import type { SnapshotItem } from "./queries";
import type { makeLocalizer } from "./time";

/**
 * Pure analysis over query results. No I/O — easy to reason about and test.
 */

type Localizer = ReturnType<typeof makeLocalizer>;
type HourBucket = { hour: number; plays: number; ms: number | null };

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** 7 × 24 grid of plays: rows Monday→Sunday, columns 0–23 local hour. */
export function listeningClock(buckets: HourBucket[], loc: Localizer): number[][] {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const b of buckets) {
    const { weekday, hour } = loc.parts(b.hour * HOUR_MS);
    grid[weekday][hour] += b.plays;
  }
  return grid;
}

export type Period = { key: string; label: string; plays: number; hours: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Plays and hours per local month (or per year), oldest first, with empty periods filled in. */
export function periodSeries(buckets: HourBucket[], loc: Localizer, by: "month" | "year"): Period[] {
  const totals = new Map<number, { plays: number; ms: number }>();
  for (const b of buckets) {
    const { year, month } = loc.parts(b.hour * HOUR_MS);
    const key = by === "month" ? year * 12 + month : year;
    const t = totals.get(key) ?? { plays: 0, ms: 0 };
    t.plays += b.plays;
    t.ms += b.ms ?? 0;
    totals.set(key, t);
  }
  if (totals.size === 0) return [];
  const keys = [...totals.keys()];
  const [min, max] = [Math.min(...keys), Math.max(...keys)];
  const series: Period[] = [];
  for (let k = min; k <= max; k++) {
    const t = totals.get(k) ?? { plays: 0, ms: 0 };
    const label =
      by === "month" ? `${MONTHS[k % 12]} ${Math.floor(k / 12)}` : String(k);
    series.push({ key: String(k), label, plays: t.plays, hours: t.ms / HOUR_MS });
  }
  return series;
}

type ArtistSpan = { name: string; first: number; last: number; plays: number };

/** Ignore "discoveries" in the first 90 days of data — those artists were likely known already. */
export const DISCOVERY_WARMUP_DAYS = 90;
const MIN_DISCOVERY_PLAYS = 3;

/**
 * Artists by the year you first played them (with ≥3 plays total), plus the
 * most recent discoveries. Only meaningful after the warm-up window, since an
 * artist's first appearance in your data isn't necessarily the first time you
 * heard them.
 */
export function discoveries(
  timeline: ArtistSpan[],
  dataStart: number,
  dataEnd: number,
  loc: Localizer,
) {
  const cutoff = dataStart + DISCOVERY_WARMUP_DAYS * DAY_MS;
  const found = timeline
    .filter((a) => a.plays >= MIN_DISCOVERY_PLAYS && a.first >= cutoff)
    .sort((a, b) => b.first - a.first);

  const perYear = new Map<number, number>();
  for (const a of found) {
    const { year } = loc.parts(a.first);
    perYear.set(year, (perYear.get(year) ?? 0) + 1);
  }

  return {
    eligible: dataEnd >= cutoff,
    cutoff,
    perYear: [...perYear.entries()].sort(([a], [b]) => a - b).map(([year, count]) => ({ year, count })),
    recent: found.slice(0, 12),
  };
}

/** Artists you played a lot who've gone quiet for 6+ months — rediscovery candidates. */
export function forgottenFavorites(timeline: ArtistSpan[], latestPlay: number, limit = 12) {
  const quietSince = latestPlay - 180 * DAY_MS;
  return timeline
    .filter((a) => a.plays >= 15 && a.last < quietSince)
    .sort((a, b) => b.plays - a.plays)
    .slice(0, limit);
}

/** Compare two ranked snapshots: who arrived, who left, who climbed. */
export function snapshotDrift(before: SnapshotItem[], after: SnapshotItem[]) {
  const beforeRank = new Map(before.map((i) => [i.itemId, i.rank]));
  const afterIds = new Set(after.map((i) => i.itemId));
  const arrived = after.filter((i) => !beforeRank.has(i.itemId));
  const left = before.filter((i) => !afterIds.has(i.itemId));
  const climbed = after
    .filter((i) => beforeRank.has(i.itemId) && beforeRank.get(i.itemId)! - i.rank >= 3)
    .map((i) => ({ ...i, delta: beforeRank.get(i.itemId)! - i.rank }))
    .sort((a, b) => b.delta - a.delta);
  const overlap = before.length > 0 ? (before.length - left.length) / before.length : null;
  return { arrived, left, climbed, overlap };
}
