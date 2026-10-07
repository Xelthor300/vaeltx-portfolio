import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
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
  return (
    <>
      <div style={{ background: "#0b0b0c", padding: "14px 18px", borderBottom: "1px solid #2c2c30", textAlign: "right" }}>
        <Link href="/admin/managed-hosting" style={{ color: "#f5f2eb", textDecoration: "none", fontSize: 13 }}>
          Managed Hosting &amp; Care →
        </Link>
      </div>
      <AuctionExperience initialState={null} page="admin" />
    </>
  );
}
