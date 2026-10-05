import { auth, siteURL } from "@/lib/auction/server";
export async function GET(request: Request) {
  if (process.env.AUCTION_PUBLIC_ENABLED !== "true")
    return new Response("Not found.", { status: 404 });
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    const { error } = await (await auth()).auth.exchangeCodeForSession(code);
    if (!error)
      return Response.redirect(siteURL("/website-auction/account?email=verified"), 303);
  }
  return Response.redirect(
    siteURL("/website-auction/account?signin=failed"),
    303,
  );
}
