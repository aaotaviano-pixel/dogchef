import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminRequest } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/http";
import { updateStoreAcceptingOrders } from "@/lib/store";

const schema = z.object({ acceptingOrders: z.boolean() });

export async function PATCH(request: import("next/server").NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Dados inválidos.", 422);
  try {
    return NextResponse.json(await updateStoreAcceptingOrders(parsed.data.acceptingOrders));
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível atualizar a loja.", 422);
  }
}
