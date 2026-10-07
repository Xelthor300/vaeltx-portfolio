import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { admin } from "@/lib/auction/server";
import OwnerSignIn from "@/components/admin/OwnerSignIn";
import "../client-ops.css";
import "../../managed-hosting/managed-hosting.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Owner sign-in · Client Ops",
  robots: { index: false, follow: false },
};

export default async function Page() {
  let ownerSession = false;
  try {
    await admin();
    ownerSession = true;
  } catch {
    // No active owner session.
  }
  if (ownerSession) redirect("/admin/client-ops");

  return (
    <main className="client-ops owner-signin-shell">
      <OwnerSignIn
        siteKey={process.env.AUCTION_TURNSTILE_SITE_KEY || null}
        target="client-ops"
      />
    </main>
  );
}
