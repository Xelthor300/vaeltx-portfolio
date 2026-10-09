import assert from "node:assert/strict";
import test from "node:test";
import { conceptRoutes, parentRoutes, projects } from "../src/lib/content";
import { contactSchema } from "../src/lib/contact";
import { vaultProducts } from "../src/lib/vault";

test("parent route inventory covers every requested public route", () => {
  assert.deepEqual(parentRoutes, [
    "work", "work/orynt-ai", "work/aster-form", "work/northstar-roofing", "work/mira-atelier", "work/axiom-strategy", "work/vault-tcg",
    "services", "process", "standards", "about", "contact", "privacy",
  ]);
  assert.equal(projects.length, 6);
  assert.equal(projects[0].slug, "orynt-ai");
  assert.equal(projects[0].route, "https://vaeltx-orynt-ai-concept.vercel.app/");
  assert.equal(projects[1].route, "https://asterandform.vercel.app/preview");
  assert.match(projects[1].status, /Full-stack certification pending/);
  assert.deepEqual(projects.slice(2).map(project => project.slug), ["northstar-roofing", "mira-atelier", "axiom-strategy", "vault-tcg"]);
});

test("four concept route trees are unique and include their required commerce and content patterns", () => {
  assert.deepEqual(Object.keys(conceptRoutes).sort(), ["axiom-strategy", "mira-atelier", "northstar-roofing", "vault-tcg"]);
  for (const [name, routes] of Object.entries(conceptRoutes)) {
    const paths = routes.map(route => route.path);
    assert.equal(new Set(paths).size, paths.length, `${name} has duplicate paths`);
    assert.ok(paths.includes(""), `${name} has no home route`);
  }
  const all = (name: keyof typeof conceptRoutes) => conceptRoutes[name].map(route => route.path);
  assert.ok(all("northstar-roofing").includes("service-areas/sample-city"));
  assert.ok(all("mira-atelier").includes("work/midnight-garden"));
  assert.ok(all("axiom-strategy").includes("insights/decision-models"));
  assert.ok(all("vault-tcg").includes("account/wishlist"));
  assert.ok(all("vault-tcg").includes("checkout-demo"));
  assert.deepEqual(
    conceptRoutes["vault-tcg"].filter(route => route.kind === "product").map(route => route.path).sort(),
    vaultProducts.map(product => `cards/${product.slug}`).sort(),
  );
});

test("contact validation accepts the brief shape and rejects invalid fields and the honeypot", () => {
  const valid = { name: "Alex Example", email: "alex@example.com", need: "New website", detail: "A clear description of the change needed.", website: "" };
  assert.equal(contactSchema.safeParse(valid).success, true);
  assert.equal(contactSchema.safeParse({ ...valid, email: "nope" }).success, false);
  assert.equal(contactSchema.safeParse({ ...valid, website: "bot-filled" }).success, false);
  assert.equal(contactSchema.safeParse({ ...valid, detail: "short" }).success, false);
});
