# CLAUDE.md : evacecole (exercices d'évacuation des écoles, CP Moncor)

Spécification complète et faisant foi : [docs/SPEC.md](docs/SPEC.md).
En cas de doute, la SPEC prime. Toute évolution de la SPEC est notée ici.

## Le projet en une phrase

Web app mobile où 3 à 6 contrôleurs saisissent en direct leurs constats pendant un
exercice d'évacuation d'école, partagent le chrono en temps réel, puis génèrent un
rapport rédigé en PDF et Word.

## Stack (imposée, ne pas en dévier)

- Vite + React + TypeScript + Tailwind CSS, React Router en **HashRouter**.
- Convex (plan gratuit) : base, temps réel, file storage pour les photos. Aucun autre backend.
- GitHub Pages via GitHub Actions : `npx convex deploy` (secret `CONVEX_DEPLOY_KEY`)
  puis build Vite avec `VITE_CONVEX_URL`, `base` = `/<nom-du-repo>/`.
- PWA légère (manifest + icône). Hors ligne : seulement la non-perte (brouillon localStorage).
- Exports côté navigateur : PDF avec **pdfmake** (Roboto), Word avec **docx** (Arial).
- Tests : **Vitest** (buildReport, formats), **Playwright** (scénario 3 contextes, viewport iPhone).
- Serveurs de dev : toujours via **Portly** (projet `evacecole`, voir docs/DEV.md).

## Fichiers contrat

| Fichier | Rôle |
|---|---|
| `src/domain/checklist.ts` | Grille d'observation typée, unique source de vérité (UI, synthèse, exports) |
| `src/domain/buildReport.ts` | Fonction pure `buildReport(exercises, observations) → ReportModel` |
| `convex/schema.ts` | Contrat de données (ci-dessous) |

Toute évolution de la grille touche `checklist.ts` + `buildReport` + leurs tests, dans le même commit.

## Règles

- Français irréprochable, typographie suisse romande : guillemets « », espace insécable
  avant `: ; ! ?`, écriture inclusive avec point médian (enseignant·es).
- **Jamais de tiret cadratin ni demi-cadratin** dans l'UI, les textes du code ou les
  rapports : virgule, deux-points ou parenthèses à la place.
- Nom de l'organisation : toujours **« CP Moncor »**, jamais « Compagnie des sapeurs-pompiers Moncor »
  (textes de l'app, rapports, pieds de page, courriels, métadonnées).
- Aucun texte « style IA » (« Il est important de noter », « En résumé », superlatifs).
  Ton cpmoncor.ch : direct, sobre, humain, sans emphase.
- Le rapport n'affiche jamais de croix, flèches ou pictos : uniquement des phrases courtes.
- La grille `src/domain/checklist.ts` et `buildReport` sont le contrat : toute évolution
  touche les deux + les tests.
- Pas de données personnelles d'élèves. Photos : installations et lieux uniquement, jamais
  d'élèves identifiables (rappel affiché au premier usage de l'appareil photo).
- Chaque étape livrée doit tourner (`npm run build` et tests verts) avant la suivante.
  Commits petits et explicites.
- Commentaires de code en anglais, textes d'interface en français.
- Ergonomie terrain : cibles tactiles 48 px min, police 17 px min, une main, plein soleil
  (contrastes forts), sauvegarde automatique à chaque tap, aucun bouton « Enregistrer ».
- Heures toujours issues du serveur Convex (`Date.now()` dans la mutation).
- Formats : heures « 08h31 », durées « 6 min » ou « 6 min 12 s », date « lundi 5 octobre 2026 ».
- Secrets : `TEAM_CODE` vit dans les variables d'environnement Convex, `CONVEX_DEPLOY_KEY`
  dans les secrets GitHub. Rien dans le code, `.env.local` jamais committé.

## Contrat de données (`convex/schema.ts`)

### Tables

- **`exercises`** : `school`, `exDate` (YYYY-MM-DD), `classroom?`, `teacher?`,
  `fireLocation?` (`"classe"` | `"ailleurs"`), `fireDetail?`, `leadName?`,
  `tStart?` `tAlarm?` `tEvac?` `tPresent?` `tFiremen?` `tEnd?` (number, ms),
  `timingNotes` (record champ → texte), `report` (champs éditables du rapport),
  `archived` (bool). Index `by_date`.
- **`observations`** : `exerciseId`, `clientId` (uuid appareil, idempotence), `observer`,
  `zone?`, `role` (`"lead"` | `"obs"`), `answers` (record id → `{ v, c? }`, `v` ∈
  `ok | partial | no | na`), `remarks?`, `photos` (liste `{ storageId, itemId?, caption? }`),
  `tClear?`, `updatedAt`. Index `by_exercise`, `by_client`.
- **`schools`** : `name` (liste réutilisable, alimentée par la saisie libre).

### Fonctions

- Mutations : `exercises.create`, `exercises.stamp(id, field)` (heure serveur, ne remplace
  jamais une heure déjà posée), `exercises.setTime(id, field, value|null, note?)`,
  `exercises.update`, `exercises.archive`, `observations.upsert` (par `clientId`),
  `files.generateUploadUrl`.
- Queries : `exercises.listRecent`, `exercises.get`, `observations.byExercise` (URLs photos
  résolues), `observations.byExercises`.

### Accès

Pas de comptes. Un **code d'équipe** saisi une fois par appareil (mémorisé), vérifié
**côté serveur dans chaque fonction** contre la variable d'environnement Convex `TEAM_CODE`.

### Durées

- Durée d'évacuation = `tPresent - tEvac` (indicateur principal).
- Délai d'alarme = `tAlarm - tStart`.
- Durée totale = `tEnd - tStart`.

## Charte

`--brand #C71A1A`, `--brand-dark #9E1414`, `--brand-soft #FBEAEA`, `--ink #1A1D24`,
`--muted #6B7280`, `--line #E7E9EE`, `--bg #F4F5F7`, `--card #FFFFFF`, `--ok #1E8E3E`,
`--amber #FABA2A`. Oui = vert, Partiel = ambre, Non = rouge marque.
Polices : Saira (titres, chrono) et Roboto (texte).
Logo : fourni par PA (`logoMoncor.svg`), copié dans `public/logo.svg`.

## Plan de travail

0. CLAUDE.md + docs/SPEC.md ✔ (écarts assumés : voir docs/DEV.md)
1. Scaffold, charte, HashRouter, workflow Pages
2. Données et temps réel, code d'équipe, accueil, création, rejoindre, QR
3. Écran exercice : chrono, timeline, grille, commentaires, photos, équipe, brouillon hors ligne
4. buildReport + tests, aperçu éditable, rapport de journée (lire `docs/reference/` avant)
5. Exports PDF et Word, vérifiés en ouvrant les fichiers
6. Playwright, revue responsive, déploiement
7. README terrain + fiche papier mode dégradé
