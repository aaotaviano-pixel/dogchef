import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { OrderStatus } from "@/lib/types";

const transitions: Record<OrderStatus, OrderStatus[]> = {
  pending_approval: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["out_for_delivery", "delivered", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus, deliveryType: "delivery" | "pickup") {
  if (!transitions[from].includes(to)) return false;
  if (to === "out_for_delivery" && deliveryType !== "delivery") return false;
  if (from === "preparing" && to === "delivered" && deliveryType !== "pickup") return false;
  return true;
}

export function newOrderId() {
  return randomUUID();
}

export function newPublicCode() {
  return `DC-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function newTrackingToken() {
  return randomBytes(32).toString("base64url");
}

export function hashTrackingToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
