import { auth, siteURL } from "@/lib/auction/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    const { error } = await (await auth()).auth.exchangeCodeForSession(code);
    if (!error)
      return Response.redirect(siteURL("/admin/managed-hosting"), 303);
  }
  return Response.redirect(siteURL("/admin/managed-hosting/signin?status=failed"), 303);
}
