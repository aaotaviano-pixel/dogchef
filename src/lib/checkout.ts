import { z } from "zod";

import { findDeliveryZone, isStoreOpen } from "@/lib/shop";
import type { CartLine, Catalog, CheckoutInput, PricedLine, Quote } from "@/lib/types";

export const checkoutSchema = z.object({
  clientReference: z.string().trim().min(8).max(100),
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(10).max(20),
    email: z.string().trim().email().max(120).optional().or(z.literal("")),
    address: z
      .object({
        street: z.string().trim().min(2).max(100),
        number: z.string().trim().min(1).max(20),
        neighborhood: z.string().trim().min(2).max(80),
        complement: z.string().trim().max(80).optional(),
        reference: z.string().trim().max(120).optional(),
      })
      .optional(),
  }),
  deliveryType: z.enum(["delivery", "pickup"]),
  paymentMethod: z.enum(["pix", "cash", "card"]),
  items: z
    .array(
      z.object({
        key: z.string().min(1).max(120),
        productId: z.string().min(1).max(120),
        quantity: z.number().int().min(1).max(20),
        optionIds: z.array(z.string().min(1).max(120)).max(10),
        note: z.string().trim().max(240).optional(),
      }),
    )
    .min(1)
    .max(30),
});

function priceLine(line: CartLine, catalog: Catalog): PricedLine {
  const product = catalog.products.find((candidate) => candidate.id === line.productId);
  if (!product || !product.isAvailable) {
    throw new Error("Um item do seu carrinho não está mais disponível.");
  }

  const selected = new Set(line.optionIds);
  const allOptions = product.optionGroups.flatMap((group) =>
    group.options.map((option) => ({ ...option, group })),
  );
  const optionals = [...selected].map((id) => {
    const selectedOption = allOptions.find((option) => option.id === id);
    if (!selectedOption || !selectedOption.isAvailable) {
      throw new Error(`Uma opção de ${product.name} não está mais disponível.`);
    }
    return {
      id: selectedOption.id,
      name: selectedOption.name,
      priceCents: selectedOption.priceCents,
    };
  });

  for (const group of product.optionGroups) {
    const count = group.options.filter((option) => selected.has(option.id)).length;
    if (count < group.minSelections || count > group.maxSelections) {
      throw new Error(`Confira a seleção “${group.name}” em ${product.name}.`);
    }
  }

  const unitPriceCents = product.priceCents + optionals.reduce((sum, item) => sum + item.priceCents, 0);
  return {
    productId: product.id,
    productName: product.name,
    quantity: line.quantity,
    unitPriceCents,
    optionals,
    note: line.note,
    totalCents: unitPriceCents * line.quantity,
  };
}

export function createQuote(input: CheckoutInput, catalog: Catalog): Quote {
  if (!catalog.acceptingOrders) throw new Error("A loja está pausada no momento.");
  // Local development stays testable; production always enforces registered business hours.
  if (process.env.NODE_ENV === "production" && !isStoreOpen(new Date(), catalog.workingHours)) {
    throw new Error("A loja está fechada agora. Consulte o horário de funcionamento.");
  }

  const items = input.items.map((line) => priceLine(line, catalog));
  const subtotalCents = items.reduce((sum, line) => sum + line.totalCents, 0);
  let deliveryFeeCents = 0;
  let deliveryZone: string | undefined;

  if (input.deliveryType === "delivery") {
    if (!input.customer.address) throw new Error("Informe o endereço para entrega.");
    const zone = findDeliveryZone(input.customer.address.neighborhood, catalog.deliveryZones);
    if (!zone) throw new Error("Ainda não entregamos nesse bairro. Escolha retirada ou fale conosco.");
    if (subtotalCents < zone.minimumOrderCents) {
      throw new Error(`Pedido mínimo para ${zone.name}: R$ ${(zone.minimumOrderCents / 100).toFixed(2).replace(".", ",")}.`);
    }
    deliveryFeeCents = zone.feeCents;
    deliveryZone = zone.name;
  }

  return {
    items,
    subtotalCents,
    deliveryFeeCents,
    totalCents: subtotalCents + deliveryFeeCents,
    deliveryZone,
  };
}
