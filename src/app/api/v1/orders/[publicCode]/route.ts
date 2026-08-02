import { NextRequest, NextResponse } from "next/server";

import { customerIdFromRequest } from "@/lib/customer-auth";
import { apiError } from "@/lib/http";
import { getOrder } from "@/lib/store";

export async function GET(request: NextRequest, context: { params: Promise<{ publicCode: string }> }) {
  const { publicCode } = await context.params;
  const token = new URL(request.url).searchParams.get("token") || undefined;
  const order = await getOrder(publicCode.toUpperCase(), token, customerIdFromRequest(request) ?? undefined);
  if (!order) return apiError("Pedido não encontrado ou acesso expirado.", 404);
  return NextResponse.json({ order }, { headers: { "Cache-Control": "no-store" } });
}
