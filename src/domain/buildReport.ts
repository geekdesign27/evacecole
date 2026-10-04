// Pure report synthesis: one ReportModel feeds the web preview, the PDF and the Word export.
// No icons, no symbols: only short sentences, like the existing CP Moncor reports.

import {
  ITEM_BY_ID,
  RECOMMENDATIONS,
  SECTIONS,
  TIME_FIELDS,
  TIME_REPORT_LABELS,
  ZONES,
  type AnswerValue,
  type ChecklistItem,
  type RecoKey,
  type Role,
  type TimeField,
} from "./checklist";
import { escapeHtml, isRichEmpty } from "./rich";
import {
  fmtDateLong,
  fmtDateShort,
  fmtDuration,
  fmtTime,
  withLocativeArticle,
} from "./format";

export interface ExerciseInput {
  _id: string;
  school: string;
  exDate: string;
  classroom?: string;
  teacher?: string;
  fireLocation?: "classe" | "ailleurs";
  fireDetail?: string;
  leadName?: string;
  tStart?: number;
  tAlarm?: number;
  tEvac?: number;
  tPresent?: number;
  tFiremen?: number;
  tEnd?: number;
  timingNotes: Record<string, string>;
  report: Record<string, string>;
}

export interface ObservationInput {
  exerciseId: string;
  observer: string;
  zone?: string;
  role: Role;
  answers: Record<string, { v?: AnswerValue; c?: string }>;
  remarks?: string;
  photos: {
    storageId: string;
    itemId?: string;
    caption?: string;
    url?: string | null;
  }[];
  tClear?: number;
}

/** Editable report fields (stored on the exercise or on the day report). */
export interface ReportFields {
  object?: string;
  recipients?: string;
  author?: string;
  intro?: string;
  objective?: string;
  criteria?: string;
  conclusion?: string;
  /** Free text written by the report author, one paragraph per line. */
  recommendations?: string;
}

export interface ReportLine {
  text: string;
  comments: string[];
}

export interface ReportPhoto {
  url: string;
  caption: string;
}

/**
 * One compiled topic of the report (« Personne interpellée », « Comportement dans les étages »,
 * « Technique »): answers of the whole team merged point by point.
 */
export interface ReportGroup {
  title: string;
  /** Points to improve (with the zones concerned), and points carrying a comment. */
  issues: ReportLine[];
  /** Compliant points without comment, printed as one run-in paragraph. */
  ok: string[];
}

export interface SchoolReport {
  exerciseId: string;
  school: string;
  facts: { label: string; value: string }[];
  /** Notes typed on the timeline (« Alarme pompiers : bouton défectueux… »). */
  timingNotes: string[];
  summary: string;
  /** « Rez (Cyril Egger), 1er étage (Jean-Pierre Nussbaumer) » */
  zonesObserved: string;
  groups: ReportGroup[];
  remarks: string[];
  photos: ReportPhoto[];
  okCount: number;
  issueCount: number;
  /** Items with no answer at all: shown in the web preview only. */
  missing: { itemId: string; label: string; role: Role }[];
  recoKeys: RecoKey[];
}

export interface ReportModel {
  mode: "school" | "day";
  title: string;
  exDate: string;
  dateLong: string;
  object: string;
  recipients: string;
  author: string;
  intro: string;
  objective: string;
  /** Evaluation criteria (rich text), pre-filled from the checklist. */
  criteria: string;
  conclusion: string;
  schools: SchoolReport[];
  /** Rich text (HTML) or plain text from the author; empty means no recommendation section. */
  recommendations: string;
  /** Suggestions deduced from Partial/No answers, offered in the editor. */
  suggestedRecommendations: string[];
  missingCount: number;
}

export const DEFAULT_OBJECT =
  "Évaluation des exercices d'évacuation, sécurité incendie";
export const DEFAULT_RECIPIENTS =
  "Directions des établissements scolaires et responsables communaux";
export const DEFAULT_CONCLUSION =
  "Ces exercices restent le meilleur moyen de vérifier que chacun sait quoi faire le jour où l'alarme sonne pour de vrai. Nous remercions les directions, les enseignant·es et les élèves pour leur engagement.";

export const DEFAULT_OBJECTIVE =
  "Vérifier la réaction du personnel face à un début d'incendie, l'application de la procédure d'évacuation et le fonctionnement des installations d'alarme.";

export function defaultIntro(
  mode: "school" | "day",
  exDate: string,
  schools: string[],
): string {
  const date = fmtDateLong(exDate);
  if (mode === "school" || schools.length <= 1) {
    return `Le ${date}, la Compagnie des sapeurs-pompiers Moncor a conduit un exercice d'évacuation ${withLocativeArticle(schools[0] ?? "")}. Une personne a été interpellée sans préavis, des observateurs répartis dans les étages ont suivi le comportement des classes et du personnel.`;
  }
  return `Le ${date}, la Compagnie des sapeurs-pompiers Moncor a conduit des exercices d'évacuation dans les établissements suivants : ${joinFr(schools)}. Dans chaque établissement, une personne a été interpellée sans préavis, des observateurs répartis dans les étages ont suivi le comportement des classes et du personnel.`;
}

/** « A, B et C » */
export function joinFr(list: string[]): string {
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} et ${list[list.length - 1]}`;
}

/** « (Prénom Nom, zone) » */
export function attribution(o: { observer: string; zone?: string }): string {
  const who = o.observer.trim() || "Observateur·rice";
  return o.zone?.trim() ? `(${who}, ${o.zone.trim()})` : `(${who})`;
}

function zoneLabel(o: ObservationInput): string {
  return o.zone?.trim() || o.observer.trim() || "zone non précisée";
}

function uniq<T>(list: T[]): T[] {
  return [...new Set(list)];
}

function sentence(item: ChecklistItem, v: Exclude<AnswerValue, "na">): string {
  return item[v];
}

/** Strips a trailing period so zones can be appended: « Portes ouvertes (1er étage). » */
function withZones(text: string, zones: string[]): string {
  const base = text.replace(/\.\s*$/, "");
  return `${base} (${zones.join(", ")}).`;
}

export interface ItemSynthesis {
  line: ReportLine | null;
  status: "ok" | "issue" | "na" | "missing";
}

export function synthesizeItem(
  item: ChecklistItem,
  observations: ObservationInput[],
  label: (o: ObservationInput) => string = zoneLabel,
): ItemSynthesis {
  const answered = observations.filter((o) => o.answers[item.id]?.v);
  const comments = observations
    .filter((o) => o.answers[item.id]?.c?.trim())
    .map((o) => `« ${o.answers[item.id]!.c!.trim()} » ${attribution(o)}`);

  const real = answered.filter((o) => o.answers[item.id]!.v !== "na");
  if (real.length === 0) {
    if (answered.length > 0) {
      // Only N/A: not a missing point, but comments still deserve a line.
      return {
        line: comments.length ? { text: "Sans objet.", comments } : null,
        status: "na",
      };
    }
    return {
      line: comments.length ? { text: "Non évalué.", comments } : null,
      status: "missing",
    };
  }

  const values = real.map(
    (o) => o.answers[item.id]!.v as Exclude<AnswerValue, "na">,
  );
  const distinct = uniq(values);
  const hasIssue = values.some((v) => v !== "ok");

  if (distinct.length === 1) {
    return {
      line: { text: sentence(item, distinct[0]), comments },
      status: hasIssue ? "issue" : "ok",
    };
  }

  const parts: string[] = [];
  for (const v of ["no", "partial"] as const) {
    const zones = uniq(
      real.filter((o) => o.answers[item.id]!.v === v).map(label),
    );
    if (zones.length) parts.push(withZones(sentence(item, v), zones));
  }
  const okZones = uniq(
    real.filter((o) => o.answers[item.id]!.v === "ok").map(label),
  );
  if (okZones.length) parts.push(`En ordre : ${okZones.join(", ")}.`);
  return { line: { text: parts.join(" "), comments }, status: "issue" };
}

function fireLocationText(ex: ExerciseInput): string {
  if (!ex.fireLocation) return ex.fireDetail?.trim() || "";
  const base = ex.fireLocation === "classe" ? "Dans la classe" : "Ailleurs";
  return ex.fireDetail?.trim() ? `${base} : ${ex.fireDetail.trim()}` : base;
}

const NOT_RECORDED = "non relevé";

function buildFacts(ex: ExerciseInput): { label: string; value: string }[] {
  const facts = [
    {
      label: "Classe interpellée",
      value: ex.classroom?.trim() || NOT_RECORDED,
    },
    { label: "Enseignant·e", value: ex.teacher?.trim() || NOT_RECORDED },
    {
      label: "Lieu du sinistre fictif",
      value: fireLocationText(ex) || NOT_RECORDED,
    },
  ];
  for (const f of TIME_FIELDS) {
    facts.push({
      label: TIME_REPORT_LABELS[f],
      value: fmtTime(ex[f]) || NOT_RECORDED,
    });
  }
  const evac =
    ex.tEvac != null && ex.tPresent != null
      ? ex.tPresent - ex.tEvac
      : undefined;
  facts.push({
    label: "Durée d'évacuation",
    value: evac != null ? fmtDuration(evac) : NOT_RECORDED,
  });
  return facts;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n <= 1 ? one : many}`;
}

function buildSummary(
  ex: ExerciseInput,
  okCount: number,
  issueCount: number,
): string {
  const parts: string[] = [];
  if (ex.tEvac != null && ex.tPresent != null) {
    parts.push(
      `Évacuation complète en ${fmtDuration(ex.tPresent - ex.tEvac)}.`,
    );
  } else {
    parts.push("Durée d'évacuation non mesurée.");
  }
  if (okCount + issueCount > 0) {
    parts.push(
      `${plural(okCount, "point en ordre", "points en ordre")}, ${plural(issueCount, "point à améliorer", "points à améliorer")}.`,
    );
  }
  return parts.join(" ");
}

function buildTimingNotes(ex: ExerciseInput): string[] {
  const out: string[] = [];
  for (const f of TIME_FIELDS) {
    const note = ex.timingNotes[f]?.trim();
    if (!note) continue;
    const by = ex.timingNotes[`${f}__by`]?.trim();
    out.push(`${TIME_REPORT_LABELS[f as TimeField]} : ${note}${by ? ` (${by})` : ""}`);
  }
  return out;
}

function buildPhotos(obs: ObservationInput[]): ReportPhoto[] {
  const out: ReportPhoto[] = [];
  for (const o of obs) {
    for (const p of o.photos) {
      if (!p.url) continue;
      const parts: string[] = [];
      if (p.itemId && ITEM_BY_ID[p.itemId]) parts.push(ITEM_BY_ID[p.itemId].label);
      if (p.caption?.trim()) parts.push(p.caption.trim());
      const head = parts.join(" : ") || "Vue générale";
      out.push({ url: p.url, caption: `${head} ${attribution(o)}` });
    }
  }
  return out;
}

const observerName = (o: ObservationInput) => o.observer.trim() || "Observateur·rice";

function zoneOrder(zone: string): number {
  const i = ZONES.indexOf(zone);
  return i === -1 ? ZONES.length : i;
}

/** « Rez (Cyril Egger), 1er étage (Jean-Pierre Nussbaumer et Yves Sulger) » in building order. */
function buildZonesObserved(obs: ObservationInput[]): string {
  const byZone = new Map<string, string[]>();
  for (const o of obs.filter((x) => x.role === "obs")) {
    const z = o.zone?.trim() || "zone non précisée";
    byZone.set(z, uniq([...(byZone.get(z) ?? []), observerName(o)]));
  }
  return [...byZone.entries()]
    .sort(([a], [b]) => zoneOrder(a) - zoneOrder(b) || a.localeCompare(b, "fr"))
    .map(([z, names]) => `${z} (${joinFr(names)})`)
    .join(", ");
}

const GROUPS: { title: string; sections: string[]; who: string }[] = [
  {
    title: "Personne interpellée",
    sections: ["reaction", "organisation"],
    who: "Évalué par l'interpellateur, qui suit la personne interpellée sans l'aider.",
  },
  {
    title: "Comportement dans les étages",
    sections: ["comportement"],
    who: "Évalué par les observateurs, chacun dans sa zone.",
  },
  {
    title: "Technique",
    sections: ["technique"],
    who: "Évalué par les observateurs, chacun dans sa zone.",
  },
];

/** Default « Critères d'évaluation » text, generated from the checklist so both always match. */
export function defaultCriteria(): string {
  const intro =
    "Chaque point est évalué sur place et noté Oui (conforme), Partiel ou Non, ou Sans objet lorsqu'il ne s'applique pas. Le rapport reprend les points évalués : ceux à améliorer avec les zones concernées, puis ceux en ordre.";
  const parts = [`<p>${escapeHtml(intro)}</p>`];
  for (const g of GROUPS) {
    const items = SECTIONS.filter((x) => g.sections.includes(x.id)).flatMap((x) => x.items);
    parts.push(`<h3>${escapeHtml(g.title)}</h3>`);
    parts.push(`<p>${escapeHtml(g.who)}</p>`);
    parts.push(`<ul>${items.map((i) => `<li><p>${escapeHtml(i.label)}</p></li>`).join("")}</ul>`);
  }
  return parts.join("");
}

export function buildSchoolReport(ex: ExerciseInput, allObs: ObservationInput[]): SchoolReport {
  const obs = allObs.filter((o) => o.exerciseId === ex._id);
  let okCount = 0;
  let issueCount = 0;
  const missing: SchoolReport["missing"] = [];
  const recoKeys = new Set<RecoKey>();
  const groups: ReportGroup[] = [];

  for (const g of GROUPS) {
    const group: ReportGroup = { title: g.title, issues: [], ok: [] };
    for (const section of SECTIONS.filter((x) => g.sections.includes(x.id))) {
      const roleObs = obs.filter((o) => o.role === section.role);
      for (const item of section.items) {
        const syn = synthesizeItem(item, roleObs);
        if (syn.status === "ok") okCount++;
        if (syn.status === "issue") {
          issueCount++;
          if (item.reco) recoKeys.add(item.reco);
        }
        if (syn.status === "missing") missing.push({ itemId: item.id, label: item.label, role: section.role });
        if (!syn.line) continue;
        if (syn.status === "ok" && syn.line.comments.length === 0) group.ok.push(syn.line.text);
        else if (syn.status !== "na" || syn.line.comments.length) group.issues.push(syn.line);
      }
    }
    if (group.issues.length || group.ok.length) groups.push(group);
  }

  const remarks = obs
    .filter((o) => o.remarks?.trim())
    .sort((a, b) => (a.role === b.role ? zoneOrder(a.zone ?? "") - zoneOrder(b.zone ?? "") : a.role === "lead" ? -1 : 1))
    .map((o) => `${o.remarks!.trim()} ${attribution(o)}`);

  return {
    exerciseId: ex._id,
    school: ex.school,
    facts: buildFacts(ex),
    timingNotes: buildTimingNotes(ex),
    summary: buildSummary(ex, okCount, issueCount),
    zonesObserved: buildZonesObserved(obs),
    groups,
    remarks,
    photos: buildPhotos(obs),
    okCount,
    issueCount,
    missing,
    recoKeys: RECOMMENDATIONS.map((r) => r.key).filter((k) => recoKeys.has(k)),
  };
}

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildReport(
  exercises: ExerciseInput[],
  observations: ObservationInput[],
  options: { mode?: "school" | "day"; fields?: ReportFields } = {},
): ReportModel {
  const sorted = [...exercises].sort(
    (a, b) => (a.tStart ?? Infinity) - (b.tStart ?? Infinity),
  );
  const mode = options.mode ?? (sorted.length > 1 ? "day" : "school");
  const fields =
    options.fields ?? (mode === "school" ? (sorted[0]?.report ?? {}) : {});
  const exDate = sorted[0]?.exDate ?? "";
  const schools = sorted.map((ex) => buildSchoolReport(ex, observations));
  const schoolNames = sorted.map((e) => e.school);

  const recoKeys = new Set(schools.flatMap((s) => s.recoKeys));
  const suggestedRecommendations = RECOMMENDATIONS.filter((r) => recoKeys.has(r.key)).map((r) => r.text);

  const title =
    mode === "school"
      ? `Rapport d'exercice d'évacuation : ${schoolNames[0] ?? ""}`
      : `Rapport d'exercices d'évacuation : Écoles, ${fmtDateShort(exDate)}`;

  return {
    mode,
    title,
    exDate,
    dateLong: exDate ? fmtDateLong(exDate) : "",
    object: fields.object?.trim() || DEFAULT_OBJECT,
    recipients: fields.recipients?.trim() || DEFAULT_RECIPIENTS,
    author: fields.author?.trim() || "",
    intro:
      fields.intro?.trim() ||
      (exDate ? defaultIntro(mode, exDate, schoolNames) : ""),
    objective: fields.objective?.trim() || DEFAULT_OBJECTIVE,
    criteria: isRichEmpty(fields.criteria) ? defaultCriteria() : fields.criteria!.trim(),
    conclusion: fields.conclusion?.trim() || DEFAULT_CONCLUSION,
    schools,
    recommendations: isRichEmpty(fields.recommendations) ? "" : (fields.recommendations ?? "").trim(),
    suggestedRecommendations,
    missingCount: schools.reduce((n, s) => n + s.missing.length, 0),
  };
}
