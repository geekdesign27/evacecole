import { ConvexError } from "convex/values";

/** Every public function takes the team code and checks it server-side. */
export function assertTeam(code: string) {
  const expected = process.env.TEAM_CODE;
  if (!expected) throw new ConvexError("TEAM_CODE non configuré sur le serveur.");
  if (code.trim().toLowerCase() !== expected.trim().toLowerCase()) {
    throw new ConvexError("Code d'équipe incorrect.");
  }
}
