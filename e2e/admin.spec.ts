import { expect, test } from "@playwright/test";

// Admin flow on the dev deployment. Test password set with
// `npx convex env set ADMIN_PASSWORD test-admin-dev-2026` (dev deployment only).
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "test-admin-dev-2026";

test("admin creates a day code and a roster; revoking the code locks devices out", async ({ browser }) => {
  test.skip(!!process.env.E2E_BASE_URL, "local only");
  const suffix = Date.now().toString(36);
  const admin = await (await browser.newContext()).newPage();

  // Wrong password is refused, right one opens the admin page
  await admin.goto("./#/admin");
  await admin.getByLabel("Mot de passe").fill("mauvais");
  await admin.getByRole("button", { name: "Se connecter" }).click();
  await expect(admin.getByText("Identifiant ou mot de passe incorrect.")).toBeVisible();
  await admin.getByLabel("Mot de passe").fill(ADMIN_PASSWORD);
  await admin.getByRole("button", { name: "Se connecter" }).click();
  await expect(admin.getByRole("heading", { name: "Codes du jour" })).toBeVisible();

  // Roster import (fictitious people)
  await admin.getByText("Coller une liste").click();
  await admin.getByLabel("Liste à importer").fill(`Alice;Test${suffix};alice@example.ch;Observatrice\nBruno;Test${suffix};;Interpellateur`);
  await admin.getByRole("button", { name: "Importer" }).click();
  await expect(admin.getByText("2 personnes ajoutées.")).toBeVisible();

  // A code that is too short is refused; a code chosen by the admin is accepted
  await admin.getByLabel("Mon code").fill("abc");
  await admin.getByRole("button", { name: "Créer le code" }).click();
  await expect(admin.getByText("6 caractères minimum")).toBeVisible();
  const code = `jour${suffix}`;
  await admin.getByLabel("Mon code").fill(code.toUpperCase());
  await admin.getByRole("button", { name: "Créer le code" }).click();
  await expect(admin.locator("li", { hasText: code }).getByText("Actif")).toBeVisible();

  // Invitations: ready-made mail for everyone and per person
  const all = admin.getByRole("link", { name: /Un courriel à tout le monde/ });
  await expect(all).toHaveAttribute("href", /^mailto:\?bcc=alice%40example\.ch/);
  const personal = admin.locator("li", { hasText: `Alice Test${suffix}` }).getByRole("link", { name: "Envoyer par courriel" });
  const href = decodeURIComponent((await personal.getAttribute("href"))!);
  expect(href).toContain(`k=${code}&n=Alice%20Test${suffix}`);

  // Personal link: name already filled in on the join screen
  const personalLink = href.match(/https?:\/\/\S+/)![0];
  const alicePhone = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await alicePhone.goto(personalLink);
  await expect(alicePhone.getByText("Nouvel exercice")).toBeVisible();
  await expect(alicePhone).not.toHaveURL(/k=|n=/);
  await alicePhone.context().close();

  // A phone joins with the day code and picks its name in one tap
  const phone = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await phone.goto(`./#/?k=${code}`);
  await expect(phone.getByText("Nouvel exercice")).toBeVisible();
  const picker = phone.getByLabel("École", { exact: true });
  if (await picker.isVisible()) await picker.selectOption({ label: "Autre école…" });
  await phone.getByLabel("Nom de l'école").fill(`École admin ${suffix}`);
  await phone.getByRole("button", { name: "Créer l'exercice du jour" }).click();
  await phone.getByLabel("Prénom et nom").fill("");
  await phone.getByRole("button", { name: `Bruno Test${suffix}` }).click();
  await expect(phone.getByLabel("Prénom et nom")).toHaveValue(`Bruno Test${suffix}`);
  await phone.getByRole("button", { name: "Rejoindre" }).click();
  await expect(phone.getByRole("button", { name: "Début", exact: true })).toBeVisible();

  // The QR code shares the day code
  await phone.getByRole("button", { name: "Inviter (QR code)" }).click();
  await expect(phone.getByText("Aucun code du jour actif")).toHaveCount(0);
  await phone.getByRole("button", { name: "Fermer" }).click();

  // Revocation locks the phone out within seconds, with a clear message
  await admin.locator("li", { hasText: code }).getByRole("button", { name: "Révoquer" }).click();
  await expect(admin.locator("li", { hasText: code }).getByText("Révoqué")).toBeVisible();
  await expect(phone.getByText(/Code incorrect|n'est plus valable/)).toBeVisible({ timeout: 10_000 });

  // Clean up the fictitious roster
  admin.on("dialog", (d) => d.accept());
  for (const n of ["Alice", "Bruno"]) await admin.getByRole("button", { name: `Supprimer ${n} Test${suffix}` }).click();
  await expect(admin.getByText(`Test${suffix}`)).toHaveCount(0);
});
