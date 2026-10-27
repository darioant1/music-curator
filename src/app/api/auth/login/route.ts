import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAppOrigin } from "@/lib/env";
import { OAUTH_STATE_COOKIE, oauthStateCookieOptions } from "@/lib/auth/session";
import { buildAuthorizeUrl } from "@/lib/spotify/oauth";

/**
 * GET /api/auth/login — start the Spotify OAuth flow.
 *
 * Generates an unguessable `state`, stores it in a short-lived httpOnly
 * cookie, and redirects to Spotify's consent screen. The callback rejects any
 * response whose `state` doesn't match, which blocks login-CSRF attacks.
 */
export function GET(request: NextRequest) {
  // Cookies are scoped per host: "localhost" and "127.0.0.1" don't share them.
  // If the user opened the app on a different host than the registered redirect
  // URI, bounce them to the right host first so the state cookie survives.
  // (Compare the raw Host header: request.nextUrl normalizes 127.0.0.1 to localhost in dev.)
  const appOrigin = getAppOrigin();
  if (request.headers.get("host") !== new URL(appOrigin).host) {
    return NextResponse.redirect(new URL("/api/auth/login", appOrigin));
  }

  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(buildAuthorizeUrl(state));
  response.cookies.set(OAUTH_STATE_COOKIE, state, oauthStateCookieOptions);
  return response;
}
