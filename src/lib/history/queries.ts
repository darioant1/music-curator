import "server-only";
import { cache } from "react";
import { sql, type SQL } from "drizzle-orm";
import { requireSession } from "@/lib/auth/current";
import { getDb } from "@/lib/db";

/**
 * Read-side Data Access Layer for listening history.
 *
 * Analytics are written in plain SQL (via Drizzle's `sql` template, which
 * still parameterizes every value) because aggregations read more clearly
 * that way than through a query builder.
 */

/**
 * A stream counts as a "play" at 30 seconds — the same threshold Spotify
 * uses for stream counts. API captures have no duration and always count.
 */
export const MIN_PLAY_MS = 30_000;

export type PlaySource = "extended" | "account" | "api";
export type Range = { from: number; to: number };

type CoverageRow = { source: PlaySource; plays: number; first: number; last: number };

/** Rows per source with their time span, before any de-overlapping. */
const getCoverage = cache(async (): Promise<CoverageRow[]> => {
  const { userId } = await requireSession();
  return getDb().all<CoverageRow>(sql`
    SELECT source, COUNT(*) AS plays, MIN(played_at) AS first, MAX(played_at) AS last
    FROM plays WHERE user_id = ${userId}
    GROUP BY source
  `);
});

/**
 * SQL condition selecting the plays we trust, avoiding double counting when
 * sources overlap. Precedence: extended > account > api. A lower-precedence
 * play is ignored if it falls inside the time span a higher one covers.
 */
async function effectivePlays(range?: Range): Promise<SQL> {
  const { userId } = await requireSession();
  const coverage = await getCoverage();
  const ext = coverage.find((c) => c.source === "extended");
  const acc = coverage.find((c) => c.source === "account");

  const outside = (c: CoverageRow) => sql`p.played_at NOT BETWEEN ${c.first} AND ${c.last}`;
  const accountCond = ext ? sql`(p.source = 'account' AND ${outside(ext)})` : sql`p.source = 'account'`;
  const apiParts = [sql`p.source = 'api'`];
  if (ext) apiParts.push(outside(ext));
  if (acc) apiParts.push(outside(acc));

  const conditions = [
    sql`p.user_id = ${userId}`,
    sql`(p.ms_played IS NULL OR p.ms_played >= ${MIN_PLAY_MS})`,
    sql`(p.source = 'extended' OR ${accountCond} OR (${sql.join(apiParts, sql` AND `)}))`,
  ];
  if (range) conditions.push(sql`p.played_at >= ${range.from} AND p.played_at < ${range.to}`);
  return sql.join(conditions, sql` AND `);
}

// --- status ----------------------------------------------------------------

export const getHistoryStatus = cache(async () => {
  const { userId } = await requireSession();
  const db = getDb();
  const coverage = await getCoverage();
  const where = await effectivePlays();
  const effective = db.get<{ plays: number; first: number | null; last: number | null }>(sql`
    SELECT COUNT(*) AS plays, MIN(played_at) AS first, MAX(played_at) AS last FROM plays p WHERE ${where}
  `);
  const user = db.get<{ lastPlaySyncAt: number | null; createdAt: number }>(sql`
    SELECT last_play_sync_at AS lastPlaySyncAt, created_at AS createdAt FROM users WHERE id = ${userId}
  `);
  const snapshots = db.get<{ days: number; first: string | null }>(sql`
    SELECT COUNT(DISTINCT taken_on) AS days, MIN(taken_on) AS first FROM top_snapshots WHERE user_id = ${userId}
  `);
  const lastImport = db.get<{ at: number | null }>(sql`
    SELECT MAX(created_at) AS at FROM imports WHERE user_id = ${userId}
  `);

  return {
    coverage,
    effectivePlays: effective?.plays ?? 0,
    first: effective?.first ?? null,
    last: effective?.last ?? null,
    trackingSince: user?.createdAt ?? null,
    lastSyncAt: user?.lastPlaySyncAt ?? null,
    snapshotDays: snapshots?.days ?? 0,
    firstSnapshotOn: snapshots?.first ?? null,
    lastImportAt: lastImport?.at ?? null,
  };
});

// --- aggregates ------------------------------------------------------------

export async function getTotals(range?: Range) {
  const where = await effectivePlays(range);
  return (
    getDb().get<{
      plays: number;
      ms: number | null;
      timedPlays: number;
      artists: number;
      tracks: number;
    }>(sql`
      SELECT COUNT(*) AS plays,
             SUM(p.ms_played) AS ms,
             COUNT(p.ms_played) AS timedPlays,
             COUNT(DISTINCT lower(p.artist_name)) AS artists,
             COUNT(DISTINCT lower(p.artist_name) || '|' || lower(p.track_name)) AS tracks
      FROM plays p WHERE ${where}
    `) ?? { plays: 0, ms: 0, timedPlays: 0, artists: 0, tracks: 0 }
  );
}

export type ArtistPlays = {
  name: string;
  plays: number;
  ms: number | null;
  artistId: string | null;
  trackId: string | null;
};

export async function getTopArtistsByPlays(range: Range | undefined, limit = 25) {
  const where = await effectivePlays(range);
  return getDb().all<ArtistPlays>(sql`
    SELECT MIN(p.artist_name) AS name, COUNT(*) AS plays, SUM(p.ms_played) AS ms,
           MAX(p.artist_id) AS artistId, MAX(p.track_id) AS trackId
    FROM plays p WHERE ${where}
    GROUP BY lower(p.artist_name)
    ORDER BY plays DESC, ms DESC
    LIMIT ${limit}
  `);
}

export type TrackPlays = {
  name: string;
  artistName: string;
  albumName: string | null;
  plays: number;
  ms: number | null;
  trackId: string | null;
};

export async function getTopTracksByPlays(range: Range | undefined, limit = 25) {
  const where = await effectivePlays(range);
  return getDb().all<TrackPlays>(sql`
    SELECT MIN(p.track_name) AS name, MIN(p.artist_name) AS artistName, MAX(p.album_name) AS albumName,
           COUNT(*) AS plays, SUM(p.ms_played) AS ms, MAX(p.track_id) AS trackId
    FROM plays p WHERE ${where}
    GROUP BY lower(p.artist_name), lower(p.track_name)
    ORDER BY plays DESC, ms DESC
    LIMIT ${limit}
  `);
}

/** Plays and listening time per UTC hour; converted to local time by the caller. */
export async function getHourBuckets(range?: Range) {
  const where = await effectivePlays(range);
  return getDb().all<{ hour: number; plays: number; ms: number | null }>(sql`
    SELECT p.played_at / 3600000 AS hour, COUNT(*) AS plays, SUM(p.ms_played) AS ms
    FROM plays p WHERE ${where}
    GROUP BY hour
  `);
}

/** Per-artist first/last play across all trusted history (not year-filtered). */
export async function getArtistTimeline() {
  const where = await effectivePlays();
  return getDb().all<{ name: string; first: number; last: number; plays: number }>(sql`
    SELECT MIN(p.artist_name) AS name, MIN(p.played_at) AS first, MAX(p.played_at) AS last, COUNT(*) AS plays
    FROM plays p WHERE ${where}
    GROUP BY lower(p.artist_name)
  `);
}

/**
 * Skip/shuffle/offline behavior — only the extended export records these.
 * Computed over every stream (including ones under 30s), since that's where
 * skips happen. A skip = Spotify's `skipped` flag or ending a track with "next".
 */
export async function getBehavior(range?: Range) {
  const { userId } = await requireSession();
  const rangeCond = range ? sql`AND played_at >= ${range.from} AND played_at < ${range.to}` : sql``;
  return (
    getDb().get<{
      streams: number;
      skipped: number | null;
      shuffleKnown: number;
      shuffled: number | null;
      offlineKnown: number;
      offline: number | null;
    }>(sql`
      SELECT COUNT(*) AS streams,
             SUM(skipped = 1 OR reason_end = 'fwdbtn') AS skipped,
             COUNT(shuffle) AS shuffleKnown, SUM(shuffle = 1) AS shuffled,
             COUNT(offline) AS offlineKnown, SUM(offline = 1) AS offline
      FROM plays WHERE user_id = ${userId} AND source = 'extended' ${rangeCond}
    `) ?? null
  );
}

/** Calendar years (UTC) that contain trusted plays, newest first. */
export async function getYears() {
  const where = await effectivePlays();
  return getDb()
    .all<{ year: string; plays: number }>(sql`
      SELECT strftime('%Y', p.played_at / 1000, 'unixepoch') AS year, COUNT(*) AS plays
      FROM plays p WHERE ${where}
      GROUP BY year ORDER BY year DESC
    `)
    .map((r) => ({ year: Number(r.year), plays: r.plays }));
}

export type SnapshotItem = {
  itemId: string;
  name: string;
  rank: number;
  imageUrl: string | null;
  subtitle: string | null;
};

/** Earliest and latest 4-week top-artist snapshots, for taste-drift comparison. */
export async function getSnapshotDrift(kind: "artists" | "tracks" = "artists") {
  const { userId } = await requireSession();
  const db = getDb();
  const bounds = db.get<{ first: string | null; last: string | null; days: number }>(sql`
    SELECT MIN(taken_on) AS first, MAX(taken_on) AS last, COUNT(DISTINCT taken_on) AS days
    FROM top_snapshots WHERE user_id = ${userId} AND kind = ${kind} AND time_range = 'short_term'
  `);
  if (!bounds?.first || !bounds.last) return null;

  const list = (day: string) =>
    db.all<SnapshotItem>(sql`
      SELECT item_id AS itemId, name, rank, image_url AS imageUrl, subtitle
      FROM top_snapshots
      WHERE user_id = ${userId} AND kind = ${kind} AND time_range = 'short_term' AND taken_on = ${day}
      ORDER BY rank
    `);

  return { first: bounds.first, last: bounds.last, days: bounds.days, before: list(bounds.first), after: list(bounds.last) };
}
