import type { Image } from "@/lib/spotify/types";

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

/** "3 min ago", "5 h ago", "2 d ago" — relative to `now`. */
export function formatRelative(iso: string, now: number): string {
  const diffS = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (diffS < 60) return "just now";
  if (diffS < 3600) return `${Math.floor(diffS / 60)} min ago`;
  if (diffS < 86400) return `${Math.floor(diffS / 3600)} h ago`;
  if (diffS < 86400 * 30) return `${Math.floor(diffS / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Pick the smallest Spotify image that is at least `minSize` px wide.
 * Spotify returns images sorted largest-first; widths can be null for playlist mosaics.
 */
export function pickImage(images: Image[], minSize: number): string | null {
  if (images.length === 0) return null;
  const sized = images.filter((img) => (img.width ?? 0) >= minSize);
  const choice = sized.length > 0 ? sized[sized.length - 1] : images[0];
  return choice.url;
}
