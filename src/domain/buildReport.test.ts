import { describe, expect, it } from "vitest";
import { ALL_ITEMS, ITEM_BY_ID, RECOMMENDATIONS, SECTIONS } from "./checklist";
import {
  buildReport,
  synthesizeItem,
  type ExerciseInput,
  type ObservationInput,
} from "./buildReport";
import {
  fmtDateLong,
  fmtDuration,
  fmtStopwatch,
  fmtTime,
  reportFileName,
  withLocativeArticle,
} from "./format";

const at = (h: number, m: number, s = 0) =>
  new Date(2026, 9, 5, h, m, s).getTime();

function ex(partial: Partial<ExerciseInput> = {}): ExerciseInput {
  return {
    _id: "ex1",
    school: "École de Platy",
    exDate: "2026-10-05",
    timingNotes: {},
    report: {},
    ...partial,
  };
}

function obs(partial: Partial<ObservationInput>): ObservationInput {
  return {
    exerciseId: "ex1",
    observer: "Anne Dupont",
    role: "obs",
    answers: {},
    photos: [],
    ...partial,
  };
}

const NO_DASH = /[–—]/;

describe("formats", () => {
  it("formats times, durations and dates the Swiss way", () => {
    expect(fmtTime(at(8, 31))).toBe("08h31");
    expect(fmtDuration(6 * 60_000)).toBe("6 min");
    expect(fmtDuration(6 * 60_000 + 12_000)).toBe("6 min 12 s");
    expect(fmtDuration(45_000)).toBe("45 s");
    expect(fmtStopwatch(372_000)).toBe("06:12");
    expect(fmtDateLong("2026-10-05")).toBe("lundi 5 octobre 2026");
    expect(fmtDateLong("2026-10-01")).toBe("jeudi 1er octobre 2026");
  });

  it("builds a safe file name", () => {
    expect(reportFileName("2026-10-05", "École de Platy", "pdf")).toBe(
      "2026-10-05_Rapport-evacuation_Ecole-de-Platy.pdf",
    );
  });

  it("picks the right locative article", () => {
    expect(withLocativeArticle("École de Platy")).toBe("à l'École de Platy");
    expect(withLocativeArticle("Collège du Belluard")).toBe(
      "au Collège du Belluard",
    );
  });
});

describe("checklist contract", () => {
  it("has unique ids and a sentence for every value", () => {
    const ids = ALL_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(25);
    for (const i of ALL_ITEMS) {
      expect(i.ok && i.partial && i.no).toBeTruthy();
      expect(`${i.label}${i.ok}${i.partial}${i.no}`).not.toMatch(NO_DASH);
    }
    for (const r of RECOMMENDATIONS) expect(r.text).not.toMatch(NO_DASH);
  });
});

describe("synthesizeItem", () => {
  const doors = ITEM_BY_ID.o_doors;

  it("uses the value sentence when all answers agree", () => {
    const r = synthesizeItem(doors, [
      obs({ zone: "Rez", answers: { o_doors: { v: "ok" } } }),
      obs({ zone: "1er étage", answers: { o_doors: { v: "ok" } } }),
    ]);
    expect(r.status).toBe("ok");
    expect(r.line?.text).toBe("Portes fermées.");
  });

  it("lists non compliant zones then the zones in order", () => {
    const r = synthesizeItem(doors, [
      obs({ zone: "Rez", answers: { o_doors: { v: "ok" } } }),
      obs({ zone: "1er étage", answers: { o_doors: { v: "partial" } } }),
      obs({ zone: "2e étage", answers: { o_doors: { v: "ok" } } }),
    ]);
    expect(r.status).toBe("issue");
    expect(r.line?.text).toBe(
      "Quelques portes sont restées ouvertes (1er étage). En ordre : Rez, 2e étage.",
    );
  });

  it("ignores N/A and unanswered, and attributes comments", () => {
    const r = synthesizeItem(doors, [
      obs({ zone: "Rez", answers: { o_doors: { v: "na" } } }),
      obs({
        observer: "Luc Morel",
        zone: "2e étage",
        answers: { o_doors: { v: "no", c: "Salle 12 grande ouverte" } },
      }),
      obs({ zone: "3e étage", answers: {} }),
    ]);
    expect(r.line?.text).toBe("Plusieurs portes sont restées ouvertes.");
    expect(r.line?.comments).toEqual([
      "« Salle 12 grande ouverte » (Luc Morel, 2e étage)",
    ]);
  });

  it("reports missing when nobody answered", () => {
    expect(synthesizeItem(doors, [obs({})]).status).toBe("missing");
    expect(synthesizeItem(doors, []).line).toBeNull();
  });
});

describe("buildReport", () => {
  const exercise = ex({
    classroom: "5H",
    teacher: "Mme Rossier",
    fireLocation: "ailleurs",
    fireDetail: "local technique du sous-sol",
    tStart: at(8, 30),
    tAlarm: at(8, 31, 40),
    tEvac: at(8, 32),
    tPresent: at(8, 38),
    tFiremen: at(8, 40),
    tEnd: at(8, 44),
    timingNotes: {
      tAlarm: "bouton défectueux, alarme en porte-à-porte",
      tAlarm__by: "PA Schütz, Rez",
    },
  });

  const lead = obs({
    observer: "PA Schütz",
    role: "lead",
    zone: "Rez",
    answers: {
      ...Object.fromEntries(
        SECTIONS.filter((s) => s.role === "lead").flatMap((s) =>
          s.items.map((i) => [i.id, { v: "ok" as const }]),
        ),
      ),
      l_118: { v: "no" },
      l_closedoor: { v: "na" },
    },
  });
  const o1 = obs({
    observer: "Anne Dupont",
    zone: "1er étage",
    answers: {
      o_doors: { v: "partial" },
      o_calm_pupils: { v: "ok" },
      o_nowedge: { v: "ok" },
    },
    remarks: "WC du 1er non contrôlés.",
    photos: [
      {
        storageId: "s1",
        itemId: "o_nowedge",
        caption: "Porte coupe-feu",
        url: "https://x/p.jpg",
      },
    ],
  });
  const o2 = obs({
    observer: "Luc Morel",
    zone: "Rez",
    answers: {
      o_doors: { v: "ok" },
      o_calm_pupils: { v: "ok" },
      o_nowedge: { v: "no" },
    },
  });

  const report = buildReport([exercise], [lead, o1, o2]);
  const school = report.schools[0];

  it("builds the title and default texts", () => {
    expect(report.mode).toBe("school");
    expect(report.title).toBe(
      "Rapport d'exercice d'évacuation : École de Platy",
    );
    expect(report.intro).toContain(
      "Le lundi 5 octobre 2026, la Compagnie des sapeurs-pompiers Moncor",
    );
    expect(report.intro).toContain("à l'École de Platy");
  });

  it("fills the facts table with the evacuation duration", () => {
    const get = (l: string) => school.facts.find((f) => f.label === l)?.value;
    expect(get("Classe interpellée")).toBe("5H");
    expect(get("Lieu du sinistre fictif")).toBe(
      "Ailleurs : local technique du sous-sol",
    );
    expect(get("Message d'évacuation")).toBe("08h32");
    expect(get("Durée d'évacuation")).toBe("6 min");
  });

  it("writes the short summary", () => {
    // lead: 13 items, 1 issue (l_118), 1 N/A; obs: o_doors issue, o_nowedge issue, o_calm_pupils ok
    expect(school.okCount).toBe(12);
    expect(school.issueCount).toBe(3);
    expect(school.summary).toBe(
      "Évacuation complète en 6 min. 12 points en ordre, 3 points à améliorer.",
    );
  });

  it("merges recommendations without duplicates, in the reference order", () => {
    expect(report.recommendations).toEqual(
      RECOMMENDATIONS.filter((r) =>
        ["formation", "portes", "calage"].includes(r.key),
      ).map((r) => r.text),
    );
  });

  it("attributes every remark and photo", () => {
    expect(school.remarks).toEqual([
      "Alarme pompiers : bouton défectueux, alarme en porte-à-porte (PA Schütz, Rez)",
      "WC du 1er non contrôlés. (Anne Dupont, 1er étage)",
    ]);
    expect(school.photos[0].caption).toBe(
      "Aucune porte calée : Porte coupe-feu (Anne Dupont, 1er étage)",
    );
  });

  it("counts the missing points for the web preview only", () => {
    const missingIds = school.missing.map((m) => m.itemId);
    expect(missingIds).toContain("o_audible");
    expect(missingIds).not.toContain("l_closedoor");
    const text = JSON.stringify(school.sections);
    expect(text).not.toContain("Alarme évacuation audible");
  });

  it("never prints dashes or symbols", () => {
    const all = JSON.stringify(report);
    expect(all).not.toMatch(NO_DASH);
    expect(all).not.toMatch(/[✓✔✗✘→←]/);
  });

  it("uses manual recommendations when edited", () => {
    const r = buildReport([exercise], [lead], {
      fields: { recommendations: "Premier point.\n\nDeuxième point." },
    });
    expect(r.recommendations).toEqual(["Premier point.", "Deuxième point."]);
    expect(r.autoRecommendations.length).toBeGreaterThan(0);
  });
});

describe("day report", () => {
  it("groups several schools in one document, ordered by start time", () => {
    const a = ex({ _id: "a", school: "École de Platy", tStart: at(10, 0) });
    const b = ex({ _id: "b", school: "École du Bois", tStart: at(8, 30) });
    const c = ex({ _id: "c", school: "Collège de Matran", tStart: at(9, 15) });
    const d = ex({ _id: "d", school: "École d'Avry", tStart: at(11, 0) });
    const r = buildReport(
      [a, b, c, d],
      [obs({ exerciseId: "a", answers: { o_doors: { v: "no" } } })],
    );
    expect(r.mode).toBe("day");
    expect(r.title).toBe(
      "Rapport d'exercices d'évacuation : Écoles, 5 octobre 2026",
    );
    expect(r.schools.map((s) => s.school)).toEqual([
      "École du Bois",
      "Collège de Matran",
      "École de Platy",
      "École d'Avry",
    ]);
    expect(r.intro).toContain(
      "École du Bois, Collège de Matran, École de Platy et École d'Avry",
    );
    expect(r.schools[2].summary).toBe(
      "Durée d'évacuation non mesurée. 0 point en ordre, 1 point à améliorer.",
    );
  });
});
