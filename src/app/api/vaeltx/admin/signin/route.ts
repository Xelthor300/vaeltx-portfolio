import { z } from "zod";
import {
  auth,
  body,
  failure,
  origin,
  rate,
  siteURL,
  verificationCooldown,
  AuctionError,
} from "@/lib/auction/server";
import { captchaTokenSchema } from "@/lib/auction/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    origin(request);
    await rate(request, "admin-signin");
    const input = z
      .object({ captchaToken: captchaTokenSchema })
      .strict()
      .parse(await body(request));

    const email = process.env.AUCTION_ADMIN_AUTH_EMAIL?.trim();
    if (!email) throw new AuctionError("Owner access is unavailable.", 503);
    if (process.env.AUCTION_AUTH_CAPTCHA_PROVIDER !== "supabase")
      throw new AuctionError("Secure owner sign-in is unavailable.", 503);

    await verificationCooldown(email);
    const result = await (await auth()).auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: siteURL("/website-auction/auth/callback?target=managed-hosting"),
        shouldCreateUser: true,
        captchaToken: input.captchaToken,
      },
    });
    if (result.error)
      throw new AuctionError("Secure owner sign-in is unavailable. Try again later.", 503);

    return Response.json(
      { ok: true, message: "Secure owner sign-in link sent." },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex",
        },
      },
    );
  } catch (error) {
    return failure(error);
  }
}
