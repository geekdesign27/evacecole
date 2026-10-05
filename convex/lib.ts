import { ConvexError } from "convex/values";
import type { QueryCtx } from "./_generated/server";

const norm = (s: string) => s.trim().toLowerCase();

/** Today's date in Switzerland (YYYY-MM-DD); day codes are valid on that date only. */
export function zurichToday(now = Date.now()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zurich" }).format(new Date(now));
}

/**
 * Accepted codes: the permanent TEAM_CODE (admin fallback, Convex env) or a day code
 * created in the admin page, not revoked and valid today.
 */
export async function isValidCode(ctx: QueryCtx, code: string): Promise<boolean> {
  const c = norm(code);
  if (!c) return false;
  const permanent = process.env.TEAM_CODE;
  if (permanent && c === norm(permanent)) return true;
  const day = await ctx.db
    .query("accessCodes")
    .withIndex("by_code", (q) => q.eq("code", c))
    .first();
  return !!day && isCodeActive(day, zurichToday());
}

/** A day code is usable from validDate to validUntil (inclusive), unless revoked. */
export function isCodeActive(c: { revoked: boolean; validDate: string; validUntil?: string }, today: string): boolean {
  return !c.revoked && c.validDate <= today && today <= (c.validUntil ?? c.validDate);
}

/** Every public function takes the access code and checks it server-side. */
export async function assertTeam(ctx: QueryCtx, code: string) {
  if (!(await isValidCode(ctx, code))) throw new ConvexError("Code d'équipe incorrect ou révoqué.");
}

/** Refuses any change by the team once the exercise is closed. */
export function assertOpen(ex: { locked?: boolean }) {
  if (ex.locked) throw new ConvexError("Saisie clôturée : cet exercice ne peut plus être modifié.");
}

/** Admin functions take the session token returned by admin.login. */
export async function assertAdmin(ctx: QueryCtx, token: string) {
  const session = token
    ? await ctx.db
        .query("adminSessions")
        .withIndex("by_token", (q) => q.eq("token", token))
        .first()
    : null;
  if (!session || session.expiresAt < Date.now()) throw new ConvexError("Session expirée, reconnecte-toi.");
}
