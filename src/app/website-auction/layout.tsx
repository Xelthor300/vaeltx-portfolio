import { notFound } from "next/navigation";
import "./auction.css";

export default function AuctionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.AUCTION_PUBLIC_ENABLED !== "true") notFound();
  return children;
}
