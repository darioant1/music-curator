import type { Artist, Track } from "@/lib/spotify/types";

/**
 * Calculated insights — pure functions over data actually retrieved from
 * Spotify. Nothing here is fetched or estimated from outside sources, and every
 * result describes only the sample it was given (e.g. "your top 50 tracks"),
 * not your full listening history.
 */

/** Share of current (≈4 week) top artists that also appear in the ≈1 year list. */
export function artistRetention(recent: Artist[], longTerm: Artist[]) {
  if (recent.length === 0) return null;
  const longIds = new Set(longTerm.map((a) => a.id));
  const shared = recent.filter((a) => longIds.has(a.id));
  const newcomers = recent.filter((a) => !longIds.has(a.id));
  return { sharedRatio: shared.length / recent.length, newcomers };
}

/** How concentrated a track list is among its most frequent artists (primary artist only). */
export function artistConcentration(tracks: Track[], topN = 3) {
  if (tracks.length === 0) return null;
  const counts = new Map<string, { name: string; count: number }>();
  for (const track of tracks) {
    const primary = track.artists[0];
    if (!primary) continue;
    const entry = counts.get(primary.id) ?? { name: primary.name, count: 0 };
    entry.count += 1;
    counts.set(primary.id, entry);
  }
  const ranked = [...counts.values()].sort((a, b) => b.count - a.count);
  const topCount = ranked.slice(0, topN).reduce((sum, a) => sum + a.count, 0);
  return {
    uniqueArtists: counts.size,
    topShare: topCount / tracks.length,
    topArtists: ranked.slice(0, topN),
  };
}

/** Count of tracks per release decade, oldest first. Tracks without a year are excluded. */
export function decadeDistribution(tracks: Track[]) {
  const counts = new Map<number, number>();
  for (const track of tracks) {
    const year = track.album.releaseYear;
    if (!year) continue;
    const decade = Math.floor(year / 10) * 10;
    counts.set(decade, (counts.get(decade) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([decade, count]) => ({ decade, count }));
}

export function averageDurationMs(tracks: Track[]) {
  if (tracks.length === 0) return null;
  return tracks.reduce((sum, t) => sum + t.durationMs, 0) / tracks.length;
}

export function explicitShare(tracks: Track[]) {
  if (tracks.length === 0) return null;
  return tracks.filter((t) => t.explicit).length / tracks.length;
}

/**
 * Genre frequency across artists. Spotify deprecated `genres` in 2026, so this
 * frequently returns an empty list — callers should hide the section then.
 */
export function genreCounts(artists: Artist[], limit = 12) {
  const counts = new Map<string, number>();
  for (const artist of artists) {
    for (const genre of artist.genres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre, count]) => ({ genre, count }));
}
