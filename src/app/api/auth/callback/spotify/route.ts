import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAppOrigin } from "@/lib/env";
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  encodeSession,
  oauthStateCookieOptions,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { exchangeCodeForTokens } from "@/lib/spotify/oauth";
import { SpotifyApiError, spotifyFetch } from "@/lib/spotify/client";
import type { RawUser } from "@/lib/spotify/types";

/**
 * GET /api/auth/callback/spotify — Spotify redirects here after consent.
 * Must exactly match the redirect URI registered in the Spotify dashboard.
 */
export async function GET(request: NextRequest) {
  const appOrigin = getAppOrigin();
  const params = request.nextUrl.searchParams;
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  const fail = (code: string) => {
    const response = NextResponse.redirect(new URL(`/?error=${code}`, appOrigin));
    response.cookies.set(OAUTH_STATE_COOKIE, "", { ...oauthStateCookieOptions, maxAge: 0 });
    return response;
  };

  // The user clicked "Cancel" on Spotify's consent screen, or Spotify reported an error.
  if (params.get("error")) {
    return fail(params.get("error") === "access_denied" ? "access_denied" : "oauth_error");
  }

  const state = params.get("state");
  const code = params.get("code");
  if (!state || !code || !expectedState || !safeEqual(state, expectedState)) {
    return fail("state_mismatch");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) throw new Error("Spotify did not return a refresh token");

    // Fetch the profile once so the session is tied to a stable Spotify user id.
    const user = await spotifyFetch<RawUser>(tokens.access_token, "/me");

    const response = NextResponse.redirect(new URL("/dashboard", appOrigin));
    response.cookies.set(
      SESSION_COOKIE,
      encodeSession({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        scope: tokens.scope,
        userId: user.id,
      }),
      sessionCookieOptions,
    );
    response.cookies.set(OAUTH_STATE_COOKIE, "", { ...oauthStateCookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    // Development Mode returns 403 for accounts not on the app's user allowlist.
    if (error instanceof SpotifyApiError && error.isForbidden) return fail("not_allowlisted");
    console.error("[auth] callback failed:", error instanceof Error ? error.message : "unknown");
    return fail("token_exchange_failed");
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
