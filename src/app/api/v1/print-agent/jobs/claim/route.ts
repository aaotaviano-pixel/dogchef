import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/http";
import { isPrintAgentRequest } from "@/lib/print-agent-auth";
import { claimPrintJobs } from "@/lib/store";

const schema = z.object({ agentId: z.string().trim().min(2).max(80), limit: z.number().int().min(1).max(3).optional() });

export async function POST(request: import("next/server").NextRequest) {
  if (!isPrintAgentRequest(request)) return apiError("Agente não autorizado.", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Solicitação inválida.", 422);
  try {
    return NextResponse.json({ jobs: await claimPrintJobs(parsed.data.agentId, parsed.data.limit ?? 1) });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Falha na fila de impressão.", 500);
  }
}
