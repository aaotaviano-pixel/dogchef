import { MercadoPagoConfig, Payment } from "mercadopago";

import type { Order, PaymentStatus } from "@/lib/types";

export function isMercadoPagoConfigured() {
  return Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN);
}

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function createPixPayment(order: Order) {
  if (!isMercadoPagoConfigured()) {
    return { configurationRequired: true } as const;
  }
  if (!order.customer.email) throw new Error("Informe seu e-mail para gerar o Pix.");

  const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN! });
  const payment = new Payment(client);
  const expiration = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const created = await payment.create({
    body: {
      transaction_amount: order.quote.totalCents / 100,
      description: `DogChef · pedido ${order.publicCode}`,
      payment_method_id: "pix",
      external_reference: order.id,
      notification_url: `${getAppUrl()}/api/v1/payments/webhook`,
      date_of_expiration: expiration,
      payer: {
        email: order.customer.email,
        first_name: order.customer.name.split(" ")[0],
      },
      metadata: { dogchef_order_id: order.id, public_code: order.publicCode },
    },
    requestOptions: { idempotencyKey: `dogchef-pix-${order.id}` },
  });
  const raw = created as unknown as Record<string, unknown>;
  const interaction = raw.point_of_interaction as Record<string, unknown> | undefined;
  const transactionData = interaction?.transaction_data as Record<string, unknown> | undefined;
  return {
    providerPaymentId: String(raw.id),
    paymentStatus: mercadoPagoStatus(raw.status as string | undefined),
    pixCopyPaste: typeof transactionData?.qr_code === "string" ? transactionData.qr_code : undefined,
    qrCodeBase64: typeof transactionData?.qr_code_base64 === "string" ? transactionData.qr_code_base64 : undefined,
    expiresAt: expiration,
  };
}

export async function getMercadoPagoPayment(id: string) {
  if (!isMercadoPagoConfigured()) throw new Error("Mercado Pago ainda não configurado.");
  const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN! });
  const payment = new Payment(client);
  const result = await payment.get({ id });
  return result as unknown as Record<string, unknown>;
}

export function mercadoPagoStatus(status?: string): PaymentStatus {
  switch (status) {
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    case "pending":
    case "in_process":
      return "pending";
    default:
      return "failed";
  }
}
