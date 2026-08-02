import { NextResponse, type NextRequest } from "next/server";

import { isAdminRequest } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/http";
import { parseImageFormData } from "@/lib/product-admin";
import { addProductImages, getCatalog } from "@/lib/store";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return unauthorized();
  const { id } = await context.params;
  try {
    const files = parseImageFormData(await request.formData());
    await addProductImages(id, files);
    const product = (await getCatalog()).products.find((candidate) => candidate.id === id);
    return NextResponse.json({ product });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível enviar as fotos.", 422);
  }
}
