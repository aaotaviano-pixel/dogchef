import { NextResponse } from "next/server";
import { z } from "zod";

import { adminCookieOptions, createAdminSession, isAdminConfigured, verifyAdminPassword } from "@/lib/auth";
import { apiError } from "@/lib/http";

const schema = z.object({ password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  if (!isAdminConfigured()) return apiError("Defina ADMIN_PASSWORD e ADMIN_SESSION_SECRET antes de ativar o painel.", 503);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !(await verifyAdminPassword(parsed.data.password))) return apiError("Senha inválida.", 401);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ ...adminCookieOptions(), value: createAdminSession() });
  return response;
}
