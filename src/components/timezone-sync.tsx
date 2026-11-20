"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const COOKIE = "mmc_tz"; // keep in sync with TZ_COOKIE in lib/history/time.ts

/**
 * Tells the server the browser's time zone (e.g. "America/Chicago") via a
 * cookie, so history charts can show local hours instead of UTC. Not
 * sensitive, so a regular (non-httpOnly) cookie is fine. Refreshes once
 * when the zone changes so server-rendered charts pick it up.
 */
export function TimezoneSync() {
  const router = useRouter();
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const current = document.cookie.match(/(?:^|; )mmc_tz=([^;]*)/)?.[1];
    if (zone && decodeURIComponent(current ?? "") !== zone) {
      document.cookie = `${COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [router]);
  return null;
}
