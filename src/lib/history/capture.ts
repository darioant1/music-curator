import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { spotifyFetch } from "@/lib/spotify/client";
import { pickImage } from "@/lib/format";
import { notNull, toArtist, toTrack } from "@/lib/spotify/mappers";
import type { RawArtist, RawPlayHistory, RawTrack, TimeRange } from "@/lib/spotify/types";
import {
  cacheArtists,
  cacheTracks,
  ensureUser,
  insertCapturedPlays,
  markPlaySync,
  saveSnapshot,
} from "./store";

/**
 * Background collection from the Spotify API.
 *
 * Spotify only ever returns your last 50 plays and current top-50 lists. By
 * saving them regularly we build up history the API alone can't provide:
 * - recently played  → every 10 minutes at most (when you use the app)
 * - top items        → once per calendar day
 *
 * These functions receive the token and userId explicitly so they don't
 * depend on request context (called from a Route Handler and a Server Action).
 */

const PLAY_SYNC_INTERVAL_MS = 10 * 60 * 1000;
const TIME_RANGES: TimeRange[] = ["short_term", "medium_term", "long_term"];

export type SyncResult = { playsInserted: number; snapshotTaken: boolean };

export async function runBackgroundSync(
  token: string,
  userId: string,
  { force = false } = {},
): Promise<SyncResult> {
  ensureUser(userId);
  const user = getDb().select().from(schema.users).where(eq(schema.users.id, userId)).get();
  const now = new Date();
  const result: SyncResult = { playsInserted: 0, snapshotTaken: false };

  const syncDue =
    force || !user?.lastPlaySyncAt || now.getTime() - user.lastPlaySyncAt.getTime() > PLAY_SYNC_INTERVAL_MS;
  if (syncDue) {
    // Mark first so concurrent requests don't all fetch at once; roll back on failure
    // so a failed attempt doesn't block the next one for 10 minutes.
    markPlaySync(userId, now);
    try {
      result.playsInserted = await captureRecentPlays(token, userId);
    } catch (error) {
      markPlaySync(userId, user?.lastPlaySyncAt ?? null);
      throw error;
    }
  }

  const today = now.toISOString().slice(0, 10);
  if (user?.lastSnapshotOn !== today) {
    await snapshotTopItems(token, userId, today);
    result.snapshotTaken = true;
  }

  return result;
}

async function captureRecentPlays(token: string, userId: string): Promise<number> {
  const page = await spotifyFetch<{ items: RawPlayHistory[] }>(token, "/me/player/recently-played", {
    limit: 50,
  });

  const rows = page.items
    .map((item) => {
      const track = item.track && toTrack(item.track);
      if (!track) return null;
      return {
        playedAt: Date.parse(item.played_at),
        msPlayed: null,
        trackName: track.name,
        artistName: track.artists[0]?.name ?? "Unknown artist",
        albumName: track.album.name,
        trackId: track.id,
        artistId: track.artists[0]?.id ?? null,
      };
    })
    .filter(notNull);

  // We already have artwork for these tracks, so seed the catalog cache for free.
  cacheTracks(page.items.map((i) => i.track).filter(notNull).map(catalogTrackFromRaw).filter(notNull));

  return insertCapturedPlays(userId, rows);
}

async function snapshotTopItems(token: string, userId: string, takenOn: string) {
  const rows: Parameters<typeof saveSnapshot>[2] = [];

  for (const timeRange of TIME_RANGES) {
    const [artists, tracks] = await Promise.all([
      spotifyFetch<{ items: RawArtist[] }>(token, "/me/top/artists", { time_range: timeRange, limit: 50 }),
      spotifyFetch<{ items: RawTrack[] }>(token, "/me/top/tracks", { time_range: timeRange, limit: 50 }),
    ]);

    artists.items.map(toArtist).forEach((a, i) =>
      rows.push({
        timeRange,
        kind: "artists",
        rank: i + 1,
        itemId: a.id,
        name: a.name,
        subtitle: null,
        imageUrl: pickImage(a.images, 160),
      }),
    );
    tracks.items
      .map(toTrack)
      .filter(notNull)
      .forEach((t, i) =>
        rows.push({
          timeRange,
          kind: "tracks",
          rank: i + 1,
          itemId: t.id,
          name: t.name,
          subtitle: t.artists.map((a) => a.name).join(", "),
          imageUrl: pickImage(t.album.images, 160),
        }),
      );

    cacheArtists(
      artists.items.map((a) => ({
        id: a.id,
        name: a.name,
        imageUrl: pickImage(toArtist(a).images, 160),
        spotifyUrl: a.external_urls.spotify,
      })),
    );
    cacheTracks(tracks.items.map(catalogTrackFromRaw).filter(notNull));
  }

  saveSnapshot(userId, takenOn, rows);
}

export function catalogTrackFromRaw(raw: RawTrack) {
  const track = toTrack(raw);
  if (!track) return null;
  return {
    id: track.id,
    name: track.name,
    albumName: track.album.name,
    imageUrl: pickImage(track.album.images, 160),
    primaryArtistId: track.artists[0]?.id ?? null,
    primaryArtistName: track.artists[0]?.name ?? null,
    spotifyUrl: track.spotifyUrl,
  };
}
