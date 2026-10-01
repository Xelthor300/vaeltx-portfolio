# VAELTX Portfolio

Next.js App Router portfolio for VAELTX and four clearly disclosed independent concept projects.

## Local setup

```sh
npm ci
cp .env.example .env.local
npm run dev
```

The portfolio renders without environment variables. The parent contact form validates on the client and server, but delivery remains disabled until an owner configures a compatible HTTPS email-delivery endpoint, its server-only bearer token, and a verified sender address. `CONTACT_TO_EMAIL` defaults to `vaeltxn@gmail.com`. Never put delivery credentials in a `NEXT_PUBLIC_` variable or commit `.env.local`.

The endpoint receives a JSON object with `to`, `from`, `replyTo`, `subject`, and `text`, plus `Authorization: Bearer <token>` and an `Idempotency-Key` header. It must return a successful 2xx response only after accepting the email for delivery. Configure the provider’s data processing and retention details before enabling the form in production.

The four `/concepts/*` worlds are interface demonstrations. Northstar and Mira forms are local-only demos; Vault cart and wishlist stay in browser storage; checkout, account and order states do not accept payment, credentials or real orders. Axiom scenarios and every project are explicitly illustrative.

## Checks

```sh
npm run typecheck
npm run lint
npm run test
npm run build
```

## Deployment settings

Vercel builds with the `build` script. Set `NEXT_PUBLIC_SITE_URL` to the production origin. Keep `SITE_INDEXABLE=false` until the owner confirms inquiry delivery and production content. Preview deployments are always excluded from the sitemap and indexing. The contact provider contract and required values are documented in `.env.example`; no provider has been selected in this repository.
