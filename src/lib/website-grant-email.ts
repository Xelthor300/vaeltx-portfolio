import "server-only";
import { Resend } from "resend";
import { grantDatabase } from "./website-grant-server";
import { getSiteOrigin } from "./site";

// DB outbox survives function failures. Resend idempotency covers overlapping workers.
export async function flushGrantEmails(participantId?: string) {
  const key = process.env.RESEND_API_KEY, from = process.env.GRANT_EMAIL_FROM, origin = getSiteOrigin();
  if (!key || !from || !origin) return false;
  const db = grantDatabase();
  let query = db.from("wg_email_outbox").select("id,participant_id,kind,subject_id").is("sent_at", null).order("created_at").limit(20);
  if (participantId) query = query.eq("participant_id", participantId);
  const { data: pending, error } = await query;
  if (error) return false;
  const resend = new Resend(key);
  for (const item of pending || []) {
    const { data: participant } = await db.from("wg_participants").select("email_normalized,campaign_id").eq("id", item.participant_id).single();
    const { data: campaign } = await db.from("wg_campaigns").select("end_at").eq("id", participant?.campaign_id).single();
    if (!participant) continue;
    const text = item.kind === "free-entry" ? `YOUR ENTRY IS CONFIRMED\n\nEntry: ${item.subject_id}\nFree entries: 1\nCampaign closes: ${campaign?.end_at || "See campaign rules"}\nNo purchase is required to claim the free entry.\nSelection follows a documented sales-team evaluation, not a random draw. Buying more entries does not automatically improve an evaluation score. No purchase guarantees selection.` : "Your VAELTX payment is confirmed. Your purchase history and any issued entries are available securely in your account. Standalone services do not create entries.";
    try {
      const result = await resend.emails.send({ from, to: participant.email_normalized, subject: item.kind === "free-entry" ? "Your VAELTX Website Launch Grant entry is confirmed" : "Your VAELTX purchase is confirmed", text: `${text}\n\nView your account: ${new URL("/website-grant/entry", origin)}\n\nVAELTX — Web & Conversion Studio\nvaeltxn@gmail.com` }, { idempotencyKey: `wg-email/${item.id}` });
      if (result.error || !result.data) continue;
      await db.from("wg_email_outbox").update({ sent_at: new Date().toISOString(), provider_id: result.data.id }).eq("id", item.id).is("sent_at", null);
    } catch { console.error(JSON.stringify({ system: "website-grant", action: "email_retry_required" })); }
  }
  return true;
}
