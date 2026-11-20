import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAppOrigin } from "@/lib/env";
import { runBackgroundSync } from "@/lib/history/capture";

/**
 * POST /api/history/sync — save recent plays (throttled to every 10 minutes)
 * and the daily top-items snapshot.
 *
 * Called by the browser once after the dashboard loads (components/sync-on-load.tsx).
 * Deliberately NOT done during page rendering: Next.js prerenders and
 * prefetches pages in the background, and data writes must not be a side
 * effect of a prefetch.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== getAppOrigin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const result = await runBackgroundSync(session.accessToken, session.userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[sync] failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Sync failed" }, { status: 502 });
  }
}
