import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSiteOrigin, isIndexableDeployment } from "@/lib/site";

const siteUrl = getSiteOrigin();
const indexable = isIndexableDeployment();

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: { default: "VAELTX — Websites with structure, character and a clear next action", template: "%s — VAELTX" },
  description: "An independent web and conversion studio. Strategy, UX/UI and build-ready systems for businesses that need clarity without looking generic.",
  applicationName: "VAELTX",
  openGraph: { type: "website", siteName: "VAELTX", title: "VAELTX — Web & Conversion Studio", description: "Websites with structure, character and a clear next action." },
  robots: { index: indexable, follow: indexable },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F7F5F1" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
