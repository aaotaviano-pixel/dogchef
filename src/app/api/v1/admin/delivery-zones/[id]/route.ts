import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminRequest } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/http";
import { deleteDeliveryZoneOverride, updateDeliveryZoneOverride } from "@/lib/store";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  feeCents: z.number().int().min(0).max(100_000),
});

export async function PATCH(request: import("next/server").NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return unauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Confira o bairro e o valor da taxa.", 422);
  const { id } = await context.params;
  try {
    return NextResponse.json({ zone: await updateDeliveryZoneOverride(id, parsed.data.name, parsed.data.feeCents) });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível atualizar o bairro.", 422);
  }
}

export async function DELETE(request: import("next/server").NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return unauthorized();
  const { id } = await context.params;
  try {
    return NextResponse.json(await deleteDeliveryZoneOverride(id));
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível excluir o bairro.", 422);
  }
}
