import { expect, test } from "@playwright/test";

// Renders the printable fallback sheet to docs/fiche-papier.pdf (Chromium print engine).
test("paper sheet prints on A4", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto("./#/fiche");
  await expect(page.getByText("Aucune porte calée")).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: "docs/fiche-papier.pdf", format: "A4", printBackground: true, preferCSSPageSize: true });
});
