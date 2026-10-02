# VAELTX Portfolio

Next.js App Router portfolio for VAELTX and four clearly disclosed independent concept projects.

## Local setup

```sh
npm ci
cp .env.example .env.local
npm run dev
```

The portfolio renders without environment variables. Contact uses the official Resend SDK in the server API route. Save `RESEND_API_KEY` as a Secret in Vercel Production. Never put it in a `NEXT_PUBLIC_` variable or commit `.env.local`; environment inspection should list names and presence only.

The fixed recipient is `vaeltxn@gmail.com`; the visitor's email is Reply-To. The initial sender is `VAELTX <onboarding@resend.dev>`, which Resend permits only for the account owner's email. No verified VAELTX domain is assumed. If this recipient is not the account email, a verified sender domain is required. Without a key, the route truthfully returns 503. Provider failure returns 502 and preserves the visitor's fields. API acceptance is distinct from confirmed inbox receipt.

The route validates same-origin requests and Zod fields, rejects the honeypot and oversized payloads, and uses a bounded per-instance rate limiter. Successful receipt metadata and in-flight keys prevent local duplicates; Resend's idempotency key protects retries across server instances for its documented 24-hour window. No inquiry database, full-brief logs or durable content store is added. Per-instance rate limiting is not a global distributed rate-limit guarantee.

The four `/concepts/*` worlds are interface demonstrations. Northstar and Mira forms are local-only demos; Vault cart and wishlist stay in browser storage; checkout, account and order states do not accept payment, credentials or real orders. Axiom scenarios and every project are explicitly illustrative.

## Checks

```sh
npm run typecheck
npm run lint
npm run test
npm run build
```

## Deployment settings

Vercel builds with the `build` script. Set `NEXT_PUBLIC_SITE_URL` to the production origin. Keep `SITE_INDEXABLE=false` until real receipt is confirmed, final production QA passes and the owner explicitly approves indexation. Preview deployments remain noindex. `.env.example` lists the server-only Resend setting. Resend credentials need not be copied into Preview; UI and failure states can be verified there without sending email.
