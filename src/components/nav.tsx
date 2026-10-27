"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: IconOverview },
  { href: "/dashboard/artists", label: "Artists", icon: IconArtist },
  { href: "/dashboard/tracks", label: "Tracks", icon: IconTrack },
  { href: "/dashboard/playlists", label: "Playlists", icon: IconPlaylist },
  { href: "/dashboard/library", label: "Liked", icon: IconHeart },
] as const;

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Vertical navigation for the desktop sidebar. */
export function SidebarNav() {
  const isActive = useIsActive();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              active ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface hover:text-ink"
            }`}
          >
            <Icon className={active ? "text-accent" : "text-ink-3"} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Bottom tab bar for phones. */
export function MobileTabBar() {
  const isActive = useIsActive();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/85 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="grid grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${
                active ? "text-ink" : "text-ink-3"
              }`}
            >
              <Icon className={active ? "text-accent" : ""} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// --- icons (inline SVG, 20px, stroke-based) --------------------------------

type IconProps = { className?: string };

function Svg({ className = "", children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-5 shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

function IconOverview(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
    </Svg>
  );
}

function IconArtist(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </Svg>
  );
}

function IconTrack(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </Svg>
  );
}

function IconPlaylist(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 6h13M3 12h13M3 18h8" />
      <path d="M19 15v6M16 18h6" />
    </Svg>
  );
}

function IconHeart(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5c-2.2 4.6-9.2 9-9.2 9Z" />
    </Svg>
  );
}
