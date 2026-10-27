import { Suspense } from "react";
import { LoadErrorNotice } from "@/components/load-error";
import { PlaylistGrid, PlaylistGridSkeleton } from "@/components/music";
import { PageTitle } from "@/components/page-title";
import { EmptyState, SectionHeader } from "@/components/ui";
import { getPlaylists } from "@/lib/spotify/api";
import { load } from "@/lib/spotify/safe";

export const metadata = { title: "Playlists" };

export default function PlaylistsPage() {
  return (
    <>
      <PageTitle eyebrow="Your library" title="Playlists">
        Playlists you’ve created or follow. Spotify only returns track listings for playlists you
        own or collaborate on; for others, only basic details are available.
      </PageTitle>
      <Suspense fallback={<PlaylistGridSkeleton count={15} />}>
        <PlaylistSections />
      </Suspense>
    </>
  );
}

async function PlaylistSections() {
  const result = await load(getPlaylists);
  if (!result.ok) return <LoadErrorNotice error={result.error} />;

  const { playlists, total } = result.data;
  if (playlists.length === 0) {
    return (
      <EmptyState title="No playlists yet">
        Playlists you create or follow in Spotify will appear here.
      </EmptyState>
    );
  }

  const owned = playlists.filter((p) => p.ownedByUser || p.collaborative);
  const followed = playlists.filter((p) => !p.ownedByUser && !p.collaborative);

  return (
    <div className="space-y-14">
      {total > playlists.length && (
        <p className="text-sm text-ink-3">
          Showing the first {playlists.length} of {total} playlists.
        </p>
      )}
      {owned.length > 0 && (
        <section>
          <SectionHeader
            title="Made by you"
            source="spotify"
            description={`${owned.length} playlists you own or collaborate on`}
          />
          <PlaylistGrid playlists={owned} />
        </section>
      )}
      {followed.length > 0 && (
        <section>
          <SectionHeader
            title="Following"
            source="spotify"
            description={`${followed.length} playlists saved from other people`}
          />
          <PlaylistGrid playlists={followed} />
        </section>
      )}
    </div>
  );
}
