import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { spotifyFetch, spotifyPaginate } from "./client";
import type {
  Artist,
  Image,
  PlayedTrack,
  Playlist,
  RawArtist,
  RawImage,
  RawPlayHistory,
  RawPlaylist,
  RawSavedTrack,
  RawTrack,
  RawUser,
  SavedTrack,
  TimeRange,
  Track,
  UserProfile,
} from "./types";

/**
 * Data Access Layer for Spotify.
 *
 * Every exported function resolves the session itself, so callers can't ask
 * for another user's data and tokens never leave this module. Each one returns
 * app domain types (see types.ts), never raw Spotify payloads.
 *
 * `cache()` from React de-duplicates identical calls within one server
 * request (e.g. the layout and the page both asking for the profile).
 */

const requireAccessToken = cache(async (): Promise<{ token: string; userId: string }> => {
  const session = await getSession();
  if (!session) redirect("/?error=signed_out");
  return { token: session.accessToken, userId: session.userId };
});

// --- mappers ---------------------------------------------------------------

const toImages = (images: RawImage[] | null | undefined): Image[] =>
  (images ?? []).map(({ url, width, height }) => ({ url, width, height }));

function toTrack(raw: RawTrack): Track | null {
  // Local files and unavailable tracks have no id; skip them rather than render broken rows.
  if (!raw.id || raw.is_local) return null;
  const year = Number.parseInt(raw.album.release_date?.slice(0, 4) ?? "", 10);
  return {
    id: raw.id,
    name: raw.name,
    durationMs: raw.duration_ms,
    explicit: raw.explicit,
    artists: raw.artists.map(({ id, name }) => ({ id, name })),
    album: {
      id: raw.album.id,
      name: raw.album.name,
      images: toImages(raw.album.images),
      releaseYear: Number.isFinite(year) && year > 0 ? year : null,
    },
    spotifyUrl: raw.external_urls.spotify ?? null,
  };
}

function toArtist(raw: RawArtist): Artist {
  return {
    id: raw.id,
    name: raw.name,
    images: toImages(raw.images),
    genres: raw.genres ?? [],
    spotifyUrl: raw.external_urls.spotify,
  };
}

const notNull = <T>(value: T | null): value is T => value !== null;

// --- queries ---------------------------------------------------------------

export const getCurrentUser = cache(async (): Promise<UserProfile> => {
  const { token } = await requireAccessToken();
  const raw = await spotifyFetch<RawUser>(token, "/me");
  return {
    id: raw.id,
    displayName: raw.display_name ?? raw.id,
    images: toImages(raw.images),
    spotifyUrl: raw.external_urls.spotify,
  };
});

/** Spotify caps top items at 50 per request; that's the full window we display. */
export const getTopArtists = cache(async (timeRange: TimeRange, limit = 50): Promise<Artist[]> => {
  const { token } = await requireAccessToken();
  const page = await spotifyFetch<{ items: RawArtist[] }>(token, "/me/top/artists", {
    time_range: timeRange,
    limit,
  });
  return page.items.map(toArtist);
});

export const getTopTracks = cache(async (timeRange: TimeRange, limit = 50): Promise<Track[]> => {
  const { token } = await requireAccessToken();
  const page = await spotifyFetch<{ items: RawTrack[] }>(token, "/me/top/tracks", {
    time_range: timeRange,
    limit,
  });
  return page.items.map(toTrack).filter(notNull);
});

export const getPlaylists = cache(async (): Promise<{ playlists: Playlist[]; total: number }> => {
  const { token, userId } = await requireAccessToken();
  const { items, total } = await spotifyPaginate<RawPlaylist | null>(token, "/me/playlists", {
    maxItems: 500,
  });
  const playlists = items.filter(notNull).map(
    (raw): Playlist => ({
      id: raw.id,
      name: raw.name,
      description: raw.description || null,
      images: toImages(raw.images),
      isPublic: raw.public,
      collaborative: raw.collaborative,
      ownerName: raw.owner.display_name ?? raw.owner.id,
      ownedByUser: raw.owner.id === userId,
      trackCount: raw.items?.total ?? raw.tracks?.total ?? null,
      spotifyUrl: raw.external_urls.spotify,
    }),
  );
  return { playlists, total };
});

/**
 * Most recently saved tracks. `total` is Spotify's count of the whole library;
 * `tracks` holds at most `maxItems` of them.
 */
export const getSavedTracks = cache(
  async (
    maxItems = 200,
  ): Promise<{ tracks: SavedTrack[]; total: number; fetchedAt: number }> => {
    const { token } = await requireAccessToken();
    const { items, total } = await spotifyPaginate<RawSavedTrack>(token, "/me/tracks", {
      maxItems,
    });
    const tracks = items
      .map((item) => {
        const track = item.track && toTrack(item.track);
        return track ? { ...track, addedAt: item.added_at } : null;
      })
      .filter(notNull);
    return { tracks, total, fetchedAt: Date.now() };
  },
);

/**
 * Spotify returns at most the 50 most recent plays — not a full listening history.
 * `fetchedAt` lets the UI show relative times ("3 h ago") without reading the clock during render.
 */
export const getRecentlyPlayed = cache(
  async (): Promise<{ plays: PlayedTrack[]; fetchedAt: number }> => {
    const { token } = await requireAccessToken();
    const page = await spotifyFetch<{ items: RawPlayHistory[] }>(
      token,
      "/me/player/recently-played",
      { limit: 50 },
    );
    const plays = page.items
      .map((item) => {
        const track = item.track && toTrack(item.track);
        return track ? { ...track, playedAt: item.played_at } : null;
      })
      .filter(notNull);
    return { plays, fetchedAt: Date.now() };
  },
);
