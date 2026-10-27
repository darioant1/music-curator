import { pickImage } from "@/lib/format";
import type { Image } from "@/lib/spotify/types";

type Props = {
  images: Image[];
  alt: string;
  /** Rendered size in CSS px — used to pick an appropriately sized Spotify image. */
  size: number;
  rounded?: "full" | "md" | "lg";
  className?: string;
};

const radius = { full: "rounded-full", md: "rounded-md", lg: "rounded-xl" };

/**
 * Album / artist / playlist artwork with a typographic fallback.
 *
 * Uses a plain <img> rather than next/image: Spotify already serves several
 * pre-sized renditions (we pick one), its image hosts vary (i.scdn.co,
 * mosaic.scdn.co, *.spotifycdn.com, and sometimes third-party avatar hosts), and
 * playlist image URLs expire within a day, which defeats server-side caching.
 */
export function Artwork({ images, alt, size, rounded = "md", className = "" }: Props) {
  const src = pickImage(images, size * 2); // 2x for high-DPI screens

  if (!src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`${radius[rounded]} flex aspect-square w-full items-center justify-center bg-gradient-to-br from-surface-3 to-surface-2 font-display text-3xl text-ink-3 ${className}`}
      >
        {alt.trim().charAt(0).toUpperCase() || "♪"}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- see component docs above
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={`${radius[rounded]} aspect-square w-full bg-surface-2 object-cover ${className}`}
    />
  );
}
