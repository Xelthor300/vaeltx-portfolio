import test from "node:test";
import assert from "node:assert/strict";
import { changeCartLine, removeCartLine } from "../src/lib/vault";

const lines = [
  { slug: "ember-keeper", condition: "Near mint", quantity: 1 },
  { slug: "ember-keeper", condition: "Light play", quantity: 3 },
  { slug: "moss-oracle", condition: "Near mint", quantity: 2 },
];

test("quantity and removal isolate a card's chosen condition", () => {
  assert.deepEqual(changeCartLine(lines, "ember-keeper", "Near mint", 2).map(x => x.quantity), [2, 3, 2]);
  assert.deepEqual(removeCartLine(lines, "ember-keeper", "Near mint"), lines.slice(1));
  assert.deepEqual(changeCartLine(lines, "ember-keeper", "Near mint", 0), lines.slice(1));
  assert.deepEqual(lines.map(x => x.quantity), [1, 3, 2]);
});

test("demo quantities reject invalid numbers and remain integral and bounded", () => {
  assert.equal(changeCartLine(lines, "ember-keeper", "Near mint", NaN), lines);
  assert.equal(changeCartLine(lines, "ember-keeper", "Near mint", 100)[0].quantity, 10);
  assert.equal(changeCartLine(lines, "ember-keeper", "Near mint", 2.8)[0].quantity, 2);
});
