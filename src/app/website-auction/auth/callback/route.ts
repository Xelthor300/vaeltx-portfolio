import { auth, siteURL } from "@/lib/auction/server";

export const dynamic = "force-dynamic";

const ownerTargets = {
  "managed-hosting": "/admin/managed-hosting",
  "client-ops": "/admin/client-ops",
} as const;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawTarget = url.searchParams.get("target");
  const ownerPath = rawTarget && rawTarget in ownerTargets
    ? ownerTargets[rawTarget as keyof typeof ownerTargets]
    : null;

  if (process.env.AUCTION_PUBLIC_ENABLED !== "true" && !ownerPath)
    return new Response("Not found.", { status: 404 });

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await (await auth()).auth.exchangeCodeForSession(code);
    if (!error) {
      if (ownerPath) return Response.redirect(siteURL(ownerPath), 303);
      return Response.redirect(siteURL("/website-auction/account?email=verified"), 303);
    }
  }

  return Response.redirect(
    siteURL(
      ownerPath
        ? `${ownerPath}/signin?status=failed`
        : "/website-auction/account?signin=failed",
    ),
    303,
  );
}
