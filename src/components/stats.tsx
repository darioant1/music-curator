import type { ReactNode } from "react";
import { SourceBadge } from "./ui";

/** A single headline number with context. */
export function StatTile({
  label,
  value,
  detail,
  source,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  source: "spotify" | "calculated";
}) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">{label}</p>
        <SourceBadge source={source} />
      </div>
      <div>
        <p className="font-display text-5xl leading-none tracking-tight text-ink">{value}</p>
        {detail && <p className="mt-2 text-sm text-ink-2">{detail}</p>}
      </div>
    </div>
  );
}

/**
 * Horizontal bar list — one hue, length encodes count. Values are printed as
 * text beside each bar so the chart never relies on color or length alone.
 */
export function BarList({
  rows,
  caption,
}: {
  rows: { label: string; value: number }[];
  caption: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <figure>
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <li
            key={row.label}
            className="grid grid-cols-[3.5rem_1fr_2rem] items-center gap-3 text-sm"
            title={`${row.label}: ${row.value}`}
          >
            <span className="font-mono text-xs tabular-nums text-ink-2">{row.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-accent transition-[width] duration-700"
                style={{ width: `${(row.value / max) * 100}%` }}
              />
            </span>
            <span className="text-right font-mono text-xs tabular-nums text-ink">{row.value}</span>
          </li>
        ))}
      </ul>
      <figcaption className="mt-4 text-xs text-ink-3">{caption}</figcaption>
    </figure>
  );
}
