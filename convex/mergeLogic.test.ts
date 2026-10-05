import { describe, expect, it } from "vitest";
import { duplicateGroups, fillEmpty, mergeObservation, mergeRecords, mergeTimes, pickMaster } from "./mergeLogic";

describe("merge two exercises", () => {
  it("takes the only known time, the earliest start events and the latest end events", () => {
    const d = mergeTimes(
      { tStart: 1000, tEvac: 5000, tPresent: 9000 },
      { tAlarm: 2000, tEvac: 4000, tPresent: 9500, tEnd: 12000 },
    );
    const kept = Object.fromEntries(d.map((x) => [x.field, x.kept]));
    expect(kept).toEqual({
      tStart: 1000,
      tAlarm: 2000,
      tEvac: 4000,
      tPresent: 9500,
      tFiremen: undefined,
      tEnd: 12000,
    });
    expect(d.filter((x) => x.conflict).map((x) => x.field)).toEqual([
      "tEvac",
      "tPresent",
    ]);
  });

  it("completes empty fields from the source only", () => {
    expect(
      fillEmpty(
        { classroom: "5H", teacher: "" } as Record<string, string>,
        { classroom: "6H", teacher: "Mme R." },
        ["classroom", "teacher"],
      ),
    ).toEqual({
      teacher: "Mme R.",
    });
  });

  it("keeps both timing notes", () => {
    expect(
      mergeRecords(
        { tAlarm: "bouton HS", tAlarm__by: "PA" },
        { tAlarm: "118 sur mobile", tAlarm__by: "Cyril", tEvac: "audible" },
      ),
    ).toEqual({
      tAlarm: "bouton HS ; 118 sur mobile",
      tAlarm__by: "PA",
      tEvac: "audible",
    });
  });

  it("merges one device's two observations: newest answer per point, remarks and photos added up", () => {
    const m = mergeObservation(
      {
        answers: {
          o_doors: { v: "ok" },
          o_windows: { v: "no", c: "salle 12" },
        },
        remarks: "WC non vus.",
        photos: [{ storageId: "p1" }],
        tClear: 10,
        updatedAt: 1,
      },
      {
        answers: { o_doors: { v: "partial" }, o_nowedge: { v: "ok" } },
        remarks: "Rez calme.",
        photos: [{ storageId: "p2" }, { storageId: "p1" }],
        updatedAt: 2,
      },
    );
    expect(m.answers).toEqual({
      o_doors: { v: "partial" },
      o_windows: { v: "no", c: "salle 12" },
      o_nowedge: { v: "ok" },
    });
    expect(m.remarks).toBe("WC non vus. Rez calme.");
    expect(m.photos.map((p) => p.storageId)).toEqual(["p1", "p2"]);
    expect(m.tClear).toBe(10);
  });

  it("picks as master the shortest measured evacuation, then the most times", () => {
    const min = 60_000;
    const good = { _id: "good", school: "École de Platy", exDate: "2026-10-05", tStart: 0, tAlarm: 1, tEvac: 2, tPresent: 2 + 6 * min + 4000, tFiremen: 5, tEnd: 6 };
    const late = { _id: "late", school: "École de Platy", exDate: "2026-10-05", tStart: 0, tAlarm: 1, tEvac: 2, tPresent: 2 + 83 * min, tFiremen: 5, tEnd: 6 };
    const quarter = { _id: "quarter", school: "École de Platy", exDate: "2026-10-05", tEvac: 2, tPresent: 2 + 25 * min };
    const noDuration = { _id: "none", school: "École de Platy", exDate: "2026-10-05", tStart: 0, tEvac: 2 };
    expect(pickMaster([late, quarter, noDuration, good])._id).toBe("good");
    // Platy: 6 times and 6 min 4 s against a start and an evacuation message only
    expect(pickMaster([noDuration, good])._id).toBe("good");
    // No measured duration anywhere: the most recorded times
    expect(pickMaster([{ ...noDuration, _id: "two" }, { _id: "one", school: "x", exDate: "x", tStart: 0 }])._id).toBe("two");
  });

  it("groups the same school on the same day, ignoring case and accents", () => {
    const g = duplicateGroups([
      { _id: "a", school: "École de Platy", exDate: "2026-10-05" },
      { _id: "b", school: "ecole de platy ", exDate: "2026-10-05" },
      { _id: "c", school: "École de Platy", exDate: "2026-10-04" },
      { _id: "d", school: "Rochettes", exDate: "2026-10-05" },
    ]);
    expect(g.map((x) => x.map((e) => e._id))).toEqual([["a", "b"]]);
  });
});
