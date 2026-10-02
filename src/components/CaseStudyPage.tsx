import Link from "next/link";
import Image from "next/image";
import { projectBySlug, projects } from "@/lib/content";
import { ContentSection, Eyebrow, SiteShell } from "@/components/SiteShell";
import { ViewportRelay } from "@/components/Interactive";

const performanceSnapshots: Record<string, { desktop: number; desktopLcp: string; mobile: number; mobileLcp: string; repeat?: { score: number; mobileLcp: string } }> = {
  "northstar-roofing": { desktop: 100, desktopLcp: "0.6", mobile: 92, mobileLcp: "2.5", repeat: { score: 98, mobileLcp: "2.3" } },
  "mira-atelier": { desktop: 100, desktopLcp: "0.5", mobile: 87, mobileLcp: "2.4", repeat: { score: 98, mobileLcp: "2.3" } },
  "axiom-strategy": { desktop: 99, desktopLcp: "0.6", mobile: 86, mobileLcp: "2.4", repeat: { score: 98, mobileLcp: "2.2" } },
  "vault-tcg": { desktop: 100, desktopLcp: "0.7", mobile: 96, mobileLcp: "2.8" },
};
