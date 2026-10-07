import { auth, siteURL } from "@/lib/auction/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ownerTarget = url.searchParams.get("target") === "managed-hosting";

  if (process.env.AUCTION_PUBLIC_ENABLED !== "true" && !ownerTarget)
    return new Response("Not found.", { status: 404 });

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await (await auth()).auth.exchangeCodeForSession(code);
    if (!error) {
      if (ownerTarget)
        return Response.redirect(siteURL("/admin/managed-hosting"), 303);
      return Response.redirect(siteURL("/website-auction/account?email=verified"), 303);
    }
  }

  return Response.redirect(
    siteURL(
      ownerTarget
        ? "/admin/managed-hosting/signin?status=failed"
        : "/website-auction/account?signin=failed",
    ),
    303,
  );
}
