// Texts saved before the organisation was renamed « CP Moncor » (2026-10-05) are fixed when read.

const RULES: [RegExp, string][] = [
  [/\b(l|L)a Compagnie des sapeurs-pompiers Moncor\b/g, "$1e CP Moncor"],
  [/\bde la Compagnie des sapeurs-pompiers Moncor\b/g, "du CP Moncor"],
  [/Compagnie des sapeurs-pompiers Moncor/g, "CP Moncor"],
  [/Compagnie Moncor/g, "CP Moncor"],
];

export function fixLegacyName(text: string): string {
  return RULES.reduce((s, [re, by]) => s.replace(re, by), text);
}

export function fixLegacyFields<T extends Record<string, string | undefined>>(fields: T): T {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = typeof v === "string" ? fixLegacyName(v) : v;
  return out as T;
}
