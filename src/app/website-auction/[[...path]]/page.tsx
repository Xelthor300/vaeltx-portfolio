import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AuctionExperience from "@/components/auction/AuctionExperience";
import { publicState } from "@/lib/auction/server";
export const dynamic = "force-dynamic";
const paths = [
  "home",
  "bid",
  "account",
  "history",
  "winner",
  "payment",
  "onboarding",
];
type Props = { params: Promise<{ path?: string[] }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params;
  const page = path?.[0] || "home";
  return {
    title:
      page === "home"
        ? "Custom website service auction"
        : `Website auction · ${page}`,
    description:
      "Bid for a custom VAELTX website. Starts at $100 USD, public reserve $350 USD, no bidding fee. Highest valid bid wins when the reserve is met.",
    alternates: {
      canonical: `/website-auction${page === "home" ? "" : `/${page}`}`,
    },
    robots: ["account", "winner", "payment", "onboarding", "bid"].includes(page)
      ? { index: false, follow: false }
      : undefined,
  };
}
export default async function Page({ params }: Props) {
  const { path } = await params;
  const page = path?.[0] || "home";
  if (!paths.includes(page) || (path?.length || 0) > 1) notFound();
  const state = await publicState().catch(() => null);
  return <AuctionExperience initialState={state} page={page} />;
}
