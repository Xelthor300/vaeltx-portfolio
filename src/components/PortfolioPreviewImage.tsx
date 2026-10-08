"use client";
import Image from "next/image";
import { useState } from "react";

/** Captures of functioning, independent concept demos (not commissioned client results).
 * Artwork is stored in a dedicated VAELTX portfolio asset folder in Picsart Drive.
 * If an external asset is unavailable, show the original local preview instead.
 */
const previews: Record<string, string> = {
  "vault-tcg": "https://gcdn.picsart.com/editing-temp/1de4aed7-d144-46de-a362-8b1ae06621d4.png",
  "northstar-roofing": "https://gcdn.picsart.com/editing-temp/e9b156d6-09da-4efc-8291-84a426589eb0.png",
  "mira-atelier": "https://gcdn.picsart.com/editing-temp/8f9e3c5a-8707-4ec7-b541-dd09ed1aee44.png",
  "axiom-strategy": "https://gcdn.picsart.com/editing-temp/c0129035-c2c8-4c2d-a310-00ec7dfd081a.png",
};
export function PortfolioPreviewImage({ slug, width, height, alt, loading = "lazy" }: {
  slug: string; width: number; height: number; alt: string; loading?: "eager" | "lazy";
}) {
  const [fallbackMode, setFallbackMode] = useState(false);
  const localSource = `/images/preview-${slug}.webp`;
  const source = fallbackMode ? localSource : (previews[slug] ?? localSource);
  return <Image
    unoptimized
    width={width}
    height={height}
    src={source}
    alt={alt}
    loading={loading}
    onError={() => { if (source !== localSource) setFallbackMode(true); }}
  />;
}
