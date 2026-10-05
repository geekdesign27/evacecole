import { useState } from "react";
import { X } from "lucide-react";
import { useAction, useMutation, useQuery } from "convex/react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { fmtDateLong, todayIso } from "../domain/format";
import { readJSON, removeKey, writeJSON } from "../lib/storage";
import { useTeam } from "../lib/team";
import {
  Button,
  Card,
  Chip,
  ErrorBox,
  Spinner,
  TopBar,
} from "../components/ui";
import { errorMessage } from "../lib/errors";

const TOKEN_KEY = "evac:admin";

export function inviteLink(code: string, name?: string) {
  const n = name ? `&n=${encodeURIComponent(name)}` : "";
  return `${window.location.origin}${window.location.pathname}#/?k=${encodeURIComponent(code)}${n}`;
}


/** Newest code still usable (today or later, not revoked): used for invitations. */
function useInviteCode(token: string) {
  const codes = useQuery(api.admin.codes, { token });
  return codes?.find((c) => !c.revoked && !c.expired) ?? null;
}


export function AdminPage() {
  const [token, setToken] = useState(() => readJSON<string>(TOKEN_KEY, ""));
  const ok = useQuery(api.admin.me, token ? { token } : "skip");
  const logout = useMutation(api.admin.logout);

  if (token && ok === undefined) return <Spinner />;
  if (!token || !ok) {
    return (
      <Login
        onLogged={(t) => {
          writeJSON(TOKEN_KEY, t);
          setToken(t);
        }}
      />
    );
  }

  return (
    <>
      <TopBar
        title="Gestion"
        back="/"
        right={
          <button
            type="button"
            className="min-h-12 px-2 underline"
            onClick={() => {
              void logout({ token });
              removeKey(TOKEN_KEY);
              setToken("");
            }}
          >
            Déconnexion
          </button>
        }
      />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <Codes token={token} />
        <Participants token={token} />
        <Schools token={token} />
        <Exercises token={token} />
        <MailJournal token={token} />
      </main>
    </>
  );
}

function Login({ onLogged }: { onLogged: (token: string) => void }) {
  const login = useMutation(api.admin.login);
  const [user, setUser] = useState("schutz.pa");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <TopBar title="Gestion" back="/" />
      <main className="mx-auto max-w-md p-4">
        <Card>
          <form
            className="flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const res = await login({ user, password });
                if (res.ok) onLogged(res.token);
                else setError(res.error);
              } catch (err) {
                setError(
                  errorMessage(err, "Connexion impossible."),
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2 className="text-xl font-bold">Connexion administrateur</h2>
            <label htmlFor="adm-user" className="font-medium">
              Identifiant
            </label>
            <input
              id="adm-user"
              className="field"
              autoCapitalize="none"
              autoComplete="username"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
            <label htmlFor="adm-pass" className="font-medium">
              Mot de passe
            </label>
            <input
              id="adm-pass"
              type="password"
              className="field"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <ErrorBox>{error}</ErrorBox>}
            <Button type="submit" disabled={busy || !password}>
              {busy ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}

function periodText(from: string, to?: string) {
  return !to || to === from ? fmtDateLong(from) : `du ${fmtDateLong(from)} au ${fmtDateLong(to)}`;
}

/** Inline editor of a code's validity period (extending the end date reactivates it). */
function CodeDates({ token, id, validDate, validUntil }: { token: string; id: Id<"accessCodes">; validDate: string; validUntil: string }) {
  const setDates = useMutation(api.admin.setCodeDates);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(validDate);
  const [to, setTo] = useState(validUntil < todayIso() ? todayIso() : validUntil);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Dates / prolonger
      </Button>
    );
  }
  return (
    <div className="flex basis-full flex-col gap-2 rounded-xl bg-bg p-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col text-sm font-medium">
          Valable du
          <input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col text-sm font-medium">
          au
          <input type="date" className="field" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="flex gap-2">
        <Button
          onClick={async () => {
            setError(null);
            try {
              await setDates({ token, id, validDate: from, validUntil: to });
              setOpen(false);
            } catch (e) {
              setError(errorMessage(e, "Enregistrement impossible."));
            }
          }}
        >
          Enregistrer les dates
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

function Codes({ token }: { token: string }) {
  const codes = useQuery(api.admin.codes, { token });
  const create = useMutation(api.admin.createCode);
  const revoke = useMutation(api.admin.revokeCode);
  const { code: deviceCode, setCode } = useTeam();
  const [date, setDate] = useState(todayIso());
  const [until, setUntil] = useState(todayIso());
  const [label, setLabel] = useState("");
  const [custom, setCustom] = useState("");
  const [shown, setShown] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <h2 className="mb-1 text-xl font-bold">Codes du jour</h2>
      <p className="mb-3 text-sm text-muted">
        Valable du premier au dernier jour choisis (inclus). Le QR code d'un exercice transmet le code
        actif. Un code expiré se réactive en prolongeant sa date de fin.
      </p>
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col text-sm font-medium">
            Valable du
            <input
              type="date"
              className="field"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                if (until < e.target.value) setUntil(e.target.value);
              }}
            />
          </label>
          <label className="flex flex-col text-sm font-medium">
            au
            <input type="date" className="field" min={date} value={until} onChange={(e) => setUntil(e.target.value)} />
          </label>
        </div>
        <input
          className="field"
          aria-label="Libellé"
          placeholder="Libellé (facultatif)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          className="field"
          aria-label="Mon code"
          autoCapitalize="none"
          autoComplete="off"
          placeholder="Mon code (facultatif, ex. moncor5), sinon généré"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <Button
          onClick={async () => {
            setError(null);
            try {
              const c = await create({
                token,
                validDate: date,
                validUntil: until,
                label: label || undefined,
                custom: custom || undefined,
              });
              setLabel("");
              setCustom("");
              setShown(c);
            } catch (e) {
              setError(errorMessage(e, "Création impossible."));
            }
          }}
        >
          Créer le code
        </Button>
        {error && <ErrorBox>{error}</ErrorBox>}
      </div>

      {codes === undefined ? (
        <Spinner />
      ) : (
        <ul className="mt-3 flex flex-col">
          {codes.map((c) => (
            <li key={c._id} className="border-b border-line py-3 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold tabular">
                    {c.code}
                  </p>
                  <p className="text-sm text-muted">
                    {periodText(c.validDate, c.validUntil)}
                    {c.label ? ` · ${c.label}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
                    c.revoked
                      ? "bg-brand text-white"
                      : c.active
                        ? "bg-ok text-white"
                        : "bg-line text-ink"
                  }`}
                >
                  {c.revoked
                    ? "Révoqué"
                    : c.active
                      ? "Actif"
                      : c.expired
                        ? "Expiré"
                        : "À venir"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setShown(shown === c.code ? null : c.code)}
                >
                  {shown === c.code ? "Masquer le QR" : "QR code"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteLink(c.code));
                      setCopied(c.code);
                    } catch {
                      setCopied(null);
                    }
                  }}
                >
                  {copied === c.code ? "Lien copié" : "Copier le lien"}
                </Button>
                {c.active && deviceCode !== c.code && (
                  <Button variant="secondary" onClick={() => setCode(c.code)}>
                    Utiliser sur ce téléphone
                  </Button>
                )}
                <CodeDates token={token} id={c._id} validDate={c.validDate} validUntil={c.validUntil ?? c.validDate} />
                <Button
                  variant={c.revoked ? "secondary" : "primary"}
                  onClick={() =>
                    void revoke({ token, id: c._id, revoked: !c.revoked })
                  }
                >
                  {c.revoked ? "Réactiver" : "Révoquer"}
                </Button>
              </div>
              {shown === c.code && (
                <div className="mt-3 flex justify-center">
                  <QRCodeSVG
                    value={inviteLink(c.code)}
                    size={240}
                    marginSize={2}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** « Prénom; Nom; courriel; fonction » per line (semicolon or tab). */
function parseParticipants(text: string) {
  return text
    .split("\n")
    .map((l) => l.split(/[;\t]/).map((s) => s.trim()))
    .filter((cols) => cols[0] || cols[1])
    .map(([firstName = "", lastName = "", email = "", fonction = ""]) => ({
      firstName,
      lastName,
      email: email || undefined,
      fonction: fonction || undefined,
    }));
}

function MailMode({ token }: { token: string }) {
  const mode = useQuery(api.mailData.mailMode, { token });
  if (!mode) return null;
  return mode.simulated ? (
    <p className="mb-3 rounded-xl border-2 border-amber bg-amber/15 p-3 text-sm">
      <strong>Mode simulation :</strong> aucun courriel ne part réellement, ils apparaissent seulement dans le journal. Envoi réel dès que
      GMAIL_APP_PASSWORD est configuré dans Convex.
    </p>
  ) : (
    <p className="mb-3 text-sm text-muted">Envoi depuis {mode.from}.</p>
  );
}

function resultText(r: { sent: number; simulated: number; errors: number }) {
  const parts = [];
  if (r.sent) parts.push(`${r.sent} envoyé${r.sent > 1 ? "s" : ""}`);
  if (r.simulated) parts.push(`${r.simulated} simulé${r.simulated > 1 ? "s" : ""}`);
  if (r.errors) parts.push(`${r.errors} en erreur (voir le journal)`);
  return parts.join(", ") || "Aucun destinataire avec une adresse.";
}

type Participant = {
  _id: Id<"participants">;
  firstName: string;
  lastName: string;
  email?: string;
  fonction?: string;
  active: boolean;
};

function ParticipantRow({ p, token, invite }: { p: Participant; token: string; invite: { _id: Id<"accessCodes">; code: string } | null }) {
  const update = useMutation(api.admin.updateParticipant);
  const remove = useMutation(api.admin.removeParticipant);
  const sendInvites = useAction(api.mail.sendInvites);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: p.firstName, lastName: p.lastName, email: p.email ?? "", fonction: p.fonction ?? "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const name = `${p.firstName} ${p.lastName}`.trim();

  if (editing) {
    return (
      <li className="border-b border-line py-3 last:border-0">
        <form
          className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            try {
              await update({
                token,
                id: p._id,
                firstName: form.firstName,
                lastName: form.lastName,
                email: form.email || undefined,
                fonction: form.fonction || undefined,
                active: p.active,
              });
              setEditing(false);
            } catch (err) {
              setError(errorMessage(err, "Enregistrement impossible."));
            }
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <input className="field" aria-label="Prénom" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <input className="field" aria-label="Nom" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <input className="field" type="email" aria-label="Courriel" placeholder="Courriel" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="field" aria-label="Fonction" placeholder="Fonction" value={form.fonction} onChange={(e) => setForm({ ...form, fonction: e.target.value })} />
          {error && <ErrorBox>{error}</ErrorBox>}
          <div className="flex gap-2">
            <Button type="submit">Enregistrer</Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-2 border-b border-line py-2 last:border-0">
      <div className="min-w-0">
        <p className={`truncate font-medium ${p.active ? "" : "text-muted line-through"}`}>{name}</p>
        <p className="truncate text-sm text-muted">{[p.fonction, p.email].filter(Boolean).join(" · ") || "Pas de courriel"}</p>
        <div className="flex flex-wrap gap-x-4">
          <button type="button" className="min-h-12 font-medium underline" onClick={() => setEditing(true)} aria-label={`Modifier ${name}`}>
            Modifier
          </button>
          {invite && p.active && p.email && (
            <button
              type="button"
              disabled={busy}
              className="min-h-12 font-medium text-brand underline disabled:opacity-50"
              onClick={async () => {
                setBusy(true);
                setMsg(null);
                try {
                  setMsg(resultText(await sendInvites({ token, codeId: invite._id, participantIds: [p._id] })));
                } catch (err) {
                  setMsg(errorMessage(err, "Envoi impossible."));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Envoi…" : "Envoyer son invitation"}
            </button>
          )}
          {invite && p.active && <CopyLink link={inviteLink(invite.code, name)} />}
        </div>
        {msg && (
          <p className="text-sm" role="status">
            {msg}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <Chip
          active={p.active}
          onClick={() =>
            void update({ token, id: p._id, firstName: p.firstName, lastName: p.lastName, email: p.email, fonction: p.fonction, active: !p.active })
          }
        >
          {p.active ? "Actif" : "Inactif"}
        </Chip>
        <button
          type="button"
          className="flex min-h-12 min-w-12 items-center justify-center rounded-xl"
          aria-label={`Supprimer ${name}`}
          onClick={() => {
            if (window.confirm(`Supprimer ${name} ?`)) void remove({ token, id: p._id });
          }}
        >
          <X size={20} />
        </button>
      </div>
    </li>
  );
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="min-h-12 font-medium underline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Lien copié" : "Copier son lien"}
    </button>
  );
}


function Participants({ token }: { token: string }) {
  const invite = useInviteCode(token);
  const list = useQuery(api.admin.participants, { token });
  const add = useMutation(api.admin.addParticipants);
  const sendInvites = useAction(api.mail.sendInvites);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", fonction: "" });
  const [bulk, setBulk] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const withMail = (list ?? []).filter((p) => p.active && p.email);

  async function submit(entries: ReturnType<typeof parseParticipants>) {
    setError(null);
    try {
      const n = await add({ token, list: entries });
      setMsg(n === 0 ? "Déjà dans la liste." : `${n} ${n > 1 ? "personnes ajoutées" : "personne ajoutée"}.`);
      return true;
    } catch (e) {
      setError(errorMessage(e, "Ajout impossible."));
      return false;
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-xl font-bold">Participant·es</h2>
      <p className="mb-3 text-sm text-muted">Les personnes actives apparaissent sur l'écran « Rejoindre » : un tap sur son nom suffit.</p>
      <MailMode token={token} />
      {list !== undefined && list.length > 0 && !invite && (
        <p className="mb-2 text-sm font-medium">Crée d'abord un code du jour pour pouvoir envoyer les invitations.</p>
      )}
      {invite && withMail.length > 0 && (
        <Button
          className="mb-3 w-full"
          variant="dark"
          disabled={sending}
          onClick={async () => {
            if (!window.confirm(`Envoyer l'invitation (code ${invite.code}) à ${withMail.length} personne${withMail.length > 1 ? "s" : ""} ?`)) return;
            setSending(true);
            setMsg(null);
            try {
              setMsg(resultText(await sendInvites({ token, codeId: invite._id })));
            } catch (e) {
              setError(errorMessage(e, "Envoi impossible."));
            } finally {
              setSending(false);
            }
          }}
        >
          {sending ? "Envoi en cours…" : `Envoyer les invitations à tout le monde (${withMail.length})`}
        </Button>
      )}
      {list === undefined ? (
        <Spinner />
      ) : (
        <ul className="mb-3 flex flex-col">
          {list.length === 0 && <li className="text-muted">Aucune personne inscrite.</li>}
          {list.map((p) => (
            <ParticipantRow key={p._id} p={p} token={token} invite={invite} />
          ))}
        </ul>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await submit([{ ...form, email: form.email || undefined, fonction: form.fonction || undefined }])) {
            setForm({ firstName: "", lastName: "", email: "", fonction: "" });
          }
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <input className="field" aria-label="Prénom" placeholder="Prénom" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <input className="field" aria-label="Nom" placeholder="Nom" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </div>
        <input className="field" type="email" aria-label="Courriel" placeholder="Courriel" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="field" aria-label="Fonction" placeholder="Fonction" value={form.fonction} onChange={(e) => setForm({ ...form, fonction: e.target.value })} />
        <Button type="submit" variant="dark" disabled={!form.firstName.trim() && !form.lastName.trim()}>
          Ajouter
        </Button>
      </form>

      <details className="mt-3">
        <summary className="min-h-12 cursor-pointer py-3 font-medium">Coller une liste</summary>
        <p className="mb-2 text-sm text-muted">Une personne par ligne : Prénom; Nom; courriel; fonction</p>
        <textarea className="field" rows={5} aria-label="Liste à importer" value={bulk} onChange={(e) => setBulk(e.target.value)} />
        <Button
          className="mt-2"
          variant="dark"
          disabled={!bulk.trim()}
          onClick={async () => {
            if (await submit(parseParticipants(bulk))) setBulk("");
          }}
        >
          Importer
        </Button>
      </details>
      {msg && (
        <p className="mt-2 text-sm" role="status">
          {msg}
        </p>
      )}
      {error && (
        <div className="mt-2">
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}
    </Card>
  );
}

function MailJournal({ token }: { token: string }) {
  const list = useQuery(api.mailData.journal, { token });
  const [preview, setPreview] = useState<string | null>(null);
  const STATUS = { sent: "Envoyé", simulated: "Simulé", error: "Erreur" } as const;
  return (
    <Card>
      <h2 className="mb-1 text-xl font-bold">Journal des courriels</h2>
      {list === undefined ? (
        <Spinner />
      ) : list.length === 0 ? (
        <p className="text-muted">Aucun envoi pour l'instant.</p>
      ) : (
        <ul className="flex flex-col">
          {list.map((m) => (
            <li key={m._id} className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{m.to}</p>
                <p className="truncate text-sm text-muted">
                  {new Date(m.sentAt).toLocaleString("fr-CH", { dateStyle: "short", timeStyle: "short" })} · {m.subject}
                  {m.attachments?.length ? ` · ${m.attachments.length} pièce${m.attachments.length > 1 ? "s" : ""} jointe${m.attachments.length > 1 ? "s" : ""}` : ""}
                </p>
                {m.error && <p className="text-sm text-brand-dark">{m.error}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-bold ${
                    m.status === "sent" ? "bg-ok text-white" : m.status === "error" ? "bg-brand text-white" : "bg-amber text-ink"
                  }`}
                >
                  {STATUS[m.status]}
                </span>
                {m.html && (
                  <Button variant="secondary" onClick={() => setPreview(m.html!)}>
                    Aperçu
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-3" role="dialog" aria-modal aria-label="Aperçu du courriel">
          <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white">
            {/* sandbox without scripts: the mail is displayed, never executed */}
            <iframe title="Aperçu du courriel" sandbox="" srcDoc={preview} className="h-full w-full flex-1" />
            <Button className="m-2" onClick={() => setPreview(null)}>
              Fermer
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Schools({ token }: { token: string }) {
  const list = useQuery(api.admin.schools, { token });
  const add = useMutation(api.admin.addSchools);
  const remove = useMutation(api.admin.removeSchool);
  const [text, setText] = useState("");

  return (
    <Card>
      <h2 className="mb-1 text-xl font-bold">Écoles</h2>
      <p className="mb-3 text-sm text-muted">
        Liste proposée à la création d'un exercice.
      </p>
      {list === undefined ? (
        <Spinner />
      ) : (
        <ul className="mb-3 flex flex-col">
          {list.map((s) => (
            <li
              key={s._id}
              className="flex min-h-12 items-center justify-between border-b border-line last:border-0"
            >
              <span>{s.name}</span>
              <button
                type="button"
                className="flex min-h-12 min-w-12 items-center justify-center"
                aria-label={`Retirer ${s.name}`}
                onClick={() => {
                  if (window.confirm(`Retirer « ${s.name} » de la liste ?`))
                    void remove({ token, id: s._id });
                }}
              >
                <X size={20} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        className="field"
        rows={3}
        aria-label="Écoles à ajouter"
        placeholder="Une école par ligne"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button
        className="mt-2"
        variant="dark"
        disabled={!text.trim()}
        onClick={async () => {
          await add({ token, names: text.split("\n") });
          setText("");
        }}
      >
        Ajouter
      </Button>
    </Card>
  );
}

function Exercises({ token }: { token: string }) {
  const list = useQuery(api.admin.exercises, { token });
  const remove = useMutation(api.admin.deleteExercise);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <h2 className="mb-1 text-xl font-bold">Exercices</h2>
      <p className="mb-3 text-sm text-muted">
        Supprimer efface définitivement l'exercice, toutes les saisies et les photos. Pour seulement le masquer, archive-le.
      </p>
      {error && <ErrorBox>{error}</ErrorBox>}
      {list === undefined ? (
        <Spinner />
      ) : (
        <ul className="flex flex-col">
          {list.length === 0 && <li className="text-muted">Aucun exercice.</li>}
          {list.map((ex) => (
            <li key={ex._id} className="flex min-h-12 items-center justify-between gap-2 border-b border-line py-1 last:border-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{ex.school}</p>
                <p className="text-sm text-muted">{fmtDateLong(ex.exDate)}</p>
              </div>
              <Button
                variant="secondary"
                className="shrink-0 text-brand"
                aria-label={`Supprimer l'exercice ${ex.school} du ${fmtDateLong(ex.exDate)}`}
                onClick={async () => {
                  if (!window.confirm(`Supprimer définitivement « ${ex.school} » (${fmtDateLong(ex.exDate)}) et toutes ses saisies ?`)) return;
                  setError(null);
                  try {
                    await remove({ token, id: ex._id });
                  } catch (e) {
                    setError(errorMessage(e, "Suppression impossible."));
                  }
                }}
              >
                Supprimer
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
