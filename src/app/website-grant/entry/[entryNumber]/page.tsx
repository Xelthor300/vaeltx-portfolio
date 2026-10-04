import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { grantDatabase, verifiedAccount, GrantError } from "@/lib/website-grant-server";
export const dynamic = "force-dynamic";
export default async function EntryDetail({ params }: { params: Promise<{ entryNumber: string }> }) {
  const { entryNumber } = await params;
  if (!/^VAELTX-\d{4}-\d{6,20}$/.test(entryNumber)) notFound();
  let user;
  try { user = await verifiedAccount(); } catch (error) { if (error instanceof GrantError && error.status === 401) redirect("/website-grant/apply"); return <main id="main" className="wg-main"><h1>Entry details are unavailable.</h1><p>Sign in when account verification is available.</p><Link href="/website-grant/entry">Your account</Link></main>; }
  const db = grantDatabase();
  const { data: participants } = await db.from("wg_participants").select("id").eq("auth_user_id", user.id);
  if (!participants?.length) notFound();
  const { data: ticket } = await db.from("wg_entries").select("entry_number,entry_source,status,created_at").eq("entry_number", entryNumber).in("participant_id", participants.map(p => p.id)).maybeSingle();
  if (!ticket) notFound();
  return <main id="main" className="wg-main wg-narrow"><p className="wg-kicker">PRIVATE ENTRY DETAILS</p><h1>Your entry.</h1><section className="wg-panel"><h2 className="wg-entry-id">{ticket.entry_number}</h2><dl><dt>Status</dt><dd>{ticket.status}</dd><dt>Source</dt><dd>{ticket.entry_source === "paid" ? "Paid entry" : "Free verified entry"}</dd><dt>Created</dt><dd>{new Date(ticket.created_at).toLocaleString("en-US", { timeZone: "UTC" })} UTC</dd></dl></section><Link className="wg-button" href="/website-grant/entry">Back to my entries ↗</Link></main>;
}
