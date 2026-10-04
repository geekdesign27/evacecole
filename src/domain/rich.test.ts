// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mapRuns, parseRich, plainToHtml, toEditorHtml } from "./rich";

describe("rich text", () => {
  it("parses paragraphs, bold, italic and lists", () => {
    expect(parseRich("<p>Un <strong>point</strong> <em>clé</em>.</p><ul><li><p>A</p></li><li><p>B</p></li></ul><ol><li><p>1</p></li></ol>")).toEqual([
      { kind: "p", runs: [{ text: "Un " }, { text: "point", bold: true }, { text: " " }, { text: "clé", italic: true }, { text: "." }] },
      { kind: "ul", items: [[{ text: "A" }], [{ text: "B" }]] },
      { kind: "ol", items: [[{ text: "1" }]] },
    ]);
  });

  it("keeps only whitelisted content (no script, no attributes, no links)", () => {
    const doc = parseRich('<p>ok<img src=x onerror="alert(1)"><script>alert(2)</script><a href="javascript:x">lien</a></p>');
    expect(JSON.stringify(doc)).not.toMatch(/onerror|javascript|<|img/);
    expect(doc[0].kind).toBe("p");
  });

  it("accepts plain text values and converts them for the editor", () => {
    expect(parseRich("Ligne 1\nLigne 2")).toEqual([
      { kind: "p", runs: [{ text: "Ligne 1" }] },
      { kind: "p", runs: [{ text: "Ligne 2" }] },
    ]);
    expect(plainToHtml("a < b")).toBe("<p>a &lt; b</p>");
    expect(toEditorHtml("<p>x</p>")).toBe("<p>x</p>");
    expect(parseRich("<p></p>")).toEqual([]);
  });

  it("applies typography to every run", () => {
    const doc = mapRuns(parseRich("<p>Objet : test</p>"), (s) => s.replace(" :", " :"));
    expect(doc[0]).toEqual({ kind: "p", runs: [{ text: "Objet : test" }] });
  });
});
