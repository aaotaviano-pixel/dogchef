import { NextResponse } from "next/server";

import { customerCookieOptions } from "@/lib/customer-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ ...customerCookieOptions(), value: "", maxAge: 0 });
  return response;
}
