import { useState } from "react";
import { Ban, CalendarClock, Check, Copy, LogOut, Merge, Pencil, QrCode, RotateCcw, Smartphone, X } from "lucide-react";
import type React from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
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
            aria-label="Déconnexion"
            title="Déconnexion"
            className="flex min-h-12 min-w-12 items-center justify-center"
            onClick={() => {
              void logout({ token });
              removeKey(TOKEN_KEY);
              setToken("");
            }}
          >
            <LogOut size={24} />
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

/** Compact secondary button with an icon (admin lists). */
function SmallBtn({ className = "", children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`flex h-11 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-line bg-white px-2 text-[15px] font-medium [&>svg]:shrink-0 ${className}`}
    >
      {children}
    </button>
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
      <SmallBtn aria-label="Dates / prolonger" onClick={() => setOpen(true)}>
        <CalendarClock size={18} /> Dates
      </SmallBtn>
    );
  }
  return (
    <div className="col-span-3 flex flex-col gap-2 rounded-xl bg-bg p-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col text-sm font-medium">
          Valable du
          <input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex min-w-0 flex-col text-sm font-medium">
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
          <label className="flex min-w-0 flex-col text-sm font-medium">
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
          <label className="flex min-w-0 flex-col text-sm font-medium">
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
          placeholder="Mon code (facultatif)"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <p className="-mt-1 text-sm text-muted">Laisse vide pour un code généré automatiquement.</p>
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
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <SmallBtn
                  aria-label={shown === c.code ? "Masquer le QR code" : "QR code"}
                  onClick={() => setShown(shown === c.code ? null : c.code)}
                >
                  <QrCode size={18} /> QR
                </SmallBtn>
                <SmallBtn
                  aria-label="Copier le lien"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteLink(c.code));
                      setCopied(c.code);
                    } catch {
                      setCopied(null);
                    }
                  }}
                >
                  {copied === c.code ? <Check size={18} /> : <Copy size={18} />} Lien
                </SmallBtn>
                {c.active && deviceCode !== c.code && (
                  <SmallBtn aria-label="Utiliser sur ce téléphone" onClick={() => setCode(c.code)}>
                    <Smartphone size={18} /> Utiliser
                  </SmallBtn>
                )}
                <CodeDates token={token} id={c._id} validDate={c.validDate} validUntil={c.validUntil ?? c.validDate} />
                <SmallBtn
                  aria-label={c.revoked ? "Réactiver" : "Révoquer"}
                  className={c.revoked ? "" : "border-brand text-brand"}
                  onClick={() => void revoke({ token, id: c._id, revoked: !c.revoked })}
                >
                  {c.revoked ? <RotateCcw size={18} /> : <Ban size={18} />} {c.revoked ? "Réactiver" : "Révoquer"}
                </SmallBtn>
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
      <Duplicates token={token} />
      {list && list.length > 1 && <MergeTool token={token} list={list} />}
      {list === undefined ? (
        <Spinner />
      ) : (
        <ul className="flex flex-col">
          {list.length === 0 && <li className="text-muted">Aucun exercice.</li>}
          {list.map((ex) => (
            <ExerciseRow key={ex._id} ex={ex} token={token}>
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
            </ExerciseRow>
          ))}
        </ul>
      )}
    </Card>
  );
}

const TIME_NAMES: Record<string, string> = {
  tStart: "Début",
  tAlarm: "Alarme pompiers",
  tEvac: "Message d'évacuation",
  tPresent: "Toutes les classes présentes",
  tFiremen: "Quittance aux pompiers",
  tEnd: "Fin",
};
const TIME_ORDER = ["tStart", "tAlarm", "tEvac", "tPresent", "tFiremen", "tEnd"] as const;

const hhmm = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "non relevé");
const duration = (ms?: number) => {
  if (ms === undefined) return "non mesurée";
  const t = Math.round(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min ${t % 60} s`;
};

type Member = {
  _id: Id<"exercises">;
  school: string;
  exDate: string;
  classroom?: string;
  teacher?: string;
  times: Record<string, number | undefined>;
  timesCount: number;
  evacuationMs?: number;
  locked: boolean;
  people: string[];
  photos: number;
};

function MemberCard({ m, master, onPick, name }: { m: Member; master: boolean; onPick: () => void; name: string }) {
  return (
    <label className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${master ? "border-ok bg-white" : "border-line bg-white"}`}>
      <input type="radio" name={name} checked={master} onChange={onPick} className="mt-1 h-6 w-6 shrink-0 accent-ok" />
      <span className="flex min-w-0 flex-col gap-0.5 text-sm">
        <span className="font-bold">
          {master ? "Maître : heures et organisation" : "Versé dans le maître puis supprimé"}
        </span>
        <span>
          Évacuation <strong>{duration(m.evacuationMs)}</strong> · {m.timesCount}/6 heures · début {hhmm(m.times.tStart)}
        </span>
        <span className="text-muted">
          Classe {m.classroom || "non relevée"} · {m.teacher || "enseignant·e non relevé·e"}
        </span>
        <span className="text-muted">
          {m.people.join(", ") || "aucune saisie"} · {m.photos} photo{m.photos > 1 ? "s" : ""}
        </span>
      </span>
    </label>
  );
}

/** Groups of exercises for the same school on the same day: suggested master, then one-tap merge. */
function Duplicates({ token }: { token: string }) {
  const groups = useQuery(api.admin.duplicates, { token });
  const merge = useMutation(api.admin.mergeGroup);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!groups || groups.length === 0) return msg ? <p className="mb-3 font-medium" role="status">{msg}</p> : null;

  type Group = NonNullable<typeof groups>[number];
  const masterOf = (g: Group) => chosen[g.members[0]._id] ?? g.masterId;

  async function run(list: Group[]) {
    const n = list.length;
    if (!window.confirm(`Fusionner ${n} groupe${n > 1 ? "s" : ""} ? Les exercices non maîtres sont supprimés, leurs saisies et photos passent dans le maître.`)) return;
    setBusy(true);
    setError(null);
    let moved = 0;
    let removed = 0;
    try {
      for (const g of list) {
        const master = masterOf(g);
        const r = await merge({ token, masterId: master as Id<"exercises">, sourceIds: g.members.filter((m) => m._id !== master).map((m) => m._id) });
        moved += r.moved + r.combined;
        removed += r.removed;
      }
      setMsg(`Fusion faite : ${removed} exercice${removed > 1 ? "s" : ""} versé${removed > 1 ? "s" : ""}, ${moved} saisie${moved > 1 ? "s" : ""} regroupée${moved > 1 ? "s" : ""}.`);
    } catch (e) {
      setError(errorMessage(e, "Fusion impossible."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border-2 border-amber bg-amber/10 p-3" aria-label="Doublons à fusionner">
      <p className="font-bold">
        {groups.length} école{groups.length > 1 ? "s ont" : " a"} plusieurs exercices le même jour
      </p>
      <p className="text-sm">
        Le maître proposé est celui dont l'évacuation mesurée est la plus courte (sinon celui qui a le plus d'heures). Il garde ses heures et son
        organisation ; les autres n'apportent que les saisies des personnes. Tu peux choisir un autre maître.
      </p>
      {groups.map((g) => {
        const master = masterOf(g);
        return (
          <div key={g.masterId} className="flex flex-col gap-2">
            <p className="font-medium">
              {g.members[0].school}, {fmtDateLong(g.members[0].exDate)}
            </p>
            {[...g.members]
              .sort((a, b) => (a._id === master ? -1 : b._id === master ? 1 : 0))
              .map((m) => (
                <MemberCard
                  key={m._id}
                  m={m}
                  master={m._id === master}
                  name={`master-${g.masterId}`}
                  onPick={() => setChosen((c) => ({ ...c, [g.members[0]._id]: m._id }))}
                />
              ))}
            <Button variant="dark" disabled={busy} onClick={() => run([g])}>
              Fusionner ce groupe
            </Button>
          </div>
        );
      })}
      {groups.length > 1 && (
        <Button disabled={busy} onClick={() => run(groups)}>
          Tout fusionner ({groups.length} groupes)
        </Button>
      )}
      {error && <ErrorBox>{error}</ErrorBox>}
      {msg && (
        <p className="font-medium" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}

/** Manual merge of any two exercises: A is the master (times and organisation). */
function MergeTool({ token, list }: { token: string; list: Doc<"exercises">[] }) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const merge = useMutation(api.admin.mergeGroup);
  const ready = targetId && sourceId && targetId !== sourceId;
  const preview = useQuery(
    api.admin.mergePreview,
    open && ready ? { token, masterId: targetId as Id<"exercises">, sourceIds: [sourceId as Id<"exercises">] } : "skip",
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = (e: Doc<"exercises">) =>
    `${e.school}, ${fmtDateLong(e.exDate)}${e.tStart ? `, début ${new Date(e.tStart).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}` : ""}`;

  if (!open) {
    return (
      <div className="mb-3">
        <Button variant="secondary" className="flex w-full items-center justify-center gap-2" onClick={() => setOpen(true)}>
          <Merge size={20} /> Fusionner deux exercices à la main
        </Button>
        {msg && (
          <p className="mt-2 text-sm font-medium" role="status">
            {msg}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl bg-bg p-3">
      <h3 className="font-bold">Fusionner deux exercices</h3>
      <label className="flex flex-col gap-1 text-sm font-medium">
        A, le maître (heures et organisation gardées)
        <select className="field" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          <option value="">Choisir…</option>
          {list.map((e) => (
            <option key={e._id} value={e._id}>
              {label(e)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        B, ses saisies passent dans A, puis il est supprimé
        <select className="field" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">Choisir…</option>
          {list
            .filter((e) => e._id !== targetId)
            .map((e) => (
              <option key={e._id} value={e._id}>
                {label(e)}
              </option>
            ))}
        </select>
      </label>
      {ready && preview === undefined && <Spinner />}
      {ready && preview && (
        <div className="flex flex-col gap-2" aria-label="Aperçu de la fusion">
          {preview[0].exDate !== preview[1].exDate && <ErrorBox>Attention : les deux exercices n'ont pas la même date.</ErrorBox>}
          {preview.map((m, i) => (
            <MemberCard key={m._id} m={m} master={i === 0} name="manual-master" onPick={() => i === 1 && (setTargetId(sourceId), setSourceId(targetId))} />
          ))}
        </div>
      )}
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="flex gap-2">
        <Button
          disabled={!ready || !preview}
          onClick={async () => {
            if (!window.confirm("Verser B dans A ? B sera supprimé, ses saisies et photos passent dans A.")) return;
            setError(null);
            try {
              const r = await merge({ token, masterId: targetId as Id<"exercises">, sourceIds: [sourceId as Id<"exercises">] });
              const n = r.moved + r.combined;
              setMsg(`Fusion faite : ${n} saisie${n > 1 ? "s" : ""} regroupée${n > 1 ? "s" : ""}.`);
              setOpen(false);
              setSourceId("");
            } catch (e) {
              setError(errorMessage(e, "Fusion impossible."));
            }
          }}
        >
          Fusionner
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

/** One exercise in the admin list, with an inline correction form (organisation and times). */
function ExerciseRow({ ex, token, children }: { ex: Doc<"exercises">; token: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-line py-1 last:border-0">
      <div className="flex min-h-12 items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{ex.school}</p>
          <p className="text-sm text-muted">
            {fmtDateLong(ex.exDate)}
            {ex.tEvac && ex.tPresent ? ` · évacuation ${duration(ex.tPresent - ex.tEvac)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <SmallBtn aria-label={`Corriger l'exercice ${ex.school}`} onClick={() => setOpen((o) => !o)}>
            <Pencil size={18} /> Corriger
          </SmallBtn>
          {children}
        </div>
      </div>
      {open && <CorrectForm ex={ex} token={token} onDone={() => setOpen(false)} />}
    </li>
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const toInput = (ms?: number) => {
  if (!ms) return "";
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};
const fromInput = (exDate: string, value: string): number | null => {
  if (!value) return null;
  const [y, mo, d] = exDate.split("-").map(Number);
  const [h, mi, se = 0] = value.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi, se).getTime();
};

function CorrectForm({ ex, token, onDone }: { ex: Doc<"exercises">; token: string; onDone: () => void }) {
  const correct = useMutation(api.admin.correctExercise);
  const [org, setOrg] = useState({
    classroom: ex.classroom ?? "",
    teacher: ex.teacher ?? "",
    fireLocation: (ex.fireLocation ?? "") as "" | "classe" | "ailleurs",
    fireDetail: ex.fireDetail ?? "",
  });
  const [times, setTimes] = useState<Record<string, string>>(Object.fromEntries(TIME_ORDER.map((k) => [k, toInput(ex[k])])));
  const [error, setError] = useState<string | null>(null);
  const evac = (() => {
    const a = fromInput(ex.exDate, times.tEvac);
    const b = fromInput(ex.exDate, times.tPresent);
    return a !== null && b !== null ? duration(b - a) : "non mesurée";
  })();

  return (
    <form
      className="mb-2 mt-1 flex flex-col gap-2 rounded-xl bg-bg p-3"
      aria-label={`Correction de ${ex.school}`}
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await correct({
            token,
            id: ex._id,
            classroom: org.classroom,
            teacher: org.teacher,
            fireLocation: org.fireLocation || null,
            fireDetail: org.fireDetail,
            times: Object.fromEntries(TIME_ORDER.map((k) => [k, fromInput(ex.exDate, times[k])])),
          });
          onDone();
        } catch (err) {
          setError(errorMessage(err, "Correction impossible."));
        }
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col text-sm font-medium">
          Classe
          <input className="field" value={org.classroom} onChange={(e) => setOrg({ ...org, classroom: e.target.value })} />
        </label>
        <label className="flex min-w-0 flex-col text-sm font-medium">
          Enseignant·e
          <input className="field" value={org.teacher} onChange={(e) => setOrg({ ...org, teacher: e.target.value })} />
        </label>
      </div>
      <label className="flex flex-col text-sm font-medium">
        Sinistre fictif
        <select className="field" value={org.fireLocation} onChange={(e) => setOrg({ ...org, fireLocation: e.target.value as typeof org.fireLocation })}>
          <option value="">Non précisé</option>
          <option value="classe">Dans la classe</option>
          <option value="ailleurs">Ailleurs</option>
        </select>
      </label>
      <label className="flex flex-col text-sm font-medium">
        Précision du sinistre
        <input className="field" value={org.fireDetail} onChange={(e) => setOrg({ ...org, fireDetail: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        {TIME_ORDER.map((k) => (
          <label key={k} className="flex min-w-0 flex-col text-sm font-medium">
            {TIME_NAMES[k]}
            <input type="time" step={1} className="field tabular" value={times[k]} onChange={(e) => setTimes({ ...times, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      <p className="text-sm">
        Durée d'évacuation : <strong>{evac}</strong>
      </p>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="flex gap-2">
        <Button type="submit">Enregistrer la correction</Button>
        <Button variant="secondary" onClick={onDone}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
