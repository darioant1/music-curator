import { describe, expect, it } from "vitest";
import {
  classifyExportFile,
  isValidRecord,
  parseAccountRow,
  parseExportFile,
  parseExtendedRow,
} from "./normalize";

// Shapes mirror Spotify's export format; values are made-up test fixtures.
const extendedRow = {
  ts: "2023-04-01T18:30:00Z",
  username: "someone",
  platform: "android",
  ms_played: 185000,
  conn_country: "US",
  ip_addr: "203.0.113.7",
  master_metadata_track_name: "Test Song",
  master_metadata_album_artist_name: "Test Artist",
  master_metadata_album_album_name: "Test Album",
  spotify_track_uri: "spotify:track:4uLU6hMCjMI75M1A2tKUQC",
  episode_name: null,
  reason_start: "trackdone",
  reason_end: "fwdbtn",
  shuffle: true,
  skipped: false,
  offline: false,
  incognito_mode: false,
};

describe("classifyExportFile", () => {
  it("recognizes extended, account, and ignores other files", () => {
    expect(classifyExportFile("Spotify Extended Streaming History/Streaming_History_Audio_2019-2021_0.json")).toBe("extended");
    expect(classifyExportFile("Spotify Account Data/StreamingHistory_music_0.json")).toBe("account");
    expect(classifyExportFile("MyData/StreamingHistory3.json")).toBe("account");
    expect(classifyExportFile("Streaming_History_Video_2020.json")).toBeNull();
    expect(classifyExportFile("StreamingHistory_podcast_0.json")).toBeNull();
    expect(classifyExportFile("Userdata.json")).toBeNull();
  });
});

describe("parseExtendedRow", () => {
  it("keeps only the fields we use and drops personal data", () => {
    const record = parseExtendedRow(extendedRow)!;
    expect(record).toEqual({
      playedAt: Date.parse("2023-04-01T18:30:00Z"),
      msPlayed: 185000,
      trackName: "Test Song",
      artistName: "Test Artist",
      albumName: "Test Album",
      trackId: "4uLU6hMCjMI75M1A2tKUQC",
      reasonStart: "trackdone",
      reasonEnd: "fwdbtn",
      shuffle: true,
      skipped: false,
      offline: false,
    });
    expect(JSON.stringify(record)).not.toContain("203.0.113.7");
    expect(JSON.stringify(record)).not.toContain("someone");
  });

  it("skips podcast episodes (no track name)", () => {
    expect(
      parseExtendedRow({ ...extendedRow, master_metadata_track_name: null, episode_name: "Ep 1" }),
    ).toBeNull();
  });

  it("tolerates missing optional fields", () => {
    const record = parseExtendedRow({ ...extendedRow, skipped: null, spotify_track_uri: "bad" })!;
    expect(record.skipped).toBeNull();
    expect(record.trackId).toBeNull();
  });
});

describe("parseAccountRow", () => {
  it("parses endTime as UTC minutes", () => {
    const record = parseAccountRow({
      endTime: "2024-01-31 23:05",
      artistName: "Test Artist",
      trackName: "Test Song",
      msPlayed: 1000,
    })!;
    expect(record.playedAt).toBe(Date.UTC(2024, 0, 31, 23, 5));
    expect(record.trackId).toBeNull();
  });

  it("rejects malformed rows", () => {
    expect(parseAccountRow({ endTime: "yesterday", artistName: "A", trackName: "B", msPlayed: 1 })).toBeNull();
    expect(parseAccountRow(null)).toBeNull();
  });
});

describe("parseExportFile", () => {
  it("requires an array and filters unusable rows", () => {
    expect(() => parseExportFile("extended", { not: "an array" })).toThrow();
    expect(parseExportFile("extended", [extendedRow, { junk: true }])).toHaveLength(1);
  });
});

describe("isValidRecord (server-side validation)", () => {
  const valid = parseExtendedRow(extendedRow)!;
  const now = Date.UTC(2026, 9, 1);

  it("accepts a well-formed record", () => {
    expect(isValidRecord(valid, now)).toBe(true);
  });

  it("rejects tampered records", () => {
    expect(isValidRecord({ ...valid, playedAt: Date.UTC(1999, 0, 1) }, now)).toBe(false);
    expect(isValidRecord({ ...valid, playedAt: now + 7 * 86_400_000 }, now)).toBe(false);
    expect(isValidRecord({ ...valid, msPlayed: -5 }, now)).toBe(false);
    expect(isValidRecord({ ...valid, trackName: "" }, now)).toBe(false);
    expect(isValidRecord({ ...valid, trackName: "x".repeat(600) }, now)).toBe(false);
    expect(isValidRecord({ ...valid, trackId: "'; DROP TABLE plays;--" }, now)).toBe(false);
    expect(isValidRecord({ ...valid, shuffle: "yes" }, now)).toBe(false);
  });
});
