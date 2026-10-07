import { processBillingWebhook } from "@/lib/billing/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 1_000_000)
      return response({ error: "Request too large." }, 413);
    const signature = request.headers.get("stripe-signature");
    const secret = process.env.VAELTX_BILLING_WEBHOOK_SECRET;
    if (!signature || !secret)
      return response({ error: "Webhook unavailable." }, 503);
    const raw = await request.text();
    if (raw.length > 1_000_000)
      return response({ error: "Request too large." }, 413);
    return response(await processBillingWebhook(raw, signature, secret));
  } catch (error) {
    console.error(
      "vaeltx_billing_webhook_failed",
      error instanceof Error ? error.message : "unknown",
    );
    return response({ error: "Webhook processing failed." }, 400);
  }
}
