import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Artwork } from "@/components/artwork";
import { LoadErrorNotice } from "@/components/load-error";
import {
  ArtistGrid,
  ArtistGridSkeleton,
  TrackList,
  TrackListSkeleton,
} from "@/components/music";
import { BarList, StatTile } from "@/components/stats";
import { EmptyState, SectionHeader, Skeleton, SourceBadge } from "@/components/ui";
import {
  artistConcentration,
  artistRetention,
  averageDurationMs,
  decadeDistribution,
  explicitShare,
  genreCounts,
} from "@/lib/insights";
import { formatDuration, formatNumber, formatPercent, formatRelative } from "@/lib/format";
import {
  getCurrentUser,
  getPlaylists,
  getRecentlyPlayed,
  getSavedTracks,
  getTopArtists,
  getTopTracks,
} from "@/lib/spotify/api";
import { load } from "@/lib/spotify/safe";

export const metadata = { title: "Overview" };

/**
 * The overview page is a static frame of section headings; each section
 * fetches its own data inside <Suspense>, so a slow or failing Spotify
 * endpoint only affects its own section.
 */
export default function OverviewPage() {
  return (
    <div className="space-y-16">
      <Suspense fallback={<HeroSkeleton />}>
        <Hero />
      </Suspense>

      <section>
        <Suspense fallback={<StatsSkeleton />}>
          <Snapshot />
        </Suspense>
      </section>

      <section>
        <SectionHeader
          eyebrow="Last 4 weeks"
          title="On rotation"
          source="spotify"
          description="Your top artists right now, as ranked by Spotify."
          action={<SeeAll href="/dashboard/artists?range=short_term" />}
        />
        <Suspense fallback={<ArtistGridSkeleton count={10} />}>
          <RotationArtists />
        </Suspense>
      </section>

      <div className="grid gap-16 xl:grid-cols-2 xl:gap-10">
        <section className="min-w-0">
          <SectionHeader
            eyebrow="Last 4 weeks"
            title="Top tracks"
            source="spotify"
            action={<SeeAll href="/dashboard/tracks?range=short_term" />}
          />
          <Suspense fallback={<TrackListSkeleton count={10} />}>
            <RecentTopTracks />
          </Suspense>
        </section>
        <section className="min-w-0">
          <SectionHeader
            eyebrow="Your last 50 plays"
            title="Recently played"
            source="spotify"
          />
          <Suspense fallback={<TrackListSkeleton count={10} />}>
            <RecentlyPlayed />
          </Suspense>
        </section>
      </div>

      <section>
        <SectionHeader
          eyebrow="Derived from your top 50 tracks & artists"
          title="Listening profile"
          source="calculated"
          description="Patterns calculated by this app from your Spotify top items. They describe those lists only — Spotify does not provide your complete listening history."
        />
        <Suspense fallback={<InsightsSkeleton />}>
          <ListeningProfile />
        </Suspense>
      </section>
    </div>
  );
}

function SeeAll({ href }: { href: string }) {
  return (
    <Link href={href} className="text-sm font-medium text-ink-2 transition-colors hover:text-accent">
      See all →
    </Link>
  );
}

// --- Hero ------------------------------------------------------------------

async function Hero() {
  const result = await load(getCurrentUser);
  if (!result.ok) return <LoadErrorNotice error={result.error} />;
  const user = result.data;

  return (
    <header className="relative flex animate-rise flex-col gap-6 sm:flex-row sm:items-end">
      <div className="pointer-events-none absolute -left-24 -top-32 -z-10 size-[28rem] rounded-full bg-accent/10 blur-3xl" />
      <div className="size-28 shrink-0 sm:size-36">
        <Artwork
          images={user.images}
          alt={user.displayName}
          size={144}
          rounded="full"
          className="shadow-[0_20px_60px_-20px_rgb(0_0_0/0.9)] ring-1 ring-line-strong"
        />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-3">
          Your listening, distilled
        </p>
        <h1 className="mt-2 font-display text-5xl leading-[0.95] tracking-tight sm:text-7xl">
          Hello, <em className="text-ink-2">{user.displayName}</em>
        </h1>
      </div>
    </header>
  );
}

function HeroSkeleton() {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
      <Skeleton className="size-28 rounded-full sm:size-36" />
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-14 w-72" />
      </div>
    </div>
  );
}

// --- Snapshot tiles --------------------------------------------------------

async function Snapshot() {
  const [saved, playlists, recentArtists, yearArtists, tracks] = await Promise.all([
    load(() => getSavedTracks(50)),
    load(getPlaylists),
    load(() => getTopArtists("short_term")),
    load(() => getTopArtists("long_term")),
    load(() => getTopTracks("medium_term")),
  ]);

  const retention =
    recentArtists.ok && yearArtists.ok
      ? artistRetention(recentArtists.data, yearArtists.data)
      : null;
  const concentration = tracks.ok ? artistConcentration(tracks.data) : null;
  const ownedPlaylists = playlists.ok ? playlists.data.playlists.filter((p) => p.ownedByUser) : [];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label="Liked songs"
        source="spotify"
        value={saved.ok ? formatNumber(saved.data.total) : "—"}
        detail="Tracks saved to your library"
      />
      <StatTile
        label="Playlists"
        source="spotify"
        value={playlists.ok ? formatNumber(playlists.data.total) : "—"}
        detail={
          playlists.ok ? `${ownedPlaylists.length} created by you` : "Couldn't load playlists"
        }
      />
      <StatTile
        label="Fresh in rotation"
        source="calculated"
        value={retention ? formatPercent(1 - retention.sharedRatio) : "—"}
        detail="of your 4-week top artists aren't in your 1-year top list"
      />
      <StatTile
        label="Artist spread"
        source="calculated"
        value={concentration ? concentration.uniqueArtists : "—"}
        detail={
          concentration
            ? `distinct lead artists across your top ${tracks.ok ? tracks.data.length : 0} tracks (6 months)`
            : "Not enough data yet"
        }
      />
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-40 rounded-2xl" />
      ))}
    </div>
  );
}

// --- Lists -----------------------------------------------------------------

async function RotationArtists() {
  const result = await load(() => getTopArtists("short_term"));
  if (!result.ok) return <LoadErrorNotice error={result.error} />;
  if (result.data.length === 0) {
    return (
      <EmptyState title="Not enough listening yet">
        Spotify needs some recent listening activity before it can rank your top artists.
      </EmptyState>
    );
  }
  return <ArtistGrid artists={result.data.slice(0, 10)} />;
}

async function RecentTopTracks() {
  const result = await load(() => getTopTracks("short_term"));
  if (!result.ok) return <LoadErrorNotice error={result.error} />;
  if (result.data.length === 0) {
    return <EmptyState title="No top tracks yet">Listen a little more and check back.</EmptyState>;
  }
  return <TrackList tracks={result.data.slice(0, 10)} />;
}

async function RecentlyPlayed() {
  const result = await load(getRecentlyPlayed);
  if (!result.ok) return <LoadErrorNotice error={result.error} />;
  if (result.data.plays.length === 0) {
    return <EmptyState title="Nothing played recently">Recent plays will show up here.</EmptyState>;
  }
  const plays = result.data.plays.slice(0, 10);
  return (
    <TrackList
      tracks={plays}
      ranked={false}
      meta={(_, i) => formatRelative(plays[i].playedAt, result.data.fetchedAt)}
    />
  );
}

// --- Insights --------------------------------------------------------------

async function ListeningProfile() {
  const [tracks, recentArtists, yearArtists, mediumArtists] = await Promise.all([
    load(() => getTopTracks("medium_term")),
    load(() => getTopArtists("short_term")),
    load(() => getTopArtists("long_term")),
    load(() => getTopArtists("medium_term")),
  ]);
  if (!tracks.ok) return <LoadErrorNotice error={tracks.error} />;
  if (tracks.data.length === 0) {
    return (
      <EmptyState title="Not enough data yet">
        Once Spotify has ranked your top tracks, patterns will appear here.
      </EmptyState>
    );
  }

  const decades = decadeDistribution(tracks.data);
  const concentration = artistConcentration(tracks.data);
  const avg = averageDurationMs(tracks.data);
  const explicit = explicitShare(tracks.data);
  const retention =
    recentArtists.ok && yearArtists.ok
      ? artistRetention(recentArtists.data, yearArtists.data)
      : null;
  const genres = mediumArtists.ok ? genreCounts(mediumArtists.data) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="rounded-2xl border border-line bg-surface p-6 lg:col-span-3">
        <h3 className="text-sm font-medium text-ink">Release decades</h3>
        <p className="mb-5 mt-1 text-xs text-ink-3">When the music you play most was released</p>
        {decades.length > 0 ? (
          <BarList
            rows={decades.map((d) => ({ label: `${d.decade}s`, value: d.count }))}
            caption={`Number of tracks per decade among your top ${tracks.data.length} tracks over ~6 months, by album release date.`}
          />
        ) : (
          <p className="text-sm text-ink-2">Release dates weren’t available for these tracks.</p>
        )}
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
        {concentration && (
          <Fact
            term="Artist concentration"
            value={formatPercent(concentration.topShare)}
            detail={`of your top tracks come from ${concentration.topArtists
              .map((a) => a.name)
              .join(", ")}`}
          />
        )}
        {avg !== null && (
          <Fact
            term="Average track length"
            value={formatDuration(avg)}
            detail={explicit !== null ? `${formatPercent(explicit)} marked explicit` : undefined}
          />
        )}
        {retention && retention.newcomers.length > 0 && (
          <Fact
            term="New this month"
            value={retention.newcomers.length}
            detail={`artists in your 4-week top list but not your 1-year list: ${retention.newcomers
              .slice(0, 4)
              .map((a) => a.name)
              .join(", ")}${retention.newcomers.length > 4 ? "…" : ""}`}
          />
        )}
      </dl>

      <div className="rounded-2xl border border-line bg-surface p-6 lg:col-span-5">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-medium text-ink">Genres</h3>
          <SourceBadge source="spotify" />
        </div>
        {genres.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {genres.map((g) => (
              <li
                key={g.genre}
                className="rounded-full border border-line-strong px-3 py-1 text-sm text-ink-2"
              >
                {g.genre}
                <span className="ml-2 font-mono text-xs text-ink-3">{g.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-2">
            Spotify deprecated artist genres in 2026 and no longer returns them for this app, so
            genre analysis isn’t available from Spotify directly. A future phase can infer genres
            from other sources.
          </p>
        )}
      </div>
    </div>
  );
}

function Fact({
  term,
  value,
  detail,
}: {
  term: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">{term}</dt>
      <dd className="mt-3 font-display text-4xl leading-none text-ink">{value}</dd>
      {detail && <dd className="mt-2 text-sm text-ink-2">{detail}</dd>}
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Skeleton className="h-72 rounded-2xl lg:col-span-3" />
      <div className="grid gap-4 lg:col-span-2">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    </div>
  );
}
