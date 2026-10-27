import type { ReactNode } from "react";
import { Artwork } from "./artwork";
import { Skeleton } from "./ui";
import { formatDuration } from "@/lib/format";
import type { Artist, Playlist, Track } from "@/lib/spotify/types";

/**
 * Artist, track, and playlist presentation. All links open Spotify, as
 * required by Spotify's design guidelines when showing its content.
 */

// --- Artists ---------------------------------------------------------------

export function ArtistGrid({ artists, ranked = true }: { artists: Artist[]; ranked?: boolean }) {
  return (
    <ol className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {artists.map((artist, i) => (
        <li
          key={artist.id}
          className="animate-rise"
          style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
        >
          <ArtistCard artist={artist} rank={ranked ? i + 1 : undefined} />
        </li>
      ))}
    </ol>
  );
}

export function ArtistCard({ artist, rank }: { artist: Artist; rank?: number }) {
  return (
    <a href={artist.spotifyUrl} target="_blank" rel="noreferrer" className="group block">
      <div className="relative overflow-hidden rounded-full shadow-[0_18px_40px_-20px_rgb(0_0_0/0.9)]">
        <Artwork
          images={artist.images}
          alt={artist.name}
          size={180}
          rounded="full"
          className="transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      </div>
      <div className="mt-3 flex items-baseline gap-2 px-1">
        {rank !== undefined && (
          <span className="font-mono text-xs tabular-nums text-ink-3">{rank}</span>
        )}
        <p className="truncate font-medium text-ink transition-colors group-hover:text-accent">
          {artist.name}
        </p>
      </div>
      {artist.genres.length > 0 && (
        <p className="mt-0.5 truncate px-1 text-xs text-ink-3">
          {artist.genres.slice(0, 2).join(" · ")}
        </p>
      )}
    </a>
  );
}

export function ArtistGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-square w-full rounded-full" />
          <Skeleton className="mx-1 mt-3 h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

// --- Tracks ----------------------------------------------------------------

export function TrackList({
  tracks,
  ranked = true,
  meta,
}: {
  tracks: Track[];
  ranked?: boolean;
  /** Optional right-hand annotation per row (e.g. "played 3 h ago"). */
  meta?: (track: Track, index: number) => ReactNode;
}) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface/60">
      {tracks.map((track, i) => (
        <li
          key={`${track.id}-${i}`}
          className="animate-rise"
          style={{ animationDelay: `${Math.min(i, 15) * 25}ms` }}
        >
          <TrackRow track={track} rank={ranked ? i + 1 : undefined} meta={meta?.(track, i)} />
        </li>
      ))}
    </ol>
  );
}

function TrackRow({ track, rank, meta }: { track: Track; rank?: number; meta?: ReactNode }) {
  const content = (
    <>
      {rank !== undefined && (
        <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-ink-3">
          {rank}
        </span>
      )}
      <div className="w-11 shrink-0 sm:w-12">
        <Artwork images={track.album.images} alt={track.album.name} size={48} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink transition-colors group-hover:text-accent">
          {track.name}
          {track.explicit && (
            <span
              title="Explicit"
              className="ml-2 inline-flex size-4 translate-y-[-1px] items-center justify-center rounded-[3px] bg-surface-3 align-middle text-[9px] font-semibold text-ink-2"
            >
              E
            </span>
          )}
        </p>
        <p className="truncate text-sm text-ink-2">
          {track.artists.map((a) => a.name).join(", ")}
        </p>
      </div>
      <p className="hidden min-w-0 flex-1 truncate text-sm text-ink-3 lg:block">
        {track.album.name}
      </p>
      {meta && <div className="hidden shrink-0 text-xs text-ink-3 sm:block">{meta}</div>}
      <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-ink-3">
        {formatDuration(track.durationMs)}
      </span>
    </>
  );

  const className =
    "group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2 sm:gap-4 sm:px-4";

  return track.spotifyUrl ? (
    <a href={track.spotifyUrl} target="_blank" rel="noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function TrackListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-surface/60">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-2.5">
          <Skeleton className="size-11 shrink-0 sm:size-12" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Playlists -------------------------------------------------------------

export function PlaylistGrid({ playlists }: { playlists: Playlist[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {playlists.map((playlist, i) => (
        <li
          key={playlist.id}
          className="animate-rise"
          style={{ animationDelay: `${Math.min(i, 15) * 25}ms` }}
        >
          <PlaylistCard playlist={playlist} />
        </li>
      ))}
    </ul>
  );
}

function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const details = [
    playlist.trackCount !== null ? `${playlist.trackCount} tracks` : null,
    playlist.ownedByUser ? "Yours" : `by ${playlist.ownerName}`,
    playlist.collaborative ? "Collaborative" : null,
  ].filter(Boolean);

  return (
    <a href={playlist.spotifyUrl} target="_blank" rel="noreferrer" className="group block">
      <div className="overflow-hidden rounded-xl shadow-[0_18px_40px_-22px_rgb(0_0_0/0.9)]">
        <Artwork
          images={playlist.images}
          alt={playlist.name}
          size={220}
          rounded="lg"
          className="transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      </div>
      <p className="mt-3 truncate font-medium text-ink transition-colors group-hover:text-accent">
        {playlist.name}
      </p>
      <p className="mt-0.5 truncate text-xs text-ink-3">{details.join(" · ")}</p>
    </a>
  );
}

export function PlaylistGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
