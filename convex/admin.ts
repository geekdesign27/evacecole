import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { assertAdmin, isCodeActive, zurichToday } from "./lib";

const SESSION_MS = 7 * 24 * 3600 * 1000;
const MAX_FAILURES = 5;
const LOCK_MS = 10 * 60 * 1000;
// No ambiguous characters (0/o, 1/l/i), easy to read aloud if the QR code fails.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomString(length: number, alphabet = ALPHABET): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Returns a result instead of throwing, so the failure counter is not rolled back. */
export const login = mutation({
  args: { user: v.string(), password: v.string() },
  handler: async (ctx, { user, password }) => {
    const expectedUser = (process.env.ADMIN_USER ?? "schutz.pa")
      .trim()
      .toLowerCase();
    const expectedPassword = process.env.ADMIN_PASSWORD;
    if (!expectedPassword)
      return {
        ok: false as const,
        error: "ADMIN_PASSWORD non configuré sur le serveur.",
      };

    const now = Date.now();
    const guard = await ctx.db.query("adminGuard").first();
    // The right credentials always open the session: a stranger typing wrong passwords on the
    // public page must not lock the admin out. Protection against guessing rests on a long
    // ADMIN_PASSWORD (16+ characters); the lock only slows down wrong attempts.
    const good =
      safeEqual(user.trim().toLowerCase(), expectedUser) &&
      safeEqual(password, expectedPassword);
    if (!good && guard && guard.lockedUntil > now) {
      const min = Math.ceil((guard.lockedUntil - now) / 60000);
      return {
        ok: false as const,
        error: `Trop d'essais. Réessaie dans ${min} min.`,
      };
    }
    if (!good) {
      const failures = (guard?.failures ?? 0) + 1;
      const lockedUntil = failures >= MAX_FAILURES ? now + LOCK_MS : 0;
      const next = { failures: lockedUntil ? 0 : failures, lockedUntil };
      if (guard) await ctx.db.patch(guard._id, next);
      else await ctx.db.insert("adminGuard", next);
      return {
        ok: false as const,
        error: "Identifiant ou mot de passe incorrect.",
      };
    }

    if (guard) await ctx.db.patch(guard._id, { failures: 0, lockedUntil: 0 });
    const token = randomString(
      40,
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    );
    await ctx.db.insert("adminSessions", {
      token,
      expiresAt: now + SESSION_MS,
    });
    return { ok: true as const, token };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const s = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (s) await ctx.db.delete(s._id);
  },
});

export const me = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    try {
      await assertAdmin(ctx, token);
      return true;
    } catch {
      return false;
    }
  },
});

// Participants

export const participants = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await assertAdmin(ctx, token);
    const list = await ctx.db.query("participants").collect();
    return list.sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(
        `${b.lastName} ${b.firstName}`,
        "fr",
      ),
    );
  },
});

const participantFields = {
  firstName: v.string(),
  lastName: v.string(),
  email: v.optional(v.string()),
  fonction: v.optional(v.string()),
};

function cleanParticipant(p: {
  firstName: string;
  lastName: string;
  email?: string;
  fonction?: string;
}) {
  const firstName = p.firstName.trim().slice(0, 80);
  const lastName = p.lastName.trim().slice(0, 80);
  if (!firstName && !lastName) throw new ConvexError("Prénom ou nom requis.");
  return {
    firstName,
    lastName,
    email: p.email?.trim().slice(0, 120) || undefined,
    fonction: p.fonction?.trim().slice(0, 120) || undefined,
  };
}

/** Adds participants, skipping names already in the list. */
export const addParticipants = mutation({
  args: { token: v.string(), list: v.array(v.object(participantFields)) },
  handler: async (ctx, { token, list }) => {
    await assertAdmin(ctx, token);
    if (list.length > 200) throw new ConvexError("Liste trop longue.");
    const existing = await ctx.db.query("participants").collect();
    const key = (p: { firstName: string; lastName: string }) =>
      `${p.firstName} ${p.lastName}`.toLowerCase();
    const known = new Set(existing.map(key));
    let added = 0;
    for (const raw of list) {
      const p = cleanParticipant(raw);
      if (known.has(key(p))) continue;
      known.add(key(p));
      await ctx.db.insert("participants", { ...p, active: true });
      added++;
    }
    return added;
  },
});

export const updateParticipant = mutation({
  args: {
    token: v.string(),
    id: v.id("participants"),
    ...participantFields,
    active: v.boolean(),
  },
  handler: async (ctx, { token, id, active, ...fields }) => {
    await assertAdmin(ctx, token);
    await ctx.db.patch(id, { ...cleanParticipant(fields), active });
  },
});

export const removeParticipant = mutation({
  args: { token: v.string(), id: v.id("participants") },
  handler: async (ctx, { token, id }) => {
    await assertAdmin(ctx, token);
    await ctx.db.delete(id);
  },
});

// Day codes

export const codes = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await assertAdmin(ctx, token);
    const all = await ctx.db.query("accessCodes").collect();
    const today = zurichToday();
    return all
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50)
      .map((c) => ({
        ...c,
        active: isCodeActive(c, today),
        expired: (c.validUntil ?? c.validDate) < today,
      }));
  },
});

export const createCode = mutation({
  args: {
    token: v.string(),
    validDate: v.string(),
    validUntil: v.optional(v.string()),
    label: v.optional(v.string()),
    /** Code chosen by the admin (easy to dictate); generated when empty. */
    custom: v.optional(v.string()),
  },
  handler: async (ctx, { token, validDate, validUntil, label, custom }) => {
    await assertAdmin(ctx, token);
    if (!ISO.test(validDate)) throw new ConvexError("Date invalide.");
    const until = validUntil || validDate;
    if (!ISO.test(until) || until < validDate) throw new ConvexError("La date de fin doit suivre la date de début.");
    let code = `${randomString(4)}-${randomString(4)}-${randomString(4)}`;
    if (custom?.trim()) {
      code = custom.trim().toLowerCase();
      if (!/^[a-z0-9-]{6,40}$/.test(code))
        throw new ConvexError("Code : 6 caractères minimum, lettres sans accent, chiffres ou tirets.");
      const permanent = process.env.TEAM_CODE?.trim().toLowerCase();
      if (code === permanent) throw new ConvexError("Ce code est déjà utilisé.");
      const taken = await ctx.db
        .query("accessCodes")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (taken) throw new ConvexError("Ce code a déjà été utilisé, choisis-en un autre.");
    }
    await ctx.db.insert("accessCodes", {
      code,
      validDate,
      validUntil: until,
      label: label?.trim().slice(0, 80) || undefined,
      revoked: false,
      createdAt: Date.now(),
    });
    return code;
  },
});

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Changes the validity period: extending the end date reactivates an expired code. */
export const setCodeDates = mutation({
  args: { token: v.string(), id: v.id("accessCodes"), validDate: v.string(), validUntil: v.string() },
  handler: async (ctx, { token, id, validDate, validUntil }) => {
    await assertAdmin(ctx, token);
    if (!ISO.test(validDate) || !ISO.test(validUntil)) throw new ConvexError("Date invalide.");
    if (validUntil < validDate) throw new ConvexError("La date de fin doit suivre la date de début.");
    await ctx.db.patch(id, { validDate, validUntil });
  },
});

export const revokeCode = mutation({
  args: { token: v.string(), id: v.id("accessCodes"), revoked: v.boolean() },
  handler: async (ctx, { token, id, revoked }) => {
    await assertAdmin(ctx, token);
    await ctx.db.patch(id, { revoked });
  },
});

// Schools

export const schools = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await assertAdmin(ctx, token);
    return await ctx.db.query("schools").withIndex("by_name").collect();
  },
});

export const addSchools = mutation({
  args: { token: v.string(), names: v.array(v.string()) },
  handler: async (ctx, { token, names }) => {
    await assertAdmin(ctx, token);
    let added = 0;
    for (const raw of names.slice(0, 100)) {
      const name = raw.trim().slice(0, 120);
      if (!name) continue;
      const known = await ctx.db
        .query("schools")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first();
      if (known) continue;
      await ctx.db.insert("schools", { name });
      added++;
    }
    return added;
  },
});

export const removeSchool = mutation({
  args: { token: v.string(), id: v.id("schools") },
  handler: async (ctx, { token, id }) => {
    await assertAdmin(ctx, token);
    await ctx.db.delete(id);
  },
});

// Exercises

export const exercises = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await assertAdmin(ctx, token);
    return await ctx.db.query("exercises").withIndex("by_date").order("desc").take(300);
  },
});

/** Permanent deletion: the exercise, its observations and their photos. */
export const deleteExercise = mutation({
  args: { token: v.string(), id: v.id("exercises") },
  handler: async (ctx, { token, id }) => {
    await assertAdmin(ctx, token);
    const observations = await ctx.db
      .query("observations")
      .withIndex("by_exercise", (q) => q.eq("exerciseId", id))
      .collect();
    for (const o of observations) {
      for (const p of o.photos) {
        // A photo may already be gone; deletion must still go through.
        await ctx.storage.delete(p.storageId).catch(() => {});
      }
      await ctx.db.delete(o._id);
    }
    await ctx.db.delete(id);
  },
});

// Report texts and closing (admin only)

const reportFields = v.record(v.string(), v.string());

export const updateReport = mutation({
  args: { token: v.string(), id: v.id("exercises"), fields: reportFields },
  handler: async (ctx, { token, id, fields }) => {
    await assertAdmin(ctx, token);
    const ex = await ctx.db.get(id);
    if (!ex) throw new ConvexError("Exercice introuvable.");
    await ctx.db.patch(id, { report: { ...ex.report, ...fields } });
  },
});

export const updateDayReport = mutation({
  args: { token: v.string(), exDate: v.string(), fields: reportFields },
  handler: async (ctx, { token, exDate, fields }) => {
    await assertAdmin(ctx, token);
    const doc = await ctx.db
      .query("dayReports")
      .withIndex("by_date", (q) => q.eq("exDate", exDate))
      .first();
    if (doc) await ctx.db.patch(doc._id, { fields: { ...doc.fields, ...fields } });
    else await ctx.db.insert("dayReports", { exDate, fields });
  },
});

/** Closes (or reopens) the team's input on these exercises. */
export const setLocked = mutation({
  args: { token: v.string(), ids: v.array(v.id("exercises")), locked: v.boolean() },
  handler: async (ctx, { token, ids, locked }) => {
    await assertAdmin(ctx, token);
    for (const id of ids) {
      await ctx.db.patch(id, locked ? { locked: true, lockedAt: Date.now() } : { locked: false, lockedAt: undefined });
    }
  },
});
