import "server-only";
import { unstable_rethrow } from "next/navigation";
import { SpotifyApiError } from "./client";

export type LoadResult<T> = { ok: true; data: T } | { ok: false; error: LoadError };

export type LoadError = {
  kind: "unauthorized" | "forbidden" | "rate_limited" | "unavailable";
  message: string;
};

/**
 * Run a Spotify query and turn expected failures into data the UI can render,
 * so one failing section (e.g. a 403 on recently played) doesn't take down
 * the whole dashboard. Next.js control-flow errors (redirect, notFound,
 * prerender bailouts) are re-thrown untouched.
 */
export async function load<T>(query: () => Promise<T>): Promise<LoadResult<T>> {
  try {
    return { ok: true, data: await query() };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: describe(error) };
  }
}

function describe(error: unknown): LoadError {
  if (error instanceof SpotifyApiError) {
    if (error.isUnauthorized) {
      return {
        kind: "unauthorized",
        message: "Your Spotify session has expired. Reconnect to continue.",
      };
    }
    if (error.isForbidden) {
      return {
        kind: "forbidden",
        message:
          "Spotify refused this request. In Development Mode this usually means your account isn't on the app's user allowlist, or a permission wasn't granted. Try reconnecting.",
      };
    }
    if (error.isRateLimited) {
      return {
        kind: "rate_limited",
        message: "Spotify is rate-limiting requests right now. Wait a moment and refresh.",
      };
    }
  }
  console.error("[spotify]", error instanceof Error ? error.message : error);
  return { kind: "unavailable", message: "Spotify couldn't be reached. Please try again shortly." };
}
