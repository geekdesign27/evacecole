import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import {
  buildReport,
  type ReportFields,
  type ReportModel,
} from "../domain/buildReport";
import { fmtDateLong, reportFileName } from "../domain/format";
import { device, readJSON } from "../lib/storage";
import { typo } from "../lib/typo";
import { escapeHtml, mapRuns, parseRich, toEditorHtml, type RichRun } from "../domain/rich";
import { RichEditor } from "../components/RichEditor";
import { useTeam } from "../lib/team";
import { downloadBlob, loadAssets } from "../export/assets";
import { defaultReportMessageHtml } from "../../convex/mailTemplates";
import { Button, Card, ErrorBox, Spinner, TopBar } from "../components/ui";
import { errorMessage } from "../lib/errors";
import { useAdminToken } from "../lib/admin";


/** Report of one school. */
export function SchoolReportPage() {
  const { id } = useParams<{ id: string }>();
  const { code } = useTeam();
  const exId = id as Id<"exercises">;
  const ex = useQuery(api.exercises.get, { code, id: exId });
  const obs = useQuery(api.observations.byExercise, { code, exerciseId: exId });
  const adminToken = useAdminToken();
  const updateReport = useMutation(api.admin.updateReport);

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
      adminToken={adminToken}
      onSave={(fields) => (adminToken ? updateReport({ token: adminToken, id: ex._id, fields }) : Promise.resolve())}
    />
  );
}

/** Report of a whole day: several schools in one document. */
export function DayReportPage() {
  const { date = "" } = useParams<{ date: string }>();
  const { code } = useTeam();
  const list = useQuery(api.exercises.listRecent, { code });
  const stored = useQuery(api.exercises.dayReport, { code, exDate: date });
  const adminToken = useAdminToken();
  const updateDay = useMutation(api.admin.updateDayReport);
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
            adminToken={adminToken}
            onSave={(fields) => (adminToken ? updateDay({ token: adminToken, exDate: date, fields }) : Promise.resolve())}
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
  /** Report texts are edited by the admin only. */
  adminToken?: string;
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
  adminToken,
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
    if (k === "recommendations") return "";
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
        setSaveError(errorMessage(e, "Enregistrement impossible."));
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

  // Follow server updates (a save still in flight when the screen opened, or a colleague's
  // edit), except for fields typed here and not yet sent.
  useEffect(() => {
    setFields((f) => {
      const next = { ...f };
      for (const [k, val] of Object.entries(storedFields)) {
        if (!(k in pending.current)) next[k as keyof ReportFields] = val;
      }
      return next;
    });
  }, [storedFields]);

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
      {adminToken && <LockCard token={adminToken} exercises={exercises} />}
      <SendReport
        model={model}
        label={label}
        message={fields.mailMessage ?? ""}
        onMessage={(v) => edit("mailMessage", v)}
      />

      {adminToken && (
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
            label="Objectif"
            rows={3}
            value={shown("objective")}
            onChange={(v) => edit("objective", v)}
          />
          <Field
            label="Critères d'évaluation"
            rows={8}
            value={shown("criteria")}
            onChange={(v) => edit("criteria", v)}
          />
          <Field
            label="Recommandations"
            rows={8}
            value={shown("recommendations")}
            onChange={(v) => edit("recommendations", v)}
          />
          {model.suggestedRecommendations.length > 0 && (
            <Button
              variant="secondary"
              className="self-start"
              onClick={() => {
                const current = toEditorHtml((fields.recommendations ?? "").trim());
                const extra = model.suggestedRecommendations.filter((r) => !current.includes(escapeHtml(r)));
                edit("recommendations", current + extra.map((r) => `<p>${escapeHtml(r)}</p>`).join(""));
              }}
            >
              Insérer les suggestions ({model.suggestedRecommendations.length})
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
      )}

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
  if (rows) {
    return <RichEditor id={id} label={label} value={value} onChange={onChange} minRows={rows} />;
  }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {rows ? (
        <RichEditor id={id} label={label} value={value} onChange={onChange} minRows={rows} />
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

/** Closing the team's input: answers become read-only (also done automatically when the report is sent). */
function LockCard({ token, exercises }: { token: string; exercises: Doc<"exercises">[] }) {
  const setLocked = useMutation(api.admin.setLocked);
  const [error, setError] = useState<string | null>(null);
  const lockedCount = exercises.filter((e) => e.locked).length;
  const allLocked = lockedCount === exercises.length;
  const ids = exercises.map((e) => e._id);
  return (
    <Card className="no-print">
      <h2 className="mb-1 text-lg font-bold">Saisie des équipes</h2>
      <p className="mb-2 text-sm">
        {allLocked
          ? "Clôturée : les réponses, commentaires et heures ne peuvent plus être modifiés."
          : lockedCount > 0
            ? `Clôturée pour ${lockedCount} exercice${lockedCount > 1 ? "s" : ""} sur ${exercises.length}.`
            : "Ouverte : les équipes peuvent encore corriger leurs réponses. Elle se clôture automatiquement à l'envoi du rapport."}
      </p>
      {error && <ErrorBox>{error}</ErrorBox>}
      <Button
        variant={allLocked ? "secondary" : "dark"}
        onClick={async () => {
          setError(null);
          try {
            await setLocked({ token, ids, locked: !allLocked });
          } catch (e) {
            setError(errorMessage(e, "Modification impossible."));
          }
        }}
      >
        {allLocked ? "Rouvrir la saisie" : "Clôturer la saisie maintenant"}
      </Button>
    </Card>
  );
}

/** End-of-day e-mail: message + PDF report attached (the Word file stays with the author), sent from the admin's Gmail. */
function SendReport({
  model,
  label,
  message,
  onMessage,
}: {
  model: ReportModel;
  label: string;
  message: string;
  onMessage: (v: string) => void;
}) {
  const { code } = useTeam();
  const adminToken = readJSON<string>("evac:admin", "");
  const isAdmin = useQuery(api.admin.me, adminToken ? { token: adminToken } : "skip");
  const people = useQuery(api.admin.participants, isAdmin ? { token: adminToken } : "skip");
  const mode = useQuery(api.mailData.mailMode, isAdmin ? { token: adminToken } : "skip");
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const sendReport = useAction(api.mail.sendReport);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <Card className="no-print">
        <h2 className="mb-1 text-lg font-bold">Envoyer le rapport par courriel</h2>
        <p className="text-sm text-muted">
          Réservé à l'administrateur.{" "}
          <Link to="/admin" className="underline">
            Se connecter dans Gestion
          </Link>
          .
        </p>
      </Card>
    );
  }

  const withMail = (people ?? []).filter((p) => p.active && p.email);
  const extraList = extra
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  // Same address twice (two entries, or typed again) is sent only once.
  const recipients = [
    ...new Set([...withMail.filter((p) => !unchecked.has(p._id)).map((p) => p.email!), ...extraList].map((e) => e.toLowerCase())),
  ];
  const shownMessage = message || defaultReportMessageHtml(model.dateLong);

  async function send() {
    if (!recipients.length) return;
    if (!window.confirm(`Envoyer le rapport PDF à ${recipients.length} destinataire${recipients.length > 1 ? "s" : ""} ?`)) return;
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const assets = await loadAssets(model);
      const pdf = await (await import("../export/pdf")).renderPdf(model, assets);
      const upload = async (blob: Blob, filename: string, contentType: string) => {
        const url = await generateUploadUrl({ code });
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": contentType }, body: blob });
        if (!res.ok) throw new Error(`Envoi du fichier refusé (${res.status}).`);
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        return { storageId, filename, contentType };
      };
      const files = [await upload(pdf, reportFileName(model.exDate, label, "pdf"), "application/pdf")];
      const r = await sendReport({
        token: adminToken,
        recipients,
        title: model.title,
        exDate: model.exDate,
        message: parseRich(shownMessage),
        files,
        exerciseIds: model.schools.map((x) => x.exerciseId as Id<"exercises">),
      });
      const parts = [];
      if (r.sent) parts.push(`${r.sent} envoyé${r.sent > 1 ? "s" : ""}`);
      if (r.simulated) parts.push(`${r.simulated} simulé${r.simulated > 1 ? "s" : ""}`);
      if (r.errors) parts.push(`${r.errors} en erreur (voir le journal dans Gestion)`);
      setResult(`${parts.join(", ")}. La saisie des exercices du rapport est maintenant clôturée.`);
    } catch (e) {
      setError(errorMessage(e, "Envoi impossible."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="no-print">
      <h2 className="mb-1 text-lg font-bold">Envoyer le rapport par courriel</h2>
      {mode?.simulated ? (
        <p className="mb-3 rounded-xl border-2 border-amber bg-amber/15 p-3 text-sm">
          <strong>Mode simulation :</strong> rien ne part réellement, les envois apparaissent dans le journal de Gestion.
        </p>
      ) : (
        mode && <p className="mb-3 text-sm text-muted">Envoi depuis {mode.from}, avec le rapport en PDF. Le Word reste pour toi (bouton « Télécharger Word »).</p>
      )}
      <fieldset className="mb-3">
        <legend className="mb-1 font-medium">Destinataires</legend>
        {withMail.length === 0 && <p className="text-sm text-muted">Aucun·e participant·e avec une adresse.</p>}
        {withMail.map((p) => (
          <label key={p._id} className="flex min-h-12 items-center gap-3">
            <input
              type="checkbox"
              className="h-6 w-6 accent-brand"
              checked={!unchecked.has(p._id)}
              onChange={() =>
                setUnchecked((s) => {
                  const n = new Set(s);
                  if (n.has(p._id)) n.delete(p._id);
                  else n.add(p._id);
                  return n;
                })
              }
            />
            <span>
              {p.firstName} {p.lastName} <span className="text-sm text-muted">{p.email}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label htmlFor="extra-recipients" className="font-medium">
        Autres destinataires (directions, commune…)
      </label>
      <textarea
        id="extra-recipients"
        className="field mb-3"
        rows={2}
        placeholder="Une adresse par ligne"
        value={extra}
        onChange={(e) => setExtra(e.target.value)}
      />
      <RichEditor id="mail-message" label="Message d'accompagnement" value={shownMessage} onChange={onMessage} minRows={6} />
      {error && (
        <div className="mt-2">
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}
      {result && (
        <p className="mt-2 font-medium" role="status">
          {result}
        </p>
      )}
      <Button className="mt-3 w-full" onClick={send} disabled={busy || recipients.length === 0}>
        {busy ? "Préparation et envoi…" : `Envoyer le rapport (${recipients.length} destinataire${recipients.length > 1 ? "s" : ""})`}
      </Button>
    </Card>
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
        `Export impossible : ${errorMessage(e, "erreur inconnue")}`,
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
      <RichView value={model.intro} />
      <h3 className="mt-4 text-lg font-bold text-brand">Objectif</h3>
      <RichView value={model.objective} />
      <h3 className="mt-4 text-lg font-bold text-brand">Critères d'évaluation</h3>
      <RichView value={model.criteria} />

      {model.schools.map((s) => (
        <section key={s.exerciseId} className="mt-4">
          <h3 className="mt-4 text-lg font-bold text-brand">
            {model.mode === "day" ? t(s.school) : "Déroulement"}
          </h3>
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
          {s.timingNotes.map((n, i) => (
            <p key={i} className="text-sm text-muted">
              {t(n)}
            </p>
          ))}
          {s.zonesObserved && (
            <p className="text-sm text-muted">
              <strong>Zones observées :</strong> {t(s.zonesObserved)}
            </p>
          )}
          {s.groups.map((g) => (
            <div key={g.title} className="mt-3">
              <h4 className="font-bold text-brand-dark">{t(g.title)}</h4>
              {g.issues.map((l, i) => (
                <div key={i}>
                  <p>{t(l.text)}</p>
                  {l.comments.map((c, j) => (
                    <p key={j} className="ml-4 text-sm italic text-muted">
                      {t(c)}
                    </p>
                  ))}
                </div>
              ))}
              {g.ok.length > 0 && (
                <p className="mt-1 text-sm text-muted">
                  <strong>En ordre :</strong> {t(g.ok.join(" "))}
                </p>
              )}
            </div>
          ))}
          {s.remarks.length > 0 && (
            <div className="mt-3">
              <h4 className="font-bold text-brand-dark">Remarques</h4>
              {s.remarks.map((r, i) => (
                <p key={i}>{t(r)}</p>
              ))}
            </div>
          )}
          {s.photos.length > 0 && (
            <div className="mt-3">
              <h4 className="font-bold text-brand-dark">Photos</h4>
              <div className="grid grid-cols-3 gap-2">
                {s.photos.map((p) => (
                  <figure key={p.url}>
                    <img src={p.url} alt={p.caption} className="w-full rounded-lg" />
                    <figcaption className="text-xs text-muted">{t(p.caption)}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
        </section>
      ))}

      {model.recommendations && (
        <>
          <h3 className="mt-4 text-lg font-bold text-brand">Recommandations</h3>
          <RichView value={model.recommendations} />
        </>
      )}
      <h3 className="mt-4 text-lg font-bold text-brand">Conclusion</h3>
      <RichView value={model.conclusion} />
      <footer className="mt-6 border-t border-line pt-2 text-sm text-muted">
        CP Moncor, www.cpmoncor.ch
      </footer>
    </article>
  );
}

function Runs({ runs }: { runs: RichRun[] }) {
  return (
    <>
      {runs.map((r, i) => {
        if (r.text === "\n") return <br key={i} />;
        let node: React.ReactNode = r.text;
        if (r.italic) node = <em>{node}</em>;
        if (r.underline) node = <u>{node}</u>;
        if (r.bold) node = <strong>{node}</strong>;
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

/** Renders stored rich text from the whitelist structure only (never as raw HTML). */
function RichView({ value }: { value: string }) {
  const doc = mapRuns(parseRich(value), typo);
  return (
    <div className="rich-content">
      {doc.map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>
            <Runs runs={b.runs} />
          </p>
        ) : b.kind === "h" ? (
          <h4 key={i} className="mt-2 font-bold">
            <Runs runs={b.runs} />
          </h4>
        ) : b.kind === "ul" ? (
          <ul key={i}>
            {b.items.map((it, j) => (
              <li key={j}>
                <Runs runs={it} />
              </li>
            ))}
          </ul>
        ) : (
          <ol key={i}>
            {b.items.map((it, j) => (
              <li key={j}>
                <Runs runs={it} />
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
