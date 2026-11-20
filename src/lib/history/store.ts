import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { ImportRecord, ImportSource } from "./normalize";

/**
 * Database writes for listening history. Callers pass a userId they obtained
 * from the session (via requireSession or the session cookie) — these
 * functions never take identity from client input.
 */

/** SQLite caps bound parameters per statement; 15 columns × 400 rows stays well under it. */
const INSERT_BATCH = 400;

export function ensureUser(userId: string) {
  getDb()
    .insert(schema.users)
    .values({ id: userId, createdAt: new Date() })
    .onConflictDoNothing()
    .run();
}

type PlayInsert = typeof schema.plays.$inferInsert;

/** Insert plays, ignoring exact duplicates. Returns how many rows were new. */
function insertPlays(rows: PlayInsert[]): number {
  const db = getDb();
  let inserted = 0;
  db.transaction((tx) => {
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const result = tx
        .insert(schema.plays)
        .values(rows.slice(i, i + INSERT_BATCH))
        .onConflictDoNothing()
        .run();
      inserted += result.changes;
    }
  });
  return inserted;
}

export function importRecords(userId: string, source: ImportSource, records: ImportRecord[]) {
  ensureUser(userId);
  const inserted = insertPlays(records.map((r) => ({ ...r, userId, source, artistId: null })));
  getDb()
    .insert(schema.imports)
    .values({ userId, source, createdAt: new Date(), received: records.length, inserted })
    .run();
  return { received: records.length, inserted };
}

export function insertCapturedPlays(
  userId: string,
  plays: Omit<PlayInsert, "userId" | "source">[],
): number {
  return insertPlays(plays.map((p) => ({ ...p, userId, source: "api" as const })));
}

export function markPlaySync(userId: string, at: Date | null) {
  getDb().update(schema.users).set({ lastPlaySyncAt: at }).where(eq(schema.users.id, userId)).run();
}

export function saveSnapshot(
  userId: string,
  takenOn: string,
  rows: Omit<typeof schema.topSnapshots.$inferInsert, "userId" | "takenOn">[],
) {
  const db = getDb();
  db.transaction((tx) => {
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      tx.insert(schema.topSnapshots)
        .values(rows.slice(i, i + INSERT_BATCH).map((r) => ({ ...r, userId, takenOn })))
        .onConflictDoNothing()
        .run();
    }
    tx.update(schema.users)
      .set({ lastSnapshotOn: takenOn })
      .where(eq(schema.users.id, userId))
      .run();
  });
}

// --- shared catalog cache --------------------------------------------------

export function cacheTracks(rows: Omit<typeof schema.catalogTracks.$inferInsert, "fetchedAt">[]) {
  if (rows.length === 0) return;
  const db = getDb();
  const fetchedAt = new Date();
  db.transaction((tx) => {
    for (const row of rows) {
      tx.insert(schema.catalogTracks)
        .values({ ...row, fetchedAt })
        .onConflictDoUpdate({ target: schema.catalogTracks.id, set: { ...row, fetchedAt } })
        .run();
    }
  });
}

export function cacheArtists(rows: Omit<typeof schema.catalogArtists.$inferInsert, "fetchedAt">[]) {
  if (rows.length === 0) return;
  const db = getDb();
  const fetchedAt = new Date();
  db.transaction((tx) => {
    for (const row of rows) {
      tx.insert(schema.catalogArtists)
        .values({ ...row, fetchedAt })
        .onConflictDoUpdate({ target: schema.catalogArtists.id, set: { ...row, fetchedAt } })
        .run();
    }
  });
}

// --- deletion --------------------------------------------------------------

/** Remove imported history (export files) but keep plays captured from the API and snapshots. */
export function deleteImportedHistory(userId: string) {
  const db = getDb();
  db.transaction((tx) => {
    tx.delete(schema.plays)
      .where(
        and(eq(schema.plays.userId, userId), inArray(schema.plays.source, ["extended", "account"])),
      )
      .run();
    tx.delete(schema.imports).where(eq(schema.imports.userId, userId)).run();
  });
}

/** Remove everything stored for this user. Foreign keys cascade to plays, snapshots, imports. */
export function deleteAllUserData(userId: string) {
  getDb().delete(schema.users).where(eq(schema.users.id, userId)).run();
}
