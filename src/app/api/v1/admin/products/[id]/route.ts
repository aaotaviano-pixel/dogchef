import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminRequest } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/http";
import { updateProductSettings } from "@/lib/store";

const schema = z.object({
  isAvailable: z.boolean().optional(),
  featured: z.boolean().optional(),
}).refine((value) => value.isAvailable !== undefined || value.featured !== undefined, {
  message: "Informe ao menos uma alteração.",
});

export async function PATCH(request: import("next/server").NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return unauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Dados inválidos.", 422);
  const { id } = await context.params;
  try {
    const product = await updateProductSettings(id, parsed.data);
    return NextResponse.json({ product });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível atualizar o produto.", 422);
  }
}
