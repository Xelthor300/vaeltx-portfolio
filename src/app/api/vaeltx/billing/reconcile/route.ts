import { operations } from "@/lib/auction/server";
import { reconcileManagedBilling } from "@/lib/billing/reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    operations(request);
    const result = await reconcileManagedBilling();
    return Response.json(result, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    console.error(
      "vaeltx_billing_reconcile_failed",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json(
      { error: "Billing reconciliation failed." },
      {
        status: 503,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex",
        },
      },
    );
  }
}
