import { z } from "zod";
import { randomInt } from "node:crypto";
import {
  auth,
  user,
  admin,
  auction,
  publicState,
  db,
  body,
  origin,
  rate,
  captcha,
  reply,
  failure,
  ensure,
  AuctionError,
  operations,
  siteURL,
} from "@/lib/auction/server";
import {
  bidSchema,
  profileSchema,
  onboardingSchema,
  TERMS_VERSION,
} from "@/lib/auction/model";
import {
  setupCard,
  checkoutWinner,
  verifiedStripe,
} from "@/lib/auction/payments";
import { reconcile, deliverNotifications } from "@/lib/auction/operations";
import { emailTransport } from "@/lib/auction/mail";
import { captchaTokenSchema } from "@/lib/auction/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
export async function GET(request: Request, ctx: Context) {
  try {
    const { action } = await ctx.params;
    if (action === "state") {
      const a = await auction();
      if (
        a.status === "active" &&
        a.ends_at &&
        Date.now() >= Date.parse(a.ends_at)
      )
        ensure(true, (await db().rpc("va_close", { p_auction: a.id })).error);
      return reply({
        state: await publicState(),
        serverTime: new Date().toISOString(),
      });
    }
    if (action === "config")
      return reply({
        url: process.env.SUPABASE_URL,
        publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
        turnstileSiteKey: process.env.AUCTION_TURNSTILE_SITE_KEY || null,
      });
    if (action === "history") {
      const a = await auction();
      const { data, error } = await db()
        .from("va_bids")
        .select("id,amount,created_at,status,va_participants(alias)")
        .eq("auction_id", a.id)
        .eq("status", "valid")
        .order("id", { ascending: false })
        .limit(100);
      const rows = ensure(data, error);
      return reply({
        bids: rows.map((b) => ({
          id: b.id,
          amount: b.amount,
          created_at: b.created_at,
          alias:
            (b.va_participants as unknown as { alias: string })?.alias ||
            "Bidder",
        })),
      });
    }
    if (action === "account") {
      const u = await user();
      const a = await auction();
      const results = await Promise.all([
        db()
          .from("va_participants")
          .select(
            "full_name,business_name,phone,country,city,website,terms_version,status,verified_mode,verified_at",
          )
          .eq("id", u.id)
          .maybeSingle(),
        db()
          .from("va_bids")
          .select("id,amount,created_at,status")
          .eq("auction_id", a.id)
          .eq("participant_id", u.id)
          .order("id", { ascending: false }),
        db()
          .from("va_winners")
          .select("id,amount,status,is_backup,offered_at,deadline,paid_at")
          .eq("auction_id", a.id)
          .eq("participant_id", u.id)
          .order("offered_at", { ascending: false }),
        db()
          .from("va_bids")
          .select("id,participant_id")
          .eq("auction_id", a.id)
          .eq("status", "valid")
          .order("amount", { ascending: false })
          .order("id")
          .limit(1)
          .maybeSingle(),
      ]);
      for (const r of results)
        if (r.error)
          throw new AuctionError("Account temporarily unavailable.", 503);
      return reply({
        email: u.email,
        profile: results[0].data,
        bids: results[1].data,
        offers: results[2].data?.map((w) => ({
          ...w,
          can_pay:
            w.status === "pending" && Date.now() < Date.parse(w.deadline),
        })),
        leading: results[3].data?.participant_id === u.id,
        leadingBidId:
          results[3].data?.participant_id === u.id ? results[3].data?.id : null,
      });
    }
    if (action === "admin-bidder") {
      await admin();
      const a = await auction();
      const search = new URL(request.url).searchParams;
      const id = z.uuid().parse(search.get("id"));
      const offset = z.coerce
        .number()
        .int()
        .min(0)
        .max(1000000)
        .parse(search.get("offset") || 0);
      const results = await Promise.all([
        db().from("va_participants").select("*").eq("id", id).single(),
        db()
          .from("va_bids")
          .select("id,amount,status,created_at,invalidation_reason")
          .eq("auction_id", a.id)
          .eq("participant_id", id)
          .order("id")
          .range(offset, offset + 999),
        db()
          .from("va_bids")
          .select("amount", { count: "exact" })
          .eq("auction_id", a.id)
          .eq("participant_id", id)
          .eq("status", "valid")
          .order("amount", { ascending: false })
          .limit(1),
      ]);
      if (results.some((r) => r.error))
        throw new AuctionError("Bidder records unavailable.", 404);
      return reply({
        profile: results[0].data,
        bids: results[1].data,
        highestBid: results[2].data?.[0]?.amount || null,
        validBidCount: results[2].count || 0,
      });
    }
    if (action === "admin") {
      await admin();
      const a = await auction();
      const tables = [
        "va_participants",
        "va_bids",
        "va_winners",
        "va_extensions",
        "va_audit",
        "va_outbox",
      ] as const;
      const search = new URL(request.url).searchParams;
      const selected = search.get("table");
      const offset = Number(search.get("offset") || 0);
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        offset > 1000000 ||
        (selected && !tables.includes(selected as (typeof tables)[number]))
      )
        throw new AuctionError("Invalid history request.");
      const load = async (table: (typeof tables)[number]) => {
        let query = db()
          .from(table)
          .select(
            table === "va_outbox"
              ? "id,dedupe_key,kind,audience,participant_id,status,attempts,next_attempt_at,provider_id,last_error,created_at,sent_at"
              : "*",
          )
          .order("id")
          .range(selected ? offset : 0, (selected ? offset : 0) + 999);
        if (
          ["va_bids", "va_winners", "va_extensions", "va_audit"].includes(table)
        )
          query = query.eq("auction_id", a.id);
        const r = await query;
        return ensure(r.data, r.error);
      };
      if (selected)
        return reply({ rows: await load(selected as (typeof tables)[number]) });
      const leaderBid = await db()
        .from("va_bids")
        .select("participant_id,amount,id")
        .eq("auction_id", a.id)
        .eq("status", "valid")
        .order("amount", { ascending: false })
        .order("id")
        .limit(1)
        .maybeSingle();
      if (leaderBid.error) throw new AuctionError("Leader unavailable.", 503);
      const leader = leaderBid.data
        ? await db()
            .from("va_participants")
            .select("id,full_name,business_name,email,phone")
            .eq("id", leaderBid.data.participant_id)
            .single()
        : { data: null, error: null };
      const result: Record<string, unknown> = {
        auction: a,
        leader: leader.data,
      };
      for (const table of tables) result[table] = await load(table);
      return reply(result);
    }
    if (action === "onboarding") {
      const u = await user();
      const a = await auction();
      const { data: w } = await db()
        .from("va_winners")
        .select("id")
        .eq("auction_id", a.id)
        .eq("participant_id", u.id)
        .eq("status", "paid")
        .limit(1)
        .maybeSingle();
      if (!w)
        throw new AuctionError("A confirmed website payment is required.", 403);
      const r = await db()
        .from("va_onboarding")
        .select("responses")
        .eq("winner_id", w.id)
        .maybeSingle();
      if (r.error) throw new AuctionError("Brief unavailable.", 503);
      return reply({ responses: r.data?.responses || null });
    }
    if (action === "operations") {
      operations(request);
      await reconcile();
      return reply(await deliverNotifications());
    }
    return reply({ error: "Not found." }, 404);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, ctx: Context) {
  try {
    const { action } = await ctx.params;
    origin(request);
    const input = await body(request);
    if (action === "signin") {
      const v = z
        .object({
          email: z.email().max(254),
          captchaToken: captchaTokenSchema,
        })
        .strict()
        .parse(input);
      await rate(request, "signin");
      // Supabase must validate this single-use token itself, including requests
      // made directly to Auth. Never redeem it here first and then replay it.
      if (process.env.AUCTION_AUTH_CAPTCHA_PROVIDER !== "supabase")
        throw new AuctionError("Secure sign-in is being configured.", 503);
      const r = await (
        await auth()
      ).auth.signInWithOtp({
        email: v.email,
        options: {
          emailRedirectTo: siteURL("/website-auction/auth/callback"),
          shouldCreateUser: true,
          captchaToken: v.captchaToken,
        },
      });
      if (r.error)
        throw new AuctionError(
          "Email sign-in is unavailable. Please try again later.",
          503,
        );
      return reply({
        ok: true,
        message: "Check your email for a secure sign-in link.",
      });
    }
    if (action === "signout") {
      await (await auth()).auth.signOut();
      return reply({ ok: true });
    }
    const u = await user();
    if (action === "profile") {
      await rate(request, "profile", u.id);
      const v = profileSchema.parse(input);
      const a = await auction();
      const eligible = a.commercial_terms.eligible_countries as
        | string[]
        | undefined;
      if (!eligible?.length || !eligible.includes(v.country))
        throw new AuctionError(
          "Country eligibility is still being finalized, or this country is not eligible.",
          409,
        );
      const { data: old } = await db()
        .from("va_participants")
        .select("alias")
        .eq("id", u.id)
        .maybeSingle();
      const { terms_accepted: accepted, ...profile } = v;
      if (!accepted) throw new AuctionError("Accept the terms.");
      const record = {
        ...profile,
        id: u.id,
        email: u.email,
        email_verified_at: u.email_confirmed_at,
        terms_version: TERMS_VERSION,
        accepted_at: new Date().toISOString(),
        alias: old?.alias || `Bidder •••${randomInt(100000, 999999)}`,
      };
      ensure(
        true,
        (
          await db()
            .from("va_participants")
            .upsert(record, { onConflict: "id" })
        ).error,
      );
      return reply({ ok: true });
    }
    if (action === "bid") {
      await rate(request, "bid", u.id);
      const v = bidSchema.parse(input);
      await captcha(v.captchaToken, "bid");
      const a = await auction();
      const r = await db().rpc("va_place_bid", {
        p_auction: a.id,
        p_user: u.id,
        p_amount: v.amount,
        p_request: v.requestId,
      });
      const outcome = ensure(r.data, r.error);
      return reply(
        {
          ...outcome,
          state: await publicState(),
          serverTime: new Date().toISOString(),
        },
        outcome.ok ? 200 : 409,
      );
    }
    if (action === "setup") {
      const v = z
        .object({ captchaToken: captchaTokenSchema })
        .strict()
        .parse(input);
      await rate(request, "setup", u.id);
      await captcha(v.captchaToken, "setup");
      return reply(await setupCard(u.id));
    }
    if (action === "checkout") {
      await rate(request, "checkout", u.id);
      const v = z
        .object({ winnerId: z.uuid(), accepted: z.literal(true) })
        .strict()
        .parse(input);
      return reply(await checkoutWinner(u.id, v.winnerId));
    }
    if (action === "onboarding") {
      await rate(request, "onboarding", u.id);
      const responses = onboardingSchema.parse(input);
      const a = await auction();
      const { data: w } = await db()
        .from("va_winners")
        .select("*")
        .eq("auction_id", a.id)
        .eq("participant_id", u.id)
        .eq("status", "paid")
        .limit(1)
        .maybeSingle();
      if (!w)
        throw new AuctionError("A confirmed website payment is required.", 403);
      ensure(
        true,
        (
          await db().from("va_onboarding").upsert({
            winner_id: w.id,
            participant_id: u.id,
            responses,
            updated_at: new Date().toISOString(),
          })
        ).error,
      );
      ensure(
        true,
        (
          await db().rpc("va_notify", {
            p_key: `onboarding:${w.id}`,
            p_kind: "onboarding",
            p_audience: "owner",
            p_user: u.id,
            p_payload: { winnerId: w.id, amount: w.amount },
          })
        ).error,
      );
      return reply({ ok: true });
    }
    if (action === "admin") {
      await admin();
      await rate(request, "admin", u.id);
      const a = await auction();
      const v = z
        .object({
          action: z.enum([
            "activate",
            "pause",
            "resume",
            "cancel",
            "invalidate",
            "backup",
          ]),
          reason: z.string().trim().min(12).max(1000),
          bidId: z.number().int().positive().optional(),
          confirmed: z.literal(true),
        })
        .strict()
        .parse(input);
      if (
        v.action === "activate" &&
        process.env.AUCTION_ALLOW_ACTIVATION !== "true"
      )
        throw new AuctionError(
          "Final activation is locked until production review is complete.",
          409,
        );
      if (v.action === "activate") {
        if (
          process.env.AUCTION_STRIPE_MODE !== "live" ||
          [
            "AUCTION_STRIPE_WEBHOOK_SECRET",
            "AUCTION_TURNSTILE_SECRET",
            "AUCTION_TURNSTILE_SITE_KEY",
            "AUCTION_EMAIL_FROM",
            "AUCTION_ADMIN_EMAIL",
          ].some((key) => !process.env[key])
        )
          throw new AuctionError(
            "Production payment, security and email configuration must be complete before activation.",
            409,
          );
        await verifiedStripe();
        await emailTransport().verify();
      }
      const r = await db().rpc("va_admin_action", {
        p_auction: a.id,
        p_actor: u.id,
        p_action: v.action,
        p_reason: v.reason,
        p_bid: v.bidId || null,
      });
      if (r.error)
        throw new AuctionError(
          "Action rejected. Check status, launch gates, and the selected bid.",
          409,
        );
      return reply(r.data);
    }
    return reply({ error: "Not found." }, 404);
  } catch (error) {
    return failure(error);
  }
}
