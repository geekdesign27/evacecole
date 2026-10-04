import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertTeam } from "./lib";

export const generateUploadUrl = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    await assertTeam(ctx, code);
    return await ctx.storage.generateUploadUrl();
  },
});
