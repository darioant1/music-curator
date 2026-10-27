import Link from "next/link";
import { TIME_RANGES, type TimeRange } from "@/lib/spotify/types";

/**
 * Segmented control for Spotify's three top-items windows. Each option is a
 * plain link (?range=…) so the selection is shareable, works without
 * JavaScript, and is rendered on the server.
 */
export function TimeRangeTabs({ pathname, current }: { pathname: string; current: TimeRange }) {
  return (
    <div
      role="tablist"
      aria-label="Time range"
      className="inline-flex rounded-full border border-line bg-surface p-1"
    >
      {TIME_RANGES.map((range) => {
        const active = range.value === current;
        return (
          <Link
            key={range.value}
            href={`${pathname}?range=${range.value}`}
            role="tab"
            aria-selected={active}
            title={range.description}
            scroll={false}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors sm:px-4 ${
              active ? "bg-ink text-bg" : "text-ink-2 hover:text-ink"
            }`}
          >
            {range.label}
          </Link>
        );
      })}
    </div>
  );
}

export function TimeRangeTabsPlaceholder() {
  return (
    <div aria-hidden className="inline-flex rounded-full border border-line bg-surface p-1">
      {TIME_RANGES.map((range) => (
        <span key={range.value} className="px-3.5 py-1.5 text-xs font-medium text-ink-3 sm:px-4">
          {range.label}
        </span>
      ))}
    </div>
  );
}
