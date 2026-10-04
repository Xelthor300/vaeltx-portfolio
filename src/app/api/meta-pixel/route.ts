import { NextRequest } from "next/server";
import { MARKETING_COOKIE, META_PIXEL_NOSCRIPT } from "@/lib/meta-pixel";

// This first-party noscript image preserves static page rendering and checks
// prior consent before redirecting to the owner's exact Meta fallback URL.
export function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Robots-Tag": "noindex, nofollow" };
  if (request.cookies.get(MARKETING_COOKIE)?.value === "granted") {
    return new Response(null, { status: 302, headers: { ...headers, Location: META_PIXEL_NOSCRIPT } });
  }
  const transparentPixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  return new Response(transparentPixel, { headers: { ...headers, "Content-Type": "image/gif" } });
}
