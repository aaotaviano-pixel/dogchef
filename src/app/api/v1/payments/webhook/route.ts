import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { apiError } from "@/lib/http";
import { getMercadoPagoPayment, mercadoPagoStatus } from "@/lib/integrations/mercado-pago";
import { listOrders, updatePaymentStatus } from "@/lib/store";

export const runtime = "nodejs";

function signatureIsValid(request: Request, paymentId: string) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  const signature = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id") || "";
  if (!secret || !signature) return false;
  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, value] = part.trim().split("=", 2);
      return [key, value];
    }),
  );
  const timestamp = parts.ts;
  const supplied = parts.v1;
  if (!timestamp || !supplied) return false;
  const manifest = `id:${paymentId};request-id:${requestId};ts:${timestamp};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  if (expected.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const paymentId = body?.data?.id ? String(body.data.id) : body?.id ? String(body.id) : "";
  if (!paymentId) return apiError("Evento de pagamento inválido.", 400);
  if (!signatureIsValid(request, paymentId)) return apiError("Assinatura de webhook inválida.", 401);

  try {
    const payment = await getMercadoPagoPayment(paymentId);
    const orderId = typeof payment.external_reference === "string" ? payment.external_reference : "";
    const order = (await listOrders()).find((candidate) => candidate.id === orderId);
    if (!order) return apiError("Pedido de referência não encontrado.", 404);
    if (Number(payment.transaction_amount) !== order.quote.totalCents / 100) {
      return apiError("Valor do pagamento não confere com o pedido.", 422);
    }
    await updatePaymentStatus(order.id, mercadoPagoStatus(payment.status as string | undefined), paymentId);
    return NextResponse.json({ received: true });
  } catch {
    return apiError("Não foi possível confirmar o pagamento agora.", 502);
  }
}
