// Device-level persistence. Every access is guarded: private mode or blocked storage must not crash the app.

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

const KEYS = {
  team: "evac:team",
  name: "evac:name",
  client: "evac:client",
  photoHint: "evac:photoHint",
  author: "evac:author",
} as const;

export const device = {
  get teamCode(): string {
    return readJSON(KEYS.team, "");
  },
  set teamCode(v: string) {
    writeJSON(KEYS.team, v);
  },
  get name(): string {
    return readJSON(KEYS.name, "");
  },
  set name(v: string) {
    writeJSON(KEYS.name, v);
  },
  get author(): string {
    return readJSON(KEYS.author, "");
  },
  set author(v: string) {
    writeJSON(KEYS.author, v);
  },
  get photoHintSeen(): boolean {
    return readJSON(KEYS.photoHint, false);
  },
  set photoHintSeen(v: boolean) {
    writeJSON(KEYS.photoHint, v);
  },
  /** Stable per-device id used for idempotent observation upserts. */
  get clientId(): string {
    let id = readJSON<string>(KEYS.client, "");
    if (!id) {
      id = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      writeJSON(KEYS.client, id);
    }
    return id;
  },
};
