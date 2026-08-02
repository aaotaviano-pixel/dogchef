import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/http";
import { requeuePrintJob } from "@/lib/store";

export async function POST(request: import("next/server").NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return unauthorized();
  const { id } = await context.params;
  try {
    return NextResponse.json(await requeuePrintJob(id));
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível reenviar o pedido para impressão.", 422);
  }
}
