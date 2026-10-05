// Pure rules for merging two exercises created by mistake for the same school (half of the team in
// each). Used by admin.mergeExercises and its preview; tested by Vitest.

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
