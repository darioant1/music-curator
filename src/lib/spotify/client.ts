import "server-only";

/**
 * Low-level HTTP client for the Spotify Web API.
 *
 * Responsibilities:
 * - Attach the bearer token (server-side only; tokens never reach the browser).
 * - Retry 429s honoring `Retry-After`, and 5xx/network errors with backoff.
 * - Convert failures into a typed `SpotifyApiError` that the UI can explain.
 */

const API_BASE = "https://api.spotify.com/v1";
const MAX_ATTEMPTS = 3;
const MAX_RETRY_AFTER_S = 10; // don't hold a page render hostage for longer than this

export class SpotifyApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly path: string,
  ) {
    super(message);
    this.name = "SpotifyApiError";
  }

  /** Token invalid/expired — the user should reconnect. */
  get isUnauthorized() {
    return this.status === 401;
  }

  /** Scope missing, or the account isn't on the Development Mode allowlist. */
  get isForbidden() {
    return this.status === 403;
  }

  get isRateLimited() {
    return this.status === 429;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function spotifyFetch<T>(
  accessToken: string,
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : `${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
    } catch (error) {
      // Network failure — retry with exponential backoff.
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await sleep(250 * 2 ** attempt);
      continue;
    }

    if (res.ok) return (await res.json()) as T;

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(res.headers.get("Retry-After"));
      const waitS =
        res.status === 429 && Number.isFinite(retryAfter) ? retryAfter : 0.25 * 2 ** attempt;
      if (waitS <= MAX_RETRY_AFTER_S) {
        await sleep(waitS * 1000);
        continue;
      }
    }

    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new SpotifyApiError(
      res.status,
      body?.error?.message ?? res.statusText ?? "Spotify request failed",
      url.pathname,
    );
  }

  throw lastError instanceof Error ? lastError : new Error("Spotify request failed");
}

type Paging<T> = { items: T[]; next: string | null; total: number };

/**
 * Follow `next` links until `maxItems` is reached or the collection ends.
 * Returns the items plus Spotify's reported `total` (which may exceed what we fetched).
 */
export async function spotifyPaginate<T>(
  accessToken: string,
  path: string,
  { pageSize = 50, maxItems = 200 }: { pageSize?: number; maxItems?: number } = {},
): Promise<{ items: T[]; total: number }> {
  const items: T[] = [];
  let page = await spotifyFetch<Paging<T>>(accessToken, path, { limit: pageSize });
  items.push(...page.items);

  while (page.next && items.length < maxItems) {
    page = await spotifyFetch<Paging<T>>(accessToken, page.next);
    items.push(...page.items);
  }

  return { items: items.slice(0, maxItems), total: page.total };
}
