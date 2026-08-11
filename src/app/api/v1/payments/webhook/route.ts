import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { apiError } from "@/lib/http";
import { getMercadoPagoPayment, mercadoPagoStatus } from "@/lib/integrations/mercado-pago";
import { completePaymentWebhookDelivery, failPaymentWebhookDelivery, getOrderById, registerPaymentWebhookDelivery, updatePaymentStatus } from "@/lib/store";

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
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 5 * 60) return false;
  const manifest = `id:${paymentId};request-id:${requestId};ts:${timestamp};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  if (expected.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  let body: { data?: { id?: unknown }; id?: unknown } | null;
  try {
    body = JSON.parse(rawBody || "null") as { data?: { id?: unknown }; id?: unknown } | null;
  } catch {
    return apiError("Corpo de webhook inválido.", 400);
  }
  const paymentId = body?.data?.id ? String(body.data.id) : body?.id ? String(body.id) : "";
  if (!paymentId) return apiError("Evento de pagamento inválido.", 400);
  if (!signatureIsValid(request, paymentId)) return apiError("Assinatura de webhook inválida.", 401);

  let deliveryId = "";
  try {
    const delivery = await registerPaymentWebhookDelivery({
      provider: "mercado_pago",
      requestId: request.headers.get("x-request-id")?.trim() || undefined,
      paymentId,
      payloadHash: createHash("sha256").update(rawBody).digest("hex"),
    });
    deliveryId = delivery.id ?? "";
    if (delivery.duplicate && delivery.processedAt) return NextResponse.json({ received: true, duplicate: true });

    const payment = await getMercadoPagoPayment(paymentId);
    const orderId = typeof payment.external_reference === "string" ? payment.external_reference : "";
    const order = orderId ? await getOrderById(orderId) : null;
    if (!order) return apiError("Pedido de referência não encontrado.", 404);
    if (order.paymentMethod !== "pix") return apiError("O pagamento não pertence a um pedido Pix.", 422);
    if (String(payment.currency_id ?? "BRL").toUpperCase() !== "BRL" || Number(payment.transaction_amount) !== order.quote.totalCents / 100) {
      return apiError("Valor do pagamento não confere com o pedido.", 422);
    }
    await updatePaymentStatus(order.id, mercadoPagoStatus(payment.status as string | undefined), paymentId);
    await completePaymentWebhookDelivery(deliveryId);
    return NextResponse.json({ received: true });
  } catch (error) {
    await failPaymentWebhookDelivery(deliveryId, error instanceof Error ? error.message : "Falha ao processar webhook.");
    return apiError("Não foi possível confirmar o pagamento agora.", 502);
  }
}
