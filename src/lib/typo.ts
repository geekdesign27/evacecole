// Swiss French typography: non-breaking space before « : ; ! ? » and inside guillemets.
const NBSP = " ";

export function typo(s: string): string {
  return s
    .replace(/ ([:;!?»])/g, `${NBSP}$1`)
    .replace(/« /g, `«${NBSP}`);
}
