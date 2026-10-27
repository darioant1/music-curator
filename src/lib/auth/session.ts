import "server-only";
import { cookies } from "next/headers";
import { seal, unseal } from "./crypto";

/**
 * The server-side session, stored encrypted in a single httpOnly cookie.
 *
 * Why a cookie and not a database? Phase 1 has no persistence layer, and an
 * encrypted cookie is stateless and survives server restarts. When Phase 2
 * adds SQLite, `userId` becomes the key for stored data; tokens can then move
 * server-side behind an opaque session id without changing callers of
 * `getSession()`.
 */
export type Session = {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds when the access token expires. */
  expiresAt: number;
  scope: string;
  /** Spotify user id — a stable identifier for future per-user storage. */
  userId: string;
};

export const SESSION_COOKIE = "mmc_session";
export const OAUTH_STATE_COOKIE = "mmc_oauth_state";

/** Refresh this long before actual expiry so in-flight requests don't race the deadline. */
export const REFRESH_LEEWAY_MS = 5 * 60 * 1000;

const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days; refresh token keeps it alive

export const sessionCookieOptions = {
  httpOnly: true, // never readable from client-side JavaScript
  secure: process.env.NODE_ENV === "production", // http://127.0.0.1 in dev can't use Secure
  sameSite: "lax" as const, // sent on top-level navigation back from Spotify, not on cross-site subrequests
  path: "/",
  maxAge: SESSION_MAX_AGE_S,
};

export const oauthStateCookieOptions = {
  ...sessionCookieOptions,
  path: "/api/auth",
  maxAge: 10 * 60, // the user has 10 minutes to complete the Spotify consent screen
};

export function encodeSession(session: Session): string {
  return seal(session);
}

export function decodeSession(value: string | undefined): Session | null {
  const session = unseal<Session>(value);
  if (!session?.accessToken || !session.refreshToken || !session.userId) return null;
  return session;
}

export function needsRefresh(session: Session, now = Date.now()): boolean {
  return session.expiresAt - REFRESH_LEEWAY_MS <= now;
}

/**
 * Read the current session in Server Components and Route Handlers.
 * Token refresh happens earlier, in `src/proxy.ts`, because Server Components
 * cannot write cookies.
 */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}
