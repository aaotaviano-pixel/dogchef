import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/http";
import { resetDashboardMetrics } from "@/lib/store";

export async function POST(request: import("next/server").NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    return NextResponse.json(await resetDashboardMetrics());
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível zerar os indicadores.", 500);
  }
}
