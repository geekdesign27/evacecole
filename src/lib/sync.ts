// Offline safety net: the observer's own observation and the time stamps are kept in
// localStorage first, then pushed to Convex. A reload or a network cut never loses a tap.

import { useCallback, useEffect, useRef, useState } from "react";
import { useConvex, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { AnswerValue, Role, TimeField } from "../domain/checklist";
import { device, readJSON, writeJSON } from "./storage";

export interface DraftPhoto {
  storageId: Id<"_storage">;
  itemId?: string;
  caption?: string;
}

export interface Draft {
  exerciseId: Id<"exercises">;
  observer: string;
  zone?: string;
  role: Role;
  answers: Record<string, { v?: AnswerValue; c?: string }>;
  remarks?: string;
  photos: DraftPhoto[];
  tClear?: number;
  updatedAt: number;
  syncedAt?: number;
}

export type SyncStatus = "synced" | "pending" | "offline" | "error";

const draftKey = (id: string) => `evac:obs:${id}`;
const stampKey = (id: string) => `evac:stamps:${id}`;

/** Polls the Convex websocket state (no event API is exposed for it). */
export function useOnline(): boolean {
  const convex = useConvex();
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const tick = () => {
      const state = convex.connectionState();
      setOnline(navigator.onLine && state.isWebSocketConnected);
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [convex]);
  return online;
}

export function useObservationDraft(exerciseId: Id<"exercises">, code: string) {
  const upsert = useMutation(api.observations.upsert);
  const online = useOnline();
  const [draft, setDraftState] = useState<Draft | null>(() =>
    readJSON<Draft | null>(draftKey(exerciseId), null),
  );
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);
  const latest = useRef(draft);
  latest.current = draft;

  const persist = (d: Draft) => {
    latest.current = d;
    writeJSON(draftKey(exerciseId), d);
    setDraftState(d);
  };

  const setDraft = useCallback(
    (update: (d: Draft) => Draft) => {
      const current = latest.current;
      if (!current) return;
      persist({ ...update(current), updatedAt: Date.now() });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exerciseId],
  );

  const join = useCallback(
    (init: Pick<Draft, "observer" | "zone" | "role">) => {
      const current = latest.current;
      persist({
        exerciseId,
        answers: {},
        photos: [],
        ...current,
        ...init,
        updatedAt: Date.now(),
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exerciseId],
  );

  const push = useCallback(async () => {
    const d = latest.current;
    if (!d || inflight.current || !code) return;
    if (d.syncedAt !== undefined && d.syncedAt >= d.updatedAt) return;
    inflight.current = true;
    try {
      const { syncedAt: _ignored, ...payload } = d;
      void _ignored;
      await upsert({ code, clientId: device.clientId, ...payload });
      setError(null);
      const now = latest.current;
      if (now) persist({ ...now, syncedAt: d.updatedAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inflight.current = false;
    }
    // A tap made during the send is pushed right away instead of on the next 4 s tick.
    const after = latest.current;
    if (after && (after.syncedAt === undefined || after.syncedAt < after.updatedAt) && after.updatedAt !== d.updatedAt) {
      void push();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, upsert]);

  useEffect(() => {
    void push();
  }, [draft?.updatedAt, online, push]);

  useEffect(() => {
    const t = window.setInterval(() => void push(), 4000);
    return () => window.clearInterval(t);
  }, [push]);

  const dirty =
    !!draft &&
    (draft.syncedAt === undefined || draft.syncedAt < draft.updatedAt);
  const status: SyncStatus = !online
    ? "offline"
    : error
      ? "error"
      : dirty
        ? "pending"
        : "synced";

  return { draft, setDraft, join, status, error };
}

interface PendingStamp {
  field: TimeField;
  clientTs: number;
}

/** Time stamps: optimistic locally, retried until the server confirms. */
export function useStamps(exerciseId: Id<"exercises">, code: string) {
  const stamp = useMutation(api.exercises.stamp);
  const online = useOnline();
  const [pending, setPending] = useState<PendingStamp[]>(() =>
    readJSON(stampKey(exerciseId), []),
  );
  const sending = useRef(new Set<string>());

  const save = (list: PendingStamp[]) => {
    writeJSON(stampKey(exerciseId), list);
    setPending(list);
  };

  const flush = useCallback(async () => {
    const list = readJSON<PendingStamp[]>(stampKey(exerciseId), []);
    for (const p of list) {
      if (sending.current.has(p.field)) continue;
      sending.current.add(p.field);
      try {
        await stamp({
          code,
          id: exerciseId,
          field: p.field,
          clientTs: p.clientTs,
        });
        const rest = readJSON<PendingStamp[]>(stampKey(exerciseId), []).filter(
          (x) => x.field !== p.field,
        );
        save(rest);
      } catch {
        /* retried on next flush */
      } finally {
        sending.current.delete(p.field);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, exerciseId, stamp]);

  useEffect(() => {
    void flush();
    const t = window.setInterval(() => void flush(), 4000);
    return () => window.clearInterval(t);
  }, [flush, online]);

  const tap = (field: TimeField) => {
    const list = readJSON<PendingStamp[]>(stampKey(exerciseId), []);
    if (list.some((p) => p.field === field)) return;
    save([...list, { field, clientTs: Date.now() }]);
    void flush();
  };

  const pendingMap = Object.fromEntries(
    pending.map((p) => [p.field, p.clientTs]),
  ) as Partial<Record<TimeField, number>>;
  return { tap, pending: pendingMap };
}
