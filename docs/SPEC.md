# Prompt de lancement : app « Exercices d'évacuation des écoles » (CP Moncor)

Tu es développeur senior full-stack (React, TypeScript, Convex) et tu connais le terrain : exercices d'évacuation en milieu scolaire, organisation sapeurs-pompiers de milice fribourgeoise, SST suisse. Tu construis cette application de A à Z, en autonomie, dans ce dépôt. Je suis Pierre-Alain (PA), commandant remplaçant de la Compagnie Moncor, vibecodeur : tu m'expliques les choix en clair, sans jargon inutile.

**Étape 0 obligatoire** : avant toute ligne de code, crée `CLAUDE.md` (règles du projet, sections « Règles » et « Contrat de données » ci-dessous) et `docs/SPEC.md` (copie intégrale de ce prompt). Ces deux fichiers font foi pour toute la suite.

---

## 1. Objectif

Une web app responsive, ultra simple, qui permet à 3 à 6 contrôleurs (pompiers, peu à l'aise avec le digital) de saisir en direct, chacun sur son téléphone, leurs constats pendant un exercice d'évacuation d'école, de partager en temps réel le chronométrage, puis de générer en un clic un rapport synthétique, propre et rédigé, téléchargeable en **PDF** et en **Word (.docx)** (modifiable avant envoi).

Usage réel : 3 à 4 écoles le même matin, puis d'autres écoles au fil de l'année. Un exercice dure 10 à 15 minutes. Chaque seconde de saisie compte.

## 2. Déroulement d'un exercice (le terrain)

1. L'équipe arrive à plusieurs et se répartit dans les étages et zones pour observer les comportements à chaque niveau.
2. L'**interpellateur** (souvent PA) choisit une salle de classe, note le numéro de la classe et l'enseignant·e responsable.
3. Il frappe à la porte (ou interpelle une personne dans le couloir), annonce l'exercice et un début d'incendie fictif (dans la classe ou ailleurs), puis suit la personne jusqu'au bout sans l'aider.
4. Attendu : si elle a une classe, elle la confie à un·e collègue. Si le feu est dans sa classe, elle sort calmement avec les élèves en fermant la porte, les confie à un·e collègue avec consigne de sortir dans le calme. Si le feu est ailleurs, elle confie sa classe et va organiser l'alarme.
5. Elle alarme d'abord les **pompiers** (bouton rouge d'alarme pompiers ou 118), puis presse le bouton d'**évacuation**.
6. Elle récupère la liste des classes (plaquette ou classeur), le gilet et le matériel, et rejoint la place de rassemblement.
7. À la place de rassemblement, chaque responsable de classe s'annonce (ou elle passe vers eux) : présences et absences quittancées.
8. Arrivée fictive des pompiers : elle annonce le niveau d'évacuation (complète ou non), l'emplacement du sinistre si connu, les dangers potentiels, les personnes à rechercher.
9. Fin de l'exercice quand tout le monde est dehors et que la quittance aux pompiers est faite. Remerciements.

Les **observateurs** contrôlent dans leur zone : calme des élèves et du personnel, audibilité de l'alarme, portes calées, fermeture des portes et fenêtres, usage des sorties de secours les plus proches, connaissance de la procédure par les enseignant·es, contrôle des locaux annexes au passage (WC, vestiaires), chemins de fuite.

Responsabilités à rappeler dans le rapport si défaillance : la personne responsable d'évacuation doit connaître le numéro des pompiers (118) ; la direction d'école forme ses enseignant·es, tient la liste des classes à jour et fournit le matériel adéquat.

## 3. Heures enregistrées (communes à toute l'équipe)

| Champ | Événement | Qui l'horodate |
|---|---|---|
| `tStart` | Début : interpellation | Interpellateur |
| `tAlarm` | Alarme transmise aux pompiers | Interpellateur |
| `tEvac` | Message d'évacuation déclenché | N'importe qui (le premier qui l'entend) |
| `tPresent` | Toutes les classes annoncées présentes | Interpellateur |
| `tFiremen` | Quittance aux pompiers | Interpellateur |
| `tEnd` | Fin de l'exercice, remerciements | Interpellateur |

Règles :
- Horodatage en un tap (« Maintenant »). Le premier appui gagne, mutation idempotente côté Convex (ne remplace jamais une heure déjà posée).
- Correction possible a posteriori (champ heure) + note libre par étape (ex. « le bouton ne fonctionnait pas, alarme transmise en porte-à-porte »).
- **Chronomètre central visible par tous** : avant `tEvac`, « Interpellation depuis mm:ss » ; dès `tEvac`, gros chrono rouge « Évacuation mm:ss » qui tourne jusqu'à `tPresent`, puis se fige (« Évacuation : 6 min 12 s »). C'est l'indicateur principal.
- Durées calculées : **durée d'évacuation** = `tPresent - tEvac` ; délai d'alarme = `tAlarm - tStart` ; durée totale = `tEnd - tStart`.
- Chaque observateur peut aussi horodater « Ma zone est évacuée » (`tClear` sur son observation).
- Timeline des 6 étapes avec coche verte + heure, mise à jour en temps réel chez tout le monde.
- Utiliser l'heure serveur Convex (`Date.now()` dans la mutation) pour éviter les écarts entre téléphones.

## 4. Parcours utilisateur (vitesse avant tout)

- **Accueil** : exercices du jour (cartes par école avec statut et chrono), bouton « Nouvel exercice », historique.
- **Nouvel exercice** : liste déroulante des écoles (liste configurable + saisie libre « Autre école », mémorisée), date du jour auto. 2 taps.
- **Rejoindre** (lien direct ou QR code affiché sur le téléphone de l'interpellateur) : nom et prénom (mémorisés sur l'appareil), zone (puces : Sous-sol, Rez, 1er, 2e, 3e, Annexe / pavillon, Salle de gym, Place de rassemblement, saisie libre), interrupteur « Je suis l'interpellateur » / « J'observe ». 3 taps maximum.
- **Écran exercice** :
  - bandeau collant : école, chrono central, pastille de synchronisation (vert synchronisé / orange en attente / gris hors ligne) ;
  - interpellateur : carte contexte (classe, enseignant·e, lieu du sinistre fictif « dans la classe » / « ailleurs » + précision) puis gros bouton « Début » ;
  - timeline des heures ;
  - grille de contrôle selon le rôle (section 5) : chaque point = libellé + boutons segmentés larges **Oui / Partiel / Non** (+ **N/A** si prévu), bouton 💬 commentaire (s'ouvre en ligne), bouton 📷 photo ;
  - remarques libres + photos générales ;
  - carte « Équipe » : qui est où, rôle, progression (points renseignés / total), zone évacuée ou non ;
  - bouton « Synthèse ».
- Sauvegarde automatique à chaque tap, aucun bouton « Enregistrer ». Cibles tactiles 48 px minimum, police 17 px minimum, utilisable d'une main, en plein soleil (contrastes forts).

## 5. Grille d'observation (contrat métier, à reprendre telle quelle)

Tous les points sont formulés positivement : « Oui » = conforme. Valeurs : `ok | partial | no | na`. Chaque point porte une phrase de synthèse par valeur et une clé de recommandation.

### 5.1 Interpellateur : section « Réaction de la personne interpellée »

| id | Libellé | Oui | Partiel | Non | reco |
|---|---|---|---|---|---|
| l_decision | Réaction rapide et décision adaptée | Réaction rapide, décision adaptée. | Réaction hésitante, décision prise après un temps de réflexion. | Réaction inadaptée, la procédure n'a pas été appliquée. | formation |
| l_transfer | Classe confiée à un·e collègue | Classe confiée à un·e collègue. | Peut mieux faire, la classe n'a pas été réellement transmise. | Classe non confiée à un·e collègue. | formation |
| l_closedoor (N/A possible) | Local du sinistre quitté dans le calme, porte fermée | Local du sinistre quitté dans le calme, porte fermée. | Local quitté, mais porte laissée partiellement ouverte. | Porte du local du sinistre laissée ouverte. | portes |
| l_firealarm | Pompiers alarmés (bouton rouge ou 118) | Pompiers alarmés. | Pompiers alarmés avec retard ou après hésitation. | Pompiers non alarmés. | formation |
| l_order | Ordre respecté : pompiers puis évacuation | Ordre respecté : alarme pompiers, puis évacuation. | Ordre des alarmes inversé. | Une des deux alarmes n'a pas été déclenchée. | formation |
| l_evacbtn | Alarme évacuation déclenchée | Alarme évacuation déclenchée. | Alarme évacuation déclenchée avec difficulté. | Alarme évacuation non déclenchée. | formation |
| l_118 | Connaît le numéro des pompiers (118) | Numéro des pompiers (118) connu. | Numéro des pompiers retrouvé après hésitation. | Numéro des pompiers (118) inconnu. | formation |

### 5.2 Interpellateur : section « Organisation et matériel »

| id | Libellé | Oui | Partiel | Non | reco |
|---|---|---|---|---|---|
| l_list | Liste des classes récupérée | Liste des classes récupérée. | Liste des classes trouvée avec difficulté. | Liste des classes introuvable. | liste |
| l_listok | Liste des classes à jour et complète (année en cours, annexes, pavillon, salle de gym) | Liste des classes à jour et complète. | Liste des classes incomplète. | Liste des classes obsolète. | liste |
| l_gear | Gilet et matériel d'évacuation pris | Gilet et matériel d'évacuation pris. | Matériel d'évacuation pris en partie. | Gilet et matériel d'évacuation non pris. | materiel |
| l_assembly | Place de rassemblement connue et rejointe | Place de rassemblement connue et rejointe. | Place de rassemblement rejointe après hésitation. | Place de rassemblement inconnue. | formation |
| l_presence | Présences et absences contrôlées | Présences et absences contrôlées pour toutes les classes. | Contrôle des présences incomplet. | Pas de contrôle des présences. | liste |
| l_brief | Information aux pompiers complète (évacuation complète ou non, lieu, dangers, personnes manquantes) | Information aux pompiers complète. | Information aux pompiers incomplète. | Pas d'information transmise aux pompiers. | briefing |

### 5.3 Observateurs : section « Comportement dans les étages »

| id | Libellé | Oui | Partiel | Non | reco |
|---|---|---|---|---|---|
| o_calm_pupils | Élèves calmes | Élèves calmes. | Élèves agités par moments. | Élèves agités. | - |
| o_calm_staff | Personnel calme | Personnel calme. | Personnel parfois hésitant. | Personnel désorganisé. | formation |
| o_procedure | Enseignant·es connaissent la procédure | Procédure connue des enseignant·es. | Méconnaissance partielle de la procédure. | Méconnaissance de la procédure. | formation |
| o_exits | Sorties de secours les plus proches utilisées | Sorties de secours les plus proches utilisées. | Sorties les plus proches pas toujours utilisées. | Sorties de secours les plus proches non utilisées. | sorties |
| o_doors | Portes fermées après le passage | Portes fermées. | Quelques portes sont restées ouvertes. | Plusieurs portes sont restées ouvertes. | portes |
| o_windows | Fenêtres fermées | Fenêtres fermées. | Quelques fenêtres sont restées ouvertes. | Plusieurs fenêtres sont restées ouvertes. | portes |
| o_nowedge | Aucune porte calée | Aucune porte calée. | Une porte calée constatée. | Plusieurs portes calées constatées. | calage |
| o_annex | Locaux communs contrôlés (WC, vestiaires, salles annexes) | Locaux communs contrôlés. | Locaux communs contrôlés en partie. | Pas de contrôle des locaux communs. | annexes |
| o_announce | Enseignant·es s'annoncent au responsable d'évacuation | Enseignant·es annoncé·es au responsable d'évacuation. | Annonces au responsable d'évacuation incomplètes. | Pas d'annonce au responsable d'évacuation. | liste |

### 5.4 Observateurs : section « Technique »

| id | Libellé | Oui | Partiel (libellé bouton) | Non | reco |
|---|---|---|---|---|---|
| o_audible | Alarme évacuation audible | Message sonore fonctionnel et audible. | Intensité faible. (bouton « Faible ») | Alarme évacuation non audible. | alarme |
| o_visual (N/A possible) | Signal lumineux fonctionnel | Signal lumineux fonctionnel. | Signal lumineux absent par endroits. | Signal lumineux absent. | alarme |
| o_paths | Chemins de fuite libres et dégagés | Chemins de fuite libres et dégagés. | Chemins de fuite partiellement encombrés. | Chemins de fuite encombrés. | sorties |

### 5.5 Recommandations (clé → texte)

- **formation** : Renforcer la formation des enseignant·es à la procédure : confier sa classe à un·e collègue, alarmer les pompiers (bouton rouge ou 118), puis déclencher l'évacuation et rejoindre la place de rassemblement.
- **liste** : Tenir la liste des classes à jour et disponible en tout temps, y compris annexes, pavillons et salle de gym, et organiser l'annonce systématique de chaque classe au responsable d'évacuation.
- **materiel** : Contrôler que le gilet et le matériel d'évacuation soient complets et rangés à un emplacement connu de tous.
- **portes** : Rappeler la fermeture des portes et fenêtres lors de l'évacuation afin de limiter la propagation du feu et des fumées.
- **calage** : Proscrire le calage des portes : une porte calée favorise l'apport d'air et la propagation du feu et des fumées.
- **annexes** : Intégrer le contrôle des locaux communs (WC, vestiaires, salles annexes) dans la procédure d'évacuation.
- **sorties** : Rappeler l'utilisation des sorties de secours les plus proches et maintenir les chemins de fuite libres en tout temps.
- **alarme** : Faire contrôler l'installation d'alarme évacuation (audibilité et signal lumineux) dans tous les locaux, y compris les bâtiments annexes.
- **briefing** : Exercer la transmission d'informations aux pompiers à leur arrivée : évacuation complète ou non, lieu du sinistre, dangers, personnes manquantes.

Place cette grille dans `src/domain/checklist.ts`, typée, unique source de vérité (UI, synthèse, exports).

## 6. Moteur de synthèse (le cœur de la valeur)

Le rapport n'affiche **jamais** de croix, flèches ou pictos : uniquement des phrases courtes, comme les rapports existants.

- Pour chaque point : regrouper les réponses de toutes les observations du bon rôle, ignorer `na` et non renseigné.
- Toutes identiques → la phrase de la valeur (« Fenêtres fermées. »).
- Mixtes (plusieurs zones) → phrases des valeurs non conformes suivies des zones entre parenthèses, puis « En ordre : Rez, 2e étage. » Exemple : « Quelques portes sont restées ouvertes (1er étage). En ordre : Rez, 2e étage. »
- Commentaires d'un point → sous la ligne : « texte » (Prénom Nom, zone).
- Points non renseignés : absents du rapport, mais signalés dans l'aperçu web (« 3 points non renseignés ») pour qu'on puisse compléter.
- **Remarques** : remarques libres de chacun + notes d'horodatage, toujours attribuées (Prénom Nom, zone).
- **Recommandations** : union dédoublonnée des clés `reco` des points en Partiel ou Non, ordre de la liste 5.5. Texte éditable avant export.
- **Bilan court** en tête de section école : « Évacuation complète en 6 min. 18 points en ordre, 4 points à améliorer. »
- Tout est calculé côté client par une fonction pure `buildReport(exercises, observations) → ReportModel`, testée unitairement (Vitest). Un seul modèle alimente l'aperçu HTML, le PDF et le Word.

## 7. Rapport (aperçu web, PDF, Word)

Deux modes : **rapport par école** et **rapport de journée** (sélection de plusieurs exercices d'une même date, comme les rapports 2024 et 2025 existants).

Structure (calquée sur les rapports existants, voir `docs/reference/`) :
1. En-tête : logo CP Moncor, titre « Rapport d'exercice d'évacuation : École de Platy » ou « Rapport d'exercices d'évacuation : Écoles, 5 octobre 2026 ».
2. Bloc : Objet (Évaluation des exercices d'évacuation, sécurité incendie), Date, Destinataires (éditable, défaut : Directions des établissements scolaires et responsables communaux), Rédigé par (éditable).
3. Introduction (éditable, défaut ci-dessous).
4. Par école : tableau des faits (classe interpelée, enseignant·e, lieu du sinistre fictif, début, alarme pompiers, message d'évacuation, toutes les classes présentes, quittance pompiers, fin, **durée d'évacuation**), bilan court, puis « Observations » : Réaction de la personne interpellée, Organisation et matériel, Comportement dans les étages, Technique, Remarques, Photos (vignettes légendées : point concerné, auteur, zone).
5. Recommandations (éditables).
6. Conclusion et remerciements (éditable).
7. Pied de page : Compagnie des sapeurs-pompiers Moncor, [www.cpmoncor.ch](https://www.cpmoncor.ch), page x/y.

Formats : heures « 08h31 », durées « 6 min » ou « 6 min 12 s », date « lundi 5 octobre 2026 ».

Introduction par défaut (une école) : « Le {date}, la Compagnie des sapeurs-pompiers Moncor a conduit un exercice d'évacuation à l'{école}. Objectif : vérifier la réaction du personnel face à un début d'incendie, l'application de la procédure d'évacuation et le fonctionnement des installations d'alarme. Une personne a été interpellée sans préavis, des observateurs répartis dans les étages ont suivi le comportement des classes et du personnel. »

Conclusion par défaut : « Ces exercices restent le meilleur moyen de vérifier que chacun sait quoi faire le jour où l'alarme sonne pour de vrai. Nous remercions les directions, les enseignant·es et les élèves pour leur engagement. »

Exports 100 % côté navigateur : PDF avec **pdfmake** (Roboto embarquée), Word avec **docx** (police Arial pour l'édition chez PA). Photos redimensionnées (1280 px max, JPEG 0.7) avant intégration. Nom de fichier : `2026-10-05_Rapport-evacuation_Ecole-de-Platy.pdf`. Le Word doit être proprement éditable (vrais titres, vrais tableaux, pas de zones de texte).

## 8. Stack et architecture (imposées)

- **Vite + React + TypeScript + Tailwind CSS**, React Router en **HashRouter** (GitHub Pages).
- **Convex, plan gratuit** : base, temps réel natif (queries réactives), **file storage Convex pour les photos** (`generateUploadUrl` puis `storageId`, URL via `ctx.storage.getUrl`). Pas d'autre backend.
- **Hébergement : GitHub Pages**, déploiement par GitHub Actions : `npx convex deploy` (secret `CONVEX_DEPLOY_KEY`) puis build Vite avec `VITE_CONVEX_URL`, `base` Vite = `/<nom-du-repo>/`.
- PWA légère (manifest + icône), installable sur l'écran d'accueil.
- **Hors ligne** : la saisie d'un observateur ne doit jamais être perdue. Brouillon local (localStorage) de sa propre observation, renvoyé automatiquement au retour du réseau, pastille d'état visible. Ne pas viser un offline complet, seulement la non-perte.
- Tests : Vitest pour `buildReport` et les formats ; Playwright pour un scénario complet à 3 contextes navigateurs (interpellateur + 2 observateurs, viewport iPhone) jusqu'aux deux exports.

### Contrat de données Convex (`convex/schema.ts`)

- `exercises` : `school`, `exDate` (YYYY-MM-DD), `classroom?`, `teacher?`, `fireLocation?` ("classe" | "ailleurs"), `fireDetail?`, `leadName?`, `tStart? tAlarm? tEvac? tPresent? tFiremen? tEnd?` (number ms), `timingNotes` (record champ → texte), `report` (champs éditables du rapport), `archived` (bool). Index `by_date`.
- `observations` : `exerciseId`, `clientId` (uuid appareil, idempotence), `observer`, `zone?`, `role` ("lead" | "obs"), `answers` (record id → `{ v, c? }`), `remarks?`, `photos` (liste `{ storageId, itemId?, caption? }`), `tClear?`, `updatedAt`. Index `by_exercise`, `by_client`.
- `schools` : `name` (liste réutilisable, alimentée par la saisie libre).
- Mutations : `exercises.create`, `exercises.stamp(id, field)` (heure serveur, sans écraser), `exercises.setTime(id, field, value|null, note?)`, `exercises.update`, `exercises.archive`, `observations.upsert` (par `clientId`), `files.generateUploadUrl`. Queries : `exercises.listRecent`, `exercises.get`, `observations.byExercise` (avec URLs photos résolues), `observations.byExercises`.
- **Accès** : pas de comptes. Un **code d'équipe** saisi une fois par appareil (mémorisé), vérifié **côté serveur dans chaque fonction** contre la variable d'environnement Convex `TEAM_CODE`. Pas de vraie sécurité côté client.

## 9. Design (charte CP Moncor)

- Couleurs : `--brand #C71A1A`, `--brand-dark #9E1414`, `--brand-soft #FBEAEA`, `--ink #1A1D24`, `--muted #6B7280`, `--line #E7E9EE`, `--bg #F4F5F7`, `--card #FFFFFF`, `--ok #1E8E3E`, `--amber #FABA2A`. Partiel = ambre, Non = rouge marque, Oui = vert.
- Polices : **Saira** (titres, 600 à 800, chiffres du chrono) et **Roboto** (texte), Google Fonts avec repli système.
- Logo : `logo.svg` du dépôt `geekdesign27/moncor-dashboard` (à copier dans `public/`).
- Ton de l'interface et du rapport, inspiré de cpmoncor.ch : direct, sobre, humain, sans emphase (« Quand on compose le 118, on ne cherche pas un slogan. On attend une réponse. »).

## 10. Règles (à reporter dans CLAUDE.md)

- Français irréprochable, typographie suisse romande : guillemets « », espace insécable avant `: ; ! ?`, écriture inclusive avec point médian (enseignant·es).
- **Jamais de tiret cadratin ni demi-cadratin** dans l'UI, le code de texte ou les rapports : virgule, deux-points ou parenthèses.
- Aucun texte « style IA » (« Il est important de noter », « En résumé », superlatifs).
- La grille `src/domain/checklist.ts` et `buildReport` sont le contrat : toute évolution touche les deux + les tests.
- Pas de données personnelles d'élèves. Photos : installations et lieux uniquement, jamais d'élèves identifiables (rappel affiché au premier usage de l'appareil photo).
- Chaque étape livrée doit tourner (`npm run build` et tests verts) avant la suivante. Commits petits et explicites.

## 11. Plan de travail attendu

0. `CLAUDE.md` + `docs/SPEC.md`. Tu me poses alors **uniquement** les questions bloquantes restantes.
1. Scaffold Vite/React/TS/Tailwind + Convex (`npx convex dev`), charte graphique, HashRouter, workflow GitHub Pages. Tu me guides pas à pas pour : connexion Convex, `TEAM_CODE`, `CONVEX_DEPLOY_KEY` dans les secrets GitHub, activation de Pages (source : GitHub Actions).
2. Données et temps réel : schéma, fonctions, code d'équipe, accueil, création, rejoindre, QR code.
3. Écran exercice : chrono, timeline, grille, commentaires, photos, équipe, brouillon hors ligne.
4. `buildReport` + tests, aperçu web éditable, rapport de journée.
5. Exports PDF et Word, vérifiés en ouvrant réellement les fichiers produits.
6. Scénario Playwright complet, revue responsive (iPhone SE, Android moyen, tablette), déploiement, URL finale.
7. `README.md` d'utilisation terrain (une page, pour des non-digitaux) + fiche « mode dégradé papier » imprimable reprenant la même grille, au cas où le réseau ou un téléphone lâche.

## 12. Critères d'acceptation

- Rejoindre un exercice en moins de 20 secondes depuis le QR code.
- Un tap sur « Message d'évacuation » chez un observateur fait démarrer le chrono chez tous en moins de 2 secondes.
- Couper le réseau d'un observateur pendant la saisie, le rétablir : aucune donnée perdue.
- Rapport d'une école exporté en PDF et Word, lisible, sans pictos, toutes les remarques attribuées (Prénom Nom, zone), recommandations cohérentes avec les constats.
- Rapport de journée regroupant 4 écoles en un seul document.
- Lighthouse mobile : accessibilité ≥ 90.

## 13. Références

Je dépose dans `docs/reference/` les rapports 2024 (texte) et 2025 (Word). Lis-les avant l'étape 4 : le rapport généré doit leur ressembler sur le fond et le ton, en plus structuré.
