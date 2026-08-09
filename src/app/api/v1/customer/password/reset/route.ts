import { NextRequest, NextResponse } from "next/server";

import { hashCustomerPassword, isCustomerAuthConfigured, customerPasswordUpdateSchema } from "@/lib/customer-auth";
import { apiError } from "@/lib/http";
import { findCustomerByAuthUserId, updateCustomerPassword } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const parsed = customerPasswordUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("A senha precisa ter pelo menos 8 caracteres.", 422, parsed.error.issues.map((issue) => issue.message));
  if (!isCustomerAuthConfigured() || !getSupabase()) return apiError("A recuperação de senha ainda não está configurada.", 503);

  const db = getSupabase();
  if (!db) return apiError("A recuperação de senha ainda não está configurada.", 503);
  const { data, error } = await db.auth.getUser(parsed.data.accessToken);
  if (error || !data.user?.id) return apiError("Este link de recuperação expirou. Solicite outro.", 401);

  const account = await findCustomerByAuthUserId(data.user.id);
  if (!account) return apiError("Não foi possível localizar sua conta.", 404);
  await updateCustomerPassword(account.id, await hashCustomerPassword(parsed.data.password));
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
