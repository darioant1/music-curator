import Link from "next/link";

/** Wordmark: a stylized record groove + editorial serif name. */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5">
      <span
        aria-hidden
        className="relative grid size-7 place-items-center rounded-full bg-[conic-gradient(from_200deg,var(--accent),#ffb36b,#7a3cff,var(--accent))] shadow-[0_0_24px_-6px_var(--accent)] transition-transform duration-700 group-hover:rotate-180"
      >
        <span className="size-2.5 rounded-full bg-bg ring-2 ring-bg/40" />
      </span>
      <span className="font-display text-[1.35rem] leading-none tracking-tight text-ink">
        Music <em className="text-ink-2">Curator</em>
      </span>
    </Link>
  );
}

/** Spotify's guidelines ask that content attributes Spotify; we keep it understated. */
export function SpotifyAttribution() {
  return (
    <p className="text-[11px] leading-relaxed text-ink-3">
      Music data and artwork provided by Spotify. Not affiliated with or endorsed by Spotify.
    </p>
  );
}
