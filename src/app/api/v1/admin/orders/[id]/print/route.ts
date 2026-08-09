import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminRequest } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/http";
import { requeuePrintJob } from "@/lib/store";

const schema = z.object({ printerId: z.string().trim().min(1).max(60).optional() });

export async function POST(request: import("next/server").NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return unauthorized();
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return apiError("Impressora inválida.", 422);
  try {
    return NextResponse.json(await requeuePrintJob(id, parsed.data.printerId));
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível reenviar o pedido para impressão.", 422);
  }
}
