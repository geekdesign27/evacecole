// Observation grid: single source of truth for UI, report synthesis and exports.
// Any change here must be reflected in buildReport and its tests.

export type AnswerValue = "ok" | "partial" | "no" | "na";
export type Role = "lead" | "obs";

export type RecoKey =
  | "formation"
  | "liste"
  | "materiel"
  | "portes"
  | "calage"
  | "annexes"
  | "sorties"
  | "alarme"
  | "briefing";

export type SectionId =
  "reaction" | "organisation" | "comportement" | "technique";

export interface ChecklistItem {
  id: string;
  label: string;
  /** Report sentence for each value. */
  ok: string;
  partial: string;
  no: string;
  /** Recommendation triggered by "partial" or "no". */
  reco: RecoKey | null;
  allowNa?: boolean;
  /** Custom label for the "partial" button (default « Partiel »). */
  partialLabel?: string;
}

export interface ChecklistSection {
  id: SectionId;
  title: string;
  role: Role;
  items: ChecklistItem[];
}

export const SECTIONS: ChecklistSection[] = [
  {
    id: "reaction",
    title: "Réaction de la personne interpellée",
    role: "lead",
    items: [
      {
        id: "l_decision",
        label: "Réaction rapide et décision adaptée",
        ok: "Réaction rapide, décision adaptée.",
        partial:
          "Réaction hésitante, décision prise après un temps de réflexion.",
        no: "Réaction inadaptée, la procédure n'a pas été appliquée.",
        reco: "formation",
      },
      {
        id: "l_transfer",
        label: "Classe confiée à un·e collègue",
        ok: "Classe confiée à un·e collègue.",
        partial:
          "Peut mieux faire, la classe n'a pas été réellement transmise.",
        no: "Classe non confiée à un·e collègue.",
        reco: "formation",
      },
      {
        id: "l_closedoor",
        label: "Local du sinistre quitté dans le calme, porte fermée",
        ok: "Local du sinistre quitté dans le calme, porte fermée.",
        partial: "Local quitté, mais porte laissée partiellement ouverte.",
        no: "Porte du local du sinistre laissée ouverte.",
        reco: "portes",
        allowNa: true,
      },
      {
        id: "l_firealarm",
        label: "Pompiers alarmés (bouton rouge ou 118)",
        ok: "Pompiers alarmés.",
        partial: "Pompiers alarmés avec retard ou après hésitation.",
        no: "Pompiers non alarmés.",
        reco: "formation",
      },
      {
        id: "l_order",
        label: "Ordre respecté : pompiers puis évacuation",
        ok: "Ordre respecté : alarme pompiers, puis évacuation.",
        partial: "Ordre des alarmes inversé.",
        no: "Une des deux alarmes n'a pas été déclenchée.",
        reco: "formation",
      },
      {
        id: "l_evacbtn",
        label: "Alarme évacuation déclenchée",
        ok: "Alarme évacuation déclenchée.",
        partial: "Alarme évacuation déclenchée avec difficulté.",
        no: "Alarme évacuation non déclenchée.",
        reco: "formation",
      },
      {
        id: "l_118",
        label: "Connaît le numéro des pompiers (118)",
        ok: "Numéro des pompiers (118) connu.",
        partial: "Numéro des pompiers retrouvé après hésitation.",
        no: "Numéro des pompiers (118) inconnu.",
        reco: "formation",
      },
    ],
  },
  {
    id: "organisation",
    title: "Organisation et matériel",
    role: "lead",
    items: [
      {
        id: "l_list",
        label: "Liste des classes récupérée",
        ok: "Liste des classes récupérée.",
        partial: "Liste des classes trouvée avec difficulté.",
        no: "Liste des classes introuvable.",
        reco: "liste",
      },
      {
        id: "l_listok",
        label:
          "Liste des classes à jour et complète (année en cours, annexes, pavillon, salle de gym)",
        ok: "Liste des classes à jour et complète.",
        partial: "Liste des classes incomplète.",
        no: "Liste des classes obsolète.",
        reco: "liste",
      },
      {
        id: "l_gear",
        label: "Gilet et matériel d'évacuation pris",
        ok: "Gilet et matériel d'évacuation pris.",
        partial: "Matériel d'évacuation pris en partie.",
        no: "Gilet et matériel d'évacuation non pris.",
        reco: "materiel",
      },
      {
        id: "l_assembly",
        label: "Place de rassemblement connue et rejointe",
        ok: "Place de rassemblement connue et rejointe.",
        partial: "Place de rassemblement rejointe après hésitation.",
        no: "Place de rassemblement inconnue.",
        reco: "formation",
      },
      {
        id: "l_presence",
        label: "Présences et absences contrôlées",
        ok: "Présences et absences contrôlées pour toutes les classes.",
        partial: "Contrôle des présences incomplet.",
        no: "Pas de contrôle des présences.",
        reco: "liste",
      },
      {
        id: "l_brief",
        label:
          "Information aux pompiers complète (évacuation complète ou non, lieu, dangers, personnes manquantes)",
        ok: "Information aux pompiers complète.",
        partial: "Information aux pompiers incomplète.",
        no: "Pas d'information transmise aux pompiers.",
        reco: "briefing",
      },
    ],
  },
  {
    id: "comportement",
    title: "Comportement dans les étages",
    role: "obs",
    items: [
      {
        id: "o_calm_pupils",
        label: "Élèves calmes",
        ok: "Élèves calmes.",
        partial: "Élèves agités par moments.",
        no: "Élèves agités.",
        reco: null,
      },
      {
        id: "o_calm_staff",
        label: "Personnel calme",
        ok: "Personnel calme.",
        partial: "Personnel parfois hésitant.",
        no: "Personnel désorganisé.",
        reco: "formation",
      },
      {
        id: "o_procedure",
        label: "Enseignant·es connaissent la procédure",
        ok: "Procédure connue des enseignant·es.",
        partial: "Méconnaissance partielle de la procédure.",
        no: "Méconnaissance de la procédure.",
        reco: "formation",
      },
      {
        id: "o_exits",
        label: "Sorties de secours les plus proches utilisées",
        ok: "Sorties de secours les plus proches utilisées.",
        partial: "Sorties les plus proches pas toujours utilisées.",
        no: "Sorties de secours les plus proches non utilisées.",
        reco: "sorties",
      },
      {
        id: "o_doors",
        label: "Portes fermées après le passage",
        ok: "Portes fermées.",
        partial: "Quelques portes sont restées ouvertes.",
        no: "Plusieurs portes sont restées ouvertes.",
        reco: "portes",
      },
      {
        id: "o_windows",
        label: "Fenêtres fermées",
        ok: "Fenêtres fermées.",
        partial: "Quelques fenêtres sont restées ouvertes.",
        no: "Plusieurs fenêtres sont restées ouvertes.",
        reco: "portes",
      },
      {
        id: "o_nowedge",
        label: "Aucune porte calée",
        ok: "Aucune porte calée.",
        partial: "Une porte calée constatée.",
        no: "Plusieurs portes calées constatées.",
        reco: "calage",
      },
      {
        id: "o_annex",
        label: "Locaux communs contrôlés (WC, vestiaires, salles annexes)",
        ok: "Locaux communs contrôlés.",
        partial: "Locaux communs contrôlés en partie.",
        no: "Pas de contrôle des locaux communs.",
        reco: "annexes",
      },
      {
        id: "o_announce",
        label: "Enseignant·es s'annoncent au responsable d'évacuation",
        ok: "Enseignant·es annoncé·es au responsable d'évacuation.",
        partial: "Annonces au responsable d'évacuation incomplètes.",
        no: "Pas d'annonce au responsable d'évacuation.",
        reco: "liste",
      },
    ],
  },
  {
    id: "technique",
    title: "Technique",
    role: "obs",
    items: [
      {
        id: "o_audible",
        label: "Alarme évacuation audible",
        ok: "Message sonore fonctionnel et audible.",
        partial: "Intensité faible.",
        no: "Alarme évacuation non audible.",
        reco: "alarme",
        partialLabel: "Faible",
      },
      {
        id: "o_visual",
        label: "Signal lumineux fonctionnel",
        ok: "Signal lumineux fonctionnel.",
        partial: "Signal lumineux absent par endroits.",
        no: "Signal lumineux absent.",
        reco: "alarme",
        allowNa: true,
      },
      {
        id: "o_paths",
        label: "Chemins de fuite libres et dégagés",
        ok: "Chemins de fuite libres et dégagés.",
        partial: "Chemins de fuite partiellement encombrés.",
        no: "Chemins de fuite encombrés.",
        reco: "sorties",
      },
    ],
  },
];

/** Ordered as in the spec (5.5): report order of recommendations. */
export const RECOMMENDATIONS: { key: RecoKey; text: string }[] = [
  {
    key: "formation",
    text: "Renforcer la formation des enseignant·es à la procédure : confier sa classe à un·e collègue, alarmer les pompiers (bouton rouge ou 118), puis déclencher l'évacuation et rejoindre la place de rassemblement.",
  },
  {
    key: "liste",
    text: "Tenir la liste des classes à jour et disponible en tout temps, y compris annexes, pavillons et salle de gym, et organiser l'annonce systématique de chaque classe au responsable d'évacuation.",
  },
  {
    key: "materiel",
    text: "Contrôler que le gilet et le matériel d'évacuation soient complets et rangés à un emplacement connu de tous.",
  },
  {
    key: "portes",
    text: "Rappeler la fermeture des portes et fenêtres lors de l'évacuation afin de limiter la propagation du feu et des fumées.",
  },
  {
    key: "calage",
    text: "Proscrire le calage des portes : une porte calée favorise l'apport d'air et la propagation du feu et des fumées.",
  },
  {
    key: "annexes",
    text: "Intégrer le contrôle des locaux communs (WC, vestiaires, salles annexes) dans la procédure d'évacuation.",
  },
  {
    key: "sorties",
    text: "Rappeler l'utilisation des sorties de secours les plus proches et maintenir les chemins de fuite libres en tout temps.",
  },
  {
    key: "alarme",
    text: "Faire contrôler l'installation d'alarme évacuation (audibilité et signal lumineux) dans tous les locaux, y compris les bâtiments annexes.",
  },
  {
    key: "briefing",
    text: "Exercer la transmission d'informations aux pompiers à leur arrivée : évacuation complète ou non, lieu du sinistre, dangers, personnes manquantes.",
  },
];

export const ALL_ITEMS: ChecklistItem[] = SECTIONS.flatMap((s) => s.items);
export const ITEM_BY_ID: Record<string, ChecklistItem> = Object.fromEntries(
  ALL_ITEMS.map((i) => [i.id, i]),
);

export function sectionsForRole(role: Role): ChecklistSection[] {
  return SECTIONS.filter((s) => s.role === role);
}

export function itemsForRole(role: Role): ChecklistItem[] {
  return sectionsForRole(role).flatMap((s) => s.items);
}

/** Timeline steps, in chronological order. */
export const TIME_FIELDS = [
  "tStart",
  "tAlarm",
  "tEvac",
  "tPresent",
  "tFiremen",
  "tEnd",
] as const;
export type TimeField = (typeof TIME_FIELDS)[number];

export const TIME_LABELS: Record<TimeField, string> = {
  tStart: "Début : interpellation",
  tAlarm: "Alarme transmise aux pompiers",
  tEvac: "Message d'évacuation",
  tPresent: "Toutes les classes présentes",
  tFiremen: "Quittance aux pompiers",
  tEnd: "Fin de l'exercice",
};

/** Short labels used in the report facts table. */
export const TIME_REPORT_LABELS: Record<TimeField, string> = {
  tStart: "Début (interpellation)",
  tAlarm: "Alarme pompiers",
  tEvac: "Message d'évacuation",
  tPresent: "Toutes les classes présentes",
  tFiremen: "Quittance aux pompiers",
  tEnd: "Fin de l'exercice",
};

export const ZONES = [
  "Sous-sol",
  "Rez",
  "1er étage",
  "2e étage",
  "3e étage",
  "Annexe / pavillon",
  "Salle de gym",
  "Place de rassemblement",
];
