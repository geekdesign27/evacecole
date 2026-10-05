import { useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useTeam } from "../lib/team";
import { Button, Card, ErrorBox, Logo, Spinner } from "./ui";

/** Asks for the team code once per device; the server checks it on every call. */
export function TeamGate({ children }: { children: ReactNode }) {
  const { code, setCode } = useTeam();
  const valid = useQuery(api.team.check, code ? { code } : "skip");
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (code && valid === undefined) return <Spinner label="Connexion…" />;
  if (code && valid) return <>{children}</>;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <div className="flex items-center gap-3">
        <Logo size={56} />
        <div>
          <h1 className="text-2xl font-bold leading-tight">
            Exercices d'évacuation
          </h1>
          <p className="text-muted">Compagnie des sapeurs-pompiers Moncor</p>
        </div>
      </div>
      <Card>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
            setCode(input.trim());
          }}
        >
          <label htmlFor="team" className="font-medium">
            Code d'équipe
          </label>
          <input
            id="team"
            className="field"
            autoComplete="off"
            autoCapitalize="none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            required
          />
          {code && valid === false && (
            <ErrorBox>
              {submitted
                ? "Code incorrect. Demande-le au chef d'exercice."
                : "Ce code n'est plus valable. Scanne le QR code du jour ou demande le nouveau code au chef d'exercice."}
            </ErrorBox>
          )}
          <Button type="submit">Entrer</Button>
          <Link to="/admin" className="flex min-h-12 items-center justify-center font-medium underline">
            Administrateur : ouvrir la gestion des codes
          </Link>
          <p className="text-sm text-muted">
            Saisi une seule fois, l'appareil le garde en mémoire.
          </p>
        </form>
      </Card>
    </main>
  );
}
