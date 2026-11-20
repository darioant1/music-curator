import { describe, expect, it } from "vitest";
import { discoveries, forgottenFavorites, listeningClock, periodSeries, snapshotDrift } from "./analysis";
import { localYearRange, makeLocalizer, resolveTimeZone } from "./time";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const hourOf = (ms: number) => Math.floor(ms / HOUR);

describe("time zones", () => {
  it("falls back to UTC for invalid zones", () => {
    expect(resolveTimeZone("Not/AZone")).toBe("UTC");
    expect(resolveTimeZone(undefined)).toBe("UTC");
    expect(resolveTimeZone("America/Chicago")).toBe("America/Chicago");
  });

  it("converts UTC to local parts, including daylight saving", () => {
    const ny = makeLocalizer("America/New_York");
    // Jan (EST, UTC-5): 15:00 UTC → 10:00 local, Wednesday Jan 10 2024
    expect(ny.parts(Date.UTC(2024, 0, 10, 15))).toEqual({ year: 2024, month: 0, weekday: 2, hour: 10 });
    // Jul (EDT, UTC-4): 15:00 UTC → 11:00 local
    expect(ny.parts(Date.UTC(2024, 6, 10, 15)).hour).toBe(11);
    // 02:00 UTC on Jan 1 is still Dec 31 in New York
    expect(ny.parts(Date.UTC(2024, 0, 1, 2))).toMatchObject({ year: 2023, month: 11 });
  });

  it("computes local year bounds", () => {
    const { from, to } = localYearRange(2024, "America/New_York");
    expect(from).toBe(Date.UTC(2024, 0, 1, 5));
    expect(to).toBe(Date.UTC(2025, 0, 1, 5));
  });
});

describe("listeningClock", () => {
  it("buckets plays into weekday × hour", () => {
    const loc = makeLocalizer("UTC");
    const monday9am = Date.UTC(2024, 0, 8, 9);
    const grid = listeningClock([{ hour: hourOf(monday9am), plays: 4, ms: null }], loc);
    expect(grid[0][9]).toBe(4);
    expect(grid.flat().reduce((a, b) => a + b)).toBe(4);
  });
});

describe("periodSeries", () => {
  it("fills empty months between active ones", () => {
    const loc = makeLocalizer("UTC");
    const series = periodSeries(
      [
        { hour: hourOf(Date.UTC(2024, 0, 5)), plays: 2, ms: 2 * HOUR },
        { hour: hourOf(Date.UTC(2024, 2, 5)), plays: 3, ms: null },
      ],
      loc,
      "month",
    );
    expect(series.map((s) => [s.label, s.plays])).toEqual([
      ["Jan 2024", 2],
      ["Feb 2024", 0],
      ["Mar 2024", 3],
    ]);
    expect(series[0].hours).toBe(2);
  });
});

describe("discoveries", () => {
  const loc = makeLocalizer("UTC");
  const start = Date.UTC(2020, 0, 1);

  it("ignores artists first seen during the warm-up window and rare artists", () => {
    const result = discoveries(
      [
        { name: "Old favorite", first: start + DAY, last: start + 400 * DAY, plays: 50 },
        { name: "New find", first: start + 200 * DAY, last: start + 300 * DAY, plays: 5 },
        { name: "One-off", first: start + 250 * DAY, last: start + 250 * DAY, plays: 1 },
      ],
      start,
      start + 400 * DAY,
      loc,
    );
    expect(result.eligible).toBe(true);
    expect(result.recent.map((a) => a.name)).toEqual(["New find"]);
    expect(result.perYear).toEqual([{ year: 2020, count: 1 }]);
  });

  it("is not eligible with under 90 days of data", () => {
    expect(discoveries([], start, start + 30 * DAY, loc).eligible).toBe(false);
  });
});

describe("forgottenFavorites", () => {
  it("finds heavily played artists that went quiet", () => {
    const latest = Date.UTC(2025, 0, 1);
    const result = forgottenFavorites(
      [
        { name: "Gone quiet", first: 0, last: latest - 365 * DAY, plays: 80 },
        { name: "Still playing", first: 0, last: latest - DAY, plays: 200 },
        { name: "Barely played", first: 0, last: latest - 365 * DAY, plays: 3 },
      ],
      latest,
    );
    expect(result.map((a) => a.name)).toEqual(["Gone quiet"]);
  });
});

describe("snapshotDrift", () => {
  const item = (itemId: string, rank: number) => ({ itemId, name: itemId, rank, imageUrl: null, subtitle: null });

  it("reports arrivals, departures and climbers", () => {
    const drift = snapshotDrift(
      [item("a", 1), item("b", 2), item("c", 6)],
      [item("c", 1), item("a", 2), item("d", 3)],
    );
    expect(drift.arrived.map((i) => i.itemId)).toEqual(["d"]);
    expect(drift.left.map((i) => i.itemId)).toEqual(["b"]);
    expect(drift.climbed.map((i) => [i.itemId, i.delta])).toEqual([["c", 5]]);
    expect(drift.overlap).toBeCloseTo(2 / 3);
  });
});
