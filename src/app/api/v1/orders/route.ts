import { NextRequest, NextResponse } from "next/server";

import { checkoutSchema } from "@/lib/checkout";
import { customerIdFromRequest } from "@/lib/customer-auth";
import { createPixPayment } from "@/lib/integrations/mercado-pago";
import { apiError } from "@/lib/http";
import { buildTrackingUrl } from "@/lib/order-tracking";
import { createOrder, getCustomerAccount, savePixPayment, updatePaymentStatus } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const customerId = customerIdFromRequest(request);
  if (!customerId) return apiError("Entre ou crie sua conta para finalizar o pedido.", 401);
  const customer = await getCustomerAccount(customerId);
  if (!customer) return apiError("Sua sessão expirou. Entre novamente.", 401);
  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Confira os dados do pedido.", 422, parsed.error.issues.map((issue) => issue.message));
  }

  try {
    const input = {
      ...parsed.data,
      customer: {
        ...parsed.data.customer,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
      },
    };
    const { order, trackingToken } = await createOrder(input, customer.id);
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
        trackingUrl: buildTrackingUrl(order.publicCode, trackingToken),
        paymentError,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível criar o pedido.", 422);
  }
}
