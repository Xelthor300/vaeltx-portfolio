import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { admin } from "@/lib/auction/server";
import OwnerSignIn from "@/components/admin/OwnerSignIn";
import "../managed-hosting.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Owner sign-in · VAELTX",
  robots: { index: false, follow: false },
};

export default async function Page() {
  let ownerSession = false;
  try {
    await admin();
    ownerSession = true;
  } catch {
    // No active owner session: render the private owner sign-in surface.
  }
  if (ownerSession) redirect("/admin/managed-hosting");

  return (
    <main className="hosting-admin owner-signin-shell">
      <OwnerSignIn siteKey={process.env.AUCTION_TURNSTILE_SITE_KEY || null} />
    </main>
  );
}
