import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminRequest } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/http";
import { updateDefaultDeliveryFee } from "@/lib/store";

const schema = z.object({ defaultDeliveryFeeCents: z.number().int().min(0).max(100_000) });

export async function PATCH(request: import("next/server").NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Informe uma taxa de entrega válida.", 422);
  try {
    return NextResponse.json(await updateDefaultDeliveryFee(parsed.data.defaultDeliveryFeeCents));
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível atualizar a taxa de entrega.", 422);
  }
}
