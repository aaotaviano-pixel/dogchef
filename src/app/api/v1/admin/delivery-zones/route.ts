import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminRequest } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/http";
import { createDeliveryZoneOverride } from "@/lib/store";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  feeCents: z.number().int().min(0).max(100_000),
});

export async function POST(request: import("next/server").NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Confira o bairro e o valor da taxa.", 422);
  try {
    return NextResponse.json({ zone: await createDeliveryZoneOverride(parsed.data.name, parsed.data.feeCents) }, { status: 201 });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível cadastrar o bairro.", 422);
  }
}
