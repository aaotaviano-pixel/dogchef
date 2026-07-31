import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/http";
import { isPrintAgentRequest } from "@/lib/print-agent-auth";
import { completePrintJob } from "@/lib/store";

const schema = z.object({
  leaseToken: z.string().min(20).max(200),
  result: z.enum(["printed", "failed"]),
  error: z.string().max(500).optional(),
});

export async function POST(request: import("next/server").NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isPrintAgentRequest(request)) return apiError("Agente não autorizado.", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Resultado inválido.", 422);
  const { id } = await context.params;
  try {
    return NextResponse.json(await completePrintJob(id, parsed.data.leaseToken, parsed.data.result, parsed.data.error));
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Falha ao finalizar impressão.", 409);
  }
}
