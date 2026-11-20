import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Database schema (SQLite via Drizzle).
 *
 * Every user-owned row carries `userId` (the Spotify user id from the session),
 * so the app is multi-user safe and future phases (recommendations, playlist
 * drafts, an MCP server) can key off the same identity.
 *
 * After editing this file run `npm run db:generate` to create a migration;
 * migrations are applied automatically when the app opens the database.
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // Spotify user id
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  /** Last time recently-played was pulled from the API (throttles background sync). */
  lastPlaySyncAt: integer("last_play_sync_at", { mode: "timestamp_ms" }),
  /** Calendar date (YYYY-MM-DD, UTC) of the last top-items snapshot. */
  lastSnapshotOn: text("last_snapshot_on"),
});

/**
 * One row per listen. Denormalized on purpose: Spotify's "Account data"
 * export has no track or artist ids, only names, so names are the common
 * denominator and ids are filled in when a source provides them.
 *
 * Sources, in order of trust:
 *   extended — "Extended streaming history" export (lifetime, richest fields)
 *   account  — "Account data" export (≈1 year, names + ms played only)
 *   api      — captured from GET /me/player/recently-played (last 50 at a time)
 * Overlapping sources are reconciled at query time (see history/effective.ts).
 */
export const plays = sqliteTable(
  "plays",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** When the stream ended (or, for API captures, Spotify's played_at), UTC epoch ms. */
    playedAt: integer("played_at").notNull(),
    /** Null for API captures, which don't report listening duration. */
    msPlayed: integer("ms_played"),
    trackName: text("track_name").notNull(),
    artistName: text("artist_name").notNull(),
    albumName: text("album_name"),
    trackId: text("track_id"),
    artistId: text("artist_id"),
    source: text("source", { enum: ["extended", "account", "api"] }).notNull(),
    // Behavioral fields — only present in extended history.
    reasonStart: text("reason_start"),
    reasonEnd: text("reason_end"),
    shuffle: integer("shuffle", { mode: "boolean" }),
    skipped: integer("skipped", { mode: "boolean" }),
    offline: integer("offline", { mode: "boolean" }),
  },
  (t) => [
    // Makes re-importing the same file (or re-syncing) a no-op.
    uniqueIndex("plays_dedupe").on(t.userId, t.source, t.playedAt, t.trackName, t.artistName),
    index("plays_user_time").on(t.userId, t.playedAt),
    index("plays_user_artist").on(t.userId, t.artistName),
  ],
);

/** Daily copies of Spotify's top artists/tracks, to observe taste drift over time. */
export const topSnapshots = sqliteTable(
  "top_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    takenOn: text("taken_on").notNull(), // YYYY-MM-DD (UTC)
    timeRange: text("time_range", { enum: ["short_term", "medium_term", "long_term"] }).notNull(),
    kind: text("kind", { enum: ["artists", "tracks"] }).notNull(),
    rank: integer("rank").notNull(),
    itemId: text("item_id").notNull(),
    name: text("name").notNull(),
    /** Track artists (for kind = tracks). */
    subtitle: text("subtitle"),
    imageUrl: text("image_url"),
  },
  (t) => [
    uniqueIndex("snapshots_unique").on(t.userId, t.takenOn, t.timeRange, t.kind, t.rank),
    index("snapshots_lookup").on(t.userId, t.kind, t.timeRange, t.takenOn),
  ],
);

/** Audit trail of history imports, shown on the Data page. */
export const imports = sqliteTable("imports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  source: text("source", { enum: ["extended", "account"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  received: integer("received").notNull(),
  inserted: integer("inserted").notNull(),
});

/**
 * Shared catalog cache (not user-specific): artwork and ids looked up from
 * Spotify for items that appear in imported history. Fetched lazily, once.
 */
export const catalogTracks = sqliteTable("catalog_tracks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  albumName: text("album_name"),
  imageUrl: text("image_url"),
  primaryArtistId: text("primary_artist_id"),
  primaryArtistName: text("primary_artist_name"),
  spotifyUrl: text("spotify_url"),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
});

export const catalogArtists = sqliteTable(
  "catalog_artists",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    spotifyUrl: text("spotify_url"),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("catalog_artists_name").on(t.name)],
);
