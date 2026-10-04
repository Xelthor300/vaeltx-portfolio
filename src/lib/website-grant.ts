import { z } from "zod";

export const GRANT_SLUG = "website-launch-grant";
export const currencies = ["USD", "CAD", "MXN"] as const;
export type Currency = typeof currencies[number];
export const entryQuantities = Array.from({ length: 20 }, (_, i) => (i + 1) * 5);
export const entryBaseMinor: Record<Currency, number> = { USD: 600, CAD: 847, MXN: 10887 };
export function entryPrice(quantity: number, currency: Currency) {
  if (!entryQuantities.includes(quantity) || !currencies.includes(currency)) throw new Error("Invalid package");
  return entryBaseMinor[currency] * (quantity / 5);
}
export const services = [
  { code: "homepage-review", name: "Homepage Quick Review", description: "First impressions, CTA clarity, visual hierarchy, mobile observations and 3 priority recommendations.", prices: { USD: 900, CAD: 1200, MXN: 18000 } },
  { code: "strategy-audit", name: "Website Strategy Audit", description: "Homepage, navigation, mobile UX, trust signals and conversion friction, with prioritized recommendations.", prices: { USD: 1900, CAD: 2600, MXN: 38000 } },
  { code: "ux-action-plan", name: "Conversion & UX Action Plan", description: "A full website review, recommended homepage structure, CTA strategy and practical next steps.", prices: { USD: 3900, CAD: 5300, MXN: 78000 } },
] as const;
export function money(amount: number, currency: Currency) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "code" }).format(amount / 100);
}
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
const shortText = z.string().trim().min(2).max(160);
const optionalUrl = z.union([z.literal(""), z.url().max(500).refine(value => ["http:", "https:"].includes(new URL(value).protocol), "Use an http or https address.")]);
export const applicationSchema = z.object({
  full_name: shortText, business_name: shortText, country: z.string().regex(/^[A-Z]{2}$/), city: shortText,
  website: optionalUrl, social_url: optionalUrl,
  business_description: z.string().trim().min(10).max(2000), website_goal: z.string().trim().min(10).max(2000),
  has_current_website: z.boolean(), age_confirmed: z.literal(true), rules_accepted: z.literal(true), contact_consent: z.literal(true),
}).strict();
export const loginSchema = z.object({ email: z.email().max(254).transform(normalizeEmail), captchaToken: z.string().max(4096) }).strict();
export const verifySchema = z.object({ email: z.email().max(254).transform(normalizeEmail), token: z.string().regex(/^\d{6,10}$/) }).strict();
export const judgedSelectionSchema = z.object({ action: z.literal("select"), participantId: z.uuid(), rubricVersion: z.string().trim().min(1).max(100), reviewers: z.array(z.string().trim().min(2).max(100)).min(1).max(20), rationale: z.string().trim().min(10).max(5000) }).strict();
export const checkoutSchema = z.object({ kind: z.enum(["entries", "service"]), code: z.string().max(80), quantity: z.number().int(), currency: z.enum(currencies), requestId: z.uuid() }).strict().superRefine((value, ctx) => {
  if (value.kind === "entries" ? !entryQuantities.includes(value.quantity) || value.code !== `entries-${value.quantity}` : value.quantity !== 1 || !services.some(s => s.code === value.code)) ctx.addIssue({ code: "custom", message: "Select an available package or service." });
});
export type Campaign = {
  id: string; slug: string; name: string; status: string; start_at: string | null; end_at: string | null;
  prize_quantity: number; eligible_countries: string[]; minimum_age: number; rules_version: string | null;
  legal_approved_at: string | null; rules: Record<string, string>; prize_arv_minor: number | null; prize_arv_currency: Currency;
  paid_entries_enabled: boolean; processor_approved_at: string | null; services_enabled: boolean;
};
export function campaignAvailability(c: Campaign | null, now = Date.now()) {
  if (!c || !c.start_at || !c.end_at || !c.legal_approved_at || !c.rules_version || !c.eligible_countries.length) return "not-open" as const;
  if (["closed", "selection_pending", "selected", "completed"].includes(c.status) || now >= Date.parse(c.end_at)) return "closed" as const;
  if (c.status !== "active" || now < Date.parse(c.start_at)) return "not-open" as const;
  return "open" as const;
}
export function countdown(end: string | null, now: number) {
  const seconds = end ? Math.max(0, Math.floor((Date.parse(end) - now) / 1000)) : 0;
  return { days: Math.floor(seconds / 86400), hours: Math.floor(seconds % 86400 / 3600), minutes: Math.floor(seconds % 3600 / 60) };
}
export const ruleSections = ["Sponsor / organizer", "Eligibility", "Promotion period", "How to enter", "One free entry per verified account", "Free entry route", "Additional paid entries and team evaluation", "Prize description", "Approximate retail value", "Domain limitations", "Hosting terms", "Website scope", "Selection procedure", "Notification", "Response deadline", "Alternate selection", "Taxes and other costs", "Intellectual property", "Permission to display completed work", "Privacy and retention", "Fraud and duplicate accounts", "Limitation of liability", "Platform disclaimer", "Governing law", "Contact"] as const;
