import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ColumnChart, ListeningHeatmap } from "@/components/charts";
import { PageTitle } from "@/components/page-title";
import { StatTile } from "@/components/stats";
import { EmptyState, SectionHeader, Skeleton, SourceBadge } from "@/components/ui";
import { formatDate, formatHours, formatNumber, formatPercent } from "@/lib/format";
import {
  DISCOVERY_WARMUP_DAYS,
  discoveries,
  forgottenFavorites,
  listeningClock,
  periodSeries,
  snapshotDrift,
} from "@/lib/history/analysis";
import { artistArtwork, trackArtwork, type Art } from "@/lib/history/enrich";
import {
  getArtistTimeline,
  getBehavior,
  getHistoryStatus,
  getHourBuckets,
  getSnapshotDrift,
  getTopArtistsByPlays,
  getTopTracksByPlays,
  getTotals,
  getYears,
  type Range,
} from "@/lib/history/queries";
import { localYearRange, makeLocalizer } from "@/lib/history/time";
import { getViewerTimeZone } from "@/lib/history/viewer";

export const metadata = { title: "History" };

/**
 * Listening history built from the local database: imported Spotify exports
 * plus plays the app has captured. Everything here is calculated by this app.
 */
export default function HistoryPage({ searchParams }: PageProps<"/dashboard/history">) {
  return (
    <>
      <PageTitle eyebrow="Calculated from your stored plays" title="Listening history">
        Real play counts from your Spotify data export and the plays this app has saved.{" "}
        <Link href="/dashboard/data" className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent">
          Import or manage your data →
        </Link>
      </PageTitle>
      <Suspense fallback={<PageSkeleton />}>
        <HistoryContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function HistoryContent({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard/history">["searchParams"];
}) {
  const [status, tz, params] = await Promise.all([getHistoryStatus(), getViewerTimeZone(), searchParams]);

  if (status.effectivePlays === 0) return <Onboarding />;

  const years = await getYears();
  const requested = Number(params.year);
  const year = years.some((y) => y.year === requested) ? requested : null;
  const range = year ? localYearRange(year, tz) : undefined;
  const hasImports = status.coverage.some((c) => c.source !== "api");

  return (
    <div className="space-y-16">
      <div className="space-y-5">
        <p className="text-sm text-ink-2">
          {formatNumber(status.effectivePlays)} plays from {formatDate(status.first!, tz)} to{" "}
          {formatDate(status.last!, tz)}.
          {!hasImports &&
            " So far this only includes plays the app has captured — import your Spotify export for your full history."}
        </p>
        <YearTabs years={years.map((y) => y.year)} current={year} />
      </div>

      <Suspense key={`totals-${year}`} fallback={<TilesSkeleton />}>
        <Totals range={range} />
      </Suspense>

      <section className="grid gap-12 xl:grid-cols-2 xl:gap-10">
        <div className="min-w-0">
          <SectionHeader title="Most played artists" source="calculated" />
          <Suspense key={`artists-${year}`} fallback={<ListSkeleton />}>
            <TopArtists range={range} />
          </Suspense>
        </div>
        <div className="min-w-0">
          <SectionHeader title="Most played tracks" source="calculated" />
          <Suspense key={`tracks-${year}`} fallback={<ListSkeleton />}>
            <TopTracks range={range} />
          </Suspense>
        </div>
      </section>

      <section>
        <SectionHeader
          title="When you listen"
          source="calculated"
          description="Shown in your local time zone, as reported by this browser."
        />
        <Suspense key={`patterns-${year}`} fallback={<Skeleton className="h-72 rounded-2xl" />}>
          <Patterns range={range} tz={tz} year={year} />
        </Suspense>
      </section>

      <Suspense key={`behavior-${year}`} fallback={null}>
        <Behavior range={range} />
      </Suspense>

      {year === null && (
        <>
          <section>
            <SectionHeader
              title="Discovery"
              source="calculated"
              description={`Artists you played at least 3 times, by when they first appeared in your history. The first ${DISCOVERY_WARMUP_DAYS} days of data are excluded, since artists there probably weren’t new to you.`}
            />
            <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
              <Discovery tz={tz} first={status.first!} last={status.last!} />
            </Suspense>
          </section>

          <section>
            <SectionHeader
              eyebrow="From daily snapshots of your Spotify top artists"
              title="Taste drift"
              source="calculated"
            />
            <Suspense fallback={<Skeleton className="h-48 rounded-2xl" />}>
              <TasteDrift />
            </Suspense>
          </section>
        </>
      )}
    </div>
  );
}

// --- navigation ------------------------------------------------------------

function YearTabs({ years, current }: { years: number[]; current: number | null }) {
  const tabs = [{ label: "All time", href: "/dashboard/history", active: current === null }].concat(
    years.map((y) => ({ label: String(y), href: `/dashboard/history?year=${y}`, active: current === y })),
  );
  return (
    <nav aria-label="Year" className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          scroll={false}
          aria-current={t.active ? "page" : undefined}
          className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
            t.active ? "border-ink bg-ink text-bg" : "border-line text-ink-2 hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

// --- sections --------------------------------------------------------------

async function Totals({ range }: { range?: Range }) {
  const t = await getTotals(range);
  const untimed = t.plays - t.timedPlays;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile label="Plays" source="calculated" value={formatNumber(t.plays)} detail="Streams of 30 seconds or more" />
      <StatTile
        label="Hours listened"
        source="calculated"
        value={formatHours(t.ms ?? 0)}
        detail={
          untimed > 0
            ? `Excludes ${formatNumber(untimed)} captured plays with no reported duration`
            : "Total time across these plays"
        }
      />
      <StatTile label="Artists" source="calculated" value={formatNumber(t.artists)} detail="Distinct artists played" />
      <StatTile label="Tracks" source="calculated" value={formatNumber(t.tracks)} detail="Distinct tracks played" />
    </div>
  );
}

async function TopArtists({ range }: { range?: Range }) {
  const artists = await getTopArtistsByPlays(range, 20);
  const art = await artistArtwork(artists);
  return (
    <RankedList
      items={artists.map((a) => ({
        key: a.name,
        title: a.name,
        subtitle: a.ms ? `${formatHours(a.ms)} h` : null,
        plays: a.plays,
        art: art.get(a.name.toLowerCase()),
        round: true,
      }))}
    />
  );
}

async function TopTracks({ range }: { range?: Range }) {
  const tracks = await getTopTracksByPlays(range, 20);
  const art = await trackArtwork(tracks.map((t) => t.trackId));
  return (
    <RankedList
      items={tracks.map((t) => ({
        key: `${t.artistName}|${t.name}`,
        title: t.name,
        subtitle: t.artistName,
        plays: t.plays,
        art: t.trackId ? art.get(t.trackId) : undefined,
        round: false,
      }))}
    />
  );
}

async function Patterns({ range, tz, year }: { range?: Range; tz: string; year: number | null }) {
  const buckets = await getHourBuckets(range);
  const loc = makeLocalizer(tz);
  const grid = listeningClock(buckets, loc);

  let by: "month" | "year" = "month";
  let series = periodSeries(buckets, loc, "month");
  if (year === null && series.length > 36) {
    by = "year";
    series = periodSeries(buckets, loc, "year");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <ListeningHeatmap grid={grid} timeZone={tz} />
      </div>
      <div className="rounded-2xl border border-line bg-surface p-6">
        <ColumnChart
          data={series.map((p) => ({
            key: p.key,
            label: p.label,
            value: p.plays,
            detail: p.hours > 0 ? `${p.hours.toFixed(1)} h` : undefined,
          }))}
          valueLabel="plays"
          caption={`Plays per ${by}${year ? ` in ${year}` : ""}.`}
        />
      </div>
    </div>
  );
}

async function Behavior({ range }: { range?: Range }) {
  const b = await getBehavior(range);
  if (!b || b.streams === 0) return null;
  return (
    <section>
      <SectionHeader
        title="How you listen"
        source="calculated"
        description="From your extended streaming history, which records skips, shuffle and offline listening."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Skip rate"
          source="calculated"
          value={formatPercent((b.skipped ?? 0) / b.streams)}
          detail={`of ${formatNumber(b.streams)} streams ended by skipping`}
        />
        {b.shuffleKnown > 0 && (
          <StatTile
            label="On shuffle"
            source="calculated"
            value={formatPercent((b.shuffled ?? 0) / b.shuffleKnown)}
            detail="of streams played with shuffle on"
          />
        )}
        {b.offlineKnown > 0 && (
          <StatTile
            label="Offline"
            source="calculated"
            value={formatPercent((b.offline ?? 0) / b.offlineKnown)}
            detail="of streams played from downloads"
          />
        )}
      </div>
    </section>
  );
}

async function Discovery({ tz, first, last }: { tz: string; first: number; last: number }) {
  const timeline = await getArtistTimeline();
  const loc = makeLocalizer(tz);
  const found = discoveries(timeline, first, last, loc);
  const forgotten = forgottenFavorites(timeline, last);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        {found.eligible && found.perYear.length > 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-6">
            <ColumnChart
              data={found.perYear.map((y) => ({ key: String(y.year), label: String(y.year), value: y.count }))}
              valueLabel="new artists"
              caption="New artists per year (first played that year, 3+ plays overall)."
            />
          </div>
        ) : found.eligible ? (
          <EmptyState title="No new artists yet">
            Every artist you’ve played 3+ times already appeared in your first {DISCOVERY_WARMUP_DAYS}{" "}
            days of history.
          </EmptyState>
        ) : (
          <EmptyState title="Not enough history yet">
            Discovery needs more than {DISCOVERY_WARMUP_DAYS} days of listening data. Importing your
            Spotify export unlocks it right away.
          </EmptyState>
        )}
        {found.recent.length > 0 && (
          <ChipList
            title="Recent discoveries"
            items={found.recent.map((a) => ({
              name: a.name,
              meta: `first played ${formatDate(a.first, tz)} · ${formatNumber(a.plays)} plays`,
            }))}
          />
        )}
      </div>
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h3 className="text-sm font-medium text-ink">Forgotten favorites</h3>
        <p className="mt-1 text-xs text-ink-3">
          Artists you played 15+ times but haven’t played in the last 6 months of your history.
        </p>
        {forgotten.length > 0 ? (
          <ul className="mt-4 divide-y divide-line">
            {forgotten.map((a) => (
              <li key={a.name} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                <span className="truncate text-ink">{a.name}</span>
                <span className="shrink-0 text-xs text-ink-3">
                  {formatNumber(a.plays)} plays · last {formatDate(a.last, tz)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-ink-2">
            None yet — this fills in once your history spans more than six months.
          </p>
        )}
      </div>
    </div>
  );
}

async function TasteDrift() {
  const snap = await getSnapshotDrift("artists");
  if (!snap || snap.days < 2) {
    return (
      <EmptyState title="Watching your taste move">
        The app saves your Spotify top artists once a day
        {snap ? ` (since ${snap.first})` : ""}. Come back after a few days to see who’s rising and
        who’s fading.
      </EmptyState>
    );
  }
  const drift = snapshotDrift(snap.before, snap.after);
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">
        Comparing your 4-week top artists on {snap.first} with {snap.last} ({snap.days} snapshots).
        {drift.overlap !== null && ` ${formatPercent(drift.overlap)} of the earlier list is still there.`}
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <DriftColumn title="Arrived" items={drift.arrived.map((i) => ({ name: i.name, meta: `now #${i.rank}` }))} />
        <DriftColumn title="Climbed" items={drift.climbed.map((i) => ({ name: i.name, meta: `up ${i.delta} to #${i.rank}` }))} />
        <DriftColumn title="Faded" items={drift.left.map((i) => ({ name: i.name, meta: `was #${i.rank}` }))} />
      </div>
    </div>
  );
}

// --- presentational helpers ------------------------------------------------

function RankedList({
  items,
}: {
  items: { key: string; title: string; subtitle: string | null; plays: number; art?: Art; round: boolean }[];
}) {
  if (items.length === 0) return <EmptyState title="No plays in this period" />;
  const max = items[0].plays;
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface/60">
      {items.map((item, i) => {
        const content = (
          <>
            <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-ink-3">{i + 1}</span>
            <Thumb art={item.art} name={item.title} round={item.round} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink transition-colors group-hover:text-accent">{item.title}</p>
              {item.subtitle && <p className="truncate text-sm text-ink-2">{item.subtitle}</p>}
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-accent/70" style={{ width: `${(item.plays / max) * 100}%` }} />
              </div>
            </div>
            <span className="shrink-0 text-right font-mono text-xs tabular-nums text-ink">
              {formatNumber(item.plays)}
              <span className="block text-[10px] text-ink-3">plays</span>
            </span>
          </>
        );
        const cls = "group flex items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4";
        return (
          <li key={item.key}>
            {item.art?.spotifyUrl ? (
              <a href={item.art.spotifyUrl} target="_blank" rel="noreferrer" className={`${cls} hover:bg-surface-2`}>
                {content}
              </a>
            ) : (
              <div className={cls}>{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Thumb({ art, name, round }: { art?: Art; name: string; round: boolean }) {
  const shape = round ? "rounded-full" : "rounded-md";
  if (!art?.imageUrl) {
    return (
      <div className={`grid size-11 shrink-0 place-items-center bg-surface-3 font-display text-lg text-ink-3 ${shape}`}>
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see components/artwork.tsx
    <img
      src={art.imageUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={`size-11 shrink-0 bg-surface-2 object-cover ${shape}`}
    />
  );
}

function ChipList({ title, items }: { title: string; items: { name: string; meta: string }[] }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      <ul className="mt-4 flex flex-wrap gap-2">
        {items.map((i) => (
          <li key={i.name} title={i.meta} className="rounded-full border border-line-strong px-3 py-1 text-sm text-ink-2">
            {i.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DriftColumn({ title, items }: { title: string; items: { name: string; meta: string }[] }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink">{title}</h3>
        <span className="font-mono text-xs text-ink-3">{items.length}</span>
      </div>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm">
          {items.slice(0, 10).map((i) => (
            <li key={i.name} className="flex justify-between gap-3">
              <span className="truncate text-ink-2">{i.name}</span>
              <span className="shrink-0 text-xs text-ink-3">{i.meta}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-3">None</p>
      )}
    </div>
  );
}

function Onboarding() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <SourceBadge source="spotify" />
        <h2 className="mt-4 font-display text-3xl text-ink">Your history starts now</h2>
        <p className="mt-2 text-sm text-ink-2">
          Each time you open the app it saves your latest plays from Spotify. Refresh in a moment and
          your recent listening will appear here, then keep growing.
        </p>
      </div>
      <div className="rounded-2xl border border-accent/30 bg-accent-soft p-6">
        <h2 className="font-display text-3xl text-ink">Bring your whole history</h2>
        <p className="mt-2 text-sm text-ink-2">
          Request your data export from Spotify and import it to see every year you’ve listened.
        </p>
        <Link
          href="/dashboard/data"
          className="mt-5 inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
        >
          Import your history →
        </Link>
      </div>
    </div>
  );
}

// --- skeletons -------------------------------------------------------------

function TilesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-36 rounded-2xl" />
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-14 rounded-xl" />
      ))}
    </div>
  );
}

function PageSkeleton(): ReactNode {
  return (
    <div className="space-y-10">
      <Skeleton className="h-8 w-80" />
      <TilesSkeleton />
      <div className="grid gap-10 xl:grid-cols-2">
        <ListSkeleton />
        <ListSkeleton />
      </div>
    </div>
  );
}
