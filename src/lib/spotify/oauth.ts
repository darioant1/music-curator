import "server-only";
import { getEnv } from "@/lib/env";

/**
 * Spotify OAuth 2.0 Authorization Code flow.
 * https://developer.spotify.com/documentation/web-api/tutorials/code-flow
 *
 * The client secret is only ever sent from this server to accounts.spotify.com.
 */

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

/**
 * Only the scopes Phase 1 actually uses. Add scopes when a feature needs
 * them (e.g. playlist-modify-private in Phase 4) — users must re-consent then.
 */
export const SPOTIFY_SCOPES = [
  "user-top-read", // GET /me/top/{artists,tracks}
  "user-library-read", // GET /me/tracks
  "playlist-read-private", // GET /me/playlists (private playlists)
  "playlist-read-collaborative", // GET /me/playlists (collaborative playlists)
  "user-read-recently-played", // GET /me/player/recently-played
] as const;

export type TokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

/** Thrown when Spotify rejects a refresh token — the user must reconnect. */
export class RefreshTokenRevokedError extends Error {
  constructor() {
    super("Spotify refresh token is no longer valid");
    this.name = "RefreshTokenRevokedError";
  }
}

export function buildAuthorizeUrl(state: string): string {
  const { spotifyClientId, spotifyRedirectUri } = getEnv();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: spotifyClientId,
    scope: SPOTIFY_SCOPES.join(" "),
    redirect_uri: spotifyRedirectUri,
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

async function requestToken(body: URLSearchParams): Promise<Response> {
  const { spotifyClientId, spotifyClientSecret } = getEnv();
  const basic = Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`).toString("base64");
  return fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getEnv().spotifyRedirectUri,
    }),
  );
  if (!res.ok) {
    // Log only the status and Spotify's error code — never the request body (it has the code/secret).
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`Spotify token exchange failed (${res.status} ${err.error ?? "unknown"})`);
  }
  return (await res.json()) as TokenResponse;
}

/**
 * Exchange a refresh token for a new access token. Spotify may or may not
 * return a new refresh token; when it doesn't, the old one stays valid.
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await requestToken(
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.status === 400 && err.error === "invalid_grant") {
      throw new RefreshTokenRevokedError();
    }
    throw new Error(`Spotify token refresh failed (${res.status} ${err.error ?? "unknown"})`);
  }
  return (await res.json()) as TokenResponse;
}
