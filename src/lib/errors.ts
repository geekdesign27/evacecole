import { ConvexError } from "convex/values";

/**
 * Human message for any error. In production Convex hides server messages ("Server Error"),
 * so the readable text travels in ConvexError.data; raw Convex errors fall back to `fallback`.
 */
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ConvexError && typeof e.data === "string") return e.data;
  if (e instanceof Error && e.message && !e.message.includes("[CONVEX") && !e.message.includes("Server Error")) {
    return e.message;
  }
  return fallback;
}

export function isRefusedCode(e: unknown): boolean {
  return /code d'équipe|révoqué/i.test(errorMessage(e, ""));
}
