"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * After the dashboard first loads, asks the server to save your latest plays
 * (POST /api/history/sync). The server throttles this, so frequent visits are
 * cheap. If new plays were saved, the current page refreshes to include them.
 */
export function SyncOnLoad() {
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/history/sync", { method: "POST", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((result: { playsInserted?: number } | null) => {
        if (result?.playsInserted) router.refresh();
      })
      .catch(() => {
        // Offline, aborted, or Spotify unavailable — try again on the next visit.
      });
    return () => controller.abort();
  }, [router]);
  return null;
}
