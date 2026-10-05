import "server-only";
import { auction, db, ensure, siteURL, AuctionError } from "./server";
import { emailTransport } from "./mail";
import { dispatchDelivery } from "./delivery-policy";
import { processEvent, verifiedStripe } from "./payments";
import { money } from "./model";
import type Stripe from "stripe";
import { auctionRuntime } from "./runtime";
import { renderAuctionEmail } from "./email-template";

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
      (a.environment === "production" || auctionRuntime().qa)
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
              p_payload: {
                amount: offer.amount,
                deadline: offer.deadline,
                auctionId: a.id,
              },
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
  const transport = emailTransport();
  // Verify SMTP before claiming rows; an unavailable server must not burn attempts.
  try {
    await transport.verify();
  } catch {
    throw new AuctionError("SMTP authentication or connectivity failed.", 503);
  }
  const result = await db().rpc("va_lease_notifications", {
    p_limit: transport.kind === "smtp" ? 2 : 10,
  });
  const messages = ensure(result.data, result.error);
  for (const item of messages || []) {
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
      (payload.qa ? "[QA — Stripe TEST] " : "") +
      (item.kind === "bid_accepted"
        ? `VAELTX Auction — New Bid: ${money(payload.amount)} USD`
        : subjects[item.kind] || "Website auction update");
    const isOwner = item.audience === "owner";
    const path = isOwner
      ? "/admin/website-auction"
      : item.kind === "payment_received" || item.kind === "onboarding"
        ? "/website-auction/onboarding"
        : "/website-auction/account";
    const url =
      payload.qa &&
      /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(payload.qaURL || "")
        ? new URL(path, payload.qaURL).toString()
        : siteURL(path);
    try {
      let message = item.delivery_message;
      if (!message) {
        const content = {
          from: process.env.AUCTION_EMAIL_FROM,
          to: recipient,
          subject: title,
          ...renderAuctionEmail({ kind: item.kind, owner: isOwner, qa: !!payload.qa, payload, url, ownerDetails: p ? {fullName:p.full_name,businessName:p.business_name,email:p.email,phone:p.phone} : undefined }),
        };
        ensure(
          true,
          (
            await db()
              .from("va_outbox")
              .update({
                delivery_message: content,
                delivery_transport: transport.kind,
              })
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
      await dispatchDelivery(item, transport.kind, {
        now: Date.now(),
        beginSMTP: async () => {
          const r = await db()
            .from("va_outbox")
            .update({
              smtp_attempt_started_at: new Date().toISOString(),
              delivery_transport: "smtp",
            })
            .eq("id", item.id)
            .eq("status", "leased")
            .eq("attempts", item.attempts)
            .is("smtp_attempt_started_at", null)
            .select("id")
            .single();
          ensure(r.data, r.error);
        },
        send: () => transport.send(message, item.id),
        sent: async (receipt) => {
          const r = await db()
            .from("va_outbox")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              provider_id: receipt,
              lease_until: null,
              last_error: null,
            })
            .eq("id", item.id)
            .eq("attempts", item.attempts)
            .select("id")
            .single();
          ensure(r.data, r.error);
        },
        failed: async (review, reason) => {
          const r = await db()
            .from("va_outbox")
            .update({
              status: review || item.attempts >= 8 ? "review" : "pending",
              lease_until: null,
              ...(transport.kind === "smtp" && !review
                ? { smtp_attempt_started_at: null }
                : {}),
              next_attempt_at: new Date(
                Date.now() + Math.min(3600, 30 * 2 ** item.attempts) * 1000,
              ).toISOString(),
              last_error: reason,
            })
            .eq("id", item.id)
            .eq("attempts", item.attempts);
          ensure(true, r.error);
        },
      });
    } catch {
      await db()
        .from("va_outbox")
        .update({
          status:
            transport.kind === "smtp" || item.attempts >= 8
              ? "review"
              : "pending",
          lease_until: null,
          next_attempt_at: new Date(
            Date.now() + Math.min(3600, 30 * 2 ** item.attempts) * 1000,
          ).toISOString(),
          last_error:
            transport.kind === "smtp"
              ? "SMTP processing or receipt is uncertain; reconcile before resending."
              : "Delivery or receipt persistence failed; retry with same idempotency key.",
        })
        .eq("id", item.id);
    }
  }
  return { processed: messages.length };
}
