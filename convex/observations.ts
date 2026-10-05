import { mutation, query, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { assertOpen, assertTeam } from "./lib";
import { answerValue, photo } from "./schema";

export const upsert = mutation({
  args: {
    code: v.string(),
    exerciseId: v.id("exercises"),
    clientId: v.string(),
    observer: v.string(),
    zone: v.optional(v.string()),
    role: v.union(v.literal("lead"), v.literal("obs")),
    answers: v.record(v.string(), v.object({ v: v.optional(answerValue), c: v.optional(v.string()) })),
    remarks: v.optional(v.string()),
    photos: v.array(photo),
    tClear: v.optional(v.number()),
    updatedAt: v.number(), // client edit time, protects against stale replays
  },
  handler: async (ctx, { code, ...obs }) => {
    await assertTeam(ctx, code);
    const ex = await ctx.db.get(obs.exerciseId);
    if (!ex) throw new ConvexError("Cet exercice a été supprimé.");
    assertOpen(ex);
    const existing = await ctx.db
      .query("observations")
      .withIndex("by_client", (q) => q.eq("clientId", obs.clientId).eq("exerciseId", obs.exerciseId))
      .first();
    if (!existing) {
      await ctx.db.insert("observations", obs);
      return obs.updatedAt;
    }
    if (existing.updatedAt > obs.updatedAt) return existing.updatedAt; // older draft, ignore
    await ctx.db.replace(existing._id, obs);
    return obs.updatedAt;
  },
});

async function withPhotoUrls(ctx: QueryCtx, o: Doc<"observations">) {
  const photos = await Promise.all(
    o.photos.map(async (p) => ({ ...p, url: await ctx.storage.getUrl(p.storageId) })),
  );
  return { ...o, photos };
}

async function forExercise(ctx: QueryCtx, exerciseId: Id<"exercises">) {
  const list = await ctx.db
    .query("observations")
    .withIndex("by_exercise", (q) => q.eq("exerciseId", exerciseId))
    .collect();
  return Promise.all(list.map((o) => withPhotoUrls(ctx, o)));
}

export const byExercise = query({
  args: { code: v.string(), exerciseId: v.id("exercises") },
  handler: async (ctx, { code, exerciseId }) => {
    await assertTeam(ctx, code);
    return forExercise(ctx, exerciseId);
  },
});

export const byExercises = query({
  args: { code: v.string(), exerciseIds: v.array(v.id("exercises")) },
  handler: async (ctx, { code, exerciseIds }) => {
    await assertTeam(ctx, code);
    const all = await Promise.all(exerciseIds.map((id) => forExercise(ctx, id)));
    return all.flat();
  },
});
