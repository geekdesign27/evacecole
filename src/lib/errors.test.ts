import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { errorMessage, isRefusedCode } from "./errors";

describe("errorMessage", () => {
  it("reads the text carried by ConvexError (production hides the message)", () => {
    const e = new ConvexError("Code : 6 caractères minimum.");
    e.message = "[CONVEX M(admin:createCode)] [Request ID: x] Server Error Called by client";
    expect(errorMessage(e, "fallback")).toBe("Code : 6 caractères minimum.");
  });
  it("never shows raw Convex server errors", () => {
    expect(errorMessage(new Error("[CONVEX M(x)] Server Error"), "Création impossible.")).toBe("Création impossible.");
  });
  it("detects a refused code", () => {
    expect(isRefusedCode(new ConvexError("Code d'équipe incorrect ou révoqué."))).toBe(true);
  });
});
