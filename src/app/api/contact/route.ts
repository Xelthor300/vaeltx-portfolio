import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { contactFieldErrors, contactSchema } from "@/lib/contact";
import { createInquiryEmail } from "@/lib/contact-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeliveryReceipt = { status: number; body: { ok: boolean; message: string; receiptId?: string }; fingerprint: string; expiresAt: number };
type PendingDelivery = { fingerprint: string; promise: Promise<DeliveryReceipt> };
const state = globalThis as typeof globalThis & {
  vaeltxContactReceipts?: Map<string, DeliveryReceipt>;
  vaeltxContactPending?: Map<string, PendingDelivery>;
  vaeltxContactRate?: Map<string, { count: number; startedAt: number }>;
};
const receipts = state.vaeltxContactReceipts ??= new Map();
const pending = state.vaeltxContactPending ??= new Map();
const rateBuckets = state.vaeltxContactRate ??= new Map();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const failureMessage = "The message could not be delivered. Your answers are still here. Retry, email vaeltxn@gmail.com, or message VAELTX on WhatsApp.";
const uncertainMessage = "Delivery could not be confirmed. Your answers are still here. You can retry safely, email vaeltxn@gmail.com, or message VAELTX on WhatsApp.";

function rateLimit(key: string) {
  const now = Date.now();
  for (const [id, bucket] of rateBuckets) if (now - bucket.startedAt > 10 * 60_000) rateBuckets.delete(id);
  const current = rateBuckets.get(key);
  if (!current) {
    if (rateBuckets.size >= 2000) rateBuckets.delete(rateBuckets.keys().next().value!);
    rateBuckets.set(key, { count: 1, startedAt: now });
    return false;
  }
  current.count += 1;
  return current.count > 3;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host") || requestUrl.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || requestUrl.protocol.replace(":", "");
  let sameOrigin = false;
  if (origin) {
    try { sameOrigin = new URL(origin).origin === `${protocol}://${host}`; } catch { sameOrigin = false; }
  }
  if (!sameOrigin) return NextResponse.json({ ok: false, message: "This request could not be verified. Reload the page and try again." }, { status: 403 });
  if (request.headers.get("content-length") && Number(request.headers.get("content-length")) > 24_000) return NextResponse.json({ ok: false, message: "Keep the brief concise and try again." }, { status: 413 });

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > 24_000) return NextResponse.json({ ok: false, message: "Keep the brief concise and try again." }, { status: 413 });
    raw = JSON.parse(text);
  } catch { return NextResponse.json({ ok: false, message: "The form could not be read. Your answers are still here; please retry." }, { status: 400 }); }
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "A few details need attention.", errors: contactFieldErrors(parsed.error) }, { status: 400 });
  const brief = parsed.data;
  const key = request.headers.get("idempotency-key") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) return NextResponse.json({ ok: false, message: "The request could not be verified. Reload the form and try again." }, { status: 400 });
  const fingerprint = hash(JSON.stringify(brief));
  for (const [id, receipt] of receipts) if (receipt.expiresAt < Date.now()) receipts.delete(id);
  const previous = receipts.get(key);
  const inFlight = pending.get(key);
  if ((previous && previous.fingerprint !== fingerprint) || (inFlight && inFlight.fingerprint !== fingerprint)) return NextResponse.json({ ok: false, message: "The brief changed. Reload the form and submit it again." }, { status: 409 });
  if (previous) return NextResponse.json(previous.body, { status: previous.status });
  if (inFlight) { const receipt = await inFlight.promise; return NextResponse.json(receipt.body, { status: receipt.status }); }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, message: "Email delivery is not configured yet. No message was sent; your answers are still here. Use email or WhatsApp to contact VAELTX directly." }, { status: 503 });
  const ipHash = hash(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown");
  if (rateLimit(ipHash)) return NextResponse.json({ ok: false, message: "Too many attempts were made. Wait a few minutes, email vaeltxn@gmail.com, or use WhatsApp." }, { status: 429 });

  const deliver = async (): Promise<DeliveryReceipt> => {
    try {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send(createInquiryEmail(brief), {
        idempotencyKey: `vaeltx-brief/${key}`,
        signal: AbortSignal.timeout(8000),
      });
      if (error || !data?.id) {
        // Record only a bounded diagnostic category; never credentials or inquiry content.
        console.error("Contact delivery rejected", {
          code: error?.name ?? "missing_receipt",
          status: error?.statusCode ?? null,
          senderSetupRequired: !!error && /only send testing emails|verify a domain|domain is not verified/i.test(error.message),
        });
        const message = !error?.statusCode || error.statusCode >= 500 ? uncertainMessage : failureMessage;
        return { status: 502, body: { ok: false, message }, fingerprint, expiresAt: Date.now() };
      }
      return { status: 200, body: { ok: true, message: "Your project brief was accepted for delivery.", receiptId: data.id }, fingerprint, expiresAt: Date.now() + 24 * 60 * 60_000 };
    } catch {
      return { status: 502, body: { ok: false, message: uncertainMessage }, fingerprint, expiresAt: Date.now() };
    }
  };
  const promise = deliver();
  pending.set(key, { fingerprint, promise });
  try {
    const receipt = await promise;
    if (receipt.body.ok) {
      if (receipts.size >= 1000) receipts.delete(receipts.keys().next().value!);
      receipts.set(key, receipt);
    }
    return NextResponse.json(receipt.body, { status: receipt.status });
  } finally { pending.delete(key); }
}
