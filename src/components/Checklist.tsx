import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import {
  sectionsForRole,
  type AnswerValue,
  type ChecklistItem,
  type Role,
} from "../domain/checklist";
import type { Draft } from "../lib/sync";
import { PhotoButton, Thumbs } from "./Photos";
import { Card } from "./ui";
import { MessageSquare, MessageSquareText, UserX } from "lucide-react";

const OPTIONS: { v: AnswerValue; label: string; on: string }[] = [
  { v: "ok", label: "Oui", on: "bg-ok text-white border-ok" },
  { v: "partial", label: "Partiel", on: "bg-amber text-ink border-amber" },
  { v: "no", label: "Non", on: "bg-brand text-white border-brand" },
  { v: "na", label: "N/A", on: "bg-ink text-white border-ink" },
];

interface Props {
  role: Role;
  draft: Draft;
  setDraft: (u: (d: Draft) => Draft) => void;
  code: string;
  photoUrls: Record<string, string | null>;
}

export function Checklist({ role, draft, setDraft, code, photoUrls }: Props) {
  return (
    <>
      {sectionsForRole(role).map((section) => (
        <Card key={section.id}>
          <h2 className="mb-1 text-xl font-bold">{section.title}</h2>
          {section.id === "comportement" && (
            <EmptyZoneButton
              itemIds={section.items.filter((i) => i.allowNa).map((i) => i.id)}
              draft={draft}
              setDraft={setDraft}
            />
          )}
          <ul className="flex flex-col">
            {section.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                draft={draft}
                setDraft={setDraft}
                code={code}
                photoUrls={photoUrls}
              />
            ))}
          </ul>
        </Card>
      ))}
    </>
  );
}

function ItemRow({
  item,
  draft,
  setDraft,
  code,
  photoUrls,
}: {
  item: ChecklistItem;
  draft: Draft;
  setDraft: Props["setDraft"];
  code: string;
  photoUrls: Record<string, string | null>;
}) {
  const answer = draft.answers[item.id] ?? {};
  const [showComment, setShowComment] = useState(!!answer.c);
  const photos = draft.photos.filter((p) => p.itemId === item.id);

  const setAnswer = (patch: { v?: AnswerValue; c?: string }) =>
    setDraft((d) => ({
      ...d,
      answers: { ...d.answers, [item.id]: { ...d.answers[item.id], ...patch } },
    }));

  const options = OPTIONS.filter((o) => o.v !== "na" || item.allowNa);

  return (
    <li className="border-b border-line py-3 last:border-0">
      <p id={`lbl-${item.id}`} className="mb-2 font-medium leading-snug">
        {item.label}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-labelledby={`lbl-${item.id}`}
          className="flex min-w-60 flex-1 gap-1.5"
        >
          {options.map((o) => {
            const active = answer.v === o.v;
            return (
              <button
                key={o.v}
                type="button"
                role="radio"
                aria-checked={active}
                // Tapping the selected value again clears it (undo a wrong tap).
                onClick={() => setAnswer({ v: active ? undefined : o.v })}
                className={`min-h-12 flex-1 rounded-xl border-2 px-1 font-bold ${
                  active ? o.on : "border-line bg-white text-ink"
                }`}
              >
                {o.v === "partial" && item.partialLabel
                  ? item.partialLabel
                  : o.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setShowComment((s) => !s)}
          aria-expanded={showComment}
          aria-label="Commentaire"
          className={`flex min-h-12 min-w-12 items-center justify-center rounded-xl border-2 ${answer.c ? "border-ink bg-bg" : "border-line bg-white"}`}
        >
          {answer.c ? <MessageSquareText size={22} /> : <MessageSquare size={22} />}
        </button>
        <PhotoButton
          compact
          code={code}
          onAdded={(storageId) =>
            setDraft((d) => ({
              ...d,
              photos: [
                ...d.photos,
                { storageId: storageId as Id<"_storage">, itemId: item.id },
              ],
            }))
          }
        />
        <Thumbs
          photos={photos}
          urls={photoUrls}
          onRemove={(id) =>
            setDraft((d) => ({
              ...d,
              photos: d.photos.filter((p) => p.storageId !== id),
            }))
          }
        />
      </div>
      {showComment && (
        <textarea
          className="field mt-2"
          rows={2}
          placeholder="Ce que tu as vu (lieu, détail)…"
          aria-label={`Commentaire : ${item.label}`}
          value={answer.c ?? ""}
          onChange={(e) => setAnswer({ c: e.target.value })}
        />
      )}
    </li>
  );
}

/** Empty floor: sets N/A on every behaviour point not answered yet (answers already given are kept). */
function EmptyZoneButton({
  itemIds,
  draft,
  setDraft,
}: {
  itemIds: string[];
  draft: Draft;
  setDraft: Props["setDraft"];
}) {
  const open = itemIds.filter((id) => !draft.answers[id]?.v);
  if (!open.length) return null;
  return (
    <button
      type="button"
      onClick={() =>
        setDraft((d) => {
          const answers = { ...d.answers };
          for (const id of itemIds) if (!answers[id]?.v) answers[id] = { ...answers[id], v: "na" };
          return { ...d, answers };
        })
      }
      className="mb-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-3 text-sm font-medium text-muted"
    >
      <UserX size={20} />
      Personne dans ma zone : mettre les points restants en N/A
    </button>
  );
}
