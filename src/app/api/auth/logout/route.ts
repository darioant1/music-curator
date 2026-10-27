import { NextResponse, type NextRequest } from "next/server";
import { getAppOrigin } from "@/lib/env";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

/**
 * POST /api/auth/logout — clear the session cookie.
 *
 * POST-only so a stray link or image tag can't log the user out. Spotify has
 * no token-revocation endpoint; to fully revoke this app's access, the user
 * can remove it at https://www.spotify.com/account/apps/.
 */
export function POST(request: NextRequest) {
  // Reject cross-site form posts. Browsers always send Origin on form POSTs.
  const appOrigin = getAppOrigin();
  const origin = request.headers.get("origin");
  if (origin && origin !== appOrigin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // 303 turns the POST into a GET on the landing page.
  const response = NextResponse.redirect(new URL("/", appOrigin), 303);
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
