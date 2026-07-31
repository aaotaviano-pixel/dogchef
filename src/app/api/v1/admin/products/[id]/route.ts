import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminRequest } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/http";
import { updateProductAvailability } from "@/lib/store";

const schema = z.object({ isAvailable: z.boolean() });

export async function PATCH(request: import("next/server").NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return unauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Dados inválidos.", 422);
  const { id } = await context.params;
  try {
    const product = await updateProductAvailability(id, parsed.data.isAvailable);
    return NextResponse.json({ product });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível atualizar o produto.", 422);
  }
}
