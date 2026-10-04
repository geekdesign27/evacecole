import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Demo report with realistic fake data. Run on demand: DEMO=1 npx playwright test e2e/demo.spec.ts
const CODE = process.env.E2E_TEAM_CODE ?? "test-moncor";
const OUT = "test-results/demo";

type Answers = Record<string, "Oui" | "Partiel" | "Non" | "Faible" | "N/A">;

const item = (p: Page, label: string) => p.locator("li", { has: p.locator("p", { hasText: label }) });

async function fill(p: Page, answers: Answers, comments: Record<string, string> = {}) {
  for (const [label, v] of Object.entries(answers)) await item(p, label).getByRole("radio", { name: v, exact: true }).click();
  for (const [label, c] of Object.entries(comments)) {
    await item(p, label).getByRole("button", { name: "Commentaire" }).click();
    await item(p, label).getByRole("textbox").fill(c);
  }
}

test("demo report", async ({ browser }) => {
  test.skip(!process.env.DEMO, "on demand only");
  mkdirSync(OUT, { recursive: true });
  const phone = async () => (await browser.newContext({ ...test.info().project.use, acceptDownloads: true })).newPage();

  const lead = await phone();
  await lead.goto(`./#/?k=${CODE}`);
  await expect(lead.getByText("Nouvel exercice")).toBeVisible();
  const picker = lead.getByLabel("École", { exact: true });
  if (await picker.isVisible()) await picker.selectOption({ label: "Autre école…" });
  await lead.getByLabel("Nom de l'école").fill("École de Platy (démonstration)");
  await lead.getByRole("button", { name: "Créer l'exercice du jour" }).click();
  await lead.getByLabel("Prénom et nom").fill("Pierre-Alain Schütz");
  await lead.getByRole("button", { name: "Rejoindre" }).click();
  const exId = lead.url().match(/#\/x\/([^?]+)/)![1];
  await lead.getByLabel("Classe", { exact: true }).fill("6H B");
  await lead.getByLabel("Enseignant·e", { exact: true }).fill("Mme Rossier");
  await lead.getByRole("button", { name: "Dans la classe", exact: true }).click();
  await lead.getByLabel("Précision sur le lieu du sinistre").fill("fumée au fond de la classe, armoire de matériel");
  await lead.getByRole("button", { name: "Début", exact: true }).click();

  const observers = [
    { name: "Yves Sulger", zone: "Rez" },
    { name: "Cyril Egger", zone: "1er étage" },
    { name: "Joël Pochon", zone: "2e étage" },
  ];
  const obs: Page[] = [];
  for (const o of observers) {
    const p = await phone();
    await p.goto(`./#/x/${exId}?k=${CODE}`);
    await p.getByLabel("Prénom et nom").fill(o.name);
    await p.getByRole("button", { name: o.zone, exact: true }).click();
    await p.getByRole("button", { name: "Rejoindre" }).click();
    obs.push(p);
  }
  await obs[1].getByRole("button", { name: "J'entends l'alarme évacuation" }).click();

  await fill(
    lead,
    {
      "Réaction rapide et décision adaptée": "Oui",
      "Classe confiée à un·e collègue": "Partiel",
      "Local du sinistre quitté dans le calme, porte fermée": "Oui",
      "Pompiers alarmés (bouton rouge ou 118)": "Oui",
      "Ordre respecté : pompiers puis évacuation": "Oui",
      "Alarme évacuation déclenchée": "Oui",
      "Connaît le numéro des pompiers (118)": "Partiel",
      "Liste des classes récupérée": "Oui",
      "Liste des classes à jour et complète": "Partiel",
      "Gilet et matériel d'évacuation pris": "Non",
      "Place de rassemblement connue et rejointe": "Oui",
      "Présences et absences contrôlées": "Oui",
      "Information aux pompiers complète": "Partiel",
    },
    {
      "Classe confiée à un·e collègue": "Classe confiée oralement, sans vérifier que la collègue avait compris.",
      "Gilet et matériel d'évacuation pris": "Gilet introuvable, rangé dans un autre local.",
    },
  );
  await lead.getByLabel("Remarques libres").fill("Personne interpellée calme et réactive. La liste des classes ne mentionnait pas le groupe d'appui du pavillon.");

  await fill(obs[0], {
    "Élèves calmes": "Oui",
    "Personnel calme": "Oui",
    "Enseignant·es connaissent la procédure": "Oui",
    "Sorties de secours les plus proches utilisées": "Oui",
    "Portes fermées après le passage": "Oui",
    "Fenêtres fermées": "Oui",
    "Aucune porte calée": "Oui",
    "Locaux communs contrôlés (WC, vestiaires, salles annexes)": "Partiel",
    "Enseignant·es s'annoncent au responsable d'évacuation": "Oui",
    "Alarme évacuation audible": "Oui",
    "Signal lumineux fonctionnel": "N/A",
    "Chemins de fuite libres et dégagés": "Oui",
  }, { "Locaux communs contrôlés (WC, vestiaires, salles annexes)": "WC du hall non contrôlés." });

  await fill(obs[1], {
    "Élèves calmes": "Partiel",
    "Personnel calme": "Oui",
    "Enseignant·es connaissent la procédure": "Partiel",
    "Sorties de secours les plus proches utilisées": "Oui",
    "Portes fermées après le passage": "Partiel",
    "Fenêtres fermées": "Non",
    "Aucune porte calée": "Non",
    "Enseignant·es s'annoncent au responsable d'évacuation": "Oui",
    "Alarme évacuation audible": "Oui",
    "Chemins de fuite libres et dégagés": "Partiel",
  }, {
    "Aucune porte calée": "Porte coupe-feu de la cage d'escalier calée avec un coin en bois.",
    "Chemins de fuite libres et dégagés": "Chariot de matériel de bricolage dans le couloir nord.",
  });
  await obs[1].getByLabel("Remarques libres").fill("Une enseignante est retournée chercher son téléphone dans la classe.");
  await item(obs[1], "Aucune porte calée").getByRole("button", { name: "Ajouter une photo" }).click();
  const [chooser] = await Promise.all([obs[1].waitForEvent("filechooser"), obs[1].getByRole("button", { name: "Compris" }).click()]);
  await chooser.setFiles("public/icon-512.png");
  await expect(item(obs[1], "Aucune porte calée").locator("img")).toBeVisible({ timeout: 10_000 });

  await fill(obs[2], {
    "Élèves calmes": "Oui",
    "Personnel calme": "Oui",
    "Enseignant·es connaissent la procédure": "Oui",
    "Sorties de secours les plus proches utilisées": "Oui",
    "Portes fermées après le passage": "Oui",
    "Fenêtres fermées": "Oui",
    "Aucune porte calée": "Oui",
    "Locaux communs contrôlés (WC, vestiaires, salles annexes)": "Oui",
    "Alarme évacuation audible": "Faible",
    "Signal lumineux fonctionnel": "Oui",
  }, { "Alarme évacuation audible": "Peu audible dans la salle d'activités créatrices, porte fermée." });
  for (const p of obs) await p.getByRole("button", { name: "Ma zone est évacuée" }).click();

  const stamp = (step: string) => lead.locator("li", { hasText: step }).getByRole("button", { name: "Maintenant" }).click();
  await stamp("Alarme transmise aux pompiers");
  await lead.locator("li", { hasText: "Alarme transmise aux pompiers" }).getByRole("button", { name: /corriger/ }).click();
  await lead.getByLabel(/Note \(ex\./).fill("bouton rouge du hall utilisé, confirmation par le 118 sur mobile");
  await lead.getByRole("button", { name: "Valider" }).click();
  await stamp("Toutes les classes présentes");
  await stamp("Quittance aux pompiers");
  await stamp("Fin de l'exercice");
  await expect(lead.getByText(/^\d{2}:\d{2}:\d{2}$/)).toHaveCount(6, { timeout: 10_000 });
  for (const p of [lead, ...obs]) await expect(p.getByRole("status")).toHaveText("Synchronisé", { timeout: 10_000 });

  await lead.getByRole("link", { name: "Synthèse" }).click();
  await lead.getByLabel("Rédigé par").fill("Plt Pierre-Alain Schütz");
  // Formatted recommendations: a bold lead-in, then a bullet list, then the suggestions
  const reco = lead.getByRole("textbox", { name: "Recommandations" });
  const bar = lead.getByRole("toolbar", { name: "Mise en forme : Recommandations" });
  await reco.click();
  await bar.getByRole("button", { name: "Sous-titre" }).click();
  await lead.keyboard.type("Priorités pour la prochaine rentrée");
  await lead.keyboard.press("Enter");
  await lead.keyboard.type("À traiter ");
  await bar.getByRole("button", { name: "Souligné" }).click();
  await lead.keyboard.type("avant le prochain exercice");
  await bar.getByRole("button", { name: "Souligné" }).click();
  await lead.keyboard.type(" :");
  await lead.keyboard.press("Enter");
  await bar.getByRole("button", { name: "Liste à puces" }).click();
  await lead.keyboard.type("retrouver le gilet et le classeur d'évacuation au secrétariat ;");
  await lead.keyboard.press("Enter");
  await lead.keyboard.type("supprimer le coin en bois de la porte coupe-feu du 1er étage.");
  await lead.keyboard.press("Enter");
  await lead.keyboard.press("Enter");
  await lead.getByRole("button", { name: /Insérer les suggestions/ }).click();
  const preview = lead.getByRole("article", { name: "Aperçu du rapport" });
  await expect(preview.locator("h4", { hasText: "Priorités pour la prochaine rentrée" })).toBeVisible();
  await expect(preview.locator("u", { hasText: "avant le prochain exercice" })).toBeVisible();
  await lead.screenshot({ path: `${OUT}/editeur.png`, clip: await reco.locator("xpath=../..").boundingBox() ?? undefined });
  await expect(preview.locator("ul li", { hasText: "coin en bois" })).toBeVisible();
  await expect(lead.getByRole("article", { name: "Aperçu du rapport" })).toContainText("Proscrire le calage");
  for (const [button, ext] of [["Télécharger PDF", "pdf"], ["Télécharger Word", "docx"]] as const) {
    const [d] = await Promise.all([lead.waitForEvent("download"), lead.getByRole("button", { name: button }).click()]);
    await d.saveAs(`${OUT}/rapport-demo.${ext}`);
  }
});
