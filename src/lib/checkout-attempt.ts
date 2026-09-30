import type { CheckoutInput } from "@/lib/types";

const STORAGE_KEY = "dogchef-checkout-attempt";

type CheckoutPayload = Omit<CheckoutInput, "clientReference">;
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function fingerprint(payload: CheckoutPayload) {
  const serialized = JSON.stringify(payload);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function validReference(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 100 && /^[a-zA-Z0-9._:-]+$/.test(value);
}

function newReference() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getCheckoutAttempt(storage: StorageLike, payload: CheckoutPayload) {
  const payloadFingerprint = fingerprint(payload);
  try {
    const stored = JSON.parse(storage.getItem(STORAGE_KEY) || "null") as { reference?: unknown; fingerprint?: unknown } | null;
    if (stored?.fingerprint === payloadFingerprint && validReference(stored.reference)) return stored.reference;
  } catch {
    // A malformed browser value is replaced with a fresh attempt below.
  }
  const reference = newReference();
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ reference, fingerprint: payloadFingerprint }));
  } catch {
    // Checkout must still work when browser storage is disabled or full.
  }
  return reference;
}

export function clearCheckoutAttempt(storage: StorageLike, reference: string) {
  try {
    const stored = JSON.parse(storage.getItem(STORAGE_KEY) || "null") as { reference?: unknown } | null;
    if (stored?.reference === reference) storage.removeItem(STORAGE_KEY);
  } catch { /* browser storage is optional */ }
}
