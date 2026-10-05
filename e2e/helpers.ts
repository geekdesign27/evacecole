import { expect, type Page } from "@playwright/test";

// Admin password of the DEV deployment only (documented in docs/DEV.md).
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "test-admin-dev-2026";

/** Logs this browser context in as admin (session kept in localStorage), from a side tab. */
export async function loginAdmin(page: Page) {
  const tab = await page.context().newPage();
  await tab.goto("./#/admin");
  await tab.getByLabel("Mot de passe").fill(ADMIN_PASSWORD);
  await tab.getByRole("button", { name: "Se connecter" }).click();
  await expect(tab.getByRole("heading", { name: "Codes du jour" })).toBeVisible();
  await tab.close();
}
