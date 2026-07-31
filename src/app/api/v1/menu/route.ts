import { NextResponse } from "next/server";

import { getCatalog } from "@/lib/store";

export async function GET() {
  const catalog = await getCatalog();
  return NextResponse.json(catalog, {
    headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" },
  });
}
