import { Suspense } from "react";
import { LoadErrorNotice } from "@/components/load-error";
import { TrackList, TrackListSkeleton } from "@/components/music";
import { PageTitle } from "@/components/page-title";
import { EmptyState, SourceBadge } from "@/components/ui";
import { formatNumber, formatRelative } from "@/lib/format";
import { getSavedTracks } from "@/lib/spotify/api";
import { load } from "@/lib/spotify/safe";

export const metadata = { title: "Liked songs" };

const SHOWN = 200;

export default function LibraryPage() {
  return (
    <>
      <PageTitle eyebrow="Your library" title="Liked songs">
        Your most recently liked tracks, newest first.
      </PageTitle>
      <Suspense fallback={<TrackListSkeleton count={14} />}>
        <SavedTracks />
      </Suspense>
    </>
  );
}

async function SavedTracks() {
  const result = await load(() => getSavedTracks(SHOWN));
  if (!result.ok) return <LoadErrorNotice error={result.error} />;

  const { tracks, total, fetchedAt } = result.data;
  if (tracks.length === 0) {
    return (
      <EmptyState title="No liked songs yet">
        Tap the heart on a track in Spotify and it will show up here.
      </EmptyState>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-ink-2">
        <SourceBadge source="spotify" />
        <span>
          {formatNumber(total)} liked songs
          {total > tracks.length && ` · showing the latest ${tracks.length}`}
        </span>
      </div>
      <TrackList
        tracks={tracks}
        ranked={false}
        meta={(_, i) => `Liked ${formatRelative(tracks[i].addedAt, fetchedAt)}`}
      />
    </>
  );
}
