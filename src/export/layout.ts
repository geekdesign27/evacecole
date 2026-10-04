// Shared compact layout for PDF and Word: the facts table on two label/value columns.

export interface FactCell {
  label: string;
  value: string;
  /** Spans the whole row (long values such as the fire location). */
  wide?: boolean;
  strong?: boolean;
}

const WIDE = new Set(["Lieu du sinistre fictif", "Durée d'évacuation"]);

/** Groups facts two per row; long ones take a full row. */
export function factRows(facts: { label: string; value: string }[]): FactCell[][] {
  const rows: FactCell[][] = [];
  let pending: FactCell | null = null;
  for (const f of facts) {
    const cell: FactCell = { ...f, wide: WIDE.has(f.label), strong: f.label === "Durée d'évacuation" };
    if (cell.wide) {
      if (pending) rows.push([pending]);
      pending = null;
      rows.push([cell]);
    } else if (pending) {
      rows.push([pending, cell]);
      pending = null;
    } else {
      pending = cell;
    }
  }
  if (pending) rows.push([pending]);
  return rows;
}
