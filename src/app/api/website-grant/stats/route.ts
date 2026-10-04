import { campaignAvailability } from "@/lib/website-grant";
import { campaignSnapshot } from "@/lib/website-grant-server";
export const dynamic = "force-dynamic";
export async function GET() {
  const { campaign, validEntries } = await campaignSnapshot();
  if (!campaign) return Response.json({ available: false, message: "Campaign details are being prepared." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json({ available: true, valid_entries: validEntries, status: campaignAvailability(campaign), start_at: campaign.start_at, end_at: campaign.end_at, website_awards: campaign.prize_quantity, server_now: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
