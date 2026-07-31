import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminRequest } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/http";
import { updateWorkingHours } from "@/lib/store";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, "Hora inválida.");
const schema = z.object({
  workingHours: z.array(z.object({
    weekday: z.number().int().min(0).max(6),
    slot: z.number().int().min(1).max(3),
    opensAt: time,
    closesAt: time,
    isClosed: z.boolean(),
  })).min(1).max(21),
});

export async function PATCH(request: import("next/server").NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Confira os horários informados.", 422);
  try {
    return NextResponse.json({ workingHours: await updateWorkingHours(parsed.data.workingHours) });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível salvar os horários.", 422);
  }
}
