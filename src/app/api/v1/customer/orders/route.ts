import { NextRequest, NextResponse } from "next/server";

import { customerIdFromRequest } from "@/lib/customer-auth";
import { apiError } from "@/lib/http";
import { listCustomerOrders } from "@/lib/store";

export async function GET(request: NextRequest) {
  const customerId = customerIdFromRequest(request);
  if (!customerId) return apiError("Entre na sua conta para ver seus pedidos.", 401);
  const orders = await listCustomerOrders(customerId);
  return NextResponse.json({ orders }, { headers: { "Cache-Control": "no-store" } });
}
