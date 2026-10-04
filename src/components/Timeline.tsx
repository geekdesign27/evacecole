import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import {
  TIME_FIELDS,
  TIME_LABELS,
  type Role,
  type TimeField,
} from "../domain/checklist";
import { fmtClock } from "../domain/format";
import { Button, Card, ErrorBox } from "./ui";

const pad = (n: number) => String(n).padStart(2, "0");

function toInputValue(ms: number | undefined): string {
  if (!ms) return "";
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fromInputValue(exDate: string, value: string): number | null {
  if (!value) return null;
  const [y, m, d] = exDate.split("-").map(Number);
  const [hh, mm, ss = 0] = value.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, ss).getTime();
}

interface Props {
  ex: Doc<"exercises">;
  role: Role;
  code: string;
  pending: Partial<Record<TimeField, number>>;
  onStamp: (f: TimeField) => void;
  author: string;
}

export function Timeline({ ex, role, code, pending, onStamp, author }: Props) {
  const [editing, setEditing] = useState<TimeField | null>(null);

  return (
    <Card>
      <h2 className="mb-2 text-xl font-bold">Heures</h2>
      <ol className="flex flex-col">
        {TIME_FIELDS.map((f) => {
          const value = ex[f];
          const local = pending[f];
          const canStamp = role === "lead" || f === "tEvac";
          const done = value !== undefined;
          return (
            <li key={f} className="border-b border-line py-2 last:border-0">
              <div className="flex min-h-12 items-center gap-3">
                <span
                  aria-hidden
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                    done
                      ? "bg-ok text-white"
                      : local
                        ? "bg-amber text-ink"
                        : "border-2 border-line"
                  }`}
                >
                  {done ? "✓" : ""}
                </span>
                <button
                  type="button"
                  className="min-h-12 flex-1 text-left"
                  onClick={() => setEditing(editing === f ? null : f)}
                  aria-label={`${TIME_LABELS[f]}, corriger l'heure ou ajouter une note`}
                >
                  <span className="block font-medium leading-tight">
                    {TIME_LABELS[f]}
                  </span>
                  {ex.timingNotes[f] && (
                    <span className="block text-sm text-muted">
                      {ex.timingNotes[f]}
                    </span>
                  )}
                </button>
                {done ? (
                  <span className="font-display text-lg font-bold tabular">
                    {fmtClock(value)}
                  </span>
                ) : local ? (
                  <span className="text-right text-sm tabular">
                    {fmtClock(local)}
                    <br />
                    <span className="text-muted">envoi…</span>
                  </span>
                ) : canStamp ? (
                  <Button
                    className={f === "tEvac" ? "min-w-32 bg-brand" : "min-w-32"}
                    variant={f === "tEvac" ? "primary" : "dark"}
                    onClick={() => onStamp(f)}
                  >
                    Maintenant
                  </Button>
                ) : (
                  <span className="text-sm text-muted">en attente</span>
                )}
              </div>
              {editing === f && (
                <TimeEditor
                  ex={ex}
                  field={f}
                  code={code}
                  author={author}
                  onClose={() => setEditing(null)}
                />
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function TimeEditor({
  ex,
  field,
  code,
  author,
  onClose,
}: {
  ex: Doc<"exercises">;
  field: TimeField;
  code: string;
  author: string;
  onClose: () => void;
}) {
  const setTime = useMutation(api.exercises.setTime);
  const [time, setTimeValue] = useState(toInputValue(ex[field]));
  const [note, setNote] = useState(ex.timingNotes[field] ?? "");
  const [error, setError] = useState<string | null>(null);

  async function save(clear = false) {
    try {
      await setTime({
        code,
        id: ex._id,
        field,
        value: clear ? null : fromInputValue(ex.exDate, time),
        note,
        noteBy: author,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl bg-bg p-3">
      <label className="text-sm font-medium" htmlFor={`t-${field}`}>
        Heure exacte
      </label>
      <input
        id={`t-${field}`}
        type="time"
        step={1}
        className="field tabular"
        value={time}
        onChange={(e) => setTimeValue(e.target.value)}
      />
      <label className="text-sm font-medium" htmlFor={`n-${field}`}>
        Note (ex. bouton défectueux, alarme en porte-à-porte)
      </label>
      <textarea
        id={`n-${field}`}
        className="field"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save(false)}>Valider</Button>
        <Button variant="secondary" onClick={onClose}>
          Annuler
        </Button>
        {ex[field] !== undefined && (
          <Button
            variant="ghost"
            className="text-brand"
            onClick={() => save(true)}
          >
            Effacer l'heure
          </Button>
        )}
      </div>
    </div>
  );
}
