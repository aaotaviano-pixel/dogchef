import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminRequest } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/http";
import { transitionOrder } from "@/lib/store";

const schema = z.object({
  status: z.enum(["pending_approval", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]),
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().max(240).optional(),
});

export async function POST(request: import("next/server").NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return unauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Dados de status inválidos.", 422);
  const { id } = await context.params;
  try {
    const order = await transitionOrder(id, parsed.data.status, parsed.data.expectedVersion, parsed.data.reason);
    return NextResponse.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível atualizar o pedido.";
    return apiError(message, message.includes("atualizado") || message.includes("Conflito") ? 409 : 422);
  }
}
