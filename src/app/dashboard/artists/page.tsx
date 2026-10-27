import { Suspense, type ReactNode } from "react";
import { LoadErrorNotice } from "@/components/load-error";
import { ArtistGrid, ArtistGridSkeleton } from "@/components/music";
import { PageTitle } from "@/components/page-title";
import { TimeRangeTabs, TimeRangeTabsPlaceholder } from "@/components/time-range-tabs";
import { EmptyState, SourceBadge } from "@/components/ui";
import { getTopArtists } from "@/lib/spotify/api";
import { load } from "@/lib/spotify/safe";
import { TIME_RANGES, parseTimeRange, type TimeRange } from "@/lib/spotify/types";

export const metadata = { title: "Top artists" };

export default function ArtistsPage({ searchParams }: PageProps<"/dashboard/artists">) {
  return (
    <>
      <PageTitle eyebrow="Ranked by Spotify" title="Top artists">
        Up to 50 artists Spotify ranks highest for you in each time window, based on your listening
        affinity.
      </PageTitle>
      {/* searchParams is request data, so it's read inside a Suspense boundary. */}
      <Suspense
        fallback={
          <>
            <Toolbar tabs={<TimeRangeTabsPlaceholder />} />
            <ArtistGridSkeleton count={15} />
          </>
        }
      >
        <ArtistsForRange searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ArtistsForRange({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard/artists">["searchParams"];
}) {
  const range = parseTimeRange((await searchParams).range);
  return (
    <>
      <Toolbar tabs={<TimeRangeTabs pathname="/dashboard/artists" current={range} />} range={range} />
      <Suspense key={range} fallback={<ArtistGridSkeleton count={15} />}>
        <ArtistResults range={range} />
      </Suspense>
    </>
  );
}

function Toolbar({ tabs, range }: { tabs: ReactNode; range?: TimeRange }) {
  const description = TIME_RANGES.find((r) => r.value === range)?.description;
  return (
    <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-3">
      {tabs}
      <SourceBadge source="spotify" />
      {description && <p className="text-xs text-ink-3">{description}</p>}
    </div>
  );
}

async function ArtistResults({ range }: { range: TimeRange }) {
  const result = await load(() => getTopArtists(range));
  if (!result.ok) return <LoadErrorNotice error={result.error} />;
  if (result.data.length === 0) {
    return (
      <EmptyState title="No top artists for this period">
        Spotify hasn’t ranked any artists for this window yet. Try a longer time range.
      </EmptyState>
    );
  }
  return <ArtistGrid artists={result.data} />;
}
