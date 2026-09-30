import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createCustomerSession, customerCookieOptions, isCustomerAuthConfigured, normalizeCustomerEmail } from "@/lib/customer-auth";
import { apiError } from "@/lib/http";
import { findCustomerByAuthUserId, findCustomerByEmail, findOrCreateGoogleCustomer } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";
import { enforceRegistrationLimits, registrationProtectionResponse } from "@/lib/registration-protection";
import { readRegistrationJson } from "@/lib/registration-request";
import { verifyRegistrationChallenge } from "@/lib/turnstile";

export const runtime = "nodejs";

const tokenSchema = z.object({ accessToken: z.string().min(20).max(4096), captchaToken: z.string().max(2048).optional() });

function safeDisplayName(value: unknown, email: string) {
  const supplied = typeof value === "string" ? value.trim() : "";
  const fallback = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  const name = supplied.length >= 2 ? supplied : fallback;
  return name.slice(0, 80) || "Cliente Dog do Chef";
}

export async function POST(request: NextRequest) {
  if (!isCustomerAuthConfigured()) return apiError("O acesso de clientes ainda não está configurado.", 503);
  const parsed = tokenSchema.safeParse(await readRegistrationJson(request));
  if (!parsed.success) return apiError("O acesso pelo Google não pôde ser validado.", 422);
  const db = getSupabase();
  if (!db) return apiError("O login com Google ainda não está configurado.", 503);

  const { data, error } = await db.auth.getUser(parsed.data.accessToken);
  const user = data.user;
  if (error || !user?.id || !user.email || !user.email_confirmed_at || !user.identities?.some((identity) => identity.provider === "google")) {
    console.warn("[DogChef Auth] GOOGLE_IDENTITY_REJECTED", {
      status: error?.status ?? 401,
      code: error?.code ?? "invalid_google_identity",
    });
    return apiError("Não foi possível confirmar sua conta Google.", 401);
  }

  try {
    const email = normalizeCustomerEmail(user.email);
    const existing = await findCustomerByAuthUserId(user.id) || await findCustomerByEmail(email);
    if (!existing) {
      try {
        // Returning customers do not consume new-account quotas or require a
        // registration challenge. Google proves ownership of their email.
        await verifyRegistrationChallenge(parsed.data.captchaToken, request.nextUrl.hostname);
        await enforceRegistrationLimits(request.headers, email);
      } catch (protectionError) { return registrationProtectionResponse(protectionError); }
    }
    const customer = await findOrCreateGoogleCustomer({
      authUserId: user.id,
      email,
      name: safeDisplayName(user.user_metadata?.full_name ?? user.user_metadata?.name, email),
    });
    const response = NextResponse.json({ customer }, { headers: { "Cache-Control": "private, no-store" } });
    response.cookies.set({ ...customerCookieOptions(), value: createCustomerSession(customer.id) });
    return response;
  } catch (requestError) {
    console.error("[DogChef Auth] GOOGLE_LOGIN_FAILED", {
      reason: requestError instanceof Error ? requestError.message : "unknown_error",
    });
    return apiError(requestError instanceof Error ? requestError.message : "Não foi possível acessar sua conta Google.", 422);
  }
}
