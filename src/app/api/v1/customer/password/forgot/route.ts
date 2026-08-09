import { randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { customerPasswordResetRedirect, customerPasswordResetRequestSchema, isCustomerAuthConfigured, normalizeCustomerEmail } from "@/lib/customer-auth";
import { apiError } from "@/lib/http";
import { findCustomerByAuthUserId, findCustomerByEmail, linkCustomerAuthUser } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const GENERIC_MESSAGE = "Se o e-mail estiver cadastrado, enviaremos um link para redefinir sua senha.";

async function findAuthUserByEmail(email: string) {
  const db = getSupabase();
  if (!db) return null;
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) break;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const parsed = customerPasswordResetRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Informe um e-mail válido.", 422, parsed.error.issues.map((issue) => issue.message));
  if (!isCustomerAuthConfigured() || !getSupabase()) return apiError("A recuperação de senha ainda não está configurada.", 503);

  const email = normalizeCustomerEmail(parsed.data.email);
  const account = await findCustomerByEmail(email);
  if (!account) return NextResponse.json({ message: GENERIC_MESSAGE }, { headers: { "Cache-Control": "no-store" } });

  try {
    const db = getSupabase();
    if (!db) throw new Error("Supabase não configurado.");
    let authUserId = account.authUserId;
    if (!authUserId) {
      const created = await db.auth.admin.createUser({
        email: account.email,
        password: randomBytes(48).toString("base64url"),
        email_confirm: true,
        user_metadata: { dogchef_customer_id: account.id },
      });
      authUserId = created.data.user?.id;
      if (!authUserId) {
        const existing = await findAuthUserByEmail(account.email);
        authUserId = existing?.id;
      }
      if (!authUserId) throw new Error("Não foi possível preparar a recuperação.");
      const linkedAccount = await findCustomerByAuthUserId(authUserId);
      if (linkedAccount && linkedAccount.id !== account.id) throw new Error("Conta já vinculada.");
      await linkCustomerAuthUser(account.id, authUserId);
    }

    const { error } = await db.auth.resetPasswordForEmail(account.email, {
      redirectTo: customerPasswordResetRedirect(request.nextUrl.origin),
    });
    if (error) throw new Error("Não foi possível enviar a recuperação.");
  } catch {
    return apiError("Não foi possível iniciar a recuperação agora. Tente novamente em instantes.", 503);
  }

  return NextResponse.json({ message: GENERIC_MESSAGE }, { headers: { "Cache-Control": "no-store" } });
}
