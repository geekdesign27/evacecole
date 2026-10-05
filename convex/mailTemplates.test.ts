import { describe, expect, it } from "vitest";
import { blocksText, defaultReportMessageHtml, inviteMail, reportMail } from "./mailTemplates";

const appUrl = "https://geekdesign27.github.io/evacecole/";

describe("mail templates", () => {
  it("builds a personal invitation with the one-tap link and the fallback code", () => {
    const m = inviteMail({ firstName: "Cyril", dateLong: "lundi 5 octobre 2026", link: `${appUrl}#/?k=moncor1752&n=Cyril%20Egger`, code: "moncor1752", appUrl });
    expect(m.subject).toBe("Exercice d'évacuation du lundi 5 octobre 2026 : votre accès");
    expect(m.html).toContain("Bonjour Cyril,");
    expect(m.html).toContain(`href="${appUrl}#/?k=moncor1752&amp;n=Cyril%20Egger"`);
    expect(m.html).toContain(">moncor1752<");
    expect(m.html).toContain(`${appUrl}icon-192.png`);
    expect(m.text).toContain(`${appUrl}#/?k=moncor1752&n=Cyril%20Egger`);
    expect(m.html + m.text).not.toMatch(/[–—]/);
    expect(m.html + m.text).toContain("CP Moncor");
    expect(m.html + m.text + defaultReportMessageHtml("lundi")).not.toMatch(/Compagnie/i);
  });

  it("escapes everything: a name or a message cannot inject HTML", () => {
    const m = inviteMail({ firstName: '<img src=x onerror="alert(1)">', dateLong: "lundi", link: 'https://x/"><script>', code: "<b>", appUrl });
    expect(m.html).not.toMatch(/<img src=x|<script>|<b>/);
    const r = reportMail({
      title: "Rapport",
      dateLong: "lundi",
      message: [{ kind: "p", runs: [{ text: "<script>alert(1)</script>", bold: true }] }],
      attachments: ["a<b>.pdf"],
      appUrl,
    });
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("renders the report message with formatting and lists the attachments", () => {
    const r = reportMail({
      title: "Rapport d'exercices d'évacuation : Écoles, 5 octobre 2026",
      dateLong: "lundi 5 octobre 2026",
      message: [
        { kind: "p", runs: [{ text: "Bonjour," }] },
        { kind: "ul", items: [[{ text: "point A", underline: true }], [{ text: "point B" }]] },
      ],
      attachments: ["2026-10-05_Rapport-evacuation_Ecoles.pdf", "2026-10-05_Rapport-evacuation_Ecoles.docx"],
      appUrl,
    });
    expect(r.html).toContain("<ul");
    expect(r.html).toContain("<u>point A</u>");
    expect(r.html).toContain("2026-10-05_Rapport-evacuation_Ecoles.docx");
    expect(r.text).toContain("- point A");
    expect(blocksText([{ kind: "ol", items: [[{ text: "x" }], [{ text: "y" }]] }])).toBe("1. x\n2. y");
  });

  it("has a default end-of-day message mentioning the date", () => {
    expect(defaultReportMessageHtml("lundi 5 octobre 2026")).toContain("lundi 5 octobre 2026");
  });
});
