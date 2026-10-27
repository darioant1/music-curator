import type { LoadError } from "@/lib/spotify/safe";

/** Inline notice for a section whose Spotify request failed. */
export function LoadErrorNotice({ error }: { error: LoadError }) {
  const canReconnect = error.kind === "unauthorized" || error.kind === "forbidden";
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border border-danger/25 bg-danger/[0.06] px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-ink-2">{error.message}</p>
      {canReconnect && (
        <a
          href="/api/auth/login"
          className="shrink-0 rounded-full border border-line-strong px-4 py-1.5 text-center font-medium text-ink transition-colors hover:border-ink-2"
        >
          Reconnect Spotify
        </a>
      )}
    </div>
  );
}
