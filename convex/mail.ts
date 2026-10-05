"use node";
// E-mail sending through Gmail SMTP (app password stored in the Convex environment).
// Without GMAIL_APP_PASSWORD, or with MAIL_DRY_RUN=1, mails are only simulated and logged.
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import nodemailer from "nodemailer";
import type { Id } from "./_generated/dataModel";
import { inviteMail, reportMail, type Mail, type MailBlock } from "./mailTemplates";
import { fixLegacyName } from "../src/domain/legacy";

const appUrl = () => process.env.APP_URL ?? "https://geekdesign27.github.io/evacecole/";
const fromAddress = () => process.env.GMAIL_USER ?? "schutz.pa@gmail.com";
const EMAIL = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]+$/;

function transport() {
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!pass || process.env.MAIL_DRY_RUN === "1") return null;
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: fromAddress(), pass },
  });
}

interface Attachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

async function deliver(to: string, mail: Mail, attachments: Attachment[] = []) {
  const t = transport();
  if (!t) return "simulated" as const;
  await t.sendMail({
    from: { name: "CP Moncor, exercices d'évacuation", address: fromAddress() },
    to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    attachments,
  });
  return "sent" as const;
}

function fmtDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${days[date.getDay()]} ${d === 1 ? "1er" : d} ${months[m - 1]} ${y}`;
}

export const sendInvites = action({
  args: {
    token: v.string(),
    codeId: v.id("accessCodes"),
    participantIds: v.optional(v.array(v.id("participants"))),
  },
  handler: async (ctx, { token, codeId, participantIds }) => {
    if (!(await ctx.runQuery(internal.mailData.isAdmin, { token }))) throw new ConvexError("Session expirée, reconnecte-toi.");
    const { code, people } = await ctx.runQuery(internal.mailData.invitees, { codeId, participantIds });
    if (!code || code.revoked) throw new ConvexError("Ce code est révoqué ou introuvable.");
    const results = { sent: 0, simulated: 0, errors: 0 };
    for (const p of people) {
      const name = `${p.firstName} ${p.lastName}`.trim();
      const link = `${appUrl()}#/?k=${encodeURIComponent(code.code)}&n=${encodeURIComponent(name)}`;
      const mail = inviteMail({ firstName: p.firstName, dateLong: fmtDateLong(code.validDate), link, code: code.code, appUrl: appUrl() });
      try {
        const status = await deliver(p.email!, mail);
        results[status]++;
        await ctx.runMutation(internal.mailData.log, { kind: "invite", to: p.email!, subject: mail.subject, status, html: mail.html });
      } catch (e) {
        results.errors++;
        await ctx.runMutation(internal.mailData.log, {
          kind: "invite",
          to: p.email!,
          subject: mail.subject,
          status: "error",
          error: e instanceof Error ? e.message.slice(0, 300) : "Erreur inconnue",
        });
      }
    }
    return results;
  },
});

export const sendReport = action({
  args: {
    token: v.string(),
    recipients: v.array(v.string()),
    title: v.string(),
    exDate: v.string(),
    message: v.array(v.any()), // whitelisted rich blocks, escaped by the template
    files: v.array(v.object({ storageId: v.id("_storage"), filename: v.string(), contentType: v.string() })),
    // Exercises in the report: their input is closed once the report has gone out.
    exerciseIds: v.optional(v.array(v.id("exercises"))),
  },
  handler: async (ctx, { token, recipients, title, exDate, message, files, exerciseIds }) => {
    if (!(await ctx.runQuery(internal.mailData.isAdmin, { token }))) throw new ConvexError("Session expirée, reconnecte-toi.");
    const to = [...new Set(recipients.map((r) => r.trim().toLowerCase()).filter(Boolean))];
    const invalid = to.filter((r) => !EMAIL.test(r));
    if (invalid.length) throw new ConvexError(`Adresse invalide : ${invalid.join(", ")}`);
    if (!to.length) throw new ConvexError("Aucun destinataire.");
    if (to.length > 60) throw new ConvexError("Trop de destinataires (60 maximum).");

    const attachments: Attachment[] = [];
    for (const f of files) {
      const blob = await ctx.storage.get(f.storageId as Id<"_storage">);
      if (!blob) throw new ConvexError(`Pièce jointe introuvable : ${f.filename}`);
      attachments.push({ filename: f.filename, content: Buffer.from(await blob.arrayBuffer()), contentType: f.contentType });
    }
    const mail = reportMail({
      title,
      dateLong: fmtDateLong(exDate),
      // Texts saved before the « CP Moncor » rename are fixed here too.
      message: (message as MailBlock[]).map((b) =>
        "runs" in b
          ? { ...b, runs: b.runs.map((r) => ({ ...r, text: fixLegacyName(String(r.text ?? "")) })) }
          : { ...b, items: b.items.map((it) => it.map((r) => ({ ...r, text: fixLegacyName(String(r.text ?? "")) }))) },
      ) as MailBlock[],
      attachments: files.map((f) => f.filename),
      appUrl: appUrl(),
    });

    // One mail per recipient: addresses stay private and a bounce does not block the others.
    const results = { sent: 0, simulated: 0, errors: 0 };
    for (const r of to) {
      try {
        const status = await deliver(r, mail, attachments);
        results[status]++;
        await ctx.runMutation(internal.mailData.log, {
          kind: "report",
          to: r,
          subject: mail.subject,
          status,
          html: mail.html,
          attachments: files.map((f) => f.filename),
        });
      } catch (e) {
        results.errors++;
        await ctx.runMutation(internal.mailData.log, {
          kind: "report",
          to: r,
          subject: mail.subject,
          status: "error",
          error: e instanceof Error ? e.message.slice(0, 300) : "Erreur inconnue",
          attachments: files.map((f) => f.filename),
        });
      }
    }
    await ctx.runMutation(internal.mailData.deleteFiles, { ids: files.map((f) => f.storageId) });
    if (exerciseIds?.length && results.sent + results.simulated > 0) {
      await ctx.runMutation(internal.mailData.lockExercises, { ids: exerciseIds });
    }
    return results;
  },
});
