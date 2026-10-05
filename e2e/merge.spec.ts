import { expect, test, type Browser, type Page } from "@playwright/test";
import { ADMIN_PASSWORD, loginAdmin } from "./helpers";

// Reproduces the field case: the team split over two exercises created for the same school.
const CODE = process.env.E2E_TEAM_CODE ?? "test-moncor";
const item = (p: Page, label: string) => p.locator("li", { has: p.locator("p", { hasText: label }) });

async function phone(browser: Browser) {
  return (await browser.newContext({ ...test.info().project.use })).newPage();
}

async function createExercise(p: Page, school: string) {
  await p.goto(`./#/?k=${CODE}`);
  const picker = p.getByLabel("École", { exact: true });
  await expect(picker.or(p.getByLabel("Nom de l'école"))).toBeVisible();
  if (await picker.isVisible()) {
    const known = (await picker.locator("option", { hasText: school }).count()) > 0;
    if (known) await picker.selectOption({ label: school });
    else await picker.selectOption({ label: "Autre école…" });
  }
  if (await p.getByLabel("Nom de l'école").isVisible()) await p.getByLabel("Nom de l'école").fill(school);
  await p.getByRole("button", { name: "Créer l'exercice du jour" }).click();
  await expect(p.getByLabel("Prénom et nom")).toBeVisible();
  return p.url().match(/#\/x\/([^?]+)/)![1];
}

async function join(p: Page, exId: string, name: string, zone?: string) {
  await p.goto(`./#/x/${exId}`);
  await p.getByLabel("Prénom et nom").fill(name);
  if (zone) {
    await p.getByRole("button", { name: "J'observe" }).click();
    await p.getByRole("button", { name: zone, exact: true }).click();
  }
  await p.getByRole("button", { name: "Rejoindre" }).click();
}

async function photo(p: Page, label: string) {
  await item(p, label).getByRole("button", { name: "Ajouter une photo" }).click();
  const hint = p.getByRole("button", { name: "Compris" });
  const chooser = p.waitForEvent("filechooser");
  if (await hint.isVisible().catch(() => false)) await hint.click();
  await (await chooser).setFiles("public/icon-512.png");
  await expect(item(p, label).locator("img")).toBeVisible({ timeout: 10_000 });
}

test("merge two exercises created for the same school", async ({ browser }) => {
  const school = `École de Platy fusion ${Date.now().toString(36)}`;

  // Exercise A: the lead and the ground floor
  const lead = await phone(browser);
  await lead.goto(`./#/?k=${CODE}`);
  const a = await createExercise(lead, school);
  await lead.getByLabel("Prénom et nom").fill("Pierre-Alain Schütz");
  await lead.getByRole("button", { name: "Rejoindre" }).click();
  await lead.getByLabel("Classe", { exact: true }).fill("6H B");
  await lead.getByRole("button", { name: "Début", exact: true }).click();
  await item(lead, "Connaît le numéro des pompiers (118)").getByRole("radio", { name: "Non", exact: true }).click();

  const rez = await phone(browser);
  await rez.goto(`./#/?k=${CODE}`);
  await join(rez, a, "Cyril Egger", "Rez");
  await item(rez, "Portes fermées après le passage").getByRole("radio", { name: "Oui", exact: true }).click();
  await rez.getByRole("button", { name: "J'entends l'alarme évacuation" }).click();

  // Exercise B: created by mistake for the same school, the upper floors
  const first = await phone(browser);
  await first.goto(`./#/?k=${CODE}`);
  const b = await createExercise(first, school);
  await first.getByLabel("Prénom et nom").fill("Joël Pochon");
  await first.getByRole("button", { name: "J'observe" }).click();
  await first.getByRole("button", { name: "1er étage", exact: true }).click();
  await first.getByRole("button", { name: "Rejoindre" }).click();
  await item(first, "Portes fermées après le passage").getByRole("radio", { name: "Partiel", exact: true }).click();
  await first.getByLabel("Remarques libres").fill("Deux classes ont laissé la porte ouverte.");
  await photo(first, "Portes fermées après le passage");

  const second = await phone(browser);
  await second.goto(`./#/?k=${CODE}`);
  await join(second, b, "Jean-Pierre Nussbaumer", "2e étage");
  await item(second, "Aucune porte calée").getByRole("radio", { name: "Non", exact: true }).click();
  await second.getByRole("button", { name: "J'entends l'alarme évacuation" }).click();
  for (const p of [lead, rez, first, second]) await expect(p.getByRole("status")).toHaveText("Synchronisé", { timeout: 15_000 });

  // Times as they ended up in the field: A is right (6 min 4 s), B was stamped far too late (1 h 23)
  const { ConvexHttpClient } = await import("convex/browser");
  const { api } = await import("../convex/_generated/api");
  const { readFileSync } = await import("node:fs");
  const url = readFileSync(".env.local", "utf8").match(/VITE_CONVEX_URL=(\S+)/)![1];
  const client = new ConvexHttpClient(url);
  const login = await client.mutation(api.admin.login, { user: "schutz.pa", password: ADMIN_PASSWORD });
  if (!login.ok) throw new Error("admin login");
  const day = new Date();
  const at = (h: number, m: number, s = 0) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, s).getTime();
  await client.mutation(api.admin.correctExercise, {
    token: login.token,
    id: a as never,
    times: { tStart: at(9, 9), tAlarm: at(9, 12), tEvac: at(9, 12), tPresent: at(9, 18, 4), tFiremen: at(9, 19), tEnd: at(9, 19, 30) },
  });
  await client.mutation(api.admin.correctExercise, {
    token: login.token,
    id: b as never,
    times: { tStart: at(9, 8), tAlarm: at(9, 9), tEvac: at(9, 10), tPresent: at(10, 33), tFiremen: at(10, 34), tEnd: at(10, 35) },
  });

  // Admin: the group is detected, A proposed as master (shortest evacuation), merged in one tap
  const admin = await phone(browser);
  await admin.goto(`./#/?k=${CODE}`);
  await loginAdmin(admin);
  await admin.goto("./#/admin");
  const dup = admin.getByLabel("Doublons à fusionner");
  const group = dup.locator("div", { has: admin.getByText(school, { exact: false }) }).filter({ has: admin.getByRole("button", { name: "Fusionner ce groupe" }) }).last();
  const masterCard = group.locator("label", { has: admin.getByRole("radio", { checked: true }) });
  await expect(masterCard).toContainText("Maître : heures et organisation");
  await expect(masterCard).toContainText("6 min 4 s");
  await expect(masterCard).toContainText("Classe 6H B");
  await expect(group).toContainText("1 h 23 min");
  admin.on("dialog", (d) => d.accept());
  await group.getByRole("button", { name: "Fusionner ce groupe" }).click();
  await expect(admin.getByText(/Fusion faite : 1 exercice versé, 2 saisies regroupées/)).toBeVisible();

  // B is gone, A keeps its own times and organisation, and holds every person's input
  await admin.goto(`./#/x/${b}`);
  await expect(admin.getByText("Exercice introuvable.")).toBeVisible();
  await admin.goto(`./#/rapport/${a}`);
  const report = admin.getByRole("article", { name: "Aperçu du rapport" });
  await expect(report).toContainText("Rez (Cyril Egger), 1er étage (Joël Pochon), 2e étage (Jean-Pierre Nussbaumer)");
  await expect(report).toContainText("quelques portes sont restées ouvertes (1er étage)");
  await expect(report).toContainText("plusieurs portes calées constatées (2e étage)");
  await expect(report).toContainText("Numéro des pompiers (118) inconnu.");
  await expect(report).toContainText("Deux classes ont laissé la porte ouverte. (Joël Pochon, 1er étage)");
  await expect(report.getByRole("figure")).toHaveCount(1);
  await expect(report).toContainText("6H B");
  await expect(report).toContainText("6 min 4 s");
  await expect(report).toContainText("09h18");
  await expect(report).not.toContainText("10h33");

  // Admin correction of the organisation (e.g. the teacher's name)
  await admin.goto("./#/admin");
  await admin.getByRole("button", { name: `Corriger l'exercice ${school}` }).click();
  const form = admin.getByRole("form", { name: `Correction de ${school}` });
  await form.getByLabel("Enseignant·e").fill("Mme Schueler");
  await form.getByRole("button", { name: "Enregistrer la correction" }).click();
  await admin.goto(`./#/rapport/${a}`);
  await expect(report).toContainText("Mme Schueler");

  // Clean up
  await admin.goto("./#/admin");
  await admin.getByRole("button", { name: new RegExp(`Supprimer l'exercice ${school}`) }).click();
});
