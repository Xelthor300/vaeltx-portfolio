import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/meta-pixel/route";
import { createMetaPixelController, MARKETING_COOKIE, META_PIXEL_ID, META_PIXEL_NOSCRIPT, parseMarketingConsent, type PixelHost } from "../src/lib/meta-pixel";

test("no consent or rejected consent never initializes Meta", () => {
  const host: PixelHost = {};
  const pixel = createMetaPixelController(host);
  pixel.pageView("/", null);
  pixel.pageView("/work", "denied");
  assert.equal(host.fbq, undefined);
});

test("initial / repeated effects / SPA routes / back navigation initialize once and count once per path transition", () => {
  const host: PixelHost = {};
  const pixel = createMetaPixelController(host);
  for (const path of ["/", "/", "/work", "/work", "/contact", "/concepts/northstar-roofing", "/concepts/mira-atelier", "/contact"]) pixel.pageView(path, "granted");
  const commands = host.fbq!.queue;
  assert.deepEqual(commands.filter(command => command[0] === "init"), [["init", META_PIXEL_ID]]);
  assert.equal(commands.filter(command => command[0] === "track").length, 6);
  assert.deepEqual(commands[0], ["set", "autoConfig", false, META_PIXEL_ID]);
  assert.equal(host._fbq, host.fbq);
  assert.equal(host.fbq!.push, host.fbq);
  assert.equal(host.fbq!.disablePushState, true);
  assert.equal(host.fbq!.allowDuplicatePageViews, true);
  // After the external library attaches, commands dispatch directly.
  const delivered: unknown[] = [];
  host.fbq!.callMethod = function (...args) {
    assert.equal(this, host.fbq);
    assert.equal(this.allowDuplicatePageViews, true);
    delivered.push(args);
  };
  pixel.pageView("/work", "granted");
  assert.deepEqual(delivered, [["track", "PageView"]]);
});

test("withdrawal stops events, regrant records current page without reinitializing or backfilling declined routes", () => {
  const host: PixelHost = {};
  const pixel = createMetaPixelController(host);
  pixel.pageView("/", "granted");
  pixel.pageView("/privacy", "denied");
  pixel.pageView("/contact", "denied");
  pixel.pageView("/contact", "granted");
  pixel.pageView("/contact", "granted");
  assert.deepEqual(host.fbq!.queue, [
    ["set", "autoConfig", false, META_PIXEL_ID], ["init", META_PIXEL_ID],
    ["consent", "grant"], ["track", "PageView"], ["consent", "revoke"],
    ["consent", "grant"], ["track", "PageView"],
  ]);
});

test("versioned consent fails closed for missing, malformed and lookalike cookies", () => {
  for (const cookie of ["", `${MARKETING_COOKIE}=yes`, `other_${MARKETING_COOKIE}=granted`]) assert.equal(parseMarketingConsent(cookie), null);
  assert.equal(parseMarketingConsent(`other=1; ${MARKETING_COOKIE}=granted; last=2`), "granted");
  assert.equal(parseMarketingConsent(`${MARKETING_COOKIE}=denied`), "denied");
});

test("noscript fallback only redirects to the exact Meta URL with prior consent and is never shared-cacheable", async () => {
  for (const value of [undefined, "denied", "invalid", "granted"]) {
    const response = GET(new NextRequest("https://vaeltx-portfolio.vercel.app/api/meta-pixel", { headers: value ? { cookie: `${MARKETING_COOKIE}=${value}` } : {} }));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("vary"), "Cookie");
    if (value === "granted") {
      assert.equal(response.status, 302);
      assert.equal(response.headers.get("location"), META_PIXEL_NOSCRIPT);
    } else {
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("location"), null);
      assert.equal(response.headers.get("content-type"), "image/gif");
      const bytes = new Uint8Array(await response.arrayBuffer());
      assert.deepEqual([...bytes.slice(6, 10)], [1, 0, 1, 0]);
    }
  }
});
