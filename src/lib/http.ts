import { NextResponse } from "next/server";

export function apiError(message: string, status = 400, details?: string[]) {
  return NextResponse.json({ error: message, details }, { status });
}

export function unauthorized() {
  return apiError("Acesso administrativo necessário.", 401);
}
