import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Accessibility of the live exercise screen (Lighthouse cannot reach it: it needs a joined device).
const CODE = process.env.E2E_TEAM_CODE ?? "test-moncor";

test("exercise screen has no accessibility violations", async ({ page }) => {
  test.skip(!!process.env.E2E_BASE_URL, "local only");
  await page.goto(`./#/?k=${CODE}`);
  await expect(page.getByText("Nouvel exercice")).toBeVisible();
  const picker = page.getByLabel("École", { exact: true });
  if (await picker.isVisible()) await picker.selectOption({ label: "Autre école…" });
  await page.getByLabel("Nom de l'école").fill("École a11y");
  await page.getByRole("button", { name: "Créer l'exercice du jour" }).click();
  await page.getByLabel("Prénom et nom").fill("Test Accessibilité");
  await page.getByRole("button", { name: "Rejoindre" }).click();
  await page.getByRole("button", { name: "Début", exact: true }).click();
  await expect(page.getByText("Interpellation depuis")).toBeVisible();
  for (const role of ["lead", "obs"]) {
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(violations.map((v) => `${role}: ${v.id} (${v.nodes.length}) ${v.help}`)).toEqual([]);
    if (role === "lead") await page.getByRole("button", { name: "Changer de rôle" }).click();
  }

  // Synthesis page with the rich text editors
  await page.getByRole("link", { name: "Synthèse" }).click();
  await expect(page.getByRole("toolbar", { name: "Mise en forme : Recommandations" })).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(violations.map((v) => `report: ${v.id} (${v.nodes.length}) ${v.help}`)).toEqual([]);
});
