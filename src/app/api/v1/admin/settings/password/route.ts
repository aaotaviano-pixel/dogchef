import type { NextRequest } from "next/server";
import { z } from "zod";

import { changeAdminPassword, isAdminRequest } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/http";

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12, "A nova senha precisa ter pelo menos 12 caracteres.").max(200),
  confirmation: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Confira os campos da nova senha.", 422, parsed.error.issues.map((issue) => issue.message));
  if (parsed.data.newPassword !== parsed.data.confirmation) return apiError("A confirmação da nova senha não confere.", 422);
  try {
    await changeAdminPassword(parsed.data.currentPassword, parsed.data.newPassword);
    return Response.json({ ok: true, message: "Senha administrativa atualizada." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível atualizar a senha administrativa.";
    if (message.includes("senha atual")) return apiError(message, 401);
    if (message.includes("migração") || message.includes("persistência")) return apiError(message, 503);
    return apiError("Não foi possível atualizar a senha administrativa.", 500);
  }
}
