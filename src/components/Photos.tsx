import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { resizeToJpeg } from "../lib/images";
import { device } from "../lib/storage";
import { Button } from "./ui";

// Object URLs of photos taken on this device, so thumbnails show before the server URL arrives.
const localPreviews = new Map<string, string>();

export function photoSrc(
  storageId: string,
  serverUrls: Record<string, string | null>,
): string | undefined {
  return serverUrls[storageId] ?? localPreviews.get(storageId);
}

interface Props {
  code: string;
  onAdded: (storageId: Id<"_storage">) => void;
  label?: string;
  compact?: boolean;
}

export function PhotoButton({
  code,
  onAdded,
  label = "Photo",
  compact,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState(false);

  function open() {
    if (!device.photoHintSeen) {
      setHint(true);
      return;
    }
    inputRef.current?.click();
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const img = await resizeToJpeg(file);
      const url = await generateUploadUrl({ code });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: img.blob,
      });
      if (!res.ok) throw new Error(`Envoi refusé (${res.status}).`);
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      localPreviews.set(storageId, URL.createObjectURL(img.blob));
      onAdded(storageId);
    } catch (e) {
      setError(
        navigator.onLine
          ? `Photo non envoyée : ${e instanceof Error ? e.message : "erreur inconnue"}`
          : "Pas de réseau : la photo n'a pas pu être envoyée. Réessaie plus tard.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        className={compact ? "min-w-12 px-3" : ""}
        onClick={open}
        disabled={busy}
        aria-label={compact ? "Ajouter une photo" : undefined}
      >
        {busy ? "Envoi…" : compact ? "📷" : `📷 ${label}`}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {error && (
        <p className="basis-full text-sm text-brand-dark" role="alert">
          {error}
        </p>
      )}
      {hint && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal
        >
          <div className="flex max-w-md flex-col gap-3 rounded-2xl bg-white p-5">
            <h2 className="text-xl font-bold">Avant la première photo</h2>
            <p>
              Photographie uniquement les installations et les lieux : portes,
              boutons, panneaux, chemins de fuite.
              <strong> Jamais d'élèves identifiables.</strong>
            </p>
            <Button
              onClick={() => {
                device.photoHintSeen = true;
                setHint(false);
                inputRef.current?.click();
              }}
            >
              Compris
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export function Thumbs({
  photos,
  urls,
  onRemove,
}: {
  photos: { storageId: string }[];
  urls: Record<string, string | null>;
  onRemove?: (storageId: string) => void;
}) {
  if (!photos.length) return null;
  return (
    <div className="flex basis-full flex-wrap gap-2">
      {photos.map((p) => {
        const src = photoSrc(p.storageId, urls);
        return (
          <div key={p.storageId} className="relative">
            {src ? (
              <img
                src={src}
                alt=""
                className="h-20 w-20 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-line text-xs">
                envoi…
              </div>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(p.storageId)}
                className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white"
                aria-label="Retirer la photo"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
