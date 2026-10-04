import { useEffect, useState } from "react";
import { fmtDuration, fmtStopwatch } from "../domain/format";

/** Current time, refreshed every 250 ms while active. */
export function useNow(active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

interface Times {
  tStart?: number;
  tEvac?: number;
  tPresent?: number;
}

/** The main indicator: evacuation time, shared by the whole team. */
export function Stopwatch({ tStart, tEvac, tPresent }: Times) {
  const running = (!!tStart || !!tEvac) && !tPresent;
  const now = useNow(running);

  if (tEvac && tPresent) {
    return (
      <div className="text-center" aria-live="polite">
        <p className="text-sm uppercase tracking-wide opacity-80">
          Évacuation terminée
        </p>
        <p className="font-display text-3xl font-extrabold tabular">
          Évacuation : {fmtDuration(tPresent - tEvac)}
        </p>
      </div>
    );
  }
  if (tEvac) {
    return (
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-wide">Évacuation</p>
        <p
          className="font-display text-6xl font-extrabold leading-none tabular"
          aria-label="Chronomètre évacuation"
        >
          {fmtStopwatch(now - tEvac)}
        </p>
      </div>
    );
  }
  if (tStart) {
    return (
      <div className="text-center">
        <p className="text-sm uppercase tracking-wide opacity-80">
          Interpellation depuis
        </p>
        <p className="font-display text-4xl font-bold tabular">
          {fmtStopwatch(now - tStart)}
        </p>
      </div>
    );
  }
  return (
    <p className="py-2 text-center font-display text-xl font-bold">
      En attente du début
    </p>
  );
}
