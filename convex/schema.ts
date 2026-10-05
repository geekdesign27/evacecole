import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const answerValue = v.union(
  v.literal("ok"),
  v.literal("partial"),
  v.literal("no"),
  v.literal("na"),
);

export const photo = v.object({
  storageId: v.id("_storage"),
  itemId: v.optional(v.string()),
  caption: v.optional(v.string()),
});

export default defineSchema({
  exercises: defineTable({
    school: v.string(),
    exDate: v.string(), // YYYY-MM-DD
    classroom: v.optional(v.string()),
    teacher: v.optional(v.string()),
    fireLocation: v.optional(v.union(v.literal("classe"), v.literal("ailleurs"))),
    fireDetail: v.optional(v.string()),
    leadName: v.optional(v.string()),
    tStart: v.optional(v.number()),
    tAlarm: v.optional(v.number()),
    tEvac: v.optional(v.number()),
    tPresent: v.optional(v.number()),
    tFiremen: v.optional(v.number()),
    tEnd: v.optional(v.number()),
    timingNotes: v.record(v.string(), v.string()),
    report: v.record(v.string(), v.string()), // editable report fields
    archived: v.boolean(),
  }).index("by_date", ["exDate"]),

  observations: defineTable({
    exerciseId: v.id("exercises"),
    clientId: v.string(),
    observer: v.string(),
    zone: v.optional(v.string()),
    role: v.union(v.literal("lead"), v.literal("obs")),
    answers: v.record(v.string(), v.object({ v: v.optional(answerValue), c: v.optional(v.string()) })),
    remarks: v.optional(v.string()),
    photos: v.array(photo),
    tClear: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_exercise", ["exerciseId"])
    .index("by_client", ["clientId", "exerciseId"]),

  schools: defineTable({ name: v.string() }).index("by_name", ["name"]),

  participants: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    fonction: v.optional(v.string()),
    active: v.boolean(),
  }),

  // Day codes created by the admin: valid on one date, revocable at any time.
  accessCodes: defineTable({
    code: v.string(),
    validDate: v.string(), // YYYY-MM-DD, Europe/Zurich
    label: v.optional(v.string()),
    revoked: v.boolean(),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  adminSessions: defineTable({
    token: v.string(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  // Single row: failed admin logins, to slow down password guessing.
  adminGuard: defineTable({
    failures: v.number(),
    lockedUntil: v.number(),
  }),

  // Every e-mail the app sends (or simulates), for the admin journal.
  mailLog: defineTable({
    kind: v.union(v.literal("invite"), v.literal("report")),
    to: v.string(),
    subject: v.string(),
    status: v.union(v.literal("sent"), v.literal("simulated"), v.literal("error")),
    error: v.optional(v.string()),
    html: v.optional(v.string()),
    attachments: v.optional(v.array(v.string())),
    sentAt: v.number(),
  }).index("by_sentAt", ["sentAt"]),

  // Editable fields of a multi-school day report (not tied to one exercise).
  dayReports: defineTable({
    exDate: v.string(),
    fields: v.record(v.string(), v.string()),
  }).index("by_date", ["exDate"]),
});
