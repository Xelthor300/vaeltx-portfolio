import { applicationSchema, normalizeEmail } from "@/lib/website-grant";
import { grantDatabase, grantFailure, GrantError, bodyJson, databaseResult, ensureOrigin, openCampaign, takeRateLimit, verifiedAccount } from "@/lib/website-grant-server";
import { flushGrantEmails } from "@/lib/website-grant-email";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    ensureOrigin(request);
    const user = await verifiedAccount(), campaign = await openCampaign();
    await takeRateLimit("application", user.id, 10, 600);
    const parsed = applicationSchema.safeParse(await bodyJson(request));
    if (!parsed.success) return Response.json({ ok: false, message: "Check the highlighted application fields.", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
    if (!campaign.eligible_countries.includes(parsed.data.country)) throw new GrantError(403, "Your jurisdiction is not eligible.");
    const db = grantDatabase();
    const { data, error } = await db.rpc("wg_claim_free", { p_campaign: campaign.id, p_user: user.id, p_email: normalizeEmail(user.email!), p_application: parsed.data });
    databaseResult(error);
    const { data: participant } = await db.from("wg_participants").select("id").eq("campaign_id", campaign.id).eq("auth_user_id", user.id).single();
    if (participant) await flushGrantEmails(participant.id);
    return Response.json({ ok: true, ...data, message: data.already_exists ? "Your free entry already exists. No second free entry was created." : "Your free entry is confirmed." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return grantFailure(error); }
}
