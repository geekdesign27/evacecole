import { expect, test, type Browser, type Page } from "@playwright/test";
import { loginAdmin } from "./helpers";
import { mkdirSync } from "node:fs";
import { fmtDateLong, todayIso } from "../src/domain/format";

// Seeds a full fake morning (4 schools) on the DEV deployment, then exports the day report.
// Run on demand: SEED=1 npx playwright test e2e/seed-day.spec.ts
// On production (adds 4 exercises dated today, deletes nothing):
//   E2E_BASE_URL=https://geekdesign27.github.io/evacecole/ E2E_TEAM_CODE=<code du jour> SEED=1 npx playwright test e2e/seed-day.spec.ts
const CODE = process.env.E2E_TEAM_CODE ?? "test-moncor";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "test-admin-dev-2026";
const OUT = "test-results/seed";

type V = "Oui" | "Partiel" | "Non" | "Faible" | "N/A";
interface Person { name: string; zone?: string; answers: Record<string, V>; comments?: Record<string, string>; remarks?: string; photo?: string }
interface School { name: string; classroom: string; teacher: string; fire: "Dans la classe" | "Ailleurs"; fireDetail: string; alarmNote?: string; lead: Person; observers: Person[]; hearer: number }

const LEAD_ALL_OK: Record<string, V> = {
  "Réaction rapide et décision adaptée": "Oui",
  "Classe confiée à un·e collègue": "Oui",
  "Local du sinistre quitté dans le calme, porte fermée": "Oui",
  "Pompiers alarmés (bouton rouge ou 118)": "Oui",
  "Ordre respecté : pompiers puis évacuation": "Oui",
  "Alarme évacuation déclenchée": "Oui",
  "Connaît le numéro des pompiers (118)": "Oui",
  "Liste des classes récupérée": "Oui",
  "Liste des classes à jour et complète": "Oui",
  "Gilet et matériel d'évacuation pris": "Oui",
  "Place de rassemblement connue et rejointe": "Oui",
  "Présences et absences contrôlées": "Oui",
  "Information aux pompiers complète": "Oui",
};
const OBS_ALL_OK: Record<string, V> = {
  "Élèves calmes": "Oui",
  "Personnel calme": "Oui",
  "Enseignant·es connaissent la procédure": "Oui",
  "Sorties de secours les plus proches utilisées": "Oui",
  "Portes fermées après le passage": "Oui",
  "Fenêtres fermées": "Oui",
  "Aucune porte calée": "Oui",
  "Locaux communs contrôlés (WC, vestiaires, salles annexes)": "Oui",
  "Enseignant·es s'annoncent au responsable d'évacuation": "Oui",
  "Alarme évacuation audible": "Oui",
  "Signal lumineux fonctionnel": "Oui",
  "Chemins de fuite libres et dégagés": "Oui",
};

const SCHOOLS: School[] = [
  {
    name: "École de Cormanon",
    classroom: "4H A",
    teacher: "M. Bersier",
    fire: "Ailleurs",
    fireDetail: "local de conciergerie au sous-sol",
    lead: { name: "Pierre-Alain Schütz", answers: { ...LEAD_ALL_OK, "Local du sinistre quitté dans le calme, porte fermée": "N/A", "Information aux pompiers complète": "Partiel" }, comments: { "Information aux pompiers complète": "Personnes manquantes annoncées, mais pas le lieu du sinistre." }, remarks: "Très bonne réaction, alarme pompiers immédiate." },
    observers: [
      { name: "Cyril Egger", zone: "Rez", answers: { ...OBS_ALL_OK, "Aucune porte calée": "Partiel" }, comments: { "Aucune porte calée": "Porte du vestiaire calée avec un banc." }, photo: "Aucune porte calée" },
      { name: "Jean-Pierre Nussbaumer", zone: "1er étage", answers: { ...OBS_ALL_OK, "Fenêtres fermées": "Partiel" } },
      { name: "Yves Sulger", zone: "Place de rassemblement", answers: { "Élèves calmes": "Oui", "Personnel calme": "Oui", "Enseignant·es s'annoncent au responsable d'évacuation": "Oui" }, remarks: "Rassemblement ordonné, classes alignées par degré." },
    ],
    hearer: 0,
  },
  {
    name: "École des Rochettes",
    classroom: "7H",
    teacher: "Mme Clerc",
    fire: "Dans la classe",
    fireDetail: "fumée près du tableau interactif",
    alarmNote: "Bouton rouge du couloir hors service, alarme transmise par le 118 sur mobile.",
    lead: { name: "Pierre-Alain Schütz", answers: { ...LEAD_ALL_OK, "Classe confiée à un·e collègue": "Partiel", "Pompiers alarmés (bouton rouge ou 118)": "Partiel", "Gilet et matériel d'évacuation pris": "Non" }, comments: { "Gilet et matériel d'évacuation pris": "Gilet rangé dans le local des maîtres, fermé à clé." } },
    observers: [
      { name: "Joël Pochon", zone: "Rez", answers: { ...OBS_ALL_OK, "Locaux communs contrôlés (WC, vestiaires, salles annexes)": "Non" }, comments: { "Locaux communs contrôlés (WC, vestiaires, salles annexes)": "WC filles et garçons non contrôlés." } },
      { name: "Cyril Egger", zone: "1er étage", answers: { ...OBS_ALL_OK, "Portes fermées après le passage": "Non", "Élèves calmes": "Partiel" }, remarks: "Trois classes ont laissé la porte ouverte en partant.", photo: "Portes fermées après le passage" },
      { name: "Yves Sulger", zone: "2e étage", answers: { ...OBS_ALL_OK, "Alarme évacuation audible": "Faible" }, comments: { "Alarme évacuation audible": "Peu audible au fond du couloir est." } },
    ],
    hearer: 2,
  },
  {
    name: "École de Platy",
    classroom: "6H B",
    teacher: "Mme Rossier",
    fire: "Dans la classe",
    fireDetail: "armoire de matériel au fond de la classe",
    lead: { name: "Pierre-Alain Schütz", answers: { ...LEAD_ALL_OK, "Connaît le numéro des pompiers (118)": "Partiel", "Liste des classes à jour et complète": "Partiel" }, comments: { "Liste des classes à jour et complète": "Le groupe d'appui du pavillon manque sur la liste." }, remarks: "Personne interpellée calme, a bien fermé la porte du local." },
    observers: [
      { name: "Jean-Pierre Nussbaumer", zone: "Rez", answers: OBS_ALL_OK },
      { name: "Joël Pochon", zone: "1er étage", answers: { ...OBS_ALL_OK, "Aucune porte calée": "Non", "Chemins de fuite libres et dégagés": "Partiel" }, comments: { "Aucune porte calée": "Porte coupe-feu de la cage d'escalier calée avec un coin en bois.", "Chemins de fuite libres et dégagés": "Chariot de bricolage dans le couloir nord." }, photo: "Aucune porte calée" },
      { name: "Yves Sulger", zone: "Annexe / pavillon", answers: { ...OBS_ALL_OK, "Signal lumineux fonctionnel": "N/A", "Enseignant·es connaissent la procédure": "Partiel" }, remarks: "Le pavillon a évacué une minute après le bâtiment principal." },
    ],
    hearer: 1,
  },
  {
    name: "École de Villars-Vert",
    classroom: "2H",
    teacher: "Mme Aebischer",
    fire: "Ailleurs",
    fireDetail: "salle de gym, local des engins",
    lead: { name: "Pierre-Alain Schütz", answers: { ...LEAD_ALL_OK, "Réaction rapide et décision adaptée": "Partiel", "Ordre respecté : pompiers puis évacuation": "Partiel", "Local du sinistre quitté dans le calme, porte fermée": "N/A" }, comments: { "Ordre respecté : pompiers puis évacuation": "Évacuation déclenchée avant l'appel aux pompiers." } },
    observers: [
      { name: "Cyril Egger", zone: "Rez", answers: OBS_ALL_OK },
      { name: "Jean-Pierre Nussbaumer", zone: "Salle de gym", answers: { ...OBS_ALL_OK, "Sorties de secours les plus proches utilisées": "Non", "Alarme évacuation audible": "Non" }, comments: { "Alarme évacuation audible": "Aucun signal sonore dans la salle de gym." }, remarks: "Le cours de gym a continué une minute, l'enseignant n'avait rien entendu.", photo: "Alarme évacuation audible" },
    ],
    hearer: 0,
  },
];

const item = (p: Page, label: string) => p.locator("li", { has: p.locator("p", { hasText: label }) });

async function phone(browser: Browser) {
  return (await browser.newContext({ ...test.info().project.use, acceptDownloads: true })).newPage();
}

async function answerAll(p: Page, person: Person) {
  for (const [label, v] of Object.entries(person.answers)) await item(p, label).getByRole("radio", { name: v, exact: true }).click();
  for (const [label, c] of Object.entries(person.comments ?? {})) {
    await item(p, label).getByRole("button", { name: "Commentaire" }).click();
    await item(p, label).getByRole("textbox").fill(c);
  }
  if (person.remarks) await p.getByLabel("Remarques libres").fill(person.remarks);
  if (person.photo) {
    await item(p, person.photo).getByRole("button", { name: "Ajouter une photo" }).click();
    const hint = p.getByRole("button", { name: "Compris" });
    const [chooser] = await Promise.all([p.waitForEvent("filechooser"), hint.click()]);
    await chooser.setFiles("public/icon-512.png");
    await expect(item(p, person.photo).locator("img")).toBeVisible({ timeout: 10_000 });
  }
}

test("seed a fake morning of 4 schools and export the day report", async ({ browser }) => {
  test.skip(!process.env.SEED, "on demand only");
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });

  // 1. Clean today's test exercises, on the dev deployment only (never on production)
  const onDev = !process.env.E2E_BASE_URL;
  if (onDev) {
  const admin = await phone(browser);
  await admin.goto("./#/admin");
  await admin.getByLabel("Mot de passe").fill(ADMIN_PASSWORD);
  await admin.getByRole("button", { name: "Se connecter" }).click();
  await expect(admin.getByRole("heading", { name: "Exercices" })).toBeVisible();
  admin.on("dialog", (d) => d.accept());
  // Same wording as the app (fmtDateLong): « dimanche 4 octobre 2026 »
  const today = fmtDateLong(todayIso());
  for (;;) {
    const del = admin.getByRole("button", { name: new RegExp(`Supprimer l'exercice .* du ${today}`) }).first();
    if (!(await del.count())) break;
    await del.click();
    await admin.waitForTimeout(300);
  }
  }

  // 2. One exercise per school, lead + observers on separate phones
  for (const school of SCHOOLS) {
    const lead = await phone(browser);
    await lead.goto(`./#/?k=${CODE}`);
    await expect(lead.getByText("Nouvel exercice")).toBeVisible();
    const picker = lead.getByLabel("École", { exact: true });
    await expect(picker.or(lead.getByLabel("Nom de l'école"))).toBeVisible();
    const exists = (await picker.isVisible()) && (await picker.locator("option", { hasText: school.name }).count()) > 0;
    if (exists) await picker.selectOption({ label: school.name });
    else {
      if (await picker.isVisible()) await picker.selectOption({ label: "Autre école…" });
      await lead.getByLabel("Nom de l'école").fill(school.name);
    }
    await lead.getByRole("button", { name: "Créer l'exercice du jour" }).click();
    await lead.getByLabel("Prénom et nom").fill(school.lead.name);
    await lead.getByRole("button", { name: "Rejoindre" }).click();
    const exId = lead.url().match(/#\/x\/([^?]+)/)![1];
    await lead.getByLabel("Classe", { exact: true }).fill(school.classroom);
    await lead.getByLabel("Enseignant·e", { exact: true }).fill(school.teacher);
    await lead.getByRole("button", { name: school.fire, exact: true }).click();
    await lead.getByLabel("Précision sur le lieu du sinistre").fill(school.fireDetail);
    await lead.getByRole("button", { name: "Début", exact: true }).click();

    const obs: Page[] = [];
    for (const o of school.observers) {
      const p = await phone(browser);
      await p.goto(`./#/x/${exId}?k=${CODE}`);
      await p.getByLabel("Prénom et nom").fill(o.name);
      await p.getByRole("button", { name: o.zone!, exact: true }).click();
      await p.getByRole("button", { name: "Rejoindre" }).click();
      obs.push(p);
    }
    const stamp = (step: string) => lead.locator("li", { hasText: step }).getByRole("button", { name: "Maintenant" }).click();
    await stamp("Alarme transmise aux pompiers");
    if (school.alarmNote) {
      await expect(lead.locator("li", { hasText: "Alarme transmise aux pompiers" }).getByText(/^\d{2}:\d{2}:\d{2}$/)).toBeVisible();
      await lead.locator("li", { hasText: "Alarme transmise aux pompiers" }).getByRole("button", { name: /corriger/ }).click();
      await lead.getByLabel(/Note \(ex\./).fill(school.alarmNote);
      await lead.getByRole("button", { name: "Valider" }).click();
    }
    await obs[school.hearer].getByRole("button", { name: "J'entends l'alarme évacuation" }).click();

    await answerAll(lead, school.lead);
    for (const [i, o] of school.observers.entries()) {
      await answerAll(obs[i], o);
      await obs[i].getByRole("button", { name: "Ma zone est évacuée" }).click();
    }
    await stamp("Toutes les classes présentes");
    await stamp("Quittance aux pompiers");
    await stamp("Fin de l'exercice");
    await expect(lead.getByText(/^\d{2}:\d{2}:\d{2}$/)).toHaveCount(6, { timeout: 10_000 });
    for (const p of [lead, ...obs]) await expect(p.getByRole("status")).toHaveText("Synchronisé", { timeout: 15_000 });
    for (const p of [lead, ...obs]) await p.context().close();
  }

  // 3. Day report with all four schools, both exports
  const writer = await phone(browser);
  await writer.goto(`./#/?k=${CODE}`);
  await loginAdmin(writer);
  await writer.reload();
  await writer.getByRole("link", { name: "Rapport de la journée" }).click();
  const preview = writer.getByRole("article", { name: "Aperçu du rapport" });
  for (const s of SCHOOLS) await expect(preview).toContainText(s.name);
  await writer.getByLabel("Rédigé par").fill("Plt Pierre-Alain Schütz");
  await writer.getByRole("button", { name: /Insérer les suggestions/ }).click();
  for (const [button, ext] of [["Télécharger PDF", "pdf"], ["Télécharger Word", "docx"]] as const) {
    const [d] = await Promise.all([writer.waitForEvent("download"), writer.getByRole("button", { name: button }).click()]);
    await d.saveAs(`${OUT}/rapport-journee.${ext}`);
  }
});
