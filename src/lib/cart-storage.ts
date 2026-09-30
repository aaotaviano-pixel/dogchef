import type { CartLine } from "@/lib/types";

export function parseStoredCart(value: string | null): CartLine[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 30).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as Record<string, unknown>;
      if (
        typeof candidate.key !== "string" || !candidate.key || candidate.key.length > 120 ||
        typeof candidate.productId !== "string" || !candidate.productId || candidate.productId.length > 120 ||
        !Number.isInteger(candidate.quantity) || Number(candidate.quantity) < 1 || Number(candidate.quantity) > 20 ||
        !Array.isArray(candidate.optionIds) || candidate.optionIds.length > 10 ||
        !candidate.optionIds.every((option) => typeof option === "string" && option.length > 0 && option.length <= 120) ||
        (candidate.note !== undefined && (typeof candidate.note !== "string" || candidate.note.length > 240))
      ) return [];
      return [{
        key: candidate.key,
        productId: candidate.productId,
        quantity: Number(candidate.quantity),
        optionIds: candidate.optionIds as string[],
        note: candidate.note as string | undefined,
      }];
    });
  } catch {
    return [];
  }
}
