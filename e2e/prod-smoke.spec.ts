import { expect, test } from "@playwright/test";

// Read-only smoke test of the deployed site: run with E2E_BASE_URL=https://geekdesign27.github.io/evacecole/
test("deployed site asks for the team code and rejects a wrong one", async ({ page }) => {
  test.skip(!process.env.E2E_BASE_URL, "production smoke test only");
  await page.goto("./");
  await expect(page.getByLabel("Code d'équipe")).toBeVisible();
  await page.getByLabel("Code d'équipe").fill("mauvais-code-de-test");
  await page.getByRole("button", { name: "Entrer" }).click();
  await expect(page.getByText("Code incorrect")).toBeVisible({ timeout: 10_000 });
  await page.goto("./#/fiche");
  await expect(page.getByText("Aucune porte calée")).toBeVisible();
});
