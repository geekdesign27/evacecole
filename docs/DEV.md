# Développement

## Lancer en local

Serveurs gérés par Portly (projet `evacecole`) :

- `evacecole/convex` : `npx convex dev` en mode local anonyme (`CONVEX_AGENT_MODE=anonymous`), aucun compte requis.
- `evacecole/web` : Vite sur http://localhost:5180

Code d'équipe du backend local de test : `test-moncor` (défini avec
`CONVEX_AGENT_MODE=anonymous npx convex env set TEAM_CODE test-moncor`). Le code de production est différent
et n'est jamais écrit dans le dépôt.

## Accès

- **Codes du jour** (table `accessCodes`) : créés dans la page « Gestion » (`#/admin`), valables à une date
  (heure de Zurich), révocables. Le QR d'un exercice transmet le code du jour actif (`team.shareCode`),
  jamais le code permanent.
- **`TEAM_CODE`** (variable d'environnement Convex) : code permanent de secours, réservé à l'admin.
- **Admin** : identifiant `ADMIN_USER` (par défaut `schutz.pa`), mot de passe `ADMIN_PASSWORD`, tous deux en
  variables d'environnement Convex. Session de 30 jours, verrouillage 10 min après 5 échecs.
- Mot de passe admin du déploiement **dev** pour les tests : `test-admin-dev-2026` (jamais en production).

## Tests

- `npm test` : Vitest (`buildReport`, formats, contrat de la grille).
- `npx playwright test` : scénario complet à 3 téléphones (création, QR, chrono partagé < 2 s, coupure réseau,
  photo, synthèse, exports PDF et Word école + journée), captures responsive, génération de la fiche papier.
  Les fichiers exportés sont dans `test-results/exports/`, les captures dans `test-results/screens/`.
  Cible par défaut : http://localhost:5180 (variable `E2E_BASE_URL` pour une autre cible, `E2E_TEAM_CODE` pour le code).

- `e2e/admin.spec.ts` : connexion admin, import de participant·es, code du jour, choix du nom en un tap, révocation.
- `e2e/a11y.spec.ts` : axe (WCAG 2 AA) sur l'écran exercice, rôles interpellateur et observateur.
- Test de fumée en production (lecture seule) :
  `E2E_BASE_URL=https://geekdesign27.github.io/evacecole/ npx playwright test e2e/prod-smoke.spec.ts`

## Déploiement

URL : https://geekdesign27.github.io/evacecole/ (Convex production : `grandiose-axolotl-578`, région eu-west-1).


Push sur `main` : GitHub Actions lance les tests, `npx convex deploy` (secret `CONVEX_DEPLOY_KEY`), build Vite
avec l'URL Convex de production, publication GitHub Pages (`base` = `/evacecole/`).

Variable d'environnement Convex de production : `TEAM_CODE` (Dashboard Convex, Settings, Environment Variables).

## Écarts par rapport à la SPEC

- Table `dayReports` ajoutée : textes éditables du rapport de journée (un rapport de journée n'appartient à aucun exercice).
- `timingNotes` contient aussi des clés `<champ>__by` (« Prénom Nom, zone ») pour attribuer les notes d'horodatage.
- `exercises.stamp` accepte `clientTs` : un appui fait hors ligne et livré plus de 15 s en retard garde l'heure du téléphone.
- Le lien du QR code transporte le code du jour (`?k=`), effacé de la barre d'adresse dès sa lecture.
- Tables `participants`, `accessCodes`, `adminSessions`, `adminGuard` et page « Gestion » ajoutées le 2026-10-04 à la demande de PA.
- Couleur `--muted` foncée à `#5F6672` (contraste AA en plein soleil).
