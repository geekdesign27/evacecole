import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import {
  buildReport,
  type ReportFields,
  type ReportModel,
} from "../domain/buildReport";
import { fmtDateLong, reportFileName } from "../domain/format";
import { device } from "../lib/storage";
import { typo } from "../lib/typo";
import { useTeam } from "../lib/team";
import { downloadBlob, loadAssets } from "../export/assets";
import { Button, Card, ErrorBox, Spinner, TopBar } from "../components/ui";


/** Report of one school. */
export function SchoolReportPage() {
  const { id } = useParams<{ id: string }>();
  const { code } = useTeam();
  const exId = id as Id<"exercises">;
  const ex = useQuery(api.exercises.get, { code, id: exId });
  const obs = useQuery(api.observations.byExercise, { code, exerciseId: exId });
  const update = useMutation(api.exercises.update);

  if (ex === undefined || obs === undefined) return <Spinner />;
  if (ex === null) return <ErrorBox>Exercice introuvable.</ErrorBox>;

  return (
    <ReportEditor
      key={ex._id}
      back={`/x/${ex._id}`}
      exercises={[ex]}
      observations={obs}
      mode="school"
      storedFields={ex.report}
      label={ex.school}
      onSave={(fields) =>
        update({ code, id: ex._id, patch: { report: fields } })
      }
    />
  );
}

/** Report of a whole day: several schools in one document. */
export function DayReportPage() {
  const { date = "" } = useParams<{ date: string }>();
  const { code } = useTeam();
  const list = useQuery(api.exercises.listRecent, { code });
  const stored = useQuery(api.exercises.dayReport, { code, exDate: date });
  const updateDay = useMutation(api.exercises.updateDayReport);
  const dayExercises = useMemo(
    () => (list ?? []).filter((e) => e.exDate === date && !e.archived),
    [list, date],
  );
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const selected = dayExercises.filter((e) => !excluded.has(e._id));
  const obs = useQuery(
    api.observations.byExercises,
    selected.length
      ? { code, exerciseIds: selected.map((e) => e._id) }
      : "skip",
  );

  if (list === undefined || stored === undefined) return <Spinner />;

  return (
    <>
      <TopBar title={`Journée du ${fmtDateLong(date)}`} back="/" />
      <main className="mx-auto max-w-3xl p-3">
        <Card className="no-print mb-3">
          <h2 className="mb-2 text-lg font-bold">Écoles incluses</h2>
          {dayExercises.length === 0 && (
            <p className="text-muted">Aucun exercice à cette date.</p>
          )}
          <div className="flex flex-col">
            {dayExercises.map((e) => (
              <label key={e._id} className="flex min-h-12 items-center gap-3">
                <input
                  type="checkbox"
                  className="h-6 w-6 accent-brand"
                  checked={!excluded.has(e._id)}
                  onChange={() =>
                    setExcluded((s) => {
                      const n = new Set(s);
                      if (n.has(e._id)) n.delete(e._id);
                      else n.add(e._id);
                      return n;
                    })
                  }
                />
                {e.school}
              </label>
            ))}
          </div>
        </Card>
        {selected.length > 0 && obs === undefined && <Spinner />}
        {selected.length > 0 && obs && (
          <ReportEditor
            embedded
            back="/"
            exercises={selected}
            observations={obs}
            mode={selected.length > 1 ? "day" : "school"}
            storedFields={stored}
            label={selected.length > 1 ? "Ecoles" : selected[0].school}
            onSave={(fields) => updateDay({ code, exDate: date, fields })}
          />
        )}
      </main>
    </>
  );
}

interface EditorProps {
  back: string;
  exercises: Doc<"exercises">[];
  observations: Parameters<typeof buildReport>[1];
  mode: "school" | "day";
  storedFields: Record<string, string>;
  label: string;
  onSave: (fields: Record<string, string>) => Promise<unknown>;
  embedded?: boolean;
}

function ReportEditor({
  back,
  exercises,
  observations,
  mode,
  storedFields,
  label,
  onSave,
  embedded,
}: EditorProps) {
  const [fields, setFields] = useState<ReportFields>(() => ({
    author: device.author || device.name,
    ...storedFields,
  }));
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const model = useMemo(
    () => buildReport(exercises, observations, { mode, fields }),
    [exercises, observations, mode, fields],
  );

  // Show the computed defaults in the editors when nothing has been typed yet.
  const shown = (k: keyof ReportFields): string => {
    if (fields[k] !== undefined && fields[k] !== "") return fields[k] as string;
    if (k === "recommendations") return model.autoRecommendations.join("\n\n");
    return (model[k as keyof ReportModel] as string) ?? "";
  };

  // Only keys edited on this device are sent (the server merges per key), so a
  // colleague's edits on other fields are never overwritten.
  const pending = useRef<Record<string, string>>({});
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const flush = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const payload = pending.current;
    if (!Object.keys(payload).length) return;
    pending.current = {};
    onSaveRef.current(payload).then(
      () => setSaveError(null),
      (e) => {
        // Keep the text so the next edit or flush retries it.
        pending.current = { ...payload, ...pending.current };
        setSaveError(e instanceof Error ? e.message : "Enregistrement impossible.");
      },
    );
  };

  const edit = (k: keyof ReportFields, value: string) => {
    setFields((f) => ({ ...f, [k]: value }));
    if (k === "author") device.author = value;
    pending.current = { ...pending.current, [k]: value };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 700);
  };

  // Leaving the screen (or the app) sends the pending text instead of dropping it.
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const body = (
    <div className="flex flex-col gap-3">
      {model.missingCount > 0 && (
        <Card className="no-print border-2 border-amber">
          <p className="font-bold">
            {model.missingCount}{" "}
            {model.missingCount > 1
              ? "points non renseignés"
              : "point non renseigné"}
          </p>
          <p className="text-sm text-muted">
            Ils n'apparaissent pas dans le rapport. Complète-les si besoin :
          </p>
          {model.schools
            .filter((s) => s.missing.length)
            .map((s) => (
              <details key={s.exerciseId} className="mt-2">
                <summary className="min-h-12 cursor-pointer py-2 font-medium">
                  {s.school} ({s.missing.length})
                </summary>
                <ul className="ml-4 list-disc text-sm">
                  {s.missing.map((m) => (
                    <li key={m.itemId}>
                      {m.label} (
                      {m.role === "lead" ? "interpellateur" : "observateurs"})
                    </li>
                  ))}
                </ul>
                <Link
                  to={`/x/${s.exerciseId}`}
                  className="flex min-h-12 items-center text-brand underline"
                >
                  Ouvrir la saisie
                </Link>
              </details>
            ))}
        </Card>
      )}

      <ExportBar model={model} label={label} />

      <Card className="no-print">
        <h2 className="mb-2 text-lg font-bold">Textes du rapport</h2>
        <div className="flex flex-col gap-3">
          <Field
            label="Destinataires"
            value={shown("recipients")}
            onChange={(v) => edit("recipients", v)}
          />
          <Field
            label="Rédigé par"
            value={shown("author")}
            onChange={(v) => edit("author", v)}
          />
          <Field
            label="Introduction"
            rows={6}
            value={shown("intro")}
            onChange={(v) => edit("intro", v)}
          />
          <Field
            label="Recommandations (une par paragraphe)"
            rows={8}
            value={shown("recommendations")}
            onChange={(v) => edit("recommendations", v)}
          />
          {fields.recommendations && (
            <Button
              variant="ghost"
              className="self-start underline"
              onClick={() => edit("recommendations", "")}
            >
              Revenir aux recommandations automatiques
            </Button>
          )}
          <Field
            label="Conclusion"
            rows={4}
            value={shown("conclusion")}
            onChange={(v) => edit("conclusion", v)}
          />
          {saveError && <ErrorBox>{saveError}</ErrorBox>}
        </div>
      </Card>

      <Preview model={model} />
    </div>
  );

  if (embedded) return body;
  return (
    <>
      <TopBar title="Synthèse" back={back} />
      <main className="mx-auto max-w-3xl p-3">{body}</main>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const id = `f-${label.replace(/\W+/g, "-")}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {rows ? (
        <textarea
          id={id}
          className="field"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className="field"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function ExportBar({ model, label }: { model: ReportModel; label: string }) {
  const [busy, setBusy] = useState<"pdf" | "docx" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "pdf" | "docx") {
    setBusy(kind);
    setError(null);
    try {
      const assets = await loadAssets(model);
      const blob =
        kind === "pdf"
          ? await (await import("../export/pdf")).renderPdf(model, assets)
          : await (await import("../export/docx")).renderDocx(model, assets);
      downloadBlob(blob, reportFileName(model.exDate, label, kind));
    } catch (e) {
      setError(
        `Export impossible : ${e instanceof Error ? e.message : "erreur inconnue"}`,
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="no-print">
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => run("pdf")} disabled={!!busy}>
          {busy === "pdf" ? "Préparation…" : "Télécharger PDF"}
        </Button>
        <Button variant="dark" onClick={() => run("docx")} disabled={!!busy}>
          {busy === "docx" ? "Préparation…" : "Télécharger Word"}
        </Button>
      </div>
      {error && (
        <div className="mt-2">
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}
    </Card>
  );
}

function Preview({ model }: { model: ReportModel }) {
  const t = typo;
  return (
    <article
      className="rounded-2xl bg-white p-5 shadow-sm"
      aria-label="Aperçu du rapport"
    >
      <header className="mb-4 flex items-center gap-3">
        <img
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt="CP Moncor"
          width={56}
          height={56}
        />
        <h2 className="text-xl font-bold leading-tight">{t(model.title)}</h2>
      </header>
      <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[15px]">
        <dt className="font-bold">Objet</dt>
        <dd>{t(model.object)}</dd>
        <dt className="font-bold">Date</dt>
        <dd>{model.dateLong}</dd>
        <dt className="font-bold">Destinataires</dt>
        <dd>{t(model.recipients)}</dd>
        {model.author && (
          <>
            <dt className="font-bold">Rédigé par</dt>
            <dd>{t(model.author)}</dd>
          </>
        )}
      </dl>
      <h3 className="mt-4 text-lg font-bold text-brand">Introduction</h3>
      <p>{t(model.intro)}</p>

      {model.schools.map((s) => (
        <section key={s.exerciseId} className="mt-4">
          {model.mode === "day" && (
            <h3 className="text-lg font-bold text-brand">{t(s.school)}</h3>
          )}
          <table className="my-2 w-full border-collapse text-[15px]">
            <tbody>
              {s.facts.map((f) => (
                <tr key={f.label} className="border-b border-line">
                  <th className="w-1/2 py-1 pr-2 text-left font-medium">
                    {t(f.label)}
                  </th>
                  <td className="py-1">{t(f.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="font-bold">{t(s.summary)}</p>
          {s.sections.length > 0 && (
            <h4 className="mt-3 font-bold">Observations</h4>
          )}
          {s.sections.map((sec) => (
            <div key={sec.title} className="mt-2">
              <h5 className="font-bold">{t(sec.title)}</h5>
              {sec.lines.map((l, i) => (
                <div key={i}>
                  <p>{t(l.text)}</p>
                  {l.comments.map((c, j) => (
                    <p key={j} className="ml-4 italic text-muted">
                      {t(c)}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ))}
          {s.remarks.length > 0 && (
            <div className="mt-2">
              <h5 className="font-bold">Remarques</h5>
              {s.remarks.map((r, i) => (
                <p key={i}>{t(r)}</p>
              ))}
            </div>
          )}
          {s.photos.length > 0 && (
            <div className="mt-2">
              <h5 className="font-bold">Photos</h5>
              <div className="grid grid-cols-2 gap-3">
                {s.photos.map((p) => (
                  <figure key={p.url}>
                    <img
                      src={p.url}
                      alt={p.caption}
                      className="w-full rounded-lg"
                    />
                    <figcaption className="text-sm text-muted">
                      {t(p.caption)}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
        </section>
      ))}

      {model.recommendations.length > 0 && (
        <>
          <h3 className="mt-4 text-lg font-bold text-brand">Recommandations</h3>
          <ol className="ml-5 list-decimal">
            {model.recommendations.map((r, i) => (
              <li key={i}>{t(r)}</li>
            ))}
          </ol>
        </>
      )}
      <h3 className="mt-4 text-lg font-bold text-brand">Conclusion</h3>
      <p>{t(model.conclusion)}</p>
      <footer className="mt-6 border-t border-line pt-2 text-sm text-muted">
        Compagnie des sapeurs-pompiers Moncor, www.cpmoncor.ch
      </footer>
    </article>
  );
}
