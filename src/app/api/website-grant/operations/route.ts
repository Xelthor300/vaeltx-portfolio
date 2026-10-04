import { timingSafeEqual } from "node:crypto";
import { judgedSelectionSchema } from "@/lib/website-grant";
import { flushGrantEmails } from "@/lib/website-grant-email";
import { campaignSnapshot, grantDatabase, grantFailure, GrantError } from "@/lib/website-grant-server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const secret = process.env.GRANT_OPERATIONS_SECRET, presented = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!secret || secret.length < 32 || !presented || Buffer.byteLength(presented) !== Buffer.byteLength(secret) || !timingSafeEqual(Buffer.from(presented), Buffer.from(secret))) throw new GrantError(401, "Unauthorized.");
    const db = grantDatabase(), { campaign, validEntries } = await campaignSnapshot();
    if (!campaign) throw new GrantError(503, "Campaign unavailable.");
    const input = await request.text();
    if (input.length > 8000) throw new GrantError(413, "Request too large.");
    let parsed: unknown; try { parsed = input ? JSON.parse(input) : {}; } catch { throw new GrantError(400,"Invalid operation."); }
    if (typeof parsed === "object" && parsed !== null && "action" in parsed) {
      const selection = judgedSelectionSchema.safeParse(parsed);
      if (!selection.success) throw new GrantError(400, "Provide the selected application, rubric version, reviewers and decision rationale.");
      if (campaign.status !== "selection_pending" || !validEntries) throw new GrantError(409, "Selection is not ready.");
      const decision = selection.data;
      const { data, error } = await db.rpc("wg_record_judged_selection", { p_campaign: campaign.id, p_participant: decision.participantId, p_decision: { rubric_version: decision.rubricVersion, reviewers: decision.reviewers, rationale: decision.rationale } });
      if (error) throw new GrantError(409, "Reconcile the campaign and eligible pool before selection.");
      return Response.json({ selected: data }, { headers: { "Cache-Control": "no-store" } });
    }
    // An expired campaign closes on the server; submissions independently enforce timestamps.
    if (campaign.end_at && Date.parse(campaign.end_at) <= Date.now()) await db.from("wg_campaigns").update({ status: "closed" }).eq("id", campaign.id).eq("status", "active");
    await flushGrantEmails();
    const [pending, orders, audits] = await Promise.all([
      db.from("wg_email_outbox").select("id", { count: "exact", head: true }).is("sent_at", null),
      db.from("wg_orders").select("kind,status,quantity,currency,amount_minor").eq("campaign_id", campaign.id).order("created_at", { ascending: false }).limit(50),
      db.from("wg_audit_logs").select("action,created_at").eq("campaign_id", campaign.id).order("created_at", { ascending: false }).limit(50),
    ]);
    return Response.json({ status: campaign.status, start: campaign.start_at, end: campaign.end_at, validEntries, emailsPending: pending.count, recentOrders: orders.data, audit: audits.data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return grantFailure(error); }
}
