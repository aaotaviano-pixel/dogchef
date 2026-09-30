import assert from "node:assert/strict";
import test from "node:test";

import { clearCheckoutAttempt, getCheckoutAttempt } from "./checkout-attempt";

function fakeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

const payload = {
  customer: { name: "Cliente", phone: "35999999999", email: "cliente@example.com" },
  deliveryType: "pickup" as const,
  paymentMethod: "cash" as const,
  items: [{ key: "item-1", productId: "dog-1", quantity: 1, optionIds: [] }],
};

test("checkout retries reuse the same reference for the same payload", () => {
  const storage = fakeStorage();
  const first = getCheckoutAttempt(storage, payload);
  const retry = getCheckoutAttempt(storage, payload);
  assert.equal(retry, first);
});

test("checkout changes start a new attempt and completed attempts are cleared safely", () => {
  const storage = fakeStorage();
  const first = getCheckoutAttempt(storage, payload);
  const changed = getCheckoutAttempt(storage, { ...payload, items: [{ ...payload.items[0], quantity: 2 }] });
  assert.notEqual(changed, first);
  clearCheckoutAttempt(storage, first);
  assert.equal(getCheckoutAttempt(storage, { ...payload, items: [{ ...payload.items[0], quantity: 2 }] }), changed);
  clearCheckoutAttempt(storage, changed);
  assert.notEqual(getCheckoutAttempt(storage, { ...payload, items: [{ ...payload.items[0], quantity: 2 }] }), changed);
});

test("checkout remains usable when browser storage is unavailable", () => {
  const blockedStorage = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  assert.doesNotThrow(() => getCheckoutAttempt(blockedStorage, payload));
  assert.doesNotThrow(() => clearCheckoutAttempt(blockedStorage, "attempt-1"));
});
