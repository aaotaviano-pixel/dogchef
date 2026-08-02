import { NextRequest, NextResponse } from "next/server";

import { customerIdFromRequest } from "@/lib/customer-auth";
import { getCustomerAccount } from "@/lib/store";

export async function GET(request: NextRequest) {
  const customerId = customerIdFromRequest(request);
  const customer = customerId ? await getCustomerAccount(customerId) : null;
  return NextResponse.json({ customer }, { headers: { "Cache-Control": "no-store" } });
}
