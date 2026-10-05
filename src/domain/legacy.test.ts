import { describe, expect, it } from "vitest";
import { fixLegacyFields, fixLegacyName } from "./legacy";

describe("legacy organisation name", () => {
  it("rewrites saved texts with the old name", () => {
    expect(fixLegacyName("Le 4 octobre, la Compagnie des sapeurs-pompiers Moncor a conduit")).toBe("Le 4 octobre, le CP Moncor a conduit");
    expect(fixLegacyName("<p>Compagnie des sapeurs-pompiers Moncor</p>")).toBe("<p>CP Moncor</p>");
    expect(fixLegacyName("Cdt Compagnie Moncor")).toBe("Cdt CP Moncor");
    expect(fixLegacyFields({ mailMessage: "Salutations, Compagnie des sapeurs-pompiers Moncor", author: "PA" })).toEqual({
      mailMessage: "Salutations, CP Moncor",
      author: "PA",
    });
  });
});
