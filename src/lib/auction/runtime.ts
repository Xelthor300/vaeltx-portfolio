import { AUCTION_SLUG } from "./model";

// QA is a server-configured, protected preview. It cannot select production data.
export function auctionRuntime(
  env: Record<string, string | undefined> = process.env,
) {
  const slug = env.AUCTION_QA_SLUG;
  if (!slug)
    return {
      qa: false,
      slug: AUCTION_SLUG,
      environment: "production" as const,
    };
  if (
    env.VERCEL_ENV !== "preview" ||
    env.AUCTION_STRIPE_MODE !== "test" ||
    env.AUCTION_ALLOW_ACTIVATION !== "false" ||
    !/^qa-ui-[a-z0-9-]{8,80}$/.test(slug)
  )
    throw new Error(
      "Isolated auction QA requires a locked Stripe TEST preview.",
    );
  return { qa: true, slug, environment: "test" as const };
}

export function qaEmailAllowed(
  email: string,
  env: Record<string, string | undefined> = process.env,
) {
  if (!auctionRuntime(env).qa) return true;
  const allowed = (env.AUCTION_QA_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
