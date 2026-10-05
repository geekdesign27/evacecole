import { expect, test } from "@playwright/test";

// Field incident (Platy, 2026-10-05): a device reopened an exercise with an empty local draft and its
// first tap replaced the 12 answers already on the server. Answers must survive.
const CODE = process.env.E2E_TEAM_CODE ?? "test-moncor";
const item = (p: import("@playwright/test").Page, label: string) => p.locator("li", { has: p.locator("p", { hasText: label }) });

test("reopening an exercise with an empty draft never erases answers on the server", async ({ browser }) => {
  const p = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await p.goto(`./#/?k=${CODE}`);
  const picker = p.getByLabel("École", { exact: true });
  await expect(picker.or(p.getByLabel("Nom de l'école"))).toBeVisible();
  if (await picker.isVisible()) await picker.selectOption({ label: "Autre école…" });
  await p.getByLabel("Nom de l'école").fill(`École perte ${Date.now().toString(36)}`);
  await p.getByRole("button", { name: "Créer l'exercice du jour" }).click();
  await p.getByLabel("Prénom et nom").fill("Pierre-Alain Schütz");
  await p.getByRole("button", { name: "Rejoindre" }).click();
  const exId = p.url().match(/#\/x\/([^?]+)/)![1];
  await item(p, "Réaction rapide et décision adaptée").getByRole("radio", { name: "Partiel", exact: true }).click();
  await item(p, "Classe confiée à un·e collègue").getByRole("radio", { name: "Oui", exact: true }).click();
  await expect(p.getByRole("status")).toHaveText("Synchronisé", { timeout: 10_000 });

  // The local draft disappears (other screen, cleared storage, merged exercise…)
  await p.evaluate((id) => localStorage.removeItem(`evac:obs:${id}`), exId);
  await p.goto(`./#/x/${exId}`);
  // The draft comes back from the server: no join form, answers already there
  await expect(item(p, "Réaction rapide et décision adaptée").getByRole("radio", { name: "Partiel", exact: true })).toHaveAttribute("aria-checked", "true");

  // Even a stale empty draft pushed later cannot erase them (server merges)
  await item(p, "Information aux pompiers complète").getByRole("radio", { name: "Oui", exact: true }).click();
  await expect(p.getByRole("status")).toHaveText("Synchronisé", { timeout: 10_000 });
  await p.reload();
  for (const [label, v] of [
    ["Réaction rapide et décision adaptée", "Partiel"],
    ["Classe confiée à un·e collègue", "Oui"],
    ["Information aux pompiers complète", "Oui"],
  ]) {
    await expect(item(p, label).getByRole("radio", { name: v, exact: true })).toHaveAttribute("aria-checked", "true");
  }
});
