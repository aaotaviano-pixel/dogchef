import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/http";
import { isPrintAgentRequest, printAgentToken } from "@/lib/print-agent-auth";
import { recordPrintAgentHeartbeat } from "@/lib/store";

const schema = z.object({
  agentId: z.string().trim().min(2).max(80),
  printers: z.array(z.object({
    id: z.string().trim().min(1).max(60),
    name: z.string().trim().min(1).max(120),
    status: z.enum(["ready", "offline", "unknown"]).optional(),
    isDefault: z.boolean().optional(),
  })).max(50).optional(),
});

export async function POST(request: import("next/server").NextRequest) {
  if (!isPrintAgentRequest(request)) return apiError("Agente não autorizado.", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Identificação do agente inválida.", 422);
  try {
    const result = await recordPrintAgentHeartbeat(parsed.data.agentId, parsed.data.printers ?? [], printAgentToken(request));
    return NextResponse.json({ ok: true, serverTime: new Date().toISOString(), printers: result.printers });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível atualizar o agente.", 500);
  }
}
