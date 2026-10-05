import { describe, expect, it } from "vitest";
import {
  fillEmpty,
  mergeObservation,
  mergeRecords,
  mergeTimes,
} from "./mergeLogic";

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
});
