import type { MetadataRoute } from "next";
import { getSiteOrigin, isIndexableDeployment } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const allowed = isIndexableDeployment();
  const origin = getSiteOrigin();
  return {
    rules: { userAgent: "*", allow: allowed ? "/" : undefined, disallow: allowed ? undefined : "/" },
    sitemap: allowed && origin ? new URL("/sitemap.xml", origin).toString() : undefined,
  };
}
