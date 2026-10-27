import "server-only";

/**
 * Server-only access to required environment variables.
 *
 * Values are read lazily (on first use, not at import time) so that
 * `next build` can analyze modules without needing secrets present, and
 * a missing variable produces a clear error naming it — never its value.
 */

type ServerEnv = {
  spotifyClientId: string;
  spotifyClientSecret: string;
  spotifyRedirectUri: string;
  sessionSecret: string;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Add it to .env.local (see .env.example).`,
    );
  }
  return value;
}

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (!cached) {
    cached = {
      spotifyClientId: required("SPOTIFY_CLIENT_ID"),
      spotifyClientSecret: required("SPOTIFY_CLIENT_SECRET"),
      spotifyRedirectUri: required("SPOTIFY_REDIRECT_URI"),
      sessionSecret: required("SESSION_SECRET"),
    };
  }
  return cached;
}

/**
 * The canonical origin of this app (e.g. http://127.0.0.1:3000), taken from
 * the registered redirect URI. Cookies are host-specific, so all auth
 * redirects must land on this exact origin.
 */
export function getAppOrigin(): string {
  return new URL(getEnv().spotifyRedirectUri).origin;
}
