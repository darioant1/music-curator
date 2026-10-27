import { Suspense, type ReactNode } from "react";
import { LoadErrorNotice } from "@/components/load-error";
import { TrackList, TrackListSkeleton } from "@/components/music";
import { PageTitle } from "@/components/page-title";
import { BarList } from "@/components/stats";
import { TimeRangeTabs, TimeRangeTabsPlaceholder } from "@/components/time-range-tabs";
import { EmptyState, SourceBadge } from "@/components/ui";
import { decadeDistribution } from "@/lib/insights";
import { getTopTracks } from "@/lib/spotify/api";
import { load } from "@/lib/spotify/safe";
import { TIME_RANGES, parseTimeRange, type TimeRange } from "@/lib/spotify/types";

export const metadata = { title: "Top tracks" };

export default function TracksPage({ searchParams }: PageProps<"/dashboard/tracks">) {
  return (
    <>
      <PageTitle eyebrow="Ranked by Spotify" title="Top tracks">
        Up to 50 tracks Spotify ranks highest for you in each time window. These rankings reflect
        affinity, not exact play counts — Spotify doesn’t expose play counts.
      </PageTitle>
      <Suspense
        fallback={
          <>
            <Toolbar tabs={<TimeRangeTabsPlaceholder />} />
            <TrackListSkeleton count={12} />
          </>
        }
      >
        <TracksForRange searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function TracksForRange({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard/tracks">["searchParams"];
}) {
  const range = parseTimeRange((await searchParams).range);
  return (
    <>
      <Toolbar tabs={<TimeRangeTabs pathname="/dashboard/tracks" current={range} />} range={range} />
      <Suspense key={range} fallback={<TrackListSkeleton count={12} />}>
        <TrackResults range={range} />
      </Suspense>
    </>
  );
}

function Toolbar({ tabs, range }: { tabs: ReactNode; range?: TimeRange }) {
  const description = TIME_RANGES.find((r) => r.value === range)?.description;
  return (
    <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-3">
      {tabs}
      {description && <p className="text-xs text-ink-3">{description}</p>}
    </div>
  );
}

async function TrackResults({ range }: { range: TimeRange }) {
  const result = await load(() => getTopTracks(range));
  if (!result.ok) return <LoadErrorNotice error={result.error} />;
  if (result.data.length === 0) {
    return (
      <EmptyState title="No top tracks for this period">
        Spotify hasn’t ranked any tracks for this window yet. Try a longer time range.
      </EmptyState>
    );
  }

  const decades = decadeDistribution(result.data);

  return (
    <div className="grid gap-10 xl:grid-cols-[1fr_20rem]">
      <div className="min-w-0">
        <div className="mb-3">
          <SourceBadge source="spotify" />
        </div>
        <TrackList tracks={result.data} />
      </div>
      {decades.length > 0 && (
        <aside className="h-fit rounded-2xl border border-line bg-surface p-6 xl:sticky xl:top-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-ink">Release decades</h2>
            <SourceBadge source="calculated" />
          </div>
          <BarList
            rows={decades.map((d) => ({ label: `${d.decade}s`, value: d.count }))}
            caption={`Tracks per decade among these ${result.data.length} tracks, by album release date.`}
          />
        </aside>
      )}
    </div>
  );
}
