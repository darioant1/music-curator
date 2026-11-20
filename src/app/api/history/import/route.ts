import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAppOrigin } from "@/lib/env";
import { IMPORT_CHUNK_SIZE, isValidRecord, type ImportSource } from "@/lib/history/normalize";
import { importRecords } from "@/lib/history/store";

/**
 * POST /api/history/import — receive one chunk of parsed export records.
 *
 * The browser unzips and parses the Spotify export, then sends records here
 * in chunks (see components/history-importer.tsx). A Route Handler is used
 * instead of a Server Action because actions are limited to 1 MB per request.
 *
 * Identity comes only from the session cookie, never from the request body.
 */

const MAX_BODY_BYTES = 4 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== getAppOrigin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  let body: { source?: unknown; records?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const source = body.source;
  if (source !== "extended" && source !== "account") {
    return NextResponse.json({ error: "Unknown source" }, { status: 400 });
  }
  if (!Array.isArray(body.records) || body.records.length > IMPORT_CHUNK_SIZE) {
    return NextResponse.json(
      { error: `Send between 0 and ${IMPORT_CHUNK_SIZE} records per request` },
      { status: 400 },
    );
  }

  const now = Date.now();
  const valid = body.records.filter((r) => isValidRecord(r, now));
  const result = importRecords(session.userId, source as ImportSource, valid);

  return NextResponse.json({
    received: body.records.length,
    rejected: body.records.length - valid.length,
    inserted: result.inserted,
  });
}
