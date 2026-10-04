import "server-only";
import { Resend } from "resend";
import { auction, db, ensure, siteURL, AuctionError } from "./server";
import { processEvent, verifiedStripe } from "./payments";
import { money } from "./model";
import type Stripe from "stripe";

export async function reconcile() {
  const a = await auction();
  ensure(true, (await db().rpc("va_close", { p_auction: a.id })).error);
  const { data: offers, error } = await db()
    .from("va_winners")
    .select("*")
    .eq("auction_id", a.id)
    .eq("status", "pending");
  ensure(offers, error);
  for (const offer of offers || []) {
    const due = Date.now() >= Date.parse(offer.deadline);
    if (
      offer.checkout_session_id ||
      (due && offer.checkout_state === "creating")
    ) {
      const s = await verifiedStripe();
      let id = offer.checkout_session_id as string | null;
      if (!id) {
        const { data: p } = await db()
          .from("va_participants")
          .select("stripe_customer_id")
          .eq("id", offer.participant_id)
          .single();
        if (!p?.stripe_customer_id)
          throw new AuctionError(
            "Checkout reconciliation needs attention.",
            503,
          );
        const sessions = await s.checkout.sessions.list({
          customer: p.stripe_customer_id,
          limit: 100,
        });
        id =
          sessions.data.find(
            (item) => item.metadata?.auction_winner === offer.id,
          )?.id || null;
        if (id)
          ensure(
            true,
            (
              await db()
                .from("va_winners")
                .update({ checkout_session_id: id, checkout_state: "open" })
                .eq("id", offer.id)
            ).error,
          );
        else
          ensure(
            true,
            (
              await db()
                .from("va_winners")
                .update({ checkout_state: "expired" })
                .eq("id", offer.id)
            ).error,
          );
      }
      if (id) {
        let session = await s.checkout.sessions.retrieve(id);
        if (due && session.status === "open") {
          try {
            session = await s.checkout.sessions.expire(id);
          } catch {
            session = await s.checkout.sessions.retrieve(id);
          }
        }
        if (session.payment_status === "paid") {
          // Recovery uses authenticated Stripe retrieval, never a browser redirect.
          await processEvent(
            {
              id: `reconcile:${session.id}`,
              type: "checkout.session.completed",
              livemode: session.livemode,
              data: { object: session },
            } as unknown as Stripe.Event,
            s,
          );
        } else if (session.status === "expired") {
          ensure(
            true,
            (
              await db()
                .from("va_winners")
                .update({ checkout_state: "expired" })
                .eq("id", offer.id)
                .eq("status", "pending")
            ).error,
          );
        }
      }
    }
    if (due)
      ensure(
        true,
        (await db().rpc("va_expire_winner", { p_winner: offer.id })).error,
      );
    else if (
      Date.parse(offer.deadline) - Date.now() < 6 * 3600_000 &&
      a.environment === "production"
    ) {
      for (const audience of ["owner", "participant"])
        ensure(
          true,
          (
            await db().rpc("va_notify", {
              p_key: `reminder:${audience}:${offer.id}`,
              p_kind: "payment_reminder",
              p_audience: audience,
              p_user: offer.participant_id,
              p_payload: { amount: offer.amount, deadline: offer.deadline },
            })
          ).error,
        );
    }
  }
}
const subjects: Record<string, string> = {
  bid_accepted: "New accepted website bid",
  bid_confirmation: "Your website bid is confirmed",
  outbid: "Your website bid has been outbid",
  reserve_met: "Website auction reserve reached",
  winner: "Website auction winner · payment due",
  backup_offer: "Website auction backup offer",
  closed_no_sale: "Website auction closed without a sale",
  auction_closed: "Website auction has closed",
  payment_reminder: "Website payment deadline reminder",
  payment_expired: "Website payment deadline expired",
  payment_received: "Website payment confirmed",
  onboarding: "Website project brief received",
  late_payment_review: "Website payment needs owner review",
};
export async function deliverNotifications() {
  if (
    !process.env.AUCTION_RESEND_API_KEY ||
    !process.env.AUCTION_EMAIL_FROM ||
    !process.env.AUCTION_ADMIN_EMAIL
  )
    throw new AuctionError("Email delivery is not configured.", 503);
  const resend = new Resend(process.env.AUCTION_RESEND_API_KEY);
  const result = await db().rpc("va_lease_notifications", { p_limit: 10 });
  const messages = ensure(result.data, result.error);
  for (const item of messages || []) {
    // Resend idempotency lasts 24 hours. Uncertain delivery beyond that window needs human reconciliation.
    if (Date.now() - Date.parse(item.first_attempt_at) > 23 * 3600_000) {
      await db()
        .from("va_outbox")
        .update({
          status: "review",
          last_error:
            "Provider idempotency window elapsed; reconcile before resending.",
        })
        .eq("id", item.id);
      continue;
    }
    const { data: p } = item.participant_id
      ? await db()
          .from("va_participants")
          .select("email,full_name,business_name,phone")
          .eq("id", item.participant_id)
          .single()
      : { data: null };
    const recipient =
      item.audience === "owner" ? process.env.AUCTION_ADMIN_EMAIL : p?.email;
    if (!recipient) {
      await db()
        .from("va_outbox")
        .update({ status: "review", last_error: "Recipient missing." })
        .eq("id", item.id);
      continue;
    }
    const payload = item.payload;
    const title =
      item.kind === "bid_accepted"
        ? `VAELTX Auction — New Bid: ${money(payload.amount)} USD`
        : subjects[item.kind] || "Website auction update";
    const isOwner = item.audience === "owner";
    const url = siteURL(
      isOwner
        ? "/admin/website-auction"
        : item.kind === "payment_received" || item.kind === "onboarding"
          ? "/website-auction/onboarding"
          : "/website-auction/account",
    );
    const text = [
      title,
      payload.amount ? `Amount: ${money(payload.amount)} USD` : "",
      payload.bidId ? `Bid: ${payload.bidId}` : "",
      payload.deadline ? `Payment deadline: ${payload.deadline}` : "",
      payload.at ? `Accepted at: ${payload.at}` : "",
      isOwner && p
        ? `Bidder: ${payload.fullName || p.full_name}\nBusiness: ${payload.businessName || p.business_name}\nEmail: ${payload.email || p.email}\nPhone: ${payload.phone || p.phone}${payload.country ? `\nCountry: ${payload.country}` : ""}`
        : "",
      isOwner && item.kind === "bid_accepted"
        ? `Current highest: ${money(payload.currentHighest)} USD\nNext minimum: ${money(payload.nextMinimum)} USD\nPublic reserve: ${money(payload.reserveAmount)} USD · ${payload.reserveMet ? "MET" : "NOT MET"}\nValid bids: ${payload.validBids}\nVerified bidders with valid bids: ${payload.verifiedBidders}\nServer deadline: ${payload.endsAt}`
        : "",
      item.kind === "backup_offer"
        ? "This offer uses your own accepted bid. No automatic charge. Review and pay only if you accept."
        : "",
      item.kind === "payment_received"
        ? "Your payment is confirmed. Continue with your website project brief."
        : "",
      url,
      "Bidding is free. Card verification does not authorize an automatic winning payment. Review the auction terms for the agreed service scope.",
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      let message = item.delivery_message;
      if (!message) {
        const content = {
          from: process.env.AUCTION_EMAIL_FROM,
          to: recipient,
          subject: title,
          text,
        };
        ensure(
          true,
          (
            await db()
              .from("va_outbox")
              .update({ delivery_message: content })
              .eq("id", item.id)
              .is("delivery_message", null)
          ).error,
        );
        const saved = await db()
          .from("va_outbox")
          .select("delivery_message")
          .eq("id", item.id)
          .single();
        message = ensure(saved.data, saved.error).delivery_message;
      }
      const sent = await resend.emails.send(message, {
        idempotencyKey: `va-outbox:${item.id}`,
      });
      if (sent.error || !sent.data?.id) throw new Error("provider_rejected");
      ensure(
        true,
        (
          await db()
            .from("va_outbox")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              provider_id: sent.data.id,
              lease_until: null,
              last_error: null,
            })
            .eq("id", item.id)
        ).error,
      );
    } catch {
      await db()
        .from("va_outbox")
        .update({
          status: item.attempts >= 8 ? "review" : "pending",
          lease_until: null,
          next_attempt_at: new Date(
            Date.now() + Math.min(3600, 30 * 2 ** item.attempts) * 1000,
          ).toISOString(),
          last_error:
            "Delivery or receipt persistence failed; retry with same idempotency key.",
        })
        .eq("id", item.id);
    }
  }
  return { processed: messages.length };
}
