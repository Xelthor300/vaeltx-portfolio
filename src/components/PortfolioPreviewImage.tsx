import Image from "next/image";

/** Authentic local captures of independent concept interfaces. */
export function PortfolioPreviewImage({ slug, width, alt, loading = "lazy" }: {
  slug: string; width: number; height: number; alt: string; loading?: "eager" | "lazy";
}) {
  return <Image width={width} height={Math.round(width * 891 / 1425)}
    src={`/images/preview-${slug}.webp`} alt={alt} loading={loading}
    sizes="(max-width: 760px) 100vw, 80vw" />;
}
