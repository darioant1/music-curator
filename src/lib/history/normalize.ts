/**
 * Parsing Spotify's "Download your data" exports into a minimal play record.
 *
 * This module runs in BOTH places:
 * - in the browser, so the export is unzipped and trimmed locally and fields
 *   we don't need (IP address, user agent, country, username) never leave
 *   the user's machine;
 * - on the server, which re-validates every record because client input is
 *   never trusted.
 *
 * Field names follow Spotify's export format. Parsers are deliberately
 * tolerant: unknown fields are ignored and missing optional fields become null.
 */

export type ImportSource = "extended" | "account";

export type ImportRecord = {
  playedAt: number; // UTC epoch ms when the stream ended
  msPlayed: number;
  trackName: string;
  artistName: string;
  albumName: string | null;
  trackId: string | null;
  reasonStart: string | null;
  reasonEnd: string | null;
  shuffle: boolean | null;
  skipped: boolean | null;
  offline: boolean | null;
};

/** Which export a file inside the zip belongs to, or null to ignore it. */
export function classifyExportFile(fileName: string): ImportSource | null {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  if (!base.toLowerCase().endsWith(".json")) return null;
  // Extended: Streaming_History_Audio_2019-2021_0.json (Video/podcast files are skipped)
  if (/^Streaming_History_Audio_/i.test(base)) return "extended";
  // Account data: StreamingHistory_music_0.json (newer) or StreamingHistory0.json (older)
  if (/^StreamingHistory(_music_)?\d+\.json$/i.test(base)) return "account";
  return null;
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

function trackIdFromUri(uri: unknown): string | null {
  const s = str(uri);
  const match = s?.match(/^spotify:track:([A-Za-z0-9]{22})$/);
  return match ? match[1] : null;
}

/** One row of Streaming_History_Audio_*.json. Returns null for podcasts/audiobooks. */
export function parseExtendedRow(row: unknown): ImportRecord | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const trackName = str(r.master_metadata_track_name);
  const artistName = str(r.master_metadata_album_artist_name);
  const ts = str(r.ts);
  if (!trackName || !artistName || !ts || typeof r.ms_played !== "number") return null;
  const playedAt = Date.parse(ts);
  if (Number.isNaN(playedAt)) return null;
  return {
    playedAt,
    msPlayed: r.ms_played,
    trackName,
    artistName,
    albumName: str(r.master_metadata_album_album_name),
    trackId: trackIdFromUri(r.spotify_track_uri),
    reasonStart: str(r.reason_start),
    reasonEnd: str(r.reason_end),
    shuffle: bool(r.shuffle),
    skipped: bool(r.skipped),
    offline: bool(r.offline),
  };
}

/** One row of StreamingHistory_music_*.json — `endTime` is "YYYY-MM-DD HH:MM" in UTC. */
export function parseAccountRow(row: unknown): ImportRecord | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const trackName = str(r.trackName);
  const artistName = str(r.artistName);
  const endTime = str(r.endTime);
  if (!trackName || !artistName || !endTime || typeof r.msPlayed !== "number") return null;
  const match = endTime.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  return {
    playedAt: Date.UTC(y, mo - 1, d, h, mi),
    msPlayed: r.msPlayed,
    trackName,
    artistName,
    albumName: null,
    trackId: null,
    reasonStart: null,
    reasonEnd: null,
    shuffle: null,
    skipped: null,
    offline: null,
  };
}

export function parseExportFile(source: ImportSource, json: unknown): ImportRecord[] {
  if (!Array.isArray(json)) throw new Error("Expected a JSON array of streams");
  const parse = source === "extended" ? parseExtendedRow : parseAccountRow;
  const records: ImportRecord[] = [];
  for (const row of json) {
    const record = parse(row);
    if (record) records.push(record);
  }
  return records;
}

// --- server-side validation of uploaded records ----------------------------

const MIN_TS = Date.UTC(2006, 0, 1); // Spotify was founded in 2006
const MAX_TEXT = 512;

const isText = (v: unknown, nullable = false) =>
  (nullable && v === null) || (typeof v === "string" && v.length > 0 && v.length <= MAX_TEXT);
const isBoolOrNull = (v: unknown) => v === null || typeof v === "boolean";

/** Strictly checks a record received from the client. */
export function isValidRecord(v: unknown, now = Date.now()): v is ImportRecord {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    Number.isInteger(r.playedAt) &&
    (r.playedAt as number) >= MIN_TS &&
    (r.playedAt as number) <= now + 86_400_000 &&
    Number.isInteger(r.msPlayed) &&
    (r.msPlayed as number) >= 0 &&
    (r.msPlayed as number) < 86_400_000 &&
    isText(r.trackName) &&
    isText(r.artistName) &&
    isText(r.albumName, true) &&
    (r.trackId === null || (typeof r.trackId === "string" && /^[A-Za-z0-9]{22}$/.test(r.trackId))) &&
    isText(r.reasonStart, true) &&
    isText(r.reasonEnd, true) &&
    isBoolOrNull(r.shuffle) &&
    isBoolOrNull(r.skipped) &&
    isBoolOrNull(r.offline)
  );
}

/** Records per upload request; keeps each request well under 1 MB. */
export const IMPORT_CHUNK_SIZE = 2000;
