import assert from "node:assert/strict";
import test from "node:test";

import { buildTrackingUrl, classifyTrackingFailure, reconcileOrderCollection, reconcileTrackingSnapshot } from "./order-tracking";

test("buildTrackingUrl keeps the secure tracking token in the customer link", () => {
  assert.equal(
    buildTrackingUrl("DC-A1B2C3", "token with / unsafe?chars"),
    "/pedido/DC-A1B2C3?token=token%20with%20%2F%20unsafe%3Fchars",
  );
});

test("buildTrackingUrl can resume an idempotent checkout through the customer session", () => {
  assert.equal(buildTrackingUrl("DC-A1B2C3"), "/pedido/DC-A1B2C3");
});

test("reconcileTrackingSnapshot never lets a late response move progress backwards", () => {
  const preparing = { version: 3, status: "preparing" };
  const lateConfirmed = { version: 2, status: "confirmed" };

  assert.equal(reconcileTrackingSnapshot(preparing, lateConfirmed), preparing);
});

test("reconcileTrackingSnapshot accepts the same or a newer order version", () => {
  const confirmed = { version: 2, status: "confirmed" };
  const preparing = { version: 3, status: "preparing" };

  assert.equal(reconcileTrackingSnapshot(confirmed, preparing), preparing);
  assert.equal(reconcileTrackingSnapshot(null, confirmed), confirmed);
});

test("classifyTrackingFailure keeps an already loaded receipt visible", () => {
  assert.equal(classifyTrackingFailure(true, 404), "retry");
  assert.equal(classifyTrackingFailure(true, 500), "retry");
  assert.equal(classifyTrackingFailure(true), "retry");
});

test("classifyTrackingFailure only treats initial access denial as fatal", () => {
  assert.equal(classifyTrackingFailure(false, 401), "fatal");
  assert.equal(classifyTrackingFailure(false, 404), "fatal");
  assert.equal(classifyTrackingFailure(false, 500), "retry");
});

test("order collections keep newer status snapshots during overlapping refreshes", () => {
  const current = [{ id: "order-1", version: 4, status: "preparing" }];
  const delayed = [{ id: "order-1", version: 3, status: "confirmed" }, { id: "order-2", version: 1, status: "pending" }];
  assert.deepEqual(reconcileOrderCollection(current, delayed), [current[0], delayed[1]]);
});
