import { failure, reply, AuctionError } from "@/lib/auction/server";
import { processEvent, verifiedStripe } from "@/lib/auction/payments";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 1000000)
      throw new AuctionError("Request too large.", 413);
    const secret = process.env.AUCTION_STRIPE_WEBHOOK_SECRET;
    const signature = request.headers.get("stripe-signature");
    if (!secret || !signature)
      throw new AuctionError(
        "Webhook configuration or signature missing.",
        400,
      );
    const raw = await request.text();
    if (raw.length > 1000000) throw new AuctionError("Request too large.", 413);
    const s = await verifiedStripe();
    let event;
    try {
      event = s.webhooks.constructEvent(raw, signature, secret);
    } catch {
      throw new AuctionError("Invalid webhook signature.", 400);
    }
    await processEvent(event, s);
    return reply({ received: true });
  } catch (error) {
    return failure(error);
  }
}
