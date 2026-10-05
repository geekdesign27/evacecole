// Database side of e-mail sending (the Node action in mail.ts cannot touch the database directly).
import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { assertAdmin } from "./lib";

export const isAdmin = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    try {
      await assertAdmin(ctx, token);
      return true;
    } catch {
      return false;
    }
  },
});

/** The day code and the active participants who have an e-mail address. */
export const invitees = internalQuery({
  args: { codeId: v.id("accessCodes"), participantIds: v.optional(v.array(v.id("participants"))) },
  handler: async (ctx, { codeId, participantIds }) => {
    const code = await ctx.db.get(codeId);
    const all = await ctx.db.query("participants").collect();
    const people = all.filter(
      (p) => p.active && p.email && (!participantIds || participantIds.includes(p._id)),
    );
    return { code, people };
  },
});

export const log = internalMutation({
  args: {
    kind: v.union(v.literal("invite"), v.literal("report")),
    to: v.string(),
    subject: v.string(),
    status: v.union(v.literal("sent"), v.literal("simulated"), v.literal("error")),
    error: v.optional(v.string()),
    html: v.optional(v.string()),
    attachments: v.optional(v.array(v.string())),
  },
  handler: async (ctx, entry) => {
    await ctx.db.insert("mailLog", { ...entry, html: entry.html?.slice(0, 100_000), sentAt: Date.now() });
  },
});

export const lockExercises = internalMutation({
  args: { ids: v.array(v.id("exercises")) },
  handler: async (ctx, { ids }) => {
    for (const id of ids) if (await ctx.db.get(id)) await ctx.db.patch(id, { locked: true, lockedAt: Date.now() });
  },
});

export const deleteFiles = internalMutation({
  args: { ids: v.array(v.id("_storage")) },
  handler: async (ctx, { ids }) => {
    for (const id of ids) await ctx.storage.delete(id).catch(() => {});
  },
});

/** Admin journal: last sends, newest first. */
export const journal = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await assertAdmin(ctx, token);
    return await ctx.db.query("mailLog").withIndex("by_sentAt").order("desc").take(50);
  },
});

/** Whether real sending is configured (the password itself never leaves the server). */
export const mailMode = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await assertAdmin(ctx, token);
    const configured = !!process.env.GMAIL_APP_PASSWORD;
    const simulated = process.env.MAIL_DRY_RUN === "1" || !configured;
    return { simulated, from: process.env.GMAIL_USER ?? "schutz.pa@gmail.com" };
  },
});
