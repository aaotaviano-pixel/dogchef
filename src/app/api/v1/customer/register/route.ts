import { NextRequest, NextResponse } from "next/server";

import { createCustomerSession, customerCookieOptions, customerRegistrationSchema, hashCustomerPassword, isCustomerAuthConfigured, normalizeCustomerEmail, normalizeCustomerPhone } from "@/lib/customer-auth";
import { apiError } from "@/lib/http";
import { createCustomerAccount, findCustomerByEmail } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isCustomerAuthConfigured()) return apiError("O acesso de clientes ainda não está configurado.", 503);
  const parsed = customerRegistrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Confira os dados da sua conta.", 422, parsed.error.issues.map((issue) => issue.message));
  const email = normalizeCustomerEmail(parsed.data.email);
  if (await findCustomerByEmail(email)) return apiError("Já existe uma conta com este e-mail.", 409);
  try {
    const customer = await createCustomerAccount({
      name: parsed.data.name.trim(),
      phone: normalizeCustomerPhone(parsed.data.phone),
      email,
      passwordHash: await hashCustomerPassword(parsed.data.password),
    });
    const response = NextResponse.json({ customer }, { status: 201, headers: { "Cache-Control": "no-store" } });
    response.cookies.set({ ...customerCookieOptions(), value: createCustomerSession(customer.id) });
    return response;
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível criar sua conta.", 422);
  }
}
