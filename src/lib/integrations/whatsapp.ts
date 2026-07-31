import type { Order, OrderStatus } from "@/lib/types";

const statusMessage: Partial<Record<OrderStatus, string>> = {
  confirmed: "Seu pedido foi confirmado e já entrou na nossa fila! 🍔",
  out_for_delivery: "Seu pedido saiu para entrega. Já já chega quentinho! 🛵",
};

export async function sendWhatsAppStatus(order: Order, status: OrderStatus) {
  const message = statusMessage[status];
  if (!message) return { status: "skipped" as const };
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    // Deliberately avoid logging phone numbers and message bodies in deployment logs.
    return { status: "simulated" as const, detail: "WhatsApp aguardando configuração" };
  }

  const response = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: order.customer.phone.replace(/\D/g, ""),
      type: "template",
      template: {
        name: process.env.WHATSAPP_TEMPLATE_NAME || "dogchef_status",
        language: { code: "pt_BR" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: order.customer.name },
              { type: "text", text: order.publicCode },
              { type: "text", text: message },
            ],
          },
        ],
      },
    }),
  });
  if (!response.ok) throw new Error("A notificação do WhatsApp não pôde ser enviada.");
  return { status: "sent" as const };
}
