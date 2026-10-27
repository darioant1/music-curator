/**
 * Two layers of types:
 *
 * 1. `Raw*` — the subset of Spotify's JSON we read. Fields Spotify removed or
 *    deprecated in the February 2026 Development Mode changes (popularity,
 *    followers, genres, preview_url, user email/country/product) are either
 *    omitted or marked optional so we never depend on them.
 *
 * 2. App domain types (`Artist`, `Track`, ...) — small, serializable shapes the
 *    UI consumes. Keeping these separate means future phases (a SQLite cache,
 *    an AI recommender, an MCP server) work with stable models rather than
 *    raw API payloads.
 */

export type RawImage = { url: string; width: number | null; height: number | null };

export type RawArtist = {
  id: string;
  name: string;
  images?: RawImage[];
  /** Deprecated by Spotify; may be empty or absent in Development Mode. */
  genres?: string[];
  external_urls: { spotify: string };
};

export type RawSimplifiedArtist = { id: string; name: string; external_urls: { spotify: string } };

export type RawTrack = {
  id: string | null;
  name: string;
  duration_ms: number;
  explicit: boolean;
  is_local: boolean;
  artists: RawSimplifiedArtist[];
  album: {
    id: string;
    name: string;
    images: RawImage[];
    release_date: string;
    release_date_precision: "year" | "month" | "day";
  };
  external_urls: { spotify?: string };
};

export type RawSavedTrack = { added_at: string; track: RawTrack | null };
export type RawPlayHistory = { played_at: string; track: RawTrack | null };

export type RawPlaylist = {
  id: string;
  name: string;
  description: string | null;
  images: RawImage[] | null;
  public: boolean | null;
  collaborative: boolean;
  owner: { id: string; display_name: string | null };
  /** Current field for item count (Feb 2026+). */
  items?: { total: number } | null;
  /** Deprecated predecessor of `items`; read only as a fallback. */
  tracks?: { total: number } | null;
  external_urls: { spotify: string };
};

export type RawUser = {
  id: string;
  display_name: string | null;
  images?: RawImage[];
  external_urls: { spotify: string };
};

// ---------------------------------------------------------------------------
// App domain types
// ---------------------------------------------------------------------------

export type TimeRange = "short_term" | "medium_term" | "long_term";

export const TIME_RANGES: { value: TimeRange; label: string; description: string }[] = [
  { value: "short_term", label: "4 weeks", description: "Approximately the last 4 weeks" },
  { value: "medium_term", label: "6 months", description: "Approximately the last 6 months" },
  { value: "long_term", label: "1 year", description: "Calculated from about one year of data" },
];

export function parseTimeRange(value: unknown): TimeRange {
  return TIME_RANGES.some((r) => r.value === value) ? (value as TimeRange) : "medium_term";
}

export type Image = { url: string; width: number | null; height: number | null };

export type UserProfile = {
  id: string;
  displayName: string;
  images: Image[];
  spotifyUrl: string;
};

export type Artist = {
  id: string;
  name: string;
  images: Image[];
  genres: string[];
  spotifyUrl: string;
};

export type Track = {
  id: string;
  name: string;
  durationMs: number;
  explicit: boolean;
  artists: { id: string; name: string }[];
  album: { id: string; name: string; images: Image[]; releaseYear: number | null };
  spotifyUrl: string | null;
};

export type SavedTrack = Track & { addedAt: string };
export type PlayedTrack = Track & { playedAt: string };

export type Playlist = {
  id: string;
  name: string;
  description: string | null;
  images: Image[];
  isPublic: boolean | null;
  collaborative: boolean;
  ownerName: string;
  ownedByUser: boolean;
  trackCount: number | null;
  spotifyUrl: string;
};
