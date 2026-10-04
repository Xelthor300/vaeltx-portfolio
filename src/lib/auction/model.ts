import { z } from "zod";
import { captchaTokenSchema } from "./turnstile";

export const AUCTION_SLUG = "website-auction";
export const TERMS_VERSION = "auction-v1";
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
export function parseAmount(value: string): number {
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(value))
    throw new Error("Enter a USD amount with at most two decimal places.");
  const [dollars, decimals = ""] = value.split(".");
  const cents = Number(dollars) * 100 + Number(decimals.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 10000 || cents > 99999999)
    throw new Error("Amount is outside the supported payment range.");
  return cents;
}
const requiredText = z.string().trim().min(2).max(160);
export const profileSchema = z
  .object({
    full_name: requiredText,
    business_name: requiredText,
    phone: z
      .string()
      .trim()
      .min(7)
      .max(32)
      .regex(/^[+\d ()-]+$/),
    country: z
      .string()
      .trim()
      .length(2)
      .regex(/^[A-Z]{2}$/),
    city: requiredText,
    website: z
      .union([
        z.literal(""),
        z
          .url()
          .max(500)
          .refine((v) => /^https?:\/\//.test(v)),
      ])
      .optional(),
    adult_confirmed: z.literal(true),
    privacy_accepted: z.literal(true),
    commitment_accepted: z.literal(true),
    terms_accepted: z.literal(true),
  })
  .strict();
export const bidSchema = z
  .object({
    amount: z.number().int().min(10000).max(99999999),
    requestId: z.uuid(),
    confirmed: z.literal(true),
    captchaToken: captchaTokenSchema,
  })
  .strict();
export const onboardingSchema = z
  .object({
    business: requiredText,
    industry: requiredText,
    services: z.string().trim().min(5).max(3000),
    pages: z.string().trim().min(5).max(2000),
    goals: z.string().trim().min(5).max(2000),
    design: z.string().trim().min(5).max(2000),
    brand: z.string().trim().max(3000),
    content: z.string().trim().max(5000),
    contact: z.string().trim().min(5).max(1000),
    functionality: z.string().trim().max(2000),
    domain: z.string().trim().max(500),
    assets_url: z.union([
      z.literal(""),
      z
        .url()
        .max(1000)
        .refine((v) => v.startsWith("https://")),
    ]),
    no_passwords: z.literal(true),
  })
  .strict();
export type PublicState = {
  auction_id: string;
  slug: string;
  status: string;
  current_amount: number | null;
  next_minimum: number;
  reserve_amount: number;
  reserve_met: boolean;
  bid_count: number;
  participant_count: number;
  starts_at: string | null;
  ends_at: string | null;
  extension_count: number;
  updated_at: string;
};
export const stateColumns =
  "auction_id,slug,status,current_amount,next_minimum,reserve_amount,reserve_met,bid_count,participant_count,starts_at,ends_at,extension_count,updated_at";
export function isActive(state: PublicState, now = Date.now()) {
  return (
    state.status === "active" &&
    !!state.starts_at &&
    !!state.ends_at &&
    now >= Date.parse(state.starts_at) &&
    now < Date.parse(state.ends_at)
  );
}
export const statusLabel: Record<string, string> = {
  ready_for_activation: "Preparing to open",
  active: "Auction open",
  paused: "Auction paused",
  closed_no_sale: "Closed · reserve not met",
  payment_pending: "Closed · winner payment pending",
  payment_expired: "Closed · payment deadline passed",
  completed: "Website commissioned",
  cancelled: "Auction cancelled",
};
