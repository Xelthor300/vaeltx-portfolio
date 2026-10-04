import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  turbopack: { root: process.cwd() },
  async redirects() {
    return [{ source: '/website-grant/:path*', destination: '/website-auction', permanent: true }];
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" }
    ] }, { source: "/concepts/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  }
};
export default config;
