import { grantAuth, grantFailure, GrantError, ensureOrigin, bodyJson, takeRateLimit, campaignSnapshot } from "@/lib/website-grant-server";
import { loginSchema, verifySchema } from "@/lib/website-grant";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    ensureOrigin(request);
    if (!(await campaignSnapshot()).campaign) throw new GrantError(503, "Account verification is not available yet.");
    const input = await bodyJson(request, 6000);
    const auth = await grantAuth();
    const isVerification = typeof input === "object" && input !== null && "token" in input;
    if (isVerification) {
      const parsed = verifySchema.safeParse(input);
      if (!parsed.success) throw new GrantError(400, "Enter the verification code from your email.");
      await takeRateLimit("verify-email", parsed.data.email, 8, 600);
      const { error } = await auth.auth.verifyOtp({ email: parsed.data.email, token: parsed.data.token, type: "email" });
      if (error) throw new GrantError(400, "The verification code is invalid or expired. Request a new code.");
      return Response.json({ ok: true, message: "Email verified. Complete your application to claim your entry." });
    }
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) throw new GrantError(400, "Enter a valid email address.");
    if (!parsed.data.captchaToken || !process.env.GRANT_CAPTCHA_SITE_KEY) throw new GrantError(400, "Complete the security check first.");
    await takeRateLimit("login-email", parsed.data.email, 3, 600);
    // An IP is only an additional high-volume signal, never the participant identity.
    await takeRateLimit("login-network", request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown", 60, 600);
    const { error } = await auth.auth.signInWithOtp({ email: parsed.data.email, options: { shouldCreateUser: true, captchaToken: parsed.data.captchaToken } });
    if (error) throw new GrantError(503, "A verification email could not be sent. Please retry later.");
    return Response.json({ ok: true, message: "Check your email for your verification code. An application is valid only after verification and submission." });
  } catch (error) { return grantFailure(error); }
}
export async function DELETE(request: Request) {
  try { ensureOrigin(request); const auth = await grantAuth(); await auth.auth.signOut(); return Response.json({ ok: true }); }
  catch (error) { return grantFailure(error); }
}
