import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

/**
 * Lazily-opened SQLite connection.
 *
 * - The file lives at DATABASE_PATH (default ./data/curator.db, git-ignored).
 * - Pending migrations from ./drizzle are applied on first open, so a fresh
 *   checkout just works.
 * - The instance is cached on globalThis so dev-mode hot reloads don't open
 *   a new connection on every edit.
 *
 * better-sqlite3 is synchronous: queries block briefly but are very fast for
 * a local single-user database, and there's no connection pool to manage.
 */

export type DB = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { __curatorDb?: DB };

export function getDb(): DB {
  if (globalForDb.__curatorDb) return globalForDb.__curatorDb;

  // turbopackIgnore: these paths are resolved at runtime, not bundled.
  const file = path.resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH ?? "data/curator.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL"); // concurrent reads while writing
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle") });

  globalForDb.__curatorDb = db;
  return db;
}

export { schema };
