import assert from "node:assert/strict";
import test from "node:test";

import { buildTrackingUrl, classifyTrackingFailure, reconcileTrackingSnapshot } from "./order-tracking";

test("buildTrackingUrl keeps the secure tracking token in the customer link", () => {
  assert.equal(
    buildTrackingUrl("DC-A1B2C3", "token with / unsafe?chars"),
    "/pedido/DC-A1B2C3?token=token%20with%20%2F%20unsafe%3Fchars",
  );
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
