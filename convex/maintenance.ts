// Maintenance operations run by hand from the Convex CLI (`npx convex run --prod maintenance:…`).
// Internal only: not callable from the website.
import { internalMutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { TIME_KEYS } from "./mergeLogic";

/** Sets some times of an exercise (ms) and returns the previous values, for the record. */
export const setTimes = internalMutation({
  args: { id: v.id("exercises"), times: v.record(v.string(), v.number()) },
  handler: async (ctx, { id, times }) => {
    const ex = await ctx.db.get(id);
    if (!ex) throw new ConvexError("Exercice introuvable.");
    const before: Record<string, number | undefined> = {};
    for (const k of Object.keys(times)) {
      if (!(TIME_KEYS as readonly string[]).includes(k)) throw new ConvexError(`Champ inconnu : ${k}`);
      before[k] = ex[k as (typeof TIME_KEYS)[number]];
    }
    await ctx.db.patch(id, times);
    return { school: ex.school, before, after: times };
  },
});
