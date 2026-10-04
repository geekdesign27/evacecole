import { query } from "./_generated/server";
import { v } from "convex/values";

export const check = query({
  args: { code: v.string() },
  handler: async (_ctx, { code }) => {
    const expected = process.env.TEAM_CODE;
    if (!expected) return false;
    return code.trim().toLowerCase() === expected.trim().toLowerCase();
  },
});
