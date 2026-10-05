// Pure rules for merging exercises created by mistake for the same school on the same day (the team
// split over several). One « master » gives every time and the organisation; the others only bring
// their people's observations. Used by the admin merge functions; tested by Vitest.

export const EARLIEST = ["tStart", "tAlarm", "tEvac"] as const; // first event wins
export const LATEST = ["tPresent", "tFiremen", "tEnd"] as const; // never underestimate the evacuation time
export type TimeKey = (typeof EARLIEST)[number] | (typeof LATEST)[number];

type Times = Partial<Record<TimeKey, number>>;

export interface TimeDecision {
  field: TimeKey;
  target?: number;
  source?: number;
  kept?: number;
  conflict: boolean;
}

export function mergeTimes(target: Times, source: Times): TimeDecision[] {
  const out: TimeDecision[] = [];
  for (const field of [...EARLIEST, ...LATEST]) {
    const a = target[field];
    const b = source[field];
    let kept = a ?? b;
    const conflict = a !== undefined && b !== undefined && a !== b;
    if (conflict)
      kept = (EARLIEST as readonly string[]).includes(field)
        ? Math.min(a!, b!)
        : Math.max(a!, b!);
    out.push({ field, target: a, source: b, kept, conflict });
  }
  return out;
}

/** Text fields: the target's value, completed by the source's when empty. */
export function fillEmpty<T extends Record<string, unknown>>(
  target: T,
  source: T,
  keys: (keyof T)[],
): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) {
    const a = target[k];
    const b = source[k];
    const empty =
      a === undefined || a === null || (typeof a === "string" && !a.trim());
    if (
      empty &&
      b !== undefined &&
      b !== null &&
      !(typeof b === "string" && !b.trim())
    )
      out[k] = b;
  }
  return out;
}

/** Records of strings (timing notes, report fields): both kept; same key with different texts joined. */
export function mergeRecords(
  target: Record<string, string>,
  source: Record<string, string>,
): Record<string, string> {
  const out = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (!v?.trim()) continue;
    if (!out[k]?.trim()) out[k] = v;
    else if (out[k].trim() !== v.trim() && !k.endsWith("__by"))
      out[k] = `${out[k].trim()} ; ${v.trim()}`;
  }
  return out;
}

export interface ObsLike {
  answers: Record<string, { v?: "ok" | "partial" | "no" | "na"; c?: string }>;
  remarks?: string;
  photos: { storageId: string; itemId?: string; caption?: string }[];
  tClear?: number;
  updatedAt: number;
}

/** Same device in both exercises: one observation, newest answer per point, everything else added up. */
export function mergeObservation<T extends ObsLike>(a: T, b: T): T {
  const [older, newer] = a.updatedAt <= b.updatedAt ? [a, b] : [b, a];
  const answers: ObsLike["answers"] = { ...older.answers };
  for (const [id, ans] of Object.entries(newer.answers)) {
    const prev = answers[id] ?? {};
    const comments = [prev.c?.trim(), ans.c?.trim()].filter(
      (c, i, arr): c is string => !!c && arr.indexOf(c) === i,
    );
    answers[id] = {
      v: ans.v ?? prev.v,
      ...(comments.length ? { c: comments.join(" ; ") } : {}),
    };
  }
  const remarks = [older.remarks?.trim(), newer.remarks?.trim()].filter(
    (r, i, arr): r is string => !!r && arr.indexOf(r) === i,
  );
  const seen = new Set<string>();
  const photos = [...older.photos, ...newer.photos].filter(
    (p) => !seen.has(p.storageId) && seen.add(p.storageId),
  );
  const clears = [a.tClear, b.tClear].filter(
    (t): t is number => t !== undefined,
  );
  return {
    ...newer,
    answers,
    remarks: remarks.length ? remarks.join(" ") : undefined,
    photos,
    tClear: clears.length ? Math.max(...clears) : undefined,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
}

export const TIME_KEYS = [...EARLIEST, ...LATEST];

interface Candidate {
  _id: string;
  school: string;
  exDate: string;
  tStart?: number;
  tAlarm?: number;
  tEvac?: number;
  tPresent?: number;
  tFiremen?: number;
  tEnd?: number;
}

export function timesCount(ex: Candidate): number {
  return TIME_KEYS.filter((k) => ex[k] !== undefined).length;
}

export function evacuationMs(ex: Candidate): number | undefined {
  return ex.tEvac !== undefined && ex.tPresent !== undefined ? ex.tPresent - ex.tEvac : undefined;
}

/**
 * Master: the shortest measured evacuation (a late button press gives absurd durations such as
 * 1 h 23); without any measured duration, the most recorded times; then the earliest start.
 */
export function pickMaster<T extends Candidate>(list: T[]): T {
  return [...list].sort(
    (a, b) =>
      (evacuationMs(a) ?? Infinity) - (evacuationMs(b) ?? Infinity) ||
      timesCount(b) - timesCount(a) ||
      (a.tStart ?? Infinity) - (b.tStart ?? Infinity),
  )[0];
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Groups of exercises with the same school (case and accents ignored) on the same date. */
export function duplicateGroups<T extends Candidate>(list: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const ex of list) {
    const key = `${ex.exDate}|${norm(ex.school)}`;
    groups.set(key, [...(groups.get(key) ?? []), ex]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}
