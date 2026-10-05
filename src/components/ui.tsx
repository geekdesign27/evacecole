import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import type { SyncStatus } from "../lib/sync";

type Variant = "primary" | "secondary" | "ghost" | "dark";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white active:bg-brand-dark disabled:opacity-50",
  secondary: "bg-white text-ink border-2 border-line active:bg-bg",
  ghost: "bg-transparent text-ink active:bg-line",
  dark: "bg-ink text-white active:bg-black",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-12 rounded-xl px-4 py-2 font-medium transition-colors ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-card p-4 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}logo.svg`}
      width={size}
      height={size}
      alt="CP Moncor"
    />
  );
}

export function TopBar({
  title,
  back,
  right,
}: {
  title: string;
  back?: string;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 bg-ink px-4 py-2 text-white">
      {back ? (
        <Link
          to={back}
          className="-ml-2 flex min-h-12 min-w-12 items-center justify-center text-2xl"
          aria-label="Retour"
        >
          <ChevronLeft size={28} />
        </Link>
      ) : (
        <Logo size={36} />
      )}
      <h1 className="flex-1 truncate text-lg font-bold">{title}</h1>
      {right}
    </header>
  );
}

const SYNC: Record<SyncStatus, { color: string; label: string }> = {
  synced: { color: "bg-ok", label: "Synchronisé" },
  pending: { color: "bg-amber", label: "En attente" },
  offline: { color: "bg-gray-400", label: "Hors ligne" },
  error: { color: "bg-brand", label: "Erreur" },
};

export function SyncDot({
  status,
  title,
}: {
  status: SyncStatus;
  title?: string;
}) {
  const s = SYNC[status];
  return (
    <span
      className="flex items-center gap-1.5 text-sm"
      title={title ?? s.label}
      role="status"
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full ring-2 ring-white ${s.color}`}
      />
      <span>{s.label}</span>
    </span>
  );
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-12 rounded-full border-2 px-4 font-medium ${
        active
          ? "border-ink bg-ink text-white"
          : "border-line bg-white text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <p
      className="rounded-xl border-2 border-brand bg-brand-soft p-3 text-brand-dark"
      role="alert"
    >
      {children}
    </p>
  );
}

export function Spinner({ label = "Chargement…" }: { label?: string }) {
  return <p className="p-6 text-center text-muted">{label}</p>;
}
