import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { itemsForRole, ZONES, type Role } from "../domain/checklist";
import { fmtClock } from "../domain/format";
import { attribution } from "../domain/buildReport";
import { device } from "../lib/storage";
import { useObservationDraft, useStamps, type Draft } from "../lib/sync";
import { useTeam } from "../lib/team";
import { Checklist } from "../components/Checklist";
import { PhotoButton, Thumbs } from "../components/Photos";
import { Stopwatch } from "../components/Stopwatch";
import { Timeline } from "../components/Timeline";
import {
  Button,
  Card,
  Chip,
  ErrorBox,
  Spinner,
  SyncDot,
  TopBar,
} from "../components/ui";

export function ExercisePage() {
  const { id } = useParams<{ id: string }>();
  const exerciseId = id as Id<"exercises">;
  const { code } = useTeam();
  const ex = useQuery(api.exercises.get, { code, id: exerciseId });
  const { draft, setDraft, join, status, error } = useObservationDraft(
    exerciseId,
    code,
  );

  if (ex === undefined) return <Spinner />;
  if (ex === null)
    return (
      <main className="p-4">
        <ErrorBox>Exercice introuvable.</ErrorBox>
        <Link to="/" className="mt-4 block underline">
          Retour à l'accueil
        </Link>
      </main>
    );

  if (!draft?.observer) return <JoinForm ex={ex} onJoin={join} />;

  return (
    <ExerciseScreen
      ex={ex}
      draft={draft}
      setDraft={setDraft}
      join={join}
      status={status}
      error={error}
    />
  );
}

function JoinForm({
  ex,
  onJoin,
}: {
  ex: Doc<"exercises">;
  onJoin: (d: Pick<Draft, "observer" | "zone" | "role">) => void;
}) {
  const [params] = useSearchParams();
  const [name, setName] = useState(device.name);
  const [zone, setZone] = useState("");
  const [customZone, setCustomZone] = useState("");
  const [role, setRole] = useState<Role>(
    params.get("lead") === "1" ? "lead" : "obs",
  );
  const finalZone = zone === "__custom" ? customZone.trim() : zone;
  const ready = name.trim().length > 1 && (role === "lead" || finalZone);

  return (
    <>
      <TopBar title={ex.school} back="/" />
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-4">
        <Card>
          <h2 className="mb-3 text-xl font-bold">Rejoindre l'exercice</h2>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!ready) return;
              device.name = name.trim();
              onJoin({
                observer: name.trim(),
                zone: finalZone || undefined,
                role,
              });
            }}
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="name" className="font-medium">
                Prénom et nom
              </label>
              <input
                id="name"
                className="field"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex. Pierre-Alain Schütz"
              />
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-medium">Mon rôle</legend>
              <div className="grid grid-cols-2 gap-2">
                <Chip active={role === "lead"} onClick={() => setRole("lead")}>
                  Je suis l'interpellateur
                </Chip>
                <Chip active={role === "obs"} onClick={() => setRole("obs")}>
                  J'observe
                </Chip>
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-medium">
                Ma zone{" "}
                {role === "lead" && (
                  <span className="text-muted">(facultatif)</span>
                )}
              </legend>
              <div className="flex flex-wrap gap-2">
                {ZONES.map((z) => (
                  <Chip
                    key={z}
                    active={zone === z}
                    onClick={() => setZone(zone === z ? "" : z)}
                  >
                    {z}
                  </Chip>
                ))}
                <Chip
                  active={zone === "__custom"}
                  onClick={() => setZone("__custom")}
                >
                  Autre…
                </Chip>
              </div>
              {zone === "__custom" && (
                <input
                  className="field"
                  aria-label="Zone"
                  placeholder="ex. Aile ouest"
                  value={customZone}
                  onChange={(e) => setCustomZone(e.target.value)}
                />
              )}
            </fieldset>

            <Button type="submit" disabled={!ready} className="text-lg">
              Rejoindre
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}

function ExerciseScreen({
  ex,
  draft,
  setDraft,
  join,
  status,
  error,
}: {
  ex: Doc<"exercises">;
  draft: Draft;
  setDraft: (u: (d: Draft) => Draft) => void;
  join: (d: Pick<Draft, "observer" | "zone" | "role">) => void;
  status: ReturnType<typeof useObservationDraft>["status"];
  error: string | null;
}) {
  const { code } = useTeam();
  const team = useQuery(api.observations.byExercise, {
    code,
    exerciseId: ex._id,
  });
  const update = useMutation(api.exercises.update);
  const { tap, pending } = useStamps(ex._id, code);
  const [showQr, setShowQr] = useState(false);
  const author = attribution(draft).slice(1, -1);

  // Register the lead's name on the exercise once.
  useEffect(() => {
    if (draft.role === "lead" && ex.leadName !== draft.observer) {
      void update({
        code,
        id: ex._id,
        patch: { leadName: draft.observer },
      }).catch(() => {});
    }
  }, [draft.role, draft.observer, ex.leadName, ex._id, code, update]);

  const photoUrls = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const o of team ?? [])
      for (const p of o.photos) map[p.storageId] = p.url;
    return map;
  }, [team]);

  const shownTimes = {
    tStart: ex.tStart ?? pending.tStart,
    tEvac: ex.tEvac ?? pending.tEvac,
    tPresent: ex.tPresent ?? pending.tPresent,
  };

  return (
    <>
      <div
        className={`sticky top-0 z-20 text-white ${shownTimes.tEvac && !shownTimes.tPresent ? "bg-brand" : "bg-ink"}`}
      >
        <div className="flex items-center gap-2 px-3 pt-1">
          <Link
            to="/"
            className="flex min-h-12 min-w-12 items-center justify-center text-2xl"
            aria-label="Retour à l'accueil"
          >
            ‹
          </Link>
          <p className="flex-1 truncate font-display text-lg font-bold">
            {ex.school}
          </p>
          <SyncDot status={status} title={error ?? undefined} />
        </div>
        <div className="px-3 pb-3">
          <Stopwatch {...shownTimes} />
        </div>
      </div>

      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-3 pb-28">
        {status === "error" && error && (
          <ErrorBox>Synchronisation refusée : {error}</ErrorBox>
        )}

        <div className="flex items-center justify-between gap-2 text-sm">
          <p>
            <strong>{draft.observer}</strong> ·{" "}
            {draft.role === "lead" ? "Interpellateur" : "Observateur·rice"}
            {draft.zone ? ` · ${draft.zone}` : ""}
          </p>
          <button
            type="button"
            className="min-h-12 underline"
            onClick={() =>
              join({
                observer: draft.observer,
                zone: draft.zone,
                role: draft.role === "lead" ? "obs" : "lead",
              })
            }
          >
            Changer de rôle
          </button>
        </div>

        {draft.role === "lead" && (
          <>
            <ContextCard ex={ex} code={code} />
            {!ex.tStart && !pending.tStart && (
              <Button
                className="min-h-20 text-2xl font-bold"
                onClick={() => tap("tStart")}
              >
                Début
              </Button>
            )}
          </>
        )}

        {draft.role === "obs" && !ex.tEvac && !pending.tEvac && (
          <Button
            className="min-h-20 text-xl font-bold"
            onClick={() => tap("tEvac")}
          >
            J'entends l'alarme évacuation
          </Button>
        )}

        <Timeline
          ex={ex}
          role={draft.role}
          code={code}
          pending={pending}
          onStamp={tap}
          author={author}
        />

        {draft.role === "obs" && (
          <Card>
            {draft.tClear ? (
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  Ma zone est évacuée à {fmtClock(draft.tClear)}
                </p>
                <Button
                  variant="ghost"
                  onClick={() => setDraft((d) => ({ ...d, tClear: undefined }))}
                >
                  Annuler
                </Button>
              </div>
            ) : (
              <Button
                className="w-full"
                variant="dark"
                onClick={() => setDraft((d) => ({ ...d, tClear: Date.now() }))}
              >
                Ma zone est évacuée
              </Button>
            )}
          </Card>
        )}

        <Checklist
          role={draft.role}
          draft={draft}
          setDraft={setDraft}
          code={code}
          photoUrls={photoUrls}
        />

        <Card>
          <h2 className="mb-2 text-xl font-bold">Remarques</h2>
          <textarea
            className="field"
            rows={4}
            aria-label="Remarques libres"
            placeholder="Tout ce qui mérite d'être dit dans le rapport."
            value={draft.remarks ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, remarks: e.target.value }))
            }
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PhotoButton
              code={code}
              label="Photo générale"
              onAdded={(storageId) =>
                setDraft((d) => ({
                  ...d,
                  photos: [...d.photos, { storageId }],
                }))
              }
            />
            <Thumbs
              photos={draft.photos.filter((p) => !p.itemId)}
              urls={photoUrls}
              onRemove={(id) =>
                setDraft((d) => ({
                  ...d,
                  photos: d.photos.filter((p) => p.storageId !== id),
                }))
              }
            />
          </div>
        </Card>

        <TeamCard team={team} />

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setShowQr(true)}>
            Inviter (QR code)
          </Button>
          <Link
            to={`/rapport/${ex._id}`}
            className="flex min-h-12 items-center justify-center rounded-xl bg-ink px-4 font-medium text-white"
          >
            Synthèse
          </Link>
        </div>
      </main>

      {showQr && (
        <QrModal exId={ex._id} code={code} onClose={() => setShowQr(false)} />
      )}
    </>
  );
}

function ContextCard({ ex, code }: { ex: Doc<"exercises">; code: string }) {
  const update = useMutation(api.exercises.update);
  const [local, setLocal] = useState({
    classroom: ex.classroom ?? "",
    teacher: ex.teacher ?? "",
    fireDetail: ex.fireDetail ?? "",
  });
  const timer = useRef<number | undefined>(undefined);

  const save = (patch: Partial<typeof local>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void update({ code, id: ex._id, patch: next }).catch(() => {});
    }, 600);
  };

  return (
    <Card>
      <h2 className="mb-3 text-xl font-bold">Personne interpellée</h2>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <input
            className="field"
            aria-label="Classe"
            placeholder="Classe (ex. 5H)"
            value={local.classroom}
            onChange={(e) => save({ classroom: e.target.value })}
          />
          <input
            className="field"
            aria-label="Enseignant·e"
            placeholder="Enseignant·e"
            value={local.teacher}
            onChange={(e) => save({ teacher: e.target.value })}
          />
        </div>
        <p className="font-medium">Sinistre fictif</p>
        <div className="grid grid-cols-2 gap-2">
          <Chip
            active={ex.fireLocation === "classe"}
            onClick={() =>
              void update({
                code,
                id: ex._id,
                patch: { fireLocation: "classe" },
              })
            }
          >
            Dans la classe
          </Chip>
          <Chip
            active={ex.fireLocation === "ailleurs"}
            onClick={() =>
              void update({
                code,
                id: ex._id,
                patch: { fireLocation: "ailleurs" },
              })
            }
          >
            Ailleurs
          </Chip>
        </div>
        <input
          className="field"
          aria-label="Précision sur le lieu du sinistre"
          placeholder="Précision (ex. local technique du sous-sol)"
          value={local.fireDetail}
          onChange={(e) => save({ fireDetail: e.target.value })}
        />
      </div>
    </Card>
  );
}

function TeamCard({ team }: { team: Doc<"observations">[] | undefined }) {
  if (!team) return null;
  return (
    <Card>
      <h2 className="mb-2 text-xl font-bold">Équipe ({team.length})</h2>
      <ul className="flex flex-col">
        {team.map((o) => {
          const total = itemsForRole(o.role).length;
          const done = itemsForRole(o.role).filter(
            (i) => o.answers[i.id]?.v,
          ).length;
          return (
            <li
              key={o._id}
              className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{o.observer}</p>
                <p className="text-sm text-muted">
                  {o.role === "lead" ? "Interpellateur" : "Observateur·rice"}
                  {o.zone ? ` · ${o.zone}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right text-sm tabular">
                <p>
                  {done}/{total} points
                </p>
                {o.role === "obs" && (
                  <p
                    className={o.tClear ? "font-medium text-ok" : "text-muted"}
                  >
                    {o.tClear
                      ? `Évacuée ${fmtClock(o.tClear)}`
                      : "Zone non évacuée"}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function QrModal({
  exId,
  code,
  onClose,
}: {
  exId: string;
  code: string;
  onClose: () => void;
}) {
  const link = `${window.location.origin}${window.location.pathname}#/x/${exId}?k=${encodeURIComponent(code)}`;
  const [copied, setCopied] = useState(false);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal
      aria-label="Inviter l'équipe"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-white p-5">
        <h2 className="text-xl font-bold">Scanner pour rejoindre</h2>
        <QRCodeSVG value={link} size={260} marginSize={2} />
        <Button
          variant="secondary"
          className="w-full"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Lien copié" : "Copier le lien"}
        </Button>
        <Button className="w-full" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  );
}
