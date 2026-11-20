/**
 * Time zone helpers. Plays are stored in UTC; charts like "listening by hour"
 * only make sense in the listener's local time. The browser reports its zone
 * via the `mmc_tz` cookie (see components/timezone-sync.tsx).
 */

export const TZ_COOKIE = "mmc_tz";

export function resolveTimeZone(value: string | undefined): string {
  if (!value) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return "UTC";
  }
}

const DAY_MS = 86_400_000;

/**
 * Returns a function converting a UTC timestamp into local calendar parts.
 *
 * Calling Intl for every play would be slow for 100k+ plays, so the UTC
 * offset is computed once per day (at noon UTC) and cached. This is exact
 * except for the few hours around a daylight-saving switch.
 */
export function makeLocalizer(timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
  const offsets = new Map<number, number>();

  function offsetForDay(day: number): number {
    let offset = offsets.get(day);
    if (offset === undefined) {
      const instant = day * DAY_MS + DAY_MS / 2;
      const p = Object.fromEntries(fmt.formatToParts(instant).map((x) => [x.type, x.value]));
      const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
      offset = asUtc - instant;
      offsets.set(day, offset);
    }
    return offset;
  }

  return {
    offsetAt(utcMs: number) {
      return offsetForDay(Math.floor(utcMs / DAY_MS));
    },
    parts(utcMs: number) {
      const local = new Date(utcMs + offsetForDay(Math.floor(utcMs / DAY_MS)));
      return {
        year: local.getUTCFullYear(),
        month: local.getUTCMonth(), // 0–11
        weekday: (local.getUTCDay() + 6) % 7, // 0 = Monday
        hour: local.getUTCHours(),
      };
    },
  };
}

/** UTC bounds of a local calendar year, for filtering plays by year. */
export function localYearRange(year: number, timeZone: string) {
  const loc = makeLocalizer(timeZone);
  const startGuess = Date.UTC(year, 0, 1);
  const endGuess = Date.UTC(year + 1, 0, 1);
  return { from: startGuess - loc.offsetAt(startGuess), to: endGuess - loc.offsetAt(endGuess) };
}
