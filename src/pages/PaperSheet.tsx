import {
  sectionsForRole,
  TIME_FIELDS,
  TIME_LABELS,
  type Role,
} from "../domain/checklist";

// Printable fallback sheet, generated from the same checklist as the app.
const box = "inline-block h-4 w-4 border-2 border-ink align-middle";

function Sheet({ role }: { role: Role }) {
  return (
    <section className="sheet mx-auto max-w-[190mm] bg-white p-6 text-[12px] leading-snug text-ink print:p-0">
      <header className="mb-3 flex items-center gap-3 border-b-2 border-ink pb-2">
        <img
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt=""
          width={44}
          height={44}
        />
        <div className="flex-1">
          <h1 className="text-lg font-bold">
            Exercice d'évacuation : fiche{" "}
            {role === "lead" ? "interpellateur" : "observateur·rice"}
          </h1>
          <p>
            CP Moncor, mode papier (si le réseau ou
            le téléphone lâche)
          </p>
        </div>
      </header>
      <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-3">
        {["École", "Date", "Prénom et nom", "Zone"].map((l) => (
          <p key={l} className="border-b border-ink pb-1">
            {l} :
          </p>
        ))}
        {role === "lead" && (
          <>
            <p className="border-b border-ink pb-1">Classe interpellée :</p>
            <p className="border-b border-ink pb-1">Enseignant·e :</p>
            <p className="col-span-2 border-b border-ink pb-1">
              Sinistre fictif : <span className={box} /> dans la classe{" "}
              <span className={box} /> ailleurs, précision :
            </p>
          </>
        )}
      </div>

      <h2 className="mb-1 text-[13px] font-bold">Heures (hh:mm:ss)</h2>
      <table className="mb-3 w-full border-collapse">
        <tbody>
          {TIME_FIELDS.filter((f) => role === "lead" || f === "tEvac").map(
            (f) => (
              <tr key={f}>
                <td className="w-1/2 border border-ink px-2 py-1">
                  {TIME_LABELS[f]}
                </td>
                <td className="border border-ink px-2 py-1" />
              </tr>
            ),
          )}
          {role === "obs" && (
            <tr>
              <td className="border border-ink px-2 py-1.5">
                Ma zone est évacuée
              </td>
              <td className="border border-ink px-2 py-1.5" />
            </tr>
          )}
        </tbody>
      </table>

      {sectionsForRole(role).map((s) => (
        <div key={s.id} className="mb-3 break-inside-avoid">
          <h2 className="mb-1 text-[13px] font-bold">{s.title}</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[11px]">
                <th className="border border-ink px-1 text-left">Point</th>
                <th className="w-11 border border-ink">Oui</th>
                <th className="w-11 border border-ink">Partiel</th>
                <th className="w-11 border border-ink">Non</th>
                <th className="w-11 border border-ink">N/A</th>
                <th className="w-[32%] border border-ink px-1 text-left">
                  Commentaire
                </th>
              </tr>
            </thead>
            <tbody>
              {s.items.map((i) => (
                <tr key={i.id}>
                  <td className="border border-ink px-1 py-1">{i.label}</td>
                  {(["ok", "partial", "no", "na"] as const).map((v) => (
                    <td key={v} className="border border-ink text-center">
                      {v === "na" && !i.allowNa ? "" : <span className={box} />}
                      {v === "partial" && i.partialLabel ? (
                        <span className="block text-[9px]">
                          {i.partialLabel}
                        </span>
                      ) : null}
                    </td>
                  ))}
                  <td className="border border-ink" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <h2 className="mb-1 text-[13px] font-bold">Remarques</h2>
      <div className="h-20 border border-ink" />
      <p className="mt-2 text-[10px]">
        Photos : installations et lieux uniquement, jamais d'élèves
        identifiables. Après l'exercice, recopier la fiche dans l'app.
      </p>
    </section>
  );
}

export function PaperSheet() {
  return (
    <main className="bg-bg py-4 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 10mm; } @media print { .sheet ~ .sheet { break-before: page; } }`}</style>
      <p className="no-print mx-auto mb-4 max-w-[190mm] px-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-12 rounded-xl bg-brand px-4 font-medium text-white"
        >
          Imprimer les fiches
        </button>
      </p>
      <Sheet role="lead" />
      <div className="no-print h-4" />
      <Sheet role="obs" />
    </main>
  );
}
