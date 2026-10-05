import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { Lock } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { itemsForRole } from "../domain/checklist";
import { fmtDateLong } from "../domain/format";
import { readJSON } from "../lib/storage";
import type { Draft } from "../lib/sync";
import { useTeam } from "../lib/team";
import { Card, Spinner, TopBar } from "../components/ui";

/** Observations saved on this device (localStorage drafts), to come back and correct them. */
function localDrafts(): Draft[] {
  const out: Draft[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("evac:obs:")) continue;
      const d = readJSON<Draft | null>(key, null);
      if (d?.observer) out.push(d);
    }
  } catch {
    /* storage unavailable: nothing to list */
  }
  return out;
}

export function MySubmissions() {
  const { code } = useTeam();
  const drafts = localDrafts();
  const exercises = useQuery(
    api.exercises.getMany,
    drafts.length ? { code, ids: drafts.map((d) => d.exerciseId as Id<"exercises">) } : "skip",
  );

  const rows =
    exercises
      ?.map((ex) => ({ ex, draft: drafts.find((d) => d.exerciseId === ex._id)! }))
      .sort((a, b) => b.ex.exDate.localeCompare(a.ex.exDate) || (b.ex.tStart ?? 0) - (a.ex.tStart ?? 0)) ?? [];

  return (
    <>
      <TopBar title="Mes saisies" back="/" />
      <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4">
        <p className="text-muted">Les exercices où ce téléphone a saisi des réponses. Touche-en un pour corriger, tant que la saisie est ouverte.</p>
        {drafts.length === 0 && <Card>Aucune saisie sur ce téléphone pour l'instant.</Card>}
        {drafts.length > 0 && exercises === undefined && <Spinner />}
        {rows.map(({ ex, draft }) => {
          const total = itemsForRole(draft.role).length;
          const done = itemsForRole(draft.role).filter((i) => draft.answers[i.id]?.v).length;
          return (
            <Link
              key={ex._id}
              to={`/x/${ex._id}`}
              className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border-2 border-line bg-card p-4 active:bg-bg"
            >
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold">{ex.school}</p>
                <p className="text-sm text-muted">
                  {fmtDateLong(ex.exDate)} · {draft.role === "lead" ? "Interpellateur" : `Observateur·rice${draft.zone ? `, ${draft.zone}` : ""}`}
                </p>
              </div>
              <div className="shrink-0 text-right text-sm">
                <p className="tabular">
                  {done}/{total} points
                </p>
                {ex.locked ? (
                  <p className="flex items-center justify-end gap-1 font-medium">
                    <Lock size={14} /> Clôturée
                  </p>
                ) : (
                  <p className="font-medium text-ok">Modifiable</p>
                )}
              </div>
            </Link>
          );
        })}
      </main>
    </>
  );
}
