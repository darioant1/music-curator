import type { ReactNode } from "react";

/**
 * Small presentational primitives shared across the app.
 */

/**
 * Labels where a number came from. "spotify" = returned directly by the API;
 * "calculated" = derived by this app from retrieved data.
 */
export function SourceBadge({ source }: { source: "spotify" | "calculated" }) {
  const isSpotify = source === "spotify";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${
        isSpotify ? "border-line-strong text-ink-2" : "border-accent/30 text-accent"
      }`}
      title={
        isSpotify
          ? "Provided directly by the Spotify Web API"
          : "Calculated by My Music Curator from data retrieved from Spotify"
      }
    >
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${isSpotify ? "bg-ink-2" : "bg-accent"}`}
      />
      {isSpotify ? "From Spotify" : "Calculated"}
    </span>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  source,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  source?: "spotify" | "calculated";
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-3">
            {eyebrow}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-3xl leading-none tracking-tight text-ink sm:text-[2.1rem]">
            {title}
          </h2>
          {source && <SourceBadge source={source} />}
        </div>
        {description && <p className="mt-2 max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="font-display text-2xl text-ink">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-ink-2">{children}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-shimmer rounded-md bg-surface-2 ${className}`} />;
}
