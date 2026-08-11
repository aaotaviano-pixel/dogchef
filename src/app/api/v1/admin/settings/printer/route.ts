import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminRequest } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/http";
import { createPrintTestJob, updateSelectedPrinter } from "@/lib/store";

const schema = z.object({ selectedPrinterId: z.string().trim().min(1).max(60) });

export async function PATCH(request: import("next/server").NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Selecione uma impressora válida.", 422);
  try {
    return NextResponse.json(await updateSelectedPrinter(parsed.data.selectedPrinterId));
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível selecionar a impressora.", 422);
  }
}

export async function POST(request: import("next/server").NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const parsed = schema.partial().safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return apiError("Seleção de impressora inválida.", 422);
  try {
    return NextResponse.json(await createPrintTestJob(parsed.data.selectedPrinterId));
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível criar o teste de impressão.", 409);
  }
}
