import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { apiError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return apiError("Verificação não autorizada.", 403);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.WHATSAPP_APP_SECRET;
  const signature = request.headers.get("x-hub-signature-256") || "";
  if (secret) {
    const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      return apiError("Assinatura do WhatsApp inválida.", 401);
    }
  }
  // DogChef only sends transactional status templates. Incoming messages are acknowledged
  // without retaining customer content or personal data.
  return NextResponse.json({ received: true });
}
