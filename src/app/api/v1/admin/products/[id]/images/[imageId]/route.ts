import { NextResponse, type NextRequest } from "next/server";

import { isAdminRequest } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/http";
import { deleteProductImage, setMainProductImage } from "@/lib/store";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; imageId: string }> }) {
  if (!isAdminRequest(request)) return unauthorized();
  const { id, imageId } = await context.params;
  try {
    await setMainProductImage(id, imageId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível definir a foto principal.", 422);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string; imageId: string }> }) {
  if (!isAdminRequest(request)) return unauthorized();
  const { id, imageId } = await context.params;
  try {
    await deleteProductImage(id, imageId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível remover a foto.", 422);
  }
}
