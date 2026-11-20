import "server-only";
import { inArray, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/current";
import { getDb, schema } from "@/lib/db";
import { pickImage } from "@/lib/format";
import { spotifyFetch } from "@/lib/spotify/client";
import { toImages } from "@/lib/spotify/mappers";
import type { RawArtist, RawTrack } from "@/lib/spotify/types";
import { catalogTrackFromRaw } from "./capture";
import { cacheArtists, cacheTracks } from "./store";

/**
 * Artwork for history lists.
 *
 * Exported history contains names and track ids but no images. We look up
 * missing items from Spotify on demand (GET /tracks/{id}, GET /artists/{id}),
 * cache them in catalog_* tables, and never fetch the same item twice.
 * A per-request budget keeps first-time page loads bounded; anything over
 * budget simply shows a placeholder and fills in on a later visit.
 */

const LOOKUP_BUDGET = 30;
const CONCURRENCY = 4;

export type Art = { imageUrl: string | null; spotifyUrl: string | null };

async function inBatches<T>(items: T[], fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(fn));
  }
}

async function fetchMissingTracks(token: string, ids: string[], budget: { left: number }) {
  const db = getDb();
  const known = new Set(
    ids.length
      ? db
          .select({ id: schema.catalogTracks.id })
          .from(schema.catalogTracks)
          .where(inArray(schema.catalogTracks.id, ids))
          .all()
          .map((r) => r.id)
      : [],
  );
  const missing = ids.filter((id) => !known.has(id)).slice(0, budget.left);
  budget.left -= missing.length;
  const fetched: NonNullable<ReturnType<typeof catalogTrackFromRaw>>[] = [];
  await inBatches(missing, async (id) => {
    try {
      const raw = await spotifyFetch<RawTrack>(token, `/tracks/${id}`);
      const row = catalogTrackFromRaw(raw);
      if (row) fetched.push(row);
    } catch {
      // Unavailable or region-locked track — leave it without artwork.
    }
  });
  cacheTracks(fetched);
}

export async function trackArtwork(trackIds: (string | null)[]): Promise<Map<string, Art>> {
  const { token } = await requireSession();
  const ids = [...new Set(trackIds.filter((id): id is string => !!id))];
  try {
    await fetchMissingTracks(token, ids, { left: LOOKUP_BUDGET });
  } catch (error) {
    console.error("[enrich] tracks:", error instanceof Error ? error.message : error);
  }
  const rows = ids.length
    ? getDb().select().from(schema.catalogTracks).where(inArray(schema.catalogTracks.id, ids)).all()
    : [];
  return new Map(rows.map((r) => [r.id, { imageUrl: r.imageUrl, spotifyUrl: r.spotifyUrl }]));
}

/** Keyed by lowercase artist name. */
export async function artistArtwork(
  artists: { name: string; artistId: string | null; trackId: string | null }[],
): Promise<Map<string, Art>> {
  const { token } = await requireSession();
  const db = getDb();
  const budget = { left: LOOKUP_BUDGET };
  const result = new Map<string, Art>();
  if (artists.length === 0) return result;

  try {
    // 1. Resolve an artist id for each name: known id → cached artist by name → via one of their tracks.
    await fetchMissingTracks(
      token,
      artists.filter((a) => !a.artistId && a.trackId).map((a) => a.trackId!),
      budget,
    );
    const trackIds = artists.map((a) => a.trackId).filter((id): id is string => !!id);
    const trackRows = trackIds.length
      ? db.select().from(schema.catalogTracks).where(inArray(schema.catalogTracks.id, trackIds)).all()
      : [];
    const artistByTrack = new Map(trackRows.map((r) => [r.id, r.primaryArtistId]));

    const names = artists.map((a) => a.name.toLowerCase());
    const byName = new Map(
      db
        .select()
        .from(schema.catalogArtists)
        .where(inArray(sql`lower(${schema.catalogArtists.name})`, names))
        .all()
        .map((r) => [r.name.toLowerCase(), r.id]),
    );

    const idFor = new Map<string, string>();
    for (const a of artists) {
      const id =
        a.artistId ?? byName.get(a.name.toLowerCase()) ?? (a.trackId ? artistByTrack.get(a.trackId) : null);
      if (id) idFor.set(a.name.toLowerCase(), id);
    }

    // 2. Fetch artists we have an id for but no cached image.
    const ids = [...new Set(idFor.values())];
    const cached = new Set(
      ids.length
        ? db
            .select({ id: schema.catalogArtists.id })
            .from(schema.catalogArtists)
            .where(inArray(schema.catalogArtists.id, ids))
            .all()
            .map((r) => r.id)
        : [],
    );
    const missing = ids.filter((id) => !cached.has(id)).slice(0, budget.left);
    const fetched: Parameters<typeof cacheArtists>[0] = [];
    await inBatches(missing, async (id) => {
      try {
        const raw = await spotifyFetch<RawArtist>(token, `/artists/${id}`);
        fetched.push({
          id: raw.id,
          name: raw.name,
          imageUrl: pickImage(toImages(raw.images), 160),
          spotifyUrl: raw.external_urls.spotify,
        });
      } catch {
        // Leave without artwork.
      }
    });
    cacheArtists(fetched);

    // 3. Assemble.
    const rows = ids.length
      ? db.select().from(schema.catalogArtists).where(inArray(schema.catalogArtists.id, ids)).all()
      : [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const [name, id] of idFor) {
      const row = byId.get(id);
      if (row) result.set(name, { imageUrl: row.imageUrl, spotifyUrl: row.spotifyUrl });
    }
  } catch (error) {
    console.error("[enrich] artists:", error instanceof Error ? error.message : error);
  }

  return result;
}
