import { NextRequest, NextResponse } from "next/server";

import { createCustomerSession, customerCookieOptions, customerLoginSchema, isCustomerAuthConfigured, normalizeCustomerEmail, verifyCustomerPassword } from "@/lib/customer-auth";
import { apiError } from "@/lib/http";
import { findCustomerByEmail, getCustomerAccount } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isCustomerAuthConfigured()) return apiError("O acesso de clientes ainda não está configurado.", 503);
  const parsed = customerLoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Confira seu e-mail e senha.", 422, parsed.error.issues.map((issue) => issue.message));
  const account = await findCustomerByEmail(normalizeCustomerEmail(parsed.data.email));
  if (account && !account.passwordHash) {
    return apiError("Esta conta usa o acesso pelo Google.", 401);
  }
  if (!account || !(await verifyCustomerPassword(parsed.data.password, account.passwordHash))) {
    return apiError("E-mail ou senha incorretos.", 401);
  }
  const customer = await getCustomerAccount(account.id);
  if (!customer) return apiError("Não foi possível acessar sua conta.", 401);
  const response = NextResponse.json({ customer }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set({ ...customerCookieOptions(), value: createCustomerSession(customer.id) });
  return response;
}
