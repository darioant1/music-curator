import { Suspense } from "react";
import { Logo, SpotifyAttribution } from "@/components/brand";
import { MobileTabBar, SidebarNav } from "@/components/nav";
import { SyncOnLoad } from "@/components/sync-on-load";
import { TimezoneSync } from "@/components/timezone-sync";
import { LogoutButton, UserChip, UserChipSkeleton } from "@/components/user-menu";

/**
 * Authenticated app shell. Everything here is static and prerendered; only
 * the user chip reads the session, so it streams in behind <Suspense>.
 * Access control happens in src/proxy.ts and again in the Data Access Layer.
 *
 * <SyncOnLoad> asks the server to save recent plays and the daily top-items
 * snapshot; <TimezoneSync> reports the browser's time zone.
 */
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line px-4 py-6 md:flex">
        <div className="px-2">
          <Logo href="/dashboard" />
        </div>
        <div className="mt-10">
          <SidebarNav />
        </div>
        <div className="mt-auto space-y-4">
          <Suspense fallback={<UserChipSkeleton />}>
            <UserChip />
          </Suspense>
          <div className="border-t border-line pt-3">
            <LogoutButton />
          </div>
          <div className="px-1">
            <SpotifyAttribution />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg/80 px-5 py-3.5 backdrop-blur-xl md:hidden">
          <Logo href="/dashboard" />
          <LogoutButton compact />
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-5 pb-32 pt-8 sm:px-8 md:pb-16 lg:px-12 lg:pt-12">
          {children}
        </main>
      </div>

      <MobileTabBar />
      <TimezoneSync />
      <SyncOnLoad />
    </div>
  );
}
