import type { Artist, Image, RawArtist, RawImage, RawTrack, Track } from "./types";

/** Convert raw Spotify payloads into app domain types. Pure functions, safe anywhere on the server. */

export const toImages = (images: RawImage[] | null | undefined): Image[] =>
  (images ?? []).map(({ url, width, height }) => ({ url, width, height }));

export function toTrack(raw: RawTrack): Track | null {
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

export function toArtist(raw: RawArtist): Artist {
  return {
    id: raw.id,
    name: raw.name,
    images: toImages(raw.images),
    genres: raw.genres ?? [],
    spotifyUrl: raw.external_urls.spotify,
  };
}

export const notNull = <T>(value: T | null): value is T => value !== null;
