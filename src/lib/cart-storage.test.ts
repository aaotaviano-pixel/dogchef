import assert from "node:assert/strict";
import test from "node:test";

import { parseStoredCart } from "./cart-storage";

test("stored cart accepts valid lines and rejects corrupted browser data", () => {
  const valid = [{ key: "line-1", productId: "dog-1", quantity: 2, optionIds: ["extra-1"], note: "sem milho" }];
  assert.deepEqual(parseStoredCart(JSON.stringify(valid)), valid);
  assert.deepEqual(parseStoredCart("not-json"), []);
  assert.deepEqual(parseStoredCart(JSON.stringify({ items: valid })), []);
  assert.deepEqual(parseStoredCart(JSON.stringify([{ ...valid[0], quantity: 999 }])), []);
});

test("stored cart caps restored lines to the server checkout limit", () => {
  const lines = Array.from({ length: 40 }, (_, index) => ({ key: `line-${index}`, productId: "dog-1", quantity: 1, optionIds: [] }));
  assert.equal(parseStoredCart(JSON.stringify(lines)).length, 30);
});
