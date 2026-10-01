import { NextResponse } from "next/server";
import { contactFieldErrors, contactSchema } from "@/lib/contact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeliveryReceipt = { status: number; body: { ok?: boolean; message?: string } };
const globalState = globalThis as typeof globalThis & { vaeltxContactKeys?: Map<string, DeliveryReceipt>; vaeltxContactRate?: Map<string, { count: number; startedAt: number }> };
const seenKeys = globalState.vaeltxContactKeys ??= new Map();
const rateBuckets = globalState.vaeltxContactRate ??= new Map();

function rateLimit(key: string) {
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || now - current.startedAt > 10 * 60_000) { rateBuckets.set(key, { count: 1, startedAt: now }); return false; }
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
  if (origin && !sameOrigin) return NextResponse.json({ ok: false, message: "This request could not be verified. Reload the page and try again." }, { status: 403 });

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimit(forwarded)) return NextResponse.json({ ok: false, message: "Too many attempts were made. Wait a few minutes or email vaeltxn@gmail.com." }, { status: 429 });

  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ ok: false, message: "The form could not be read. Your answers are still here; please retry." }, { status: 400 }); }
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "A few details need attention.", errors: contactFieldErrors(parsed.error) }, { status: 400 });
  const brief = parsed.data;
  if (brief.website) return NextResponse.json({ ok: false, message: "The form could not be verified. Please retry." }, { status: 400 });
  const key = request.headers.get("idempotency-key") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) return NextResponse.json({ ok: false, message: "The request could not be verified. Reload the form and try again." }, { status: 400 });
  const previous = seenKeys.get(key);
  if (previous) return NextResponse.json(previous.body, { status: previous.status });

  const endpointValue = process.env.CONTACT_DELIVERY_URL;
  const token = process.env.CONTACT_DELIVERY_TOKEN;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!endpointValue || !token || !from) return NextResponse.json({ ok: false, message: "Email delivery is not configured yet. No message was sent; your answers are still here. You can email vaeltxn@gmail.com directly." }, { status: 503 });

  let endpoint: URL;
  try { endpoint = new URL(endpointValue); } catch { return NextResponse.json({ ok: false, message: "Email delivery is temporarily unavailable. Your answers are still here." }, { status: 503 }); }
  const devEndpoint = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(endpoint.hostname);
  if (endpoint.protocol !== "https:" && !devEndpoint) return NextResponse.json({ ok: false, message: "Email delivery is temporarily unavailable. Your answers are still here." }, { status: 503 });

  const text = [
    "New VAELTX project inquiry",
    "",
    `Name: ${brief.name}`,
    `Email: ${brief.email}`,
    `Help requested: ${brief.need}`,
    `Current site: ${brief.site || "Not provided"}`,
    `Timing: ${brief.timing || "Not provided"}`,
    "",
    "What needs to change:",
    brief.detail,
  ].join("\n");
  try {
    const result = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": key },
      body: JSON.stringify({ to: process.env.CONTACT_TO_EMAIL || "vaeltxn@gmail.com", from, replyTo: brief.email, subject: `New VAELTX project inquiry / ${brief.name}`, text }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!result.ok) return NextResponse.json({ ok: false, message: "The message did not send. Your answers are still here; try again or email vaeltxn@gmail.com." }, { status: 502 });
    const receipt = { status: 200, body: { ok: true, message: "Your project brief was delivered." } } satisfies DeliveryReceipt;
    if (seenKeys.size > 500) seenKeys.clear();
    seenKeys.set(key, receipt);
    return NextResponse.json(receipt.body, { status: receipt.status });
  } catch {
    return NextResponse.json({ ok: false, message: "The message did not send. Your answers are still here; try again or email vaeltxn@gmail.com." }, { status: 502 });
  }
}
