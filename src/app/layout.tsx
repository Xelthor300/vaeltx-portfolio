import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./visual-system.css";
import "./case-studies.css";
import "./concept-visual-overhaul.css";
import "./navigation-polish.css";
import "./contact-polish.css";
import "./production-polish.css";
import "./orynt-case.css";
import "./aster-case.css";
import "./project-proof.css";
import localFont from "next/font/local";
import { getSiteOrigin, isIndexableDeployment } from "@/lib/site";
import { Suspense } from "react";
import { MetaPixel } from "@/components/MetaPixel";
import { MarketingConsentBanner } from "@/components/MarketingConsent";

const siteUrl = getSiteOrigin();
const indexable = isIndexableDeployment();
const display = localFont({ src: "./fonts/instrument-sans-600.ttf", variable: "--font-studio", weight: "600", display: "swap" });

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: { default: "VAELTX — Websites with structure, character and a clear next action", template: "%s — VAELTX" },
  description: "An independent web and conversion studio. Strategy, UX/UI and build-ready systems for businesses that need clarity without looking generic.",
  applicationName: "VAELTX",
  openGraph: { type: "website", siteName: "VAELTX", title: "VAELTX — Web & Conversion Studio", description: "Websites with structure, character and a clear next action." },
  robots: { index: indexable, follow: indexable },
  alternates: siteUrl ? { canonical: new URL("/", siteUrl).toString() } : undefined,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F7F5F1" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={display.variable}><body>{children}
    <Suspense fallback={null}><MetaPixel /></Suspense>
    <MarketingConsentBanner />
    <noscript>
      {/* A direct Meta URL here would bypass consent when JavaScript is off. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img height="1" width="1" src="/api/meta-pixel" alt="" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }} />
    </noscript>
  </body></html>;
}
