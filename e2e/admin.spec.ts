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

  // Personal link (as sent in the invitation): code and name filled in, then removed from the address bar
  const alicePhone = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await alicePhone.goto(`./#/?k=${code}&n=${encodeURIComponent(`Alice Test${suffix}`)}`);
  await expect(alicePhone.getByText("Nouvel exercice")).toBeVisible();
  await expect(alicePhone).not.toHaveURL(/k=|n=/);
  await alicePhone.context().close();

  // A phone joins with the day code and picks its name in one tap
  const phone = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await phone.goto(`./#/?k=${code}`);
  await expect(phone.getByText("Nouvel exercice")).toBeVisible();
  const picker = phone.getByLabel("École", { exact: true });
  await expect(picker.or(phone.getByLabel("Nom de l'école"))).toBeVisible();
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

  // Edit a participant's e-mail
  admin.on("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: `Modifier Bruno Test${suffix}` }).click();
  await admin.getByLabel("Courriel").first().fill("bruno@example.ch");
  await admin.getByRole("button", { name: "Enregistrer" }).click();
  await expect(admin.locator("li", { hasText: `Bruno Test${suffix}` }).getByText("Interpellateur · bruno@example.ch")).toBeVisible();

  // Automatic invitations (simulated on the dev deployment) and the journal with a preview
  await expect(admin.getByText("Mode simulation").first()).toBeVisible();
  await admin.getByRole("button", { name: /Envoyer les invitations à tout le monde/ }).click();
  await expect(admin.getByText(/simulés?/).first()).toBeVisible({ timeout: 20_000 });
  const journal = admin.locator("section", { has: admin.getByRole("heading", { name: "Journal des courriels" }) });
  await expect(journal.getByText("alice@example.ch").first()).toBeVisible();
  await expect(journal.getByText("bruno@example.ch").first()).toBeVisible();
  await journal.getByRole("button", { name: "Aperçu" }).first().click();
  const mail = admin.frameLocator('iframe[title="Aperçu du courriel"]');
  await expect(mail.getByRole("link", { name: "Ouvrir l'application" })).toHaveAttribute("href", new RegExp(`k=${code}&n=`));
  await expect(mail.getByText(code, { exact: true })).toBeVisible();
  await admin.getByRole("button", { name: "Fermer" }).click();

  // End-of-day report mail with PDF and Word attached
  await admin.locator("li", { hasText: code }).getByRole("button", { name: "Utiliser sur ce téléphone" }).click();
  await admin.goto(`./#/x/${phone.url().match(/#\/x\/([^?]+)/)![1]}`);
  await admin.goto(admin.url().replace("#/x/", "#/rapport/"));
  await expect(admin.getByRole("heading", { name: "Envoyer le rapport par courriel" })).toBeVisible();
  await admin.getByLabel("Autres destinataires (directions, commune…)").fill("direction@example.ch");
  // alice@, bruno@ and direction@ (duplicates of earlier runs are sent once)
  await admin.getByRole("button", { name: "Envoyer le rapport (3 destinataires)" }).click();
  await expect(admin.getByText("3 simulés")).toBeVisible({ timeout: 60_000 });
  await admin.goto("./#/admin");
  await expect(journal.getByText("direction@example.ch").first()).toBeVisible();
  await expect(journal.locator("li", { hasText: "direction@example.ch" }).first()).toContainText("2 pièces jointes");

  // Admin device: delete button on the home cards
  await admin.goto("./#/");
  await expect(admin.getByRole("button", { name: `Supprimer l'exercice École admin ${suffix}` })).toBeVisible();

  await admin.goto("./#/admin");
  // Revocation locks the phone out within seconds, with a clear message
  await admin.locator("li", { hasText: code }).getByRole("button", { name: "Révoquer" }).click();
  await expect(admin.locator("li", { hasText: code }).getByText("Révoqué")).toBeVisible();
  await expect(phone.getByText(/Code incorrect|n'est plus valable/)).toBeVisible({ timeout: 10_000 });

  // Clean up the fictitious roster
  for (const n of ["Alice", "Bruno"]) await admin.getByRole("button", { name: `Supprimer ${n} Test${suffix}` }).click();
  await expect(admin.getByText(`Test${suffix}`)).toHaveCount(0);
});
