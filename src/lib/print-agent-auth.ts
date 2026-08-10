import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

export function isPrintAgentRequest(request: NextRequest) {
  const configured = process.env.PRINT_AGENT_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || !supplied || configured.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(configured), Buffer.from(supplied));
}

export function printAgentToken(request: NextRequest) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
}
