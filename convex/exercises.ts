import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { assertTeam } from "./lib";

const timeField = v.union(
  v.literal("tStart"),
  v.literal("tAlarm"),
  v.literal("tEvac"),
  v.literal("tPresent"),
  v.literal("tFiremen"),
  v.literal("tEnd"),
);

// A stamp queued offline reaches the server late. If the client clock says the tap
// happened clearly earlier than now, trust the client time instead of server time.
const LATE_DELIVERY_MS = 15_000;

export const create = mutation({
  args: { code: v.string(), school: v.string(), exDate: v.string() },
  handler: async (ctx, { code, school, exDate }) => {
    await assertTeam(ctx, code);
    const name = school.trim();
    if (!name) throw new ConvexError("Nom d'école manquant.");
    const known = await ctx.db
      .query("schools")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
    if (!known) await ctx.db.insert("schools", { name });
    return await ctx.db.insert("exercises", {
      school: name,
      exDate,
      timingNotes: {},
      report: {},
      archived: false,
    });
  },
});

export const stamp = mutation({
  args: { code: v.string(), id: v.id("exercises"), field: timeField, clientTs: v.optional(v.number()) },
  handler: async (ctx, { code, id, field, clientTs }) => {
    await assertTeam(ctx, code);
    const ex = await ctx.db.get(id);
    if (!ex) throw new ConvexError("Exercice introuvable.");
    if (ex[field] !== undefined) return ex[field]; // first tap wins
    const now = Date.now();
    const t = clientTs !== undefined && now - clientTs > LATE_DELIVERY_MS && clientTs < now ? clientTs : now;
    await ctx.db.patch(id, { [field]: t });
    return t;
  },
});

export const setTime = mutation({
  args: {
    code: v.string(),
    id: v.id("exercises"),
    field: timeField,
    value: v.union(v.number(), v.null()),
    note: v.optional(v.string()),
    noteBy: v.optional(v.string()), // « Prénom Nom, zone » for report attribution
  },
  handler: async (ctx, { code, id, field, value, note, noteBy }) => {
    await assertTeam(ctx, code);
    const ex = await ctx.db.get(id);
    if (!ex) throw new ConvexError("Exercice introuvable.");
    const patch: Record<string, unknown> = { [field]: value ?? undefined };
    if (note !== undefined) {
      const timingNotes = { ...ex.timingNotes };
      if (note.trim()) {
        timingNotes[field] = note;
        if (noteBy) timingNotes[`${field}__by`] = noteBy;
      } else {
        delete timingNotes[field];
        delete timingNotes[`${field}__by`];
      }
      patch.timingNotes = timingNotes;
    }
    await ctx.db.patch(id, patch);
  },
});

export const update = mutation({
  args: {
    code: v.string(),
    id: v.id("exercises"),
    patch: v.object({
      school: v.optional(v.string()),
      exDate: v.optional(v.string()),
      classroom: v.optional(v.string()),
      teacher: v.optional(v.string()),
      fireLocation: v.optional(v.union(v.literal("classe"), v.literal("ailleurs"))),
      fireDetail: v.optional(v.string()),
      leadName: v.optional(v.string()),
      report: v.optional(v.record(v.string(), v.string())),
    }),
  },
  handler: async (ctx, { code, id, patch }) => {
    await assertTeam(ctx, code);
    const ex = await ctx.db.get(id);
    if (!ex) throw new ConvexError("Exercice introuvable.");
    const { report, ...rest } = patch;
    await ctx.db.patch(id, { ...rest, ...(report ? { report: { ...ex.report, ...report } } : {}) });
  },
});

export const archive = mutation({
  args: { code: v.string(), id: v.id("exercises"), archived: v.boolean() },
  handler: async (ctx, { code, id, archived }) => {
    await assertTeam(ctx, code);
    await ctx.db.patch(id, { archived });
  },
});

export const listRecent = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    await assertTeam(ctx, code);
    return await ctx.db.query("exercises").withIndex("by_date").order("desc").take(300);
  },
});

export const get = query({
  args: { code: v.string(), id: v.id("exercises") },
  handler: async (ctx, { code, id }) => {
    await assertTeam(ctx, code);
    return await ctx.db.get(id);
  },
});

export const getMany = query({
  args: { code: v.string(), ids: v.array(v.id("exercises")) },
  handler: async (ctx, { code, ids }) => {
    await assertTeam(ctx, code);
    const docs = await Promise.all(ids.map((id) => ctx.db.get(id)));
    return docs.filter((d) => d !== null);
  },
});

export const schools = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    await assertTeam(ctx, code);
    const all = await ctx.db.query("schools").withIndex("by_name").take(500);
    return all.map((s) => s.name);
  },
});

export const dayReport = query({
  args: { code: v.string(), exDate: v.string() },
  handler: async (ctx, { code, exDate }) => {
    await assertTeam(ctx, code);
    const doc = await ctx.db
      .query("dayReports")
      .withIndex("by_date", (q) => q.eq("exDate", exDate))
      .first();
    return doc?.fields ?? {};
  },
});

export const updateDayReport = mutation({
  args: { code: v.string(), exDate: v.string(), fields: v.record(v.string(), v.string()) },
  handler: async (ctx, { code, exDate, fields }) => {
    await assertTeam(ctx, code);
    const doc = await ctx.db
      .query("dayReports")
      .withIndex("by_date", (q) => q.eq("exDate", exDate))
      .first();
    if (doc) await ctx.db.patch(doc._id, { fields: { ...doc.fields, ...fields } });
    else await ctx.db.insert("dayReports", { exDate, fields });
  },
});
