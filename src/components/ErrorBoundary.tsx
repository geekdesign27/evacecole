import { Component, type ReactNode } from "react";
import { isRefusedCode } from "../lib/errors";

/** Last resort: a server refusal (e.g. revoked code) must never leave a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    const refused = isRefusedCode(this.state.error);
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
        <p className="rounded-xl border-2 border-brand bg-brand-soft p-3 text-brand-dark" role="alert">
          {refused
            ? "Le code d'accès n'est plus valable. Demande le nouveau code ou le QR code au chef d'exercice."
            : "Un problème est survenu. Tes saisies sont gardées sur le téléphone."}
        </p>
        <button
          type="button"
          className="min-h-12 rounded-xl bg-brand px-4 font-medium text-white"
          onClick={() => {
            if (refused) {
              try {
                localStorage.removeItem("evac:team");
              } catch {
                /* ignore */
              }
            }
            window.location.reload();
          }}
        >
          {refused ? "Saisir un nouveau code" : "Recharger"}
        </button>
      </main>
    );
  }
}
