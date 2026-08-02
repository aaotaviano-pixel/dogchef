import { NextResponse, type NextRequest } from "next/server";

import { isAdminRequest } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/http";
import { parseProductFormData } from "@/lib/product-admin";
import { addProductImages, createProduct, getCatalog } from "@/lib/store";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    const { input, files } = parseProductFormData(await request.formData());
    const created = await createProduct(input);
    let warning = "";
    if (files.length) {
      try {
        await addProductImages(created.id, files);
      } catch (error) {
        warning = error instanceof Error ? `Produto salvo. ${error.message}` : "Produto salvo, mas as fotos não foram enviadas.";
      }
    }
    const product = (await getCatalog()).products.find((candidate) => candidate.id === created.id) ?? created;
    return NextResponse.json({ product, warning }, { status: 201 });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível cadastrar o produto.", 422);
  }
}
