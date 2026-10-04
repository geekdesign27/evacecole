import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { useTeam } from "../lib/team";
import { fmtDateLong, fmtDuration, fmtTime, todayIso } from "../domain/format";
import { Button, Card, ErrorBox, Spinner, TopBar } from "../components/ui";
import { useNow } from "../components/Stopwatch";
import { errorMessage } from "../lib/errors";

const OTHER = "__other__";

export function exerciseStatus(ex: Doc<"exercises">): string {
  if (ex.tEnd) return "Terminé";
  if (ex.tPresent) return "Classes présentes";
  if (ex.tEvac) return "Évacuation en cours";
  if (ex.tStart) return "Interpellation en cours";
  return "Pas commencé";
}

function MiniChrono({ ex }: { ex: Doc<"exercises"> }) {
  const now = useNow(!!ex.tEvac && !ex.tPresent);
  if (ex.tEvac && ex.tPresent)
    return <span>Évacuation : {fmtDuration(ex.tPresent - ex.tEvac)}</span>;
  if (ex.tEvac)
    return (
      <span className="font-bold text-brand">
        Évacuation {fmtDuration(now - ex.tEvac)}
      </span>
    );
  if (ex.tStart) return <span>Début {fmtTime(ex.tStart)}</span>;
  return null;
}

function ExerciseCard({ ex }: { ex: Doc<"exercises"> }) {
  return (
    <Link
      to={`/x/${ex._id}`}
      className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border-2 border-line bg-card p-4 active:bg-bg"
    >
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-bold">{ex.school}</p>
        <p className="text-sm text-muted">{exerciseStatus(ex)}</p>
      </div>
      <div className="shrink-0 text-right text-sm tabular">
        <MiniChrono ex={ex} />
      </div>
    </Link>
  );
}

function NewExercise() {
  const { code } = useTeam();
  const navigate = useNavigate();
  const schools = useQuery(api.exercises.schools, { code });
  const create = useMutation(api.exercises.create);
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showOther =
    choice === OTHER || (schools !== undefined && schools.length === 0);
  const school = showOther ? other.trim() : choice;

  async function submit() {
    if (!school) return;
    setBusy(true);
    setError(null);
    try {
      const id = await create({ code, school, exDate: todayIso() });
      navigate(`/x/${id}?lead=1`);
    } catch (e) {
      setError(errorMessage(e, "Création impossible."));
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-3 text-xl font-bold">Nouvel exercice</h2>
      <div className="flex flex-col gap-3">
        {schools && schools.length > 0 && (
          <select
            className="field"
            aria-label="École"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
          >
            <option value="">Choisir l'école…</option>
            {schools.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value={OTHER}>Autre école…</option>
          </select>
        )}
        {showOther && (
          <input
            className="field"
            placeholder="Nom de l'école (ex. École de Platy)"
            aria-label="Nom de l'école"
            value={other}
            onChange={(e) => setOther(e.target.value)}
          />
        )}
        {error && <ErrorBox>{error}</ErrorBox>}
        <Button disabled={!school || busy} onClick={submit}>
          {busy ? "Création…" : `Créer l'exercice du jour`}
        </Button>
      </div>
    </Card>
  );
}

export function Home() {
  const { code } = useTeam();
  const list = useQuery(api.exercises.listRecent, { code });
  const [showArchived, setShowArchived] = useState(false);
  const today = todayIso();

  if (list === undefined) return <Spinner />;

  const visible = list.filter((e) => showArchived || !e.archived);
  const todays = visible.filter((e) => e.exDate === today);
  const past = visible.filter((e) => e.exDate !== today);
  const byDate = new Map<string, Doc<"exercises">[]>();
  for (const e of past)
    byDate.set(e.exDate, [...(byDate.get(e.exDate) ?? []), e]);

  return (
    <>
      <TopBar title="Exercices d'évacuation" />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <NewExercise />

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Aujourd'hui</h2>
            {todays.length > 0 && (
              <Link
                to={`/rapport/jour/${today}`}
                className="flex min-h-12 items-center font-medium text-brand underline"
              >
                Rapport de la journée
              </Link>
            )}
          </div>
          {todays.length === 0 && (
            <p className="text-muted">Aucun exercice aujourd'hui.</p>
          )}
          {todays.map((ex) => (
            <ExerciseCard key={ex._id} ex={ex} />
          ))}
        </section>

        {byDate.size > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">Historique</h2>
            {[...byDate.entries()].map(([date, exs]) => (
              <div key={date} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold capitalize">{fmtDateLong(date)}</h3>
                  <Link
                    to={`/rapport/jour/${date}`}
                    className="flex min-h-12 items-center text-brand underline"
                  >
                    Rapport
                  </Link>
                </div>
                {exs.map((ex) => (
                  <ExerciseCard key={ex._id} ex={ex} />
                ))}
              </div>
            ))}
          </section>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Link to="/fiche" className="flex min-h-12 items-center justify-center font-medium underline">
            Fiche papier
          </Link>
          <Link to="/admin" className="flex min-h-12 items-center justify-center font-medium underline">
            Gestion
          </Link>
        </div>
        <Button variant="ghost" onClick={() => setShowArchived((v) => !v)}>
          {showArchived
            ? "Masquer les exercices archivés"
            : "Afficher les exercices archivés"}
        </Button>
      </main>
    </>
  );
}
