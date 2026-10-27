import { Artwork } from "./artwork";
import { Skeleton } from "./ui";
import { getCurrentUser } from "@/lib/spotify/api";
import { load } from "@/lib/spotify/safe";

/** Profile chip for the sidebar. Reads the session, so it must render inside <Suspense>. */
export async function UserChip() {
  const result = await load(getCurrentUser);
  if (!result.ok) {
    return <p className="px-1 text-xs text-ink-3">Profile unavailable</p>;
  }
  const user = result.data;
  return (
    <a
      href={user.spotifyUrl}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-surface"
    >
      <div className="size-9 shrink-0">
        <Artwork images={user.images} alt={user.displayName} size={36} rounded="full" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{user.displayName}</p>
        <p className="text-xs text-ink-3">Spotify profile ↗</p>
      </div>
    </a>
  );
}

export function UserChipSkeleton() {
  return (
    <div className="flex items-center gap-3 p-1">
      <Skeleton className="size-9 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        className={
          compact
            ? "rounded-full border border-line-strong px-3 py-1 text-xs text-ink-2 transition-colors hover:text-ink"
            : "w-full rounded-lg px-3 py-2 text-left text-sm text-ink-3 transition-colors hover:bg-surface hover:text-ink"
        }
      >
        {compact ? "Log out" : "Disconnect Spotify"}
      </button>
    </form>
  );
}
