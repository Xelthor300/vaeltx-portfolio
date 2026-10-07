export const dynamic = "force-dynamic";

export function GET() {
  const target =
    process.env.VAELTX_CUSTOMER_PORTAL_LOGIN_URL ||
    "https://billing.stripe.com/p/login/28E6oAb7R1wO4W877X9MY00";

  return Response.redirect(target, 302);
}
