import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createCustomerSession, customerCookieOptions, isCustomerAuthConfigured, normalizeCustomerEmail } from "@/lib/customer-auth";
import { apiError } from "@/lib/http";
import { findOrCreateGoogleCustomer } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const tokenSchema = z.object({ accessToken: z.string().min(20).max(4096) });

function safeDisplayName(value: unknown, email: string) {
  const supplied = typeof value === "string" ? value.trim() : "";
  const fallback = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  const name = supplied.length >= 2 ? supplied : fallback;
  return name.slice(0, 80) || "Cliente Dog do Chef";
}

export async function POST(request: NextRequest) {
  if (!isCustomerAuthConfigured()) return apiError("O acesso de clientes ainda não está configurado.", 503);
  const parsed = tokenSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("O acesso pelo Google não pôde ser validado.", 422);
  const db = getSupabase();
  if (!db) return apiError("O login com Google ainda não está configurado.", 503);

  const { data, error } = await db.auth.getUser(parsed.data.accessToken);
  const user = data.user;
  if (error || !user?.id || !user.email || !user.email_confirmed_at) {
    return apiError("Não foi possível confirmar sua conta Google.", 401);
  }

  try {
    const email = normalizeCustomerEmail(user.email);
    const customer = await findOrCreateGoogleCustomer({
      authUserId: user.id,
      email,
      name: safeDisplayName(user.user_metadata?.full_name ?? user.user_metadata?.name, email),
    });
    const response = NextResponse.json({ customer }, { headers: { "Cache-Control": "private, no-store" } });
    response.cookies.set({ ...customerCookieOptions(), value: createCustomerSession(customer.id) });
    return response;
  } catch (requestError) {
    return apiError(requestError instanceof Error ? requestError.message : "Não foi possível acessar sua conta Google.", 422);
  }
}
