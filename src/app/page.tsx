import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Logo, SpotifyAttribution } from "@/components/brand";
import { SESSION_COOKIE, decodeSession } from "@/lib/auth/session";

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "You cancelled the Spotify authorization. Connect again whenever you’re ready.",
  state_mismatch:
    "The sign-in request couldn’t be verified (it may have expired). Please try connecting again.",
  oauth_error: "Spotify reported an error during sign-in. Please try again.",
  token_exchange_failed: "We couldn’t complete sign-in with Spotify. Please try again.",
  not_allowlisted:
    "Spotify blocked this account. While the app is in Development Mode, each user must be added under Settings → User Management in the Spotify Developer Dashboard.",
  session_expired: "Your Spotify session expired or access was revoked. Please reconnect.",
  signed_out: "Please connect Spotify to view your dashboard.",
};

/**
 * Landing page. The marketing content is static (prerendered); the two
 * request-dependent bits — the auth-aware CTA and the error banner — stream
 * in behind <Suspense>.
 */
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <Backdrop />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-8">
        <Logo />
        <Suspense fallback={null}>
          <HeaderAction />
        </Suspense>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-16 px-6 pb-20 pt-8 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:pt-16">
        <section>
          <Suspense fallback={null}>
            <ErrorBanner searchParams={searchParams} />
          </Suspense>

          <p className="animate-rise text-[11px] font-medium uppercase tracking-[0.2em] text-accent">
            A personal music curator
          </p>
          <h1
            className="mt-5 animate-rise font-display text-[3.4rem] leading-[0.92] tracking-tight text-ink sm:text-7xl lg:text-[5.6rem]"
            style={{ animationDelay: "60ms" }}
          >
            Hear beyond
            <br />
            <em className="text-ink-2">your rotation.</em>
          </h1>
          <p
            className="mt-7 max-w-xl animate-rise text-lg leading-relaxed text-ink-2"
            style={{ animationDelay: "120ms" }}
          >
            Streaming algorithms keep playing you more of what you already know. Music Curator
            studies your taste — your top artists, the tracks on repeat, the playlists you’ve
            built — to help you find what’s just outside it.
          </p>

          <div
            className="mt-10 flex animate-rise flex-wrap items-center gap-4"
            style={{ animationDelay: "180ms" }}
          >
            <Suspense fallback={<ConnectButton />}>
              <PrimaryAction />
            </Suspense>
            <p className="text-xs text-ink-3">Read-only access · Disconnect anytime</p>
          </div>
        </section>

        <Record />
      </main>

      <section className="relative z-10 border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:px-8 md:grid-cols-3">
          <Step
            n="01"
            title="Connect"
            body="Sign in with Spotify. Your tokens stay on our server, encrypted — never in your browser."
          />
          <Step
            n="02"
            title="Understand"
            body="See your top artists and tracks across three time windows, your playlists, liked songs, and patterns in your taste."
          />
          <Step
            n="03"
            title="Discover"
            soon
            body="AI-guided discovery and playlist building, tuned from familiar to experimental."
          />
        </div>
      </section>

      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:px-8 md:flex-row md:justify-between">
          <div className="max-w-md">
            <p className="text-sm font-medium text-ink">What this app can see</p>
            <ul className="mt-3 space-y-1.5 text-sm text-ink-2">
              <li>Your profile name and picture</li>
              <li>Your top artists and tracks</li>
              <li>Your playlists and liked songs</li>
              <li>Your 50 most recently played tracks</li>
            </ul>
            <p className="mt-3 text-xs text-ink-3">
              It can’t change your library, playlists, or playback.
            </p>
          </div>
          <div className="max-w-xs self-end">
            <SpotifyAttribution />
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- request-dependent pieces ---------------------------------------------

async function isSignedIn() {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value) !== null;
}

async function PrimaryAction() {
  if (!(await isSignedIn())) return <ConnectButton />;
  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-bg transition-transform hover:scale-[1.02]"
    >
      Open your dashboard →
    </Link>
  );
}

async function HeaderAction() {
  if (!(await isSignedIn())) return null;
  return (
    <Link href="/dashboard" className="text-sm font-medium text-ink-2 transition-colors hover:text-ink">
      Dashboard →
    </Link>
  );
}

async function ErrorBanner({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const code = (await searchParams).error;
  const message = typeof code === "string" ? ERROR_MESSAGES[code] : undefined;
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-8 max-w-xl animate-rise rounded-2xl border border-danger/25 bg-danger/[0.07] px-5 py-4 text-sm text-ink-2"
    >
      {message}
    </div>
  );
}

// --- static pieces ---------------------------------------------------------

function ConnectButton() {
  // A plain <a>, not <Link>: this hits a Route Handler that redirects off-site.
  return (
    <a
      href="/api/auth/login"
      className="group inline-flex items-center gap-3 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-accent-ink shadow-[0_10px_40px_-10px_var(--accent)] transition-transform hover:scale-[1.02]"
    >
      <SpotifyGlyph />
      Connect Spotify
    </a>
  );
}

function Step({ n, title, body, soon }: { n: string; title: string; body: string; soon?: boolean }) {
  return (
    <div>
      <p className="font-mono text-xs text-ink-3">{n}</p>
      <h2 className="mt-3 flex items-center gap-3 font-display text-3xl text-ink">
        {title}
        {soon && (
          <span className="rounded-full border border-line-strong px-2 py-0.5 font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-ink-3">
            Coming soon
          </span>
        )}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
    </div>
  );
}

/** Decorative spinning record — pure CSS, no fake album art or data. */
function Record() {
  return (
    <div aria-hidden className="relative mx-auto hidden aspect-square w-full max-w-md lg:block">
      <div className="absolute inset-0 animate-spin-slow rounded-full bg-[repeating-radial-gradient(circle_at_center,#141210_0px,#141210_2px,#1d1a17_3px,#141210_4px)] shadow-[0_40px_120px_-30px_rgb(0_0_0/0.95),inset_0_0_0_1px_rgb(255_255_255/0.05)]">
        <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_30deg,transparent_0deg,rgb(255_255_255/0.07)_40deg,transparent_80deg,transparent_180deg,rgb(255_255_255/0.05)_220deg,transparent_260deg)]" />
        <div className="absolute inset-[34%] rounded-full bg-[conic-gradient(from_200deg,var(--accent),#ffb36b,#7a3cff,var(--accent))]">
          <div className="absolute inset-[42%] rounded-full bg-bg" />
        </div>
      </div>
    </div>
  );
}

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -right-40 -top-40 size-[40rem] rounded-full bg-accent/10 blur-[120px]" />
      <div className="absolute -left-40 top-1/2 size-[32rem] rounded-full bg-[#7a3cff]/[0.07] blur-[120px]" />
    </div>
  );
}

function SpotifyGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="currentColor">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.62.62 0 0 1-.86.2c-2.35-1.43-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.81-.87 7.08-.5 9.72 1.11.3.18.39.57.21.86Zm1.22-2.72a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.57 11.23 1.33.37.22.48.7.26 1.07Zm.1-2.84C14.7 8.93 9.38 8.75 6.3 9.69a.94.94 0 1 1-.54-1.8c3.53-1.07 9.4-.86 13.1 1.34a.94.94 0 0 1-.96 1.61Z" />
    </svg>
  );
}
