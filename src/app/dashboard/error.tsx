"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

/**
 * Catches unexpected rendering errors in the dashboard. Expected Spotify
 * failures (401/403/429) are handled inline per section; this is the last resort.
 */
export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <p className="font-display text-4xl text-ink">The record skipped.</p>
      <p className="mt-3 text-sm text-ink-2">
        Something went wrong while loading this page. Your Spotify data is untouched.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={() => retry()}
          className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90"
        >
          Try again
        </button>
        <a
          href="/api/auth/login"
          className="rounded-full border border-line-strong px-5 py-2 text-sm font-medium text-ink transition-colors hover:border-ink-2"
        >
          Reconnect Spotify
        </a>
      </div>
    </div>
  );
}
