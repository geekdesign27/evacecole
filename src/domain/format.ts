// Swiss French formatting helpers (times, durations, dates, file names).

const pad = (n: number) => String(n).padStart(2, "0");

/** 08h31 */
export function fmtTime(ms: number | undefined | null): string {
  if (ms == null) return "";
  const d = new Date(ms);
  return `${pad(d.getHours())}h${pad(d.getMinutes())}`;
}

/** 08:31:07, for on-screen timeline precision */
export function fmtClock(ms: number | undefined | null): string {
  if (ms == null) return "";
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** « 6 min », « 6 min 12 s », « 45 s », « 1 h 05 min » */
export function fmtDuration(ms: number | undefined | null): string {
  if (ms == null || ms < 0) return "";
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} h ${pad(m)} min`;
  if (m === 0) return `${s} s`;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

/** Rounded minutes for the short summary: « 6 min » (≥ 30 s rounds up). */
export function fmtDurationShort(ms: number): string {
  const totalS = Math.round(ms / 1000);
  if (totalS < 60) return `${totalS} s`;
  return `${Math.round(totalS / 60)} min`;
}

/** mm:ss for the live stopwatch (hh:mm:ss after one hour). */
export function fmtStopwatch(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** « lundi 5 octobre 2026 » (1er for the first day of the month) */
export function fmtDateLong(iso: string): string {
  const d = parseIsoDate(iso);
  const day = d.getDate() === 1 ? "1er" : String(d.getDate());
  return `${DAYS[d.getDay()]} ${day} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** « 5 octobre 2026 » */
export function fmtDateShort(iso: string): string {
  const d = parseIsoDate(iso);
  const day = d.getDate() === 1 ? "1er" : String(d.getDate());
  return `${day} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Local date as YYYY-MM-DD */
export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** « École de Platy » → « Ecole-de-Platy » (safe in any file system) */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function reportFileName(exDate: string, label: string, ext: "pdf" | "docx"): string {
  return `${exDate}_Rapport-evacuation_${slugify(label)}.${ext}`;
}

/** Article for « à l'École… » / « au Collège… »: picks l' / le / la based on first letter. */
export function withLocativeArticle(school: string): string {
  const s = school.trim();
  if (/^[aeiouyéèêàâîïôûhAEIOUYÉÈÊÀÂÎÏÔÛH]/.test(s)) return `à l'${s}`;
  if (/^(collège|cycle|centre|cos|co )/i.test(s)) return `au ${s}`;
  return `à ${s}`;
}
