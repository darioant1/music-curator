import type { ReactNode } from "react";
import { formatNumber } from "@/lib/format";

/**
 * Lightweight HTML/CSS charts (no chart library).
 * - One hue (the accent), lightness encodes magnitude.
 * - Hover tooltips are pure CSS, so they work without JavaScript.
 * - Each chart includes a screen-reader table with the underlying numbers.
 */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_LABELS = [0, 6, 12, 18];

function hourLabel(h: number) {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

// Five sequential steps of the accent, dim → bright, against the dark surface.
const STEPS = [
  "rgb(255 120 73 / 0.12)",
  "rgb(255 120 73 / 0.28)",
  "rgb(255 120 73 / 0.48)",
  "rgb(255 120 73 / 0.72)",
  "rgb(255 120 73 / 1)",
];

function Tooltip({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-line-strong bg-surface-3 px-2.5 py-1.5 text-xs text-ink shadow-xl group-hover:block">
      {children}
    </span>
  );
}

/** Weekday × hour-of-day heatmap of plays. */
export function ListeningHeatmap({ grid, timeZone }: { grid: number[][]; timeZone: string }) {
  const max = Math.max(1, ...grid.flat());
  const step = (v: number) => (v === 0 ? null : STEPS[Math.min(4, Math.floor((v / max) * 5))]);

  return (
    <figure>
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[34rem]" aria-hidden>
          <div className="grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-[2px]">
            {grid.map((row, d) => (
              <div key={d} className="contents">
                <span className="self-center pr-2 text-right text-[11px] text-ink-3">{DAYS[d]}</span>
                {row.map((v, h) => (
                  <span
                    key={h}
                    className="group relative aspect-square rounded-[3px] bg-surface-2"
                    style={step(v) ? { background: step(v)! } : undefined}
                  >
                    <Tooltip>
                      {DAYS[d]} {hourLabel(h)}–{hourLabel((h + 1) % 24)} · {formatNumber(v)} plays
                    </Tooltip>
                  </span>
                ))}
              </div>
            ))}
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="pt-1 text-[10px] text-ink-3">
                {HOUR_LABELS.includes(h) ? hourLabel(h) : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-3">
        <span>Plays by local day and hour ({timeZone.replace(/_/g, " ")})</span>
        <span className="flex items-center gap-1.5">
          Fewer
          {STEPS.map((c) => (
            <span key={c} className="size-3 rounded-[3px]" style={{ background: c }} />
          ))}
          More
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>Plays by day of week and hour</caption>
        <thead>
          <tr>
            <th>Day</th>
            {Array.from({ length: 24 }, (_, h) => (
              <th key={h}>{hourLabel(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, d) => (
            <tr key={d}>
              <th>{DAYS[d]}</th>
              {row.map((v, h) => (
                <td key={h}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Vertical columns over time (months or years). */
export function ColumnChart({
  data,
  caption,
  valueLabel,
  format = (v) => formatNumber(Math.round(v)),
}: {
  data: { key: string; label: string; value: number; detail?: string }[];
  caption: string;
  valueLabel: string;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <figure>
      <div className="flex items-start gap-3" aria-hidden>
        <span className="w-10 shrink-0 text-right font-mono text-[10px] text-ink-3">{format(max)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex h-44 items-end gap-[2px] border-b border-line-strong">
            {data.map((d) => (
              <div key={d.key} className="group relative flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-t-[4px] bg-accent/80 transition-colors group-hover:bg-accent"
                  style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
                />
                <Tooltip>
                  {d.label} · {format(d.value)} {valueLabel}
                  {d.detail ? ` · ${d.detail}` : ""}
                </Tooltip>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-[2px]">
            {data.map((d, i) => (
              <span key={d.key} className="flex-1 truncate text-[10px] text-ink-3">
                {i % labelEvery === 0 ? d.label : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-xs text-ink-3">{caption}</figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th>{d.label}</th>
              <td>
                {format(d.value)} {valueLabel}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
