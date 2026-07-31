import { NextResponse } from "next/server";

import { apiError } from "@/lib/http";
import { isPrintAgentRequest } from "@/lib/print-agent-auth";

export async function POST(request: import("next/server").NextRequest) {
  if (!isPrintAgentRequest(request)) return apiError("Agente não autorizado.", 401);
  return NextResponse.json({ ok: true, serverTime: new Date().toISOString() });
}
