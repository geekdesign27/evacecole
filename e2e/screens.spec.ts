import { expect, test } from "@playwright/test";

// Responsive review: full-page captures of the key screens on small and large devices.
const CODE = process.env.E2E_TEAM_CODE ?? "test-moncor";
const VIEWPORTS = [
  { name: "iphone-se", width: 320, height: 568 },
  { name: "android", width: 360, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
];

test("responsive captures", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto(`./#/?k=${CODE}`);
  const picker = page.getByLabel("École", { exact: true });
  await expect(picker.or(page.getByLabel("Nom de l'école"))).toBeVisible();
  await expect(page.getByText("Nouvel exercice")).toBeVisible();
  if (await picker.isVisible()) await picker.selectOption({ label: "Autre école…" });
  await page.getByLabel("Nom de l'école").fill("École de Platy");
  await page.getByRole("button", { name: "Créer l'exercice du jour" }).click();
  await page.getByLabel("Prénom et nom").fill("Pierre-Alain Schütz");
  await page.getByRole("button", { name: "Rejoindre" }).click();
  const url = page.url().replace("?lead=1", "");
  await ctx.close();

  for (const vp of VIEWPORTS) {
    for (const role of ["lead", "obs"] as const) {
      const c = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.width < 700, hasTouch: true });
      const p = await c.newPage();
      await p.goto(`${url}?k=${CODE}${role === "lead" ? "&lead=1" : ""}`);
      await p.screenshot({ path: `test-results/screens/${vp.name}-${role}-join.png`, fullPage: true });
      await p.getByLabel("Prénom et nom").fill(role === "lead" ? "Pierre-Alain Schütz" : "Anne Dupont");
      if (role === "obs") await p.getByRole("button", { name: "1er étage", exact: true }).click();
      await p.getByRole("button", { name: "Rejoindre" }).click();
      const hear = p.getByRole("button", { name: "J'entends l'alarme évacuation" });
      if (role === "obs" && (await hear.isVisible())) await hear.click();
      await p.waitForTimeout(1500);
      await p.screenshot({ path: `test-results/screens/${vp.name}-${role}.png`, fullPage: true });
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow on ${vp.name} ${role}`).toBeLessThanOrEqual(0);
      await c.close();
    }
  }
});
