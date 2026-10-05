// Pure e-mail templates (HTML + plain text). Shared by the Convex mail action and the tests.
// Every dynamic value is escaped; rich text arrives as a whitelisted block structure, never as HTML.

export interface MailRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export type MailBlock =
  | { kind: "p"; runs: MailRun[] }
  | { kind: "h"; runs: MailRun[] }
  | { kind: "ul" | "ol"; items: MailRun[][] };

export interface Mail {
  subject: string;
  html: string;
  text: string;
}

const BRAND = "#C71A1A";
const INK = "#1A1D24";
const MUTED = "#5F6672";
const BG = "#F4F5F7";
const FONT = "Roboto, Helvetica, Arial, sans-serif";

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Swiss French typography in mails too: non-breaking space before « : ; ! ? » and inside guillemets. */
function typo(s: string): string {
  return s.replace(/ ([:;!?»])/g, " $1").replace(/« /g, "« ");
}

function runsHtml(runs: MailRun[]): string {
  return runs
    .map((r) => {
      if (r.text === "\n") return "<br>";
      let h = esc(typo(String(r.text ?? "")));
      if (r.underline) h = `<u>${h}</u>`;
      if (r.italic) h = `<em>${h}</em>`;
      if (r.bold) h = `<strong>${h}</strong>`;
      return h;
    })
    .join("");
}

const P = `margin:0 0 14px;font-family:${FONT};font-size:16px;line-height:1.55;color:${INK};`;

/** Whitelisted blocks to mail-safe HTML (inline styles only). */
export function blocksHtml(blocks: MailBlock[]): string {
  return (Array.isArray(blocks) ? blocks : [])
    .map((b) => {
      if (b.kind === "p") return `<p style="${P}">${runsHtml(b.runs)}</p>`;
      if (b.kind === "h")
        return `<p style="${P}font-size:17px;font-weight:700;margin-top:6px;">${runsHtml(b.runs)}</p>`;
      if (b.kind === "ul" || b.kind === "ol") {
        const tag = b.kind;
        const items = b.items
          .map((it) => `<li style="margin:0 0 6px;">${runsHtml(it)}</li>`)
          .join("");
        return `<${tag} style="${P}padding-left:22px;">${items}</${tag}>`;
      }
      return "";
    })
    .join("");
}

export function blocksText(blocks: MailBlock[]): string {
  const runs = (rs: MailRun[]) =>
    rs.map((r) => (r.text === "\n" ? "\n" : r.text)).join("");
  return (Array.isArray(blocks) ? blocks : [])
    .map((b) => {
      if (b.kind === "p" || b.kind === "h") return runs(b.runs);
      return b.items
        .map((it, i) => `${b.kind === "ol" ? `${i + 1}.` : "-"} ${runs(it)}`)
        .join("\n");
    })
    .join("\n\n");
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 22px;"><tr><td style="border-radius:12px;background:${BRAND};">
<a href="${esc(href)}" style="display:inline-block;padding:15px 28px;font-family:${FONT};font-size:17px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${esc(label)}</a>
</td></tr></table>`;
}

function layout(opts: {
  preheader: string;
  title: string;
  body: string;
  appUrl: string;
}): string {
  const logo = `${opts.appUrl.replace(/\/?$/, "/")}icon-192.png`;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BG};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:${BRAND};padding:18px 24px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
<td style="padding-right:14px;"><img src="${esc(logo)}" width="48" height="48" alt="CP Moncor" style="display:block;border-radius:24px;background:#ffffff;"></td>
<td style="font-family:${FONT};color:#ffffff;font-size:15px;line-height:1.3;font-weight:700;">Compagnie des sapeurs-pompiers Moncor<br><span style="font-weight:400;opacity:.9;">Exercices d'évacuation des écoles</span></td>
</tr></table>
</td></tr>
<tr><td style="padding:28px 24px 8px;">
<h1 style="margin:0 0 18px;font-family:${FONT};font-size:22px;line-height:1.3;color:${INK};">${esc(typo(opts.title))}</h1>
${opts.body}
</td></tr>
<tr><td style="padding:16px 24px 24px;border-top:1px solid #E7E9EE;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};">
Compagnie des sapeurs-pompiers Moncor<br><a href="https://www.cpmoncor.ch" style="color:${MUTED};">www.cpmoncor.ch</a>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** Invitation: personal one-tap link (day code + name) and the code as a fallback. */
export function inviteMail(opts: {
  firstName: string;
  dateLong: string;
  link: string;
  code: string;
  appUrl: string;
}): Mail {
  const title = `Exercice d'évacuation du ${opts.dateLong}`;
  const hello = opts.firstName.trim()
    ? `Bonjour ${opts.firstName.trim()},`
    : "Bonjour,";
  const body = [
    `<p style="${P}">${esc(hello)}</p>`,
    `<p style="${P}">${esc(typo(`Voici votre accès à l'application de saisie pour l'exercice d'évacuation du ${opts.dateLong}. Le bouton ci-dessous vous connecte directement, votre nom est déjà rempli.`))}</p>`,
    button(opts.link, "Ouvrir l'application"),
    `<p style="${P}">${esc(typo("Sur place : choisissez votre zone, touchez « Rejoindre », puis répondez aux points de votre liste. Tout est enregistré automatiquement, même sans réseau."))}</p>`,
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 18px;"><tr><td style="background:${BG};border-radius:12px;padding:14px 16px;font-family:${FONT};font-size:15px;line-height:1.5;color:${INK};">
${esc(typo("Si le bouton ne fonctionne pas, ouvrez"))} <a href="${esc(opts.appUrl)}" style="color:${BRAND};">${esc(opts.appUrl)}</a> ${esc(typo("et saisissez le code du jour :"))}<br>
<span style="display:inline-block;margin-top:8px;font-size:22px;font-weight:700;letter-spacing:2px;">${esc(opts.code)}</span>
</td></tr></table>`,
    `<p style="${P}color:${MUTED};font-size:14px;">${esc(typo("Conseil : ajoutez l'application à l'écran d'accueil de votre téléphone pour la retrouver en un geste."))}</p>`,
  ].join("\n");
  const text = [
    hello,
    "",
    `Voici votre accès à l'application de saisie pour l'exercice d'évacuation du ${opts.dateLong}.`,
    "Ce lien vous connecte directement, votre nom est déjà rempli :",
    opts.link,
    "",
    "Sur place : choisissez votre zone, touchez « Rejoindre », puis répondez aux points de votre liste.",
    "",
    `Si le lien ne fonctionne pas, ouvrez ${opts.appUrl} et saisissez le code du jour : ${opts.code}`,
    "",
    "Compagnie des sapeurs-pompiers Moncor, www.cpmoncor.ch",
  ].join("\n");
  return {
    subject: `${title} : votre accès`,
    html: layout({
      preheader: `Votre accès direct et le code du jour pour le ${opts.dateLong}.`,
      title,
      body,
      appUrl: opts.appUrl,
    }),
    text,
  };
}

/** End-of-day mail: the author's message and the report attached (PDF and Word). */
export function reportMail(opts: {
  title: string;
  dateLong: string;
  message: MailBlock[];
  attachments: string[];
  appUrl: string;
}): Mail {
  const files = opts.attachments.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 10px;"><tr><td style="background:${BG};border-radius:12px;padding:12px 16px;font-family:${FONT};font-size:14px;line-height:1.6;color:${INK};">
<strong>Pièces jointes</strong><br>${opts.attachments.map((a) => esc(a)).join("<br>")}
</td></tr></table>`
    : "";
  const body = `${blocksHtml(opts.message)}\n${files}`;
  const text = [
    blocksText(opts.message),
    "",
    opts.attachments.length
      ? `Pièces jointes : ${opts.attachments.join(", ")}`
      : "",
    "",
    "Compagnie des sapeurs-pompiers Moncor, www.cpmoncor.ch",
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");
  return {
    subject: opts.title,
    html: layout({
      preheader: `Rapport des exercices d'évacuation du ${opts.dateLong}.`,
      title: opts.title,
      body,
      appUrl: opts.appUrl,
    }),
    text,
  };
}

export function defaultReportMessageHtml(dateLong: string): string {
  return [
    "<p>Bonjour,</p>",
    `<p>Merci pour votre engagement lors des exercices d'évacuation du ${esc(dateLong)}. Vous trouverez en pièce jointe le rapport complet, en PDF et en Word (modifiable).</p>`,
    "<p>Chaque établissement y trouve le déroulement de son exercice, les points en ordre, les points à améliorer et nos recommandations. Nous restons volontiers à disposition pour en discuter.</p>",
    "<p>Avec nos meilleures salutations,</p>",
    "<p>Compagnie des sapeurs-pompiers Moncor</p>",
  ].join("");
}
