import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { loginAdmin } from "./helpers";
import { mkdirSync } from "node:fs";

// Local test team code, set on the anonymous local Convex deployment (see docs/DEV.md).
const CODE = process.env.E2E_TEAM_CODE ?? "test-moncor";
const OUT = "test-results/exports";

async function join(page: Page, name: string, zone?: string) {
  await page.getByLabel("Prénom et nom").fill(name);
  if (zone) await page.getByRole("button", { name: zone, exact: true }).click();
  await page.getByRole("button", { name: "Rejoindre" }).click();
}

function item(page: Page, label: string) {
  return page.locator("li", { has: page.locator("p", { hasText: label }) });
}

async function answer(page: Page, label: string, value: string) {
  await item(page, label).getByRole("radio", { name: value, exact: true }).click();
}

async function stamp(page: Page, step: string) {
  await page.locator("li", { hasText: step }).getByRole("button", { name: "Maintenant" }).click();
}

test("full exercise with three phones, offline safety and both exports", async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const school = `École de Test ${Date.now().toString(36)}`;
  const contexts: BrowserContext[] = [];
  const newPhone = async () => {
    const ctx = await browser.newContext({ ...test.info().project.use, acceptDownloads: true });
    contexts.push(ctx);
    return ctx.newPage();
  };

  // Lead creates the exercise
  const lead = await newPhone();
  await lead.goto(`./#/?k=${CODE}`);
  await expect(lead.getByText("Nouvel exercice")).toBeVisible();
  const picker = lead.getByLabel("École", { exact: true });
  await expect(picker.or(lead.getByLabel("Nom de l'école"))).toBeVisible();
  if (await picker.isVisible()) await picker.selectOption({ label: "Autre école…" });
  await lead.getByLabel("Nom de l'école").fill(school);
  await lead.getByRole("button", { name: "Créer l'exercice du jour" }).click();
  await expect(lead.getByRole("button", { name: "Je suis l'interpellateur" })).toHaveAttribute("aria-pressed", "true");
  await join(lead, "Pierre-Alain Schütz");
  const exId = lead.url().match(/#\/x\/([^?]+)/)![1];

  await lead.getByLabel("Classe", { exact: true }).fill("5H");
  await lead.getByLabel("Enseignant·e", { exact: true }).fill("Mme Rossier");
  await lead.getByRole("button", { name: "Ailleurs", exact: true }).click();
  await lead.getByLabel("Précision sur le lieu du sinistre").fill("local technique du sous-sol");
  await lead.getByRole("button", { name: "Début", exact: true }).click();
  await expect(lead.getByText("Interpellation depuis")).toBeVisible();

  // Two observers join through the QR link (team code carried by the link)
  const joinStart = Date.now();
  const obs1 = await newPhone();
  await obs1.goto(`./#/x/${exId}?k=${CODE}`);
  await expect(obs1).not.toHaveURL(/k=/); // team code removed from the address bar
  await join(obs1, "Anne Dupont", "1er étage");
  await expect(obs1.getByText("Interpellation depuis")).toBeVisible();
  expect(Date.now() - joinStart).toBeLessThan(20_000);

  const obs2 = await newPhone();
  await obs2.goto(`./#/x/${exId}?k=${CODE}`);
  await join(obs2, "Luc Morel", "Rez");

  // Observer 1 hears the evacuation alarm: the stopwatch starts everywhere within 2 s
  await obs1.getByRole("button", { name: "J'entends l'alarme évacuation" }).click();
  await expect(lead.getByLabel("Chronomètre évacuation")).toBeVisible({ timeout: 2000 });
  await expect(obs2.getByLabel("Chronomètre évacuation")).toBeVisible({ timeout: 2000 });

  // Observations
  await answer(obs1, "Portes fermées après le passage", "Partiel");
  await answer(obs1, "Aucune porte calée", "Non");
  await item(obs1, "Aucune porte calée").getByRole("button", { name: "Commentaire" }).click();
  await item(obs1, "Aucune porte calée").getByRole("textbox").fill("Porte coupe-feu calée avec une chaise");
  await answer(obs1, "Élèves calmes", "Oui");
  // Photo on a checklist point: first use shows the privacy reminder
  await item(obs1, "Aucune porte calée").getByRole("button", { name: "Ajouter une photo" }).click();
  await expect(obs1.getByText("Jamais d'élèves identifiables.")).toBeVisible();
  const [chooser] = await Promise.all([
    obs1.waitForEvent("filechooser"),
    obs1.getByRole("button", { name: "Compris" }).click(),
  ]);
  await chooser.setFiles("public/icon-512.png");
  await expect(item(obs1, "Aucune porte calée").locator("img")).toBeVisible({ timeout: 10_000 });
  await answer(obs2, "Portes fermées après le passage", "Oui");
  // Empty-zone shortcut: remaining behaviour points become N/A, given answers are kept
  await obs2.getByRole("button", { name: /Personne dans ma zone/ }).click();
  await expect(item(obs2, "Élèves calmes").getByRole("radio", { name: "N/A", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(item(obs2, "Portes fermées après le passage").getByRole("radio", { name: "Oui", exact: true })).toHaveAttribute("aria-checked", "true");
  await answer(obs2, "Alarme évacuation audible", "Faible");
  await answer(lead, "Réaction rapide et décision adaptée", "Oui");
  await answer(lead, "Connaît le numéro des pompiers (118)", "Non");
  await answer(lead, "Local du sinistre quitté dans le calme, porte fermée", "N/A");

  // Offline safety: observer 2 loses the network, keeps typing, closes the app, comes back
  await expect(obs2.getByRole("status")).toHaveText("Synchronisé", { timeout: 10_000 });
  await obs2.context().setOffline(true);
  await answer(obs2, "Fenêtres fermées", "Non");
  await obs2.getByLabel("Remarques libres").fill("Fenêtres de la salle des maîtres restées ouvertes.");
  await expect(obs2.getByRole("status")).toHaveText("Hors ligne", { timeout: 5000 });
  await obs2.close();
  await obs2.context().setOffline(false);
  const obs2b = await obs2.context().newPage();
  await obs2b.goto(`./#/x/${exId}`);
  await expect(item(obs2b, "Fenêtres fermées").getByRole("radio", { name: "Non", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(obs2b.getByRole("status")).toHaveText("Synchronisé", { timeout: 10_000 });

  // Lead finishes the timeline; the stopwatch freezes
  await stamp(lead, "Alarme transmise aux pompiers");
  await stamp(lead, "Toutes les classes présentes");
  await stamp(lead, "Quittance aux pompiers");
  await stamp(lead, "Fin de l'exercice");
  await expect(lead.getByText(/Évacuation : \d+ s|Évacuation : \d+ min/)).toBeVisible();
  await expect(obs1.getByText(/Évacuation : /)).toBeVisible({ timeout: 2000 });
  await obs1.getByRole("button", { name: "Ma zone est évacuée" }).click();

  // Synthesis
  // A team member has no access to the synthesis, the invitation stays available
  await expect(lead.getByRole("link", { name: "Synthèse" })).toHaveCount(0);
  await expect(lead.getByRole("button", { name: "Inviter", exact: true })).toBeVisible();
  const url = lead.url();
  await lead.goto(url.replace("#/x/", "#/rapport/"));
  await expect(lead.getByText("Réservé à l'administrateur")).toBeVisible();
  // The admin has it
  await loginAdmin(lead);
  await lead.goto(url);
  await lead.getByRole("link", { name: "Synthèse" }).click();
  await expect(lead.getByRole("heading", { name: "Textes du rapport" })).toBeVisible();
  const preview = lead.getByRole("article", { name: "Aperçu du rapport" });
  await expect(preview).toContainText(`Rapport d'exercice d'évacuation : ${school}`);
  // Once in the evaluation criteria, once in the school section
  await expect(preview.getByRole("heading", { name: "Personne interpellée", exact: true })).toHaveCount(2);
  await expect(preview.getByRole("heading", { name: "Comportement dans les étages" })).toHaveCount(2);
  await expect(preview).toContainText("Rez (Luc Morel), 1er étage (Anne Dupont)");
  await expect(preview).toContainText("Quelques portes sont restées ouvertes (1er étage). En ordre : Rez.");
  await expect(preview).toContainText("Objectif");
  await expect(preview).toContainText("Plusieurs portes calées constatées.");
  await expect(preview).toContainText("« Porte coupe-feu calée avec une chaise » (Anne Dupont, 1er étage)");
  await expect(preview).toContainText("Plusieurs fenêtres sont restées ouvertes.");
  await expect(preview).toContainText("Fenêtres de la salle des maîtres restées ouvertes. (Luc Morel, Rez)");
  await expect(preview).toContainText("Numéro des pompiers (118) inconnu.");
  await expect(preview).not.toContainText("Proscrire le calage des portes");
  await lead.getByRole("button", { name: /Insérer les suggestions/ }).click();
  await expect(preview).toContainText("Proscrire le calage des portes");
  await expect(preview.getByRole("figure")).toContainText("Aucune porte calée (Anne Dupont, 1er étage)");
  await expect(lead.getByText(/points? non renseignés?/)).toBeVisible();

  await lead.getByLabel("Rédigé par").fill("Cap Pierre-Alain Schütz");

  // Text typed just before leaving the screen is saved, not dropped
  await lead.getByRole("textbox", { name: "Conclusion" }).fill("Merci à toute l'équipe de l'école.");
  await lead.getByRole("link", { name: "Retour" }).click();
  await lead.getByRole("link", { name: "Synthèse" }).click();
  await expect(lead.getByRole("textbox", { name: "Conclusion" })).toHaveText("Merci à toute l'équipe de l'école.");

  for (const [button, ext] of [
    ["Télécharger PDF", "pdf"],
    ["Télécharger Word", "docx"],
  ] as const) {
    const [download] = await Promise.all([lead.waitForEvent("download"), lead.getByRole("button", { name: button }).click()]);
    expect(download.suggestedFilename()).toMatch(new RegExp(`^\\d{4}-\\d{2}-\\d{2}_Rapport-evacuation_Ecole-de-Test-[a-z0-9]+\\.${ext}$`));
    await download.saveAs(`${OUT}/school.${ext}`);
  }

  // Day report: every exercise of today in one document
  await lead.goto(`./#/rapport/jour/${exId ? new Date().toLocaleDateString("sv-SE") : ""}`);
  await expect(lead.getByRole("article", { name: "Aperçu du rapport" })).toContainText(school);
  for (const [button, ext] of [
    ["Télécharger PDF", "pdf"],
    ["Télécharger Word", "docx"],
  ] as const) {
    const [download] = await Promise.all([lead.waitForEvent("download"), lead.getByRole("button", { name: button }).click()]);
    await download.saveAs(`${OUT}/day.${ext}`);
  }

  for (const ctx of contexts) await ctx.close();
});
