import { NextRequest, NextResponse } from "next/server";

import { customerIdFromRequest, customerProfileSchema, normalizeCustomerPhone } from "@/lib/customer-auth";
import { apiError } from "@/lib/http";
import { updateCustomerPhone } from "@/lib/store";

export async function PATCH(request: NextRequest) {
  const customerId = customerIdFromRequest(request);
  if (!customerId) return apiError("Entre na sua conta para atualizar seus dados.", 401);
  const parsed = customerProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Informe um telefone válido.", 422, parsed.error.issues.map((issue) => issue.message));
  try {
    const customer = await updateCustomerPhone(customerId, normalizeCustomerPhone(parsed.data.phone));
    return NextResponse.json({ customer }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (requestError) {
    return apiError(requestError instanceof Error ? requestError.message : "Não foi possível salvar seus dados.", 422);
  }
}
