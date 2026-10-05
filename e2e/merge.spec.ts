import { expect, test, type Browser, type Page } from "@playwright/test";
import { loginAdmin } from "./helpers";

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

  // Admin: the pair is detected and previewed
  const admin = await phone(browser);
  await admin.goto(`./#/?k=${CODE}`);
  await loginAdmin(admin);
  await admin.goto("./#/admin");
  await expect(admin.getByText("Deux exercices existent pour la même école le même jour.")).toBeVisible();
  await admin.getByRole("button", { name: "Fusionner deux exercices" }).click();
  await admin.getByLabel("A, l'exercice gardé").selectOption(a);
  await admin.getByLabel("B, versé dans A puis supprimé").selectOption(b);
  const preview = admin.getByLabel("Aperçu de la fusion");
  await expect(preview).toContainText("Pierre-Alain Schütz (interpellateur), Cyril Egger (Rez)");
  await expect(preview).toContainText("Joël Pochon (1er étage), Jean-Pierre Nussbaumer (2e étage) (1 photo)");
  admin.on("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: "Fusionner", exact: true }).click();
  await expect(admin.getByText("Fusion faite : 2 saisies déplacées.")).toBeVisible();

  // B is gone, A's report holds the four people, the photo and the merged answers
  await admin.goto(`./#/x/${b}`);
  await expect(admin.getByText("Exercice introuvable.")).toBeVisible();
  await admin.goto(`./#/rapport/${a}`);
  const report = admin.getByRole("article", { name: "Aperçu du rapport" });
  await expect(report).toContainText("Rez (Cyril Egger), 1er étage (Joël Pochon), 2e étage (Jean-Pierre Nussbaumer)");
  await expect(report).toContainText("Quelques portes sont restées ouvertes (1er étage). En ordre : Rez.");
  await expect(report).toContainText("Plusieurs portes calées constatées.");
  await expect(report).toContainText("Numéro des pompiers (118) inconnu.");
  await expect(report).toContainText("Deux classes ont laissé la porte ouverte. (Joël Pochon, 1er étage)");
  await expect(report.getByRole("figure")).toHaveCount(1);
  await expect(report).toContainText("6H B");

  // Clean up
  await admin.goto("./#/admin");
  await admin.getByRole("button", { name: new RegExp(`Supprimer l'exercice ${school}`) }).click();
});
