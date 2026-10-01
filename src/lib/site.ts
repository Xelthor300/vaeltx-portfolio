export function getSiteOrigin(): URL | undefined {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const value = configured || (productionHost ? `https://${productionHost}` : undefined);
  if (!value) return undefined;
  try { return new URL(value); } catch { return undefined; }
}

export function isIndexableDeployment(): boolean {
  return process.env.SITE_INDEXABLE === "true" && process.env.VERCEL_ENV !== "preview";
}
