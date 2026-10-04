# Meta Pixel implementation

Pixel: `1716784306059756`. Only `PageView` is emitted by the application.

## Consent decision

The existing English-language public portfolio had no advertising consent mechanism or explicit restriction to a jurisdiction. Actual visitor jurisdictions are unknown. A blanket assumption that pre-consent advertising tracking is appropriate is unsupported. Use a conservative global opt-in, including for potential UK/EEA visitors, rather than IP geolocation or unconditional tracking. This is a technical safeguard, not a legal compliance guarantee.

Basis: [ICO advertising guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/how-do-the-rules-apply-to-online-advertising/) requires consent for advertising storage/access technologies; [EDPB technical scope guidance](https://www.edpb.europa.eu/system/files/documents/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf) addresses tracking pixels.

The optional, nonmodal banner has equal accept/reject controls. No Meta script, initialization, cookies or PageViews are requested by the application before acceptance. The first-party `vaeltx_marketing_v1` preference cookie persists for 180 days (Secure on HTTPS, SameSite=Lax, Path=/). Privacy contains disclosure and controls to change/withdraw. Withdrawal issues Meta's revoke command immediately, stops application PageViews, and removes accessible `_fbp` / `_fbc` cookies. The script already downloaded cannot be unloaded; data already sent cannot be recalled. Consent choice is not sent to the contact handler or used to restrict necessary functionality.

## App Router behavior

`MetaPixel` is mounted once in the root layout under Suspense. `next/script` loads the external library once after consent. The typed controller installs the standard queue, disables automatic event detection (`autoConfig=false`), initializes once, and queues the first PageView. `usePathname` sends one event per pathname transition, including browser back/forward. Query-only and hash-only changes are not distinct portfolio page navigations. Repeated effects/rerenders do not send events. Acceptance after browsing counts only the current page; declined page history is not backfilled. No advanced matching data, form values, extra events, new environment variables or secrets are supplied.

Meta's library inherently receives URL/browser/network information. Keep personal information out of page URLs. Current contact form data stays in the POST body and is not passed to the Pixel.

## Noscript

The global invisible 1×1 image requests `/api/meta-pixel`. With prior granted consent this uncached endpoint redirects to exactly `https://www.facebook.com/tr?id=1716784306059756&ev=PageView&noscript=1`; otherwise it returns a local transparent GIF without contacting Meta. This deliberate same-origin indirection reconciles the requested fallback with consent and preserves static page generation. With JavaScript off and no prior acceptance, tracking stays disabled. No JavaScript-disabled consent capture is added.

## Validation

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Unit checks cover deny-by-default, queue dispatch, repeat-effect deduplication, route/back navigation, revoke/regrant, cookie parsing and uncached noscript allow/deny behavior. Browser evidence and deployment results are recorded separately; passing unit checks alone does not prove network delivery or receipt in Meta Events Manager.
