import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  decodeSession,
  encodeSession,
  needsRefresh,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { RefreshTokenRevokedError, refreshAccessToken } from "@/lib/spotify/oauth";

/**
 * Proxy (formerly "middleware") for dashboard routes.
 *
 * 1. Redirects visitors without a valid session to the landing page.
 * 2. Refreshes the Spotify access token shortly before it expires.
 *
 * Refresh lives here because Server Components can read cookies but not write
 * them. The new session is written to the outgoing response (for the browser)
 * *and* to the forwarded request (so this same render already uses the fresh
 * token).
 *
 * Pages still verify the session themselves via the Data Access Layer —
 * the proxy is a convenience, not the only line of defense.
 */
export async function proxy(request: NextRequest) {
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    return signOutRedirect(request, "signed_out");
  }

  if (!needsRefresh(session)) {
    return NextResponse.next();
  }

  try {
    const tokens = await refreshAccessToken(session.refreshToken);
    const sealed = encodeSession({
      ...session,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? session.refreshToken,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope ?? session.scope,
    });

    request.cookies.set(SESSION_COOKIE, sealed);
    const response = NextResponse.next({ request: { headers: request.headers } });
    response.cookies.set(SESSION_COOKIE, sealed, sessionCookieOptions);
    return response;
  } catch (error) {
    if (error instanceof RefreshTokenRevokedError) {
      // The user revoked access in Spotify settings, or the token was invalidated.
      return signOutRedirect(request, "session_expired");
    }
    // Transient failure (network, Spotify outage). Let the page render; if the
    // token has truly expired it will show a reconnect prompt.
    console.error("[auth] token refresh failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.next();
  }
}

function signOutRedirect(request: NextRequest, reason: string) {
  const response = NextResponse.redirect(new URL(`/?error=${reason}`, request.url));
  if (request.cookies.has(SESSION_COOKIE)) {
    response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  }
  return response;
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
