import type { MetadataRoute } from "next";
import { parentRoutes } from "@/lib/content";
import { getSiteOrigin, isIndexableDeployment } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteOrigin();
  if (!isIndexableDeployment() || !origin) return [];
  return ["", ...parentRoutes, "website-auction", "website-auction/history", "website-auction/terms"].map(path => ({
    url: new URL(path ? `/${path}` : "/", origin).toString(),
    lastModified: new Date(),
    changeFrequency: path === "" ? "monthly" : "yearly",
    priority: path === "" ? 1 : 0.7,
  }));
}
