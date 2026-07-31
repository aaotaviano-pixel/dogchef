import { NextResponse } from "next/server";

import { checkoutSchema } from "@/lib/checkout";
import { createPixPayment } from "@/lib/integrations/mercado-pago";
import { apiError } from "@/lib/http";
import { createOrder, savePixPayment, updatePaymentStatus } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Confira os dados do pedido.", 422, parsed.error.issues.map((issue) => issue.message));
  }

  try {
    const { order, trackingToken } = await createOrder(parsed.data);
    let paymentError: string | undefined;
    if (order.paymentMethod === "pix") {
      try {
        const pix = await createPixPayment(order);
        if ("configurationRequired" in pix) {
          order.payment = { configurationRequired: true };
        } else {
          order.payment = {
            pixCopyPaste: pix.pixCopyPaste,
            qrCodeBase64: pix.qrCodeBase64,
            expiresAt: pix.expiresAt,
          };
          order.paymentStatus = pix.paymentStatus;
          await savePixPayment(order.id, order.payment, pix.providerPaymentId);
          await updatePaymentStatus(order.id, pix.paymentStatus, pix.providerPaymentId);
        }
      } catch {
        order.paymentStatus = "failed";
        paymentError = "O pedido foi registrado, mas não foi possível gerar o Pix. Tente novamente pelo acompanhamento ou fale com a loja.";
        await updatePaymentStatus(order.id, "failed").catch(() => undefined);
      }
    }
    return NextResponse.json(
      {
        order,
        trackingToken,
        trackingUrl: `/pedido/${order.publicCode}?token=${encodeURIComponent(trackingToken)}`,
        paymentError,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível criar o pedido.", 422);
  }
}
