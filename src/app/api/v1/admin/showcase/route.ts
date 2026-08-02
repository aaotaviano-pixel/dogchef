import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isAdminRequest } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/http";
import { updateShowcaseProducts } from "@/lib/store";

const schema = z.object({ productIds: z.array(z.string().min(1)).max(5) });

export async function PATCH(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Seleção do showcase inválida.", 422);
  try {
    await updateShowcaseProducts(parsed.data.productIds);
    return NextResponse.json({ productIds: parsed.data.productIds });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível salvar o showcase.", 422);
  }
}
