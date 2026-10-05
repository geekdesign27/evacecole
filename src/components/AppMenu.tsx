import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ClipboardList, FileText, Home, Menu, Settings, X } from "lucide-react";
import { useAdminToken } from "../lib/admin";

/** Hamburger menu shared by every screen; « Gestion » only on the admin's device. */
export function AppMenu() {
  const [open, setOpen] = useState(false);
  const admin = useAdminToken();
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  const items = [
    { to: "/", label: "Accueil", icon: <Home size={22} /> },
    { to: "/mes-saisies", label: "Mes saisies", icon: <ClipboardList size={22} /> },
    { to: "/fiche", label: "Fiche papier", icon: <FileText size={22} /> },
    ...(admin ? [{ to: "/admin", label: "Gestion", icon: <Settings size={22} /> }] : []),
  ];

  return (
    <>
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex min-h-12 min-w-12 items-center justify-center"
      >
        <Menu size={26} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setOpen(false)}>
          <nav
            aria-label="Menu principal"
            className="flex h-full w-72 max-w-[85vw] flex-col gap-1 bg-white p-3 text-ink shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-lg font-bold">Menu</span>
              <button type="button" aria-label="Fermer le menu" onClick={() => setOpen(false)} className="flex min-h-12 min-w-12 items-center justify-center">
                <X size={24} />
              </button>
            </div>
            {items.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                onClick={() => setOpen(false)}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-3 font-medium ${
                  location.pathname === it.to ? "bg-ink text-white" : "active:bg-bg"
                }`}
              >
                {it.icon}
                {it.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
