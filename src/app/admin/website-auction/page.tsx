import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { admin } from "@/lib/auction/server";
import AuctionExperience from "@/components/auction/AuctionExperience";
import "../../website-auction/auction.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private auction operations",
  robots: { index: false, follow: false },
};
export default async function Page() {
  try {
    await admin();
  } catch {
    notFound();
  }
  return <AuctionExperience initialState={null} page="admin" />;
}
