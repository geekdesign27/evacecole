import { query } from "./_generated/server";
import { v } from "convex/values";
import { assertTeam, isValidCode, zurichToday } from "./lib";

export const check = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => isValidCode(ctx, code),
});

/** Names offered on the join screen (one tap instead of typing). */
export const participants = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    await assertTeam(ctx, code);
    const list = await ctx.db.query("participants").collect();
    return list
      .filter((p) => p.active)
      .map((p) => ({ _id: p._id, name: `${p.firstName} ${p.lastName}`.trim() }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  },
});

/**
 * Code to put in the invitation QR: today's newest active day code, never the
 * permanent TEAM_CODE. Null when no day code exists for today.
 */
export const shareCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    await assertTeam(ctx, code);
    const today = zurichToday();
    const all = await ctx.db.query("accessCodes").collect();
    const active = all
      .filter((c) => !c.revoked && c.validDate === today)
      .sort((a, b) => b.createdAt - a.createdAt);
    // A day-code holder shares its own code, so revoking it cannot be dodged through a newer one.
    const own = active.find((c) => c.code === code.trim().toLowerCase());
    return own?.code ?? active[0]?.code ?? null;
  },
});
