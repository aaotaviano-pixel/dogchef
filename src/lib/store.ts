import { createQuote } from "@/lib/checkout";
import { canTransition, hashTrackingToken, newOrderId, newPublicCode, newTrackingToken } from "@/lib/orders";
import { defaultWorkingHours, products, seededCatalog } from "@/lib/seed";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import type { Catalog, Category, CheckoutInput, DeliveryZone, Order, OrderStatus, PaymentStatus, Product, WorkingHour } from "@/lib/types";
import { sendWhatsAppStatus } from "@/lib/integrations/whatsapp";

type PrintJob = {
  id: string;
  orderId: string;
  status: "queued" | "leased" | "printed" | "failed";
  leaseToken?: string;
  leaseExpiresAt?: number;
  attempts: number;
};

const memory = {
  orders: [] as Order[],
  printJobs: [] as PrintJob[],
  acceptingOrders: true,
  workingHours: deepCopy(defaultWorkingHours),
};

function now() {
  return new Date().toISOString();
}

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function menuHighlight(id: string) {
  if (id === "combo-do-chef") return "Mais pedido";
  if (id === "combo-completo") return "Melhor escolha";
  return undefined;
}

function formatHoursLabel(hours: WorkingHour[], fallback: string) {
  const active = hours.filter((hour) => !hour.isClosed);
  if (!active.length) return "Loja fechada no momento";
  const first = active[0];
  const opensAt = first.opensAt.slice(0, 5).replace(":", "h");
  const closesAt = first.closesAt.slice(0, 5).replace(":", "h");
  const sameSchedule = active.every((hour) => hour.opensAt === first.opensAt && hour.closesAt === first.closesAt);
  return sameSchedule ? `${active.length} dias ativos · ${opensAt} às ${closesAt}` : fallback;
}

export async function getCatalog(): Promise<Catalog> {
  // Catalog fallback makes preview/development usable before the hosted database is provisioned.
  const fallback = { ...seededCatalog(), acceptingOrders: memory.acceptingOrders, workingHours: deepCopy(memory.workingHours) };
  const safeFallback = process.env.NODE_ENV === "production" ? { ...fallback, acceptingOrders: false } : fallback;
  const db = getSupabase();
  if (!db) {
    // A serverless production instance must never accept real orders only in memory.
    return safeFallback;
  }

  const [categoriesResult, productsResult, zonesResult, settingsResult, hoursResult] = await Promise.all([
    db.from("menu_categories").select("id, name, description, sort_order").eq("is_available", true).order("sort_order"),
    db.from("products").select("id, category_id, name, description, price_cents, emoji, is_available, featured, prep_minutes").order("sort_order"),
    db.from("delivery_zones").select("id, name, aliases, fee_cents, minimum_order_cents, is_available").order("name"),
    db.from("store_settings").select("accepting_orders").eq("id", true).maybeSingle(),
    db.from("working_hours").select("weekday, slot, opens_at, closes_at, is_closed").order("weekday").order("slot"),
  ]);

  if (categoriesResult.error || productsResult.error || !categoriesResult.data?.length || !productsResult.data?.length) return safeFallback;

  const categories: Category[] = categoriesResult.data.map((category) => ({
    id: String(category.id),
    name: String(category.name),
    description: String(category.description ?? ""),
    sortOrder: Number(category.sort_order),
  }));
  const categoryIds = new Set(categories.map((category) => category.id));
  const remoteProducts: Product[] = productsResult.data
    .filter((product) => categoryIds.has(String(product.category_id)))
    .map((product) => ({
      id: String(product.id),
      categoryId: String(product.category_id),
      name: String(product.name),
      description: String(product.description ?? ""),
      priceCents: Number(product.price_cents),
      emoji: String(product.emoji ?? "🌭"),
      isAvailable: Boolean(product.is_available),
      featured: Boolean(product.featured),
      highlight: menuHighlight(String(product.id)),
      prepMinutes: Number(product.prep_minutes ?? 20),
      optionGroups: [],
    }));
  if (!remoteProducts.length) return safeFallback;

  const workingHours: WorkingHour[] = hoursResult.data?.map((hour) => ({
    weekday: Number(hour.weekday),
    slot: Number(hour.slot),
    opensAt: String(hour.opens_at),
    closesAt: String(hour.closes_at),
    isClosed: Boolean(hour.is_closed),
  })) ?? fallback.workingHours;
  const deliveryZones: DeliveryZone[] = zonesResult.data?.map((zone) => ({
    id: String(zone.id),
    name: String(zone.name),
    aliases: Array.isArray(zone.aliases) ? zone.aliases.map(String) : [],
    feeCents: Number(zone.fee_cents),
    minimumOrderCents: Number(zone.minimum_order_cents),
    isAvailable: Boolean(zone.is_available),
  })) ?? fallback.deliveryZones;
  return {
    categories,
    products: remoteProducts,
    deliveryZones,
    acceptingOrders: settingsResult.data?.accepting_orders ?? fallback.acceptingOrders,
    pixConfigured: Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN),
    whatsappConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
    hoursLabel: formatHoursLabel(workingHours, fallback.hoursLabel),
    workingHours,
  };
}

export function isDatabaseConfigured() {
  return hasSupabase();
}

export async function createOrder(input: CheckoutInput): Promise<{ order: Order; trackingToken: string }> {
  const catalog = await getCatalog();
  const quote = createQuote(input, catalog);
  if (input.paymentMethod === "pix" && !catalog.pixConfigured) {
    throw new Error("O Pix está aguardando configuração. Escolha cartão ou dinheiro para testar o fluxo.");
  }

  const timestamp = now();
  const id = newOrderId();
  const trackingToken = newTrackingToken();
  const paymentStatus: PaymentStatus = input.paymentMethod === "pix" ? "pending" : "not_required";
  const order: Order = {
    id,
    publicCode: newPublicCode(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "pending_approval",
    paymentStatus,
    paymentMethod: input.paymentMethod,
    deliveryType: input.deliveryType,
    customer: input.customer,
    quote,
    payment:
      input.paymentMethod === "pix"
        ? { expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() }
        : undefined,
    events: [{ at: timestamp, to: "pending_approval", actor: "customer" }],
  };

  const db = getSupabase();
  if (db) {
    const { data: duplicate } = await db
      .from("orders")
      .select("public_code")
      .eq("client_reference", input.clientReference)
      .maybeSingle();
    if (duplicate?.public_code) {
      throw new Error("Este pedido já foi recebido. Consulte o acompanhamento para ver o status.");
    }

    const { error } = await db.from("orders").insert({
      id: order.id,
      public_code: order.publicCode,
      client_reference: input.clientReference,
      status: order.status,
      payment_status: order.paymentStatus,
      payment_method: order.paymentMethod,
      delivery_type: order.deliveryType,
      customer_name: order.customer.name,
      customer_phone: order.customer.phone,
      customer_email: order.customer.email ?? null,
      address: order.customer.address ?? null,
      subtotal_cents: quote.subtotalCents,
      delivery_fee_cents: quote.deliveryFeeCents,
      total_cents: quote.totalCents,
      version: order.version,
      tracking_token_hash: hashTrackingToken(trackingToken),
      payment_data: order.payment ?? null,
    });
    if (error) throw new Error("Não foi possível salvar seu pedido. Tente novamente em instantes.");

    const { error: linesError } = await db.from("order_items").insert(
      quote.items.map((line) => ({
        order_id: order.id,
        product_id: line.productId,
        product_name: line.productName,
        unit_price_cents: line.unitPriceCents,
        quantity: line.quantity,
        note: line.note ?? null,
        total_cents: line.totalCents,
        options: line.optionals,
      })),
    );
    if (linesError) throw new Error("O pedido foi criado, mas houve um problema ao salvar os itens. Contate a loja.");
    await db.from("order_events").insert({
      order_id: order.id,
      to_status: order.status,
      actor: "customer",
    });
  } else {
    memory.orders.unshift(order);
  }

  return { order: deepCopy(order), trackingToken };
}

function mapRemoteOrder(row: Record<string, unknown>): Order {
  const lineRows = Array.isArray(row.order_items) ? row.order_items : [];
  const events = Array.isArray(row.order_events) ? row.order_events : [];
  return {
    id: String(row.id),
    publicCode: String(row.public_code),
    version: Number(row.version || 1),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    status: row.status as OrderStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    paymentMethod: row.payment_method as Order["paymentMethod"],
    deliveryType: row.delivery_type as Order["deliveryType"],
    customer: {
      name: String(row.customer_name),
      phone: String(row.customer_phone),
      email: (row.customer_email as string | null) ?? undefined,
      address: (row.address as Order["customer"]["address"]) ?? undefined,
    },
    quote: {
      items: lineRows.map((line) => ({
        productId: String(line.product_id),
        productName: String(line.product_name),
        quantity: Number(line.quantity),
        unitPriceCents: Number(line.unit_price_cents),
        optionals: (line.options as []) ?? [],
        note: (line.note as string | null) ?? undefined,
        totalCents: Number(line.total_cents),
      })),
      subtotalCents: Number(row.subtotal_cents),
      deliveryFeeCents: Number(row.delivery_fee_cents),
      totalCents: Number(row.total_cents),
    },
    payment: (row.payment_data as Order["payment"]) ?? undefined,
    printStatus: (row.print_status as Order["printStatus"]) ?? undefined,
    events: events.map((event) => ({
      at: String(event.created_at),
      from: event.from_status as OrderStatus | undefined,
      to: event.to_status as OrderStatus,
      reason: event.reason as string | undefined,
      actor: event.actor as Order["events"][number]["actor"],
    })),
  };
}

export async function getOrder(publicCode: string, trackingToken?: string) {
  const db = getSupabase();
  if (db) {
    const query = db
      .from("orders")
      .select("*, order_items(*), order_events(*)")
      .eq("public_code", publicCode)
      .order("created_at", { referencedTable: "order_events", ascending: true });
    if (trackingToken) query.eq("tracking_token_hash", hashTrackingToken(trackingToken));
    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return mapRemoteOrder(data as Record<string, unknown>);
  }
  return memory.orders.find((order) => order.publicCode === publicCode) ?? null;
}

export async function listOrders() {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from("orders")
      .select("*, order_items(*), order_events(*)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Não foi possível carregar os pedidos.");
    return (data ?? []).map((row) => mapRemoteOrder(row as Record<string, unknown>));
  }
  return deepCopy(memory.orders);
}

export async function transitionOrder(
  id: string,
  target: OrderStatus,
  expectedVersion: number,
  reason?: string,
) {
  const orders = await listOrders();
  const existing = orders.find((order) => order.id === id);
  if (!existing) throw new Error("Pedido não encontrado.");
  if (existing.version !== expectedVersion) throw new Error("Este pedido foi atualizado em outra tela. Atualize a lista.");
  if (!canTransition(existing.status, target, existing.deliveryType)) {
    throw new Error("Essa mudança de status não é permitida.");
  }
  if (target === "confirmed" && existing.paymentMethod === "pix" && existing.paymentStatus !== "approved") {
    throw new Error("A confirmação exige um Pix aprovado.");
  }

  const updatedAt = now();
  const event = { at: updatedAt, from: existing.status, to: target, reason, actor: "admin" as const };
  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from("orders")
      .update({ status: target, version: expectedVersion + 1, updated_at: updatedAt })
      .eq("id", id)
      .eq("version", expectedVersion)
      .select("id")
      .maybeSingle();
    if (error || !data) throw new Error("Conflito de atualização. Recarregue a lista de pedidos.");
    await db.from("order_events").insert({
      order_id: id,
      from_status: existing.status,
      to_status: target,
      reason: reason ?? null,
      actor: "admin",
    });
    if (target === "confirmed") {
      await db.from("print_jobs").upsert({ order_id: id, kind: "kitchen", status: "queued", payload: ticketPayload(existing) });
    }
    await queueWhatsApp(db, existing, target);
    await sendWhatsAppStatus(existing, target).catch(() => undefined);
    return { ...existing, status: target, version: expectedVersion + 1, updatedAt, events: [...existing.events, event] };
  }

  const targetOrder = memory.orders.find((order) => order.id === id)!;
  targetOrder.status = target;
  targetOrder.version += 1;
  targetOrder.updatedAt = updatedAt;
  targetOrder.events.push(event);
  if (target === "confirmed") {
    targetOrder.printStatus = "queued";
    memory.printJobs.push({ id: newOrderId(), orderId: id, status: "queued", attempts: 0 });
  }
  await sendWhatsAppStatus(targetOrder, target).catch(() => undefined);
  return deepCopy(targetOrder);
}

export async function savePixPayment(
  orderId: string,
  payment: NonNullable<Order["payment"]>,
  providerPaymentId?: string,
) {
  const db = getSupabase();
  if (db) {
    const { error } = await db
      .from("orders")
      .update({ payment_data: payment, updated_at: now() })
      .eq("id", orderId);
    if (error) throw new Error("Não foi possível registrar a cobrança Pix.");
    if (providerPaymentId) {
      await db.from("payment_attempts").upsert(
        {
          order_id: orderId,
          provider: "mercado_pago",
          provider_payment_id: providerPaymentId,
          status: "pending",
          expires_at: payment.expiresAt ?? null,
          pix_copy_paste: payment.pixCopyPaste ?? null,
        },
        { onConflict: "provider_payment_id" },
      );
    }
    return;
  }
  const order = memory.orders.find((candidate) => candidate.id === orderId);
  if (order) order.payment = payment;
}

export async function updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus, providerPaymentId?: string) {
  const db = getSupabase();
  if (db) {
    const { error } = await db
      .from("orders")
      .update({ payment_status: paymentStatus, updated_at: now() })
      .eq("id", orderId);
    if (error) throw new Error("Não foi possível atualizar o pagamento.");
    if (providerPaymentId) {
      await db.from("payment_attempts").update({ status: paymentStatus }).eq("provider_payment_id", providerPaymentId);
    }
    return;
  }
  const order = memory.orders.find((candidate) => candidate.id === orderId);
  if (order) {
    order.paymentStatus = paymentStatus;
    order.updatedAt = now();
  }
}

export async function updateProductAvailability(id: string, isAvailable: boolean) {
  const product = products.find((candidate) => candidate.id === id);
  if (!product) throw new Error("Produto não encontrado.");
  const db = getSupabase();
  if (db) {
    const { error } = await db.from("products").update({ is_available: isAvailable }).eq("id", id);
    if (error) throw new Error("Não foi possível atualizar a disponibilidade.");
  }
  product.isAvailable = isAvailable;
  return product;
}

export async function updateStoreAcceptingOrders(acceptingOrders: boolean) {
  const db = getSupabase();
  if (db) {
    const { error } = await db
      .from("store_settings")
      .upsert({ id: true, accepting_orders: acceptingOrders, updated_at: now() });
    if (error) throw new Error("Não foi possível atualizar o recebimento de pedidos.");
  }
  memory.acceptingOrders = acceptingOrders;
  return { acceptingOrders };
}

export async function updateWorkingHours(workingHours: WorkingHour[]) {
  const normalized = workingHours.map((hour) => ({
    weekday: hour.weekday,
    slot: hour.slot,
    opensAt: hour.opensAt,
    closesAt: hour.closesAt,
    isClosed: hour.isClosed,
  }));
  const uniqueSlots = new Set(normalized.map((hour) => `${hour.weekday}:${hour.slot}`));
  if (uniqueSlots.size !== normalized.length) throw new Error("Há horários duplicados para o mesmo dia.");

  const db = getSupabase();
  if (db) {
    const { error } = await db.from("working_hours").upsert(
      normalized.map((hour) => ({
        weekday: hour.weekday,
        slot: hour.slot,
        opens_at: hour.opensAt,
        closes_at: hour.closesAt,
        is_closed: hour.isClosed,
      })),
      { onConflict: "weekday,slot" },
    );
    if (error) throw new Error("Não foi possível salvar os horários de funcionamento.");
  }
  memory.workingHours = deepCopy(normalized);
  return memory.workingHours;
}

function ticketPayload(order: Order) {
  return {
    publicCode: order.publicCode,
    createdAt: order.createdAt,
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    deliveryType: order.deliveryType,
    address: order.customer.address,
    items: order.quote.items,
    totalCents: order.quote.totalCents,
    paymentMethod: order.paymentMethod,
  };
}

async function queueWhatsApp(db: NonNullable<ReturnType<typeof getSupabase>>, order: Order, target: OrderStatus) {
  if (!(["confirmed", "out_for_delivery"] as OrderStatus[]).includes(target)) return;
  const dedupeKey = `whatsapp:${order.id}:${target}`;
  await db.from("notification_outbox").upsert(
    {
      dedupe_key: dedupeKey,
      order_id: order.id,
      channel: "whatsapp",
      event: target,
      status: process.env.WHATSAPP_ACCESS_TOKEN ? "queued" : "simulated",
      payload: { publicCode: order.publicCode, phoneLast4: order.customer.phone.slice(-4) },
    },
    { onConflict: "dedupe_key" },
  );
}

export async function claimPrintJobs(agentId: string, limit = 1) {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db.rpc("claim_print_jobs", { p_limit: Math.max(1, Math.min(limit, 3)) });
    if (error) throw new Error("Não foi possível consultar a fila de impressão.");
    return (data ?? []).map((job: Record<string, unknown>) => ({
      id: String(job.id),
      leaseToken: String(job.lease_token),
      leaseExpiresAt: String(job.lease_expires_at),
      agentId,
      payload: job.payload,
    }));
  }
  const nowMillis = Date.now();
  const eligible = memory.printJobs
    .filter((job) => job.status === "queued" || (job.status === "leased" && (job.leaseExpiresAt ?? 0) < nowMillis))
    .slice(0, Math.max(1, Math.min(limit, 3)));
  return eligible.map((job) => {
    job.status = "leased";
    job.leaseToken = newTrackingToken();
    job.leaseExpiresAt = nowMillis + 60_000;
    job.attempts += 1;
    const order = memory.orders.find((candidate) => candidate.id === job.orderId)!;
    return { id: job.id, leaseToken: job.leaseToken, leaseExpiresAt: new Date(job.leaseExpiresAt).toISOString(), agentId, payload: ticketPayload(order) };
  });
}

export async function completePrintJob(jobId: string, leaseToken: string, result: "printed" | "failed", error?: string) {
  const db = getSupabase();
  if (db) {
    const { data, error: updateError } = await db
      .from("print_jobs")
      .update({ status: result, lease_token: null, lease_expires_at: null, error: error ?? null, completed_at: now() })
      .eq("id", jobId)
      .eq("lease_token", leaseToken)
      .gt("lease_expires_at", now())
      .select("id")
      .maybeSingle();
    if (updateError || !data) throw new Error("A reserva do trabalho de impressão expirou.");
    return { ok: true, error };
  }
  const job = memory.printJobs.find((candidate) => candidate.id === jobId);
  if (!job || job.leaseToken !== leaseToken || (job.leaseExpiresAt ?? 0) < Date.now()) {
    throw new Error("A reserva do trabalho de impressão expirou.");
  }
  job.status = result;
  const order = memory.orders.find((candidate) => candidate.id === job.orderId);
  if (order) order.printStatus = result === "printed" ? "printed" : "failed";
  return { ok: true, error };
}
