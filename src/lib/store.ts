import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { createQuote } from "@/lib/checkout";
import { canTransition, hashTrackingToken, newOrderId, newPublicCode, newTrackingToken } from "@/lib/orders";
import { defaultWorkingHours, products, seededCatalog } from "@/lib/seed";
import { configuredPrinterOptions, defaultPrinterId, parseDiscoveredPrinters, preferredPrinterId } from "@/lib/printers";
import { normalizeNeighborhood } from "@/lib/shop";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import type { Catalog, Category, CheckoutInput, CustomerAccount, DeliveryZone, OptionGroup, Order, OrderStatus, PaymentStatus, PrintSettings, Product, ProductImage, ProductInput, PrinterOption, WorkingHour } from "@/lib/types";

type PrintTicketPayload = {
  printerId: string;
  publicCode: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  deliveryType: "delivery" | "pickup";
  address?: Order["customer"]["address"];
  items: Order["quote"]["items"];
  totalCents: number;
  paymentMethod: string;
};

type PrintJob = {
  id: string;
  orderId?: string;
  status: "queued" | "leased" | "printed" | "failed" | "dead";
  leaseToken?: string;
  leaseExpiresAt?: number;
  attempts: number;
  printerId?: string;
  payload?: PrintTicketPayload;
};

type StoredCustomerAccount = CustomerAccount & { passwordHash?: string; authUserId?: string };

const MAX_PRINT_ATTEMPTS = 5;

const memory = {
  orders: [] as Order[],
  customerAccounts: [] as StoredCustomerAccount[],
  trackingHashes: {} as Record<string, string>,
  printJobs: [] as PrintJob[],
  acceptingOrders: true,
  defaultDeliveryFeeCents: 800,
  deliveryZones: [] as DeliveryZone[],
  workingHours: deepCopy(defaultWorkingHours),
  selectedPrinterId: defaultPrinterId(),
  discoveredPrinters: [] as PrinterOption[],
  printAgentId: undefined as string | undefined,
  printAgentLastSeenAt: undefined as string | undefined,
  metricsResetAt: undefined as string | undefined,
};

const localCatalogFile = path.join(process.cwd(), ".data", "catalog.json");
const localCommerceFile = path.join(process.cwd(), ".data", "commerce.json");
let localCatalogLoaded = false;

function normalizeLocalProduct(product: Product): Product {
  const imageUrl = product.imageUrl || "/images/dogchef/hot-dog-tradicional.webp";
  const images = Array.isArray(product.images) && product.images.length
    ? product.images
    : [{ id: `seed-${product.id}`, url: imageUrl, isMain: true, sortOrder: 0 }];
  return { ...product, imageUrl, images, showcaseOrder: Number(product.showcaseOrder ?? 0) };
}

async function ensureLocalCatalogLoaded() {
  if (localCatalogLoaded || hasSupabase() || process.env.NODE_ENV === "production") return;
  localCatalogLoaded = true;
  try {
    const stored = JSON.parse(await readFile(localCatalogFile, "utf8")) as { products?: Product[] };
    if (stored.products?.length) products.splice(0, products.length, ...stored.products.map(normalizeLocalProduct));
  } catch {
    // The seed catalog is the intended first-run state.
  }
}

async function persistLocalCatalog() {
  if (hasSupabase() || process.env.NODE_ENV === "production") return;
  await mkdir(path.dirname(localCatalogFile), { recursive: true });
  await writeFile(localCatalogFile, JSON.stringify({ products }, null, 2), "utf8");
}

async function ensureLocalCommerceLoaded() {
  if (hasSupabase() || process.env.NODE_ENV === "production") return;
  try {
    const stored = JSON.parse(await readFile(localCommerceFile, "utf8")) as {
      orders?: Order[];
      customerAccounts?: StoredCustomerAccount[];
      trackingHashes?: Record<string, string>;
      metricsResetAt?: string;
    };
    memory.orders = Array.isArray(stored.orders) ? stored.orders : [];
    memory.customerAccounts = Array.isArray(stored.customerAccounts) ? stored.customerAccounts : [];
    memory.trackingHashes = stored.trackingHashes && typeof stored.trackingHashes === "object" ? stored.trackingHashes : {};
    memory.metricsResetAt = typeof stored.metricsResetAt === "string" ? stored.metricsResetAt : undefined;
  } catch {
    // The empty local commerce state is the intended first-run state.
  }
}

async function persistLocalCommerce() {
  if (hasSupabase() || process.env.NODE_ENV === "production") return;
  await mkdir(path.dirname(localCommerceFile), { recursive: true });
  const temporaryFile = `${localCommerceFile}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryFile, JSON.stringify({
    orders: memory.orders,
    customerAccounts: memory.customerAccounts,
    trackingHashes: memory.trackingHashes,
    metricsResetAt: memory.metricsResetAt,
  }, null, 2), "utf8");
  await rename(temporaryFile, localCommerceFile);
}

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

function publicWhatsAppUrl() {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  return number ? `https://wa.me/${number}` : undefined;
}

export async function getCatalog(): Promise<Catalog> {
  await ensureLocalCatalogLoaded();
  // Catalog fallback makes preview/development usable before the hosted database is provisioned.
  const fallback = {
    ...seededCatalog(),
    acceptingOrders: memory.acceptingOrders,
    defaultDeliveryFeeCents: memory.defaultDeliveryFeeCents,
    deliveryZones: deepCopy(memory.deliveryZones),
    workingHours: deepCopy(memory.workingHours),
  };
  const safeFallback = process.env.NODE_ENV === "production" ? { ...fallback, acceptingOrders: false } : fallback;
  const db = getSupabase();
  if (!db) {
    // A serverless production instance must never accept real orders only in memory.
    return safeFallback;
  }

  const [categoriesResult, productsResult, imagesResult, zonesResult, settingsResult, hoursResult, groupsResult, linksResult, optionsResult] = await Promise.all([
    db.from("menu_categories").select("id, name, description, sort_order").eq("is_available", true).order("sort_order"),
    db.from("products").select("*").order("sort_order"),
    db.from("product_images").select("id, product_id, public_url, is_main, sort_order").order("sort_order"),
    db.from("delivery_zones").select("id, name, aliases, fee_cents, minimum_order_cents, is_available").eq("is_available", true).order("name"),
    db.from("store_settings").select("accepting_orders, default_delivery_fee_cents").eq("id", true).maybeSingle(),
    db.from("working_hours").select("weekday, slot, opens_at, closes_at, is_closed").order("weekday").order("slot"),
    db.from("product_option_groups").select("id, name, min_selections, max_selections, required, is_available, sort_order").eq("is_available", true).order("sort_order"),
    db.from("product_option_group_products").select("product_id, option_group_id"),
    db.from("product_options").select("id, option_group_id, name, price_cents, is_available, sort_order").order("sort_order"),
  ]);

  if (categoriesResult.error || productsResult.error || !categoriesResult.data?.length || !productsResult.data?.length) return safeFallback;

  const categories: Category[] = categoriesResult.data.map((category) => ({
    id: String(category.id),
    name: String(category.name),
    description: String(category.description ?? ""),
    sortOrder: Number(category.sort_order),
  }));
  const categoryIds = new Set(categories.map((category) => category.id));
  const optionsByGroup = new Map<string, OptionGroup["options"]>();
  if (!optionsResult.error) {
    for (const option of optionsResult.data ?? []) {
      const groupId = String(option.option_group_id);
      const existing = optionsByGroup.get(groupId) ?? [];
      existing.push({
        id: String(option.id),
        name: String(option.name),
        priceCents: Number(option.price_cents),
        isAvailable: Boolean(option.is_available),
      });
      optionsByGroup.set(groupId, existing);
    }
  }
  const groupsById = new Map<string, OptionGroup>();
  if (!groupsResult.error) {
    for (const group of groupsResult.data ?? []) {
      const id = String(group.id);
      groupsById.set(id, {
        id,
        name: String(group.name),
        minSelections: Number(group.min_selections),
        maxSelections: Number(group.max_selections),
        required: Boolean(group.required),
        options: optionsByGroup.get(id) ?? [],
      });
    }
  }
  const groupsByProduct = new Map<string, OptionGroup[]>();
  if (!linksResult.error) {
    for (const link of linksResult.data ?? []) {
      const productId = String(link.product_id);
      const group = groupsById.get(String(link.option_group_id));
      if (!group) continue;
      const existing = groupsByProduct.get(productId) ?? [];
      existing.push(group);
      groupsByProduct.set(productId, existing);
    }
  }
  const imagesByProduct = new Map<string, ProductImage[]>();
  if (!imagesResult.error) {
    for (const image of imagesResult.data ?? []) {
      const productId = String(image.product_id);
      const existing = imagesByProduct.get(productId) ?? [];
      existing.push({
        id: String(image.id),
        url: String(image.public_url),
        isMain: Boolean(image.is_main),
        sortOrder: Number(image.sort_order),
      });
      imagesByProduct.set(productId, existing);
    }
  }
  const remoteProducts: Product[] = productsResult.data
    .filter((product) => categoryIds.has(String(product.category_id)))
    .map((product) => {
      const id = String(product.id);
      const fallbackProduct = products.find((candidate) => candidate.id === id);
      const imageUrl = String(product.image_url || fallbackProduct?.imageUrl || "/images/dogchef/hot-dog-tradicional.webp");
      const storedImages = imagesByProduct.get(id) ?? [];
      return {
        id,
        categoryId: String(product.category_id),
        name: String(product.name),
        description: String(product.description ?? ""),
        priceCents: Number(product.price_cents),
        emoji: String(product.emoji ?? "🌭"),
        imageUrl,
        images: storedImages.length ? storedImages : [{ id: `legacy-${id}`, url: imageUrl, isMain: true, sortOrder: 0 }],
        isAvailable: Boolean(product.is_available),
        featured: Boolean(product.featured),
        highlight: String(product.highlight || menuHighlight(id) || "") || undefined,
        showcaseOrder: Number(product.showcase_order ?? product.sort_order ?? 0),
        prepMinutes: Number(product.prep_minutes ?? 20),
        optionGroups: groupsByProduct.get(id) ?? [],
      };
    });
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
    defaultDeliveryFeeCents: Number(settingsResult.data?.default_delivery_fee_cents ?? fallback.defaultDeliveryFeeCents),
    acceptingOrders: settingsResult.data?.accepting_orders ?? fallback.acceptingOrders,
    pixConfigured: Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN),
    whatsappConfigured: Boolean(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER),
    whatsappUrl: publicWhatsAppUrl(),
    hoursLabel: formatHoursLabel(workingHours, fallback.hoursLabel),
    workingHours,
  };
}

export function isDatabaseConfigured() {
  return hasSupabase();
}

function publicCustomer(account: StoredCustomerAccount): CustomerAccount {
  const { passwordHash: _passwordHash, authUserId: _authUserId, ...customer } = account;
  return { ...customer, profileComplete: Boolean(customer.phone) };
}

export async function findCustomerByEmail(email: string): Promise<StoredCustomerAccount | null> {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from("customer_accounts")
      .select("id, name, phone, email, password_hash, auth_user_id, created_at")
      .eq("email", email)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: String(data.id),
      name: String(data.name),
      phone: data.phone ? String(data.phone) : "",
      email: String(data.email),
      passwordHash: data.password_hash ? String(data.password_hash) : undefined,
      authUserId: data.auth_user_id ? String(data.auth_user_id) : undefined,
      createdAt: String(data.created_at),
      profileComplete: Boolean(data.phone),
    };
  }
  await ensureLocalCommerceLoaded();
  return deepCopy(memory.customerAccounts.find((customer) => customer.email === email) ?? null);
}

export async function findCustomerByAuthUserId(authUserId: string): Promise<StoredCustomerAccount | null> {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from("customer_accounts")
      .select("id, name, phone, email, password_hash, auth_user_id, created_at")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: String(data.id),
      name: String(data.name),
      phone: data.phone ? String(data.phone) : "",
      email: String(data.email),
      passwordHash: data.password_hash ? String(data.password_hash) : undefined,
      authUserId: data.auth_user_id ? String(data.auth_user_id) : undefined,
      createdAt: String(data.created_at),
      profileComplete: Boolean(data.phone),
    };
  }
  await ensureLocalCommerceLoaded();
  return deepCopy(memory.customerAccounts.find((customer) => customer.authUserId === authUserId) ?? null);
}

export async function linkCustomerAuthUser(id: string, authUserId: string) {
  const db = getSupabase();
  if (db) {
    const { error } = await db
      .from("customer_accounts")
      .update({ auth_user_id: authUserId, updated_at: now() })
      .eq("id", id)
      .is("auth_user_id", null);
    if (error) throw new Error("Não foi possível preparar a recuperação da conta.");
    return;
  }
  await ensureLocalCommerceLoaded();
  const account = memory.customerAccounts.find((candidate) => candidate.id === id);
  if (!account) throw new Error("Conta não encontrada.");
  account.authUserId = authUserId;
  await persistLocalCommerce();
}

export async function updateCustomerPassword(id: string, passwordHash: string) {
  const db = getSupabase();
  if (db) {
    const { error } = await db
      .from("customer_accounts")
      .update({ password_hash: passwordHash, updated_at: now() })
      .eq("id", id);
    if (error) throw new Error("Não foi possível atualizar a senha da conta.");
    return;
  }
  await ensureLocalCommerceLoaded();
  const account = memory.customerAccounts.find((candidate) => candidate.id === id);
  if (!account) throw new Error("Conta não encontrada.");
  account.passwordHash = passwordHash;
  await persistLocalCommerce();
}

export async function getCustomerAccount(id: string): Promise<CustomerAccount | null> {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from("customer_accounts")
      .select("id, name, phone, email, created_at")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: String(data.id),
      name: String(data.name),
      phone: data.phone ? String(data.phone) : "",
      email: String(data.email),
      createdAt: String(data.created_at),
      profileComplete: Boolean(data.phone),
    };
  }
  await ensureLocalCommerceLoaded();
  const account = memory.customerAccounts.find((customer) => customer.id === id);
  return account ? deepCopy(publicCustomer(account)) : null;
}

export async function createCustomerAccount(input: { name: string; phone: string; email: string; passwordHash: string }) {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db.from("customer_accounts").insert({
      name: input.name,
      phone: input.phone,
      email: input.email,
      password_hash: input.passwordHash,
    }).select("id, name, phone, email, created_at").single();
    if (error) {
      if (error.code === "23505") throw new Error("Já existe uma conta com este e-mail.");
      throw new Error("Não foi possível criar sua conta agora.");
    }
    return {
      id: String(data.id),
      name: String(data.name),
      phone: String(data.phone),
      email: String(data.email),
      createdAt: String(data.created_at),
      profileComplete: Boolean(data.phone),
    } satisfies CustomerAccount;
  }
  await ensureLocalCommerceLoaded();
  if (memory.customerAccounts.some((customer) => customer.email === input.email)) {
    throw new Error("Já existe uma conta com este e-mail.");
  }
  const account: StoredCustomerAccount = {
    id: randomUUID(),
    name: input.name,
    phone: input.phone,
    email: input.email,
    passwordHash: input.passwordHash,
    createdAt: now(),
    profileComplete: true,
  };
  memory.customerAccounts.push(account);
  await persistLocalCommerce();
  return deepCopy(publicCustomer(account));
}

export async function findOrCreateGoogleCustomer(input: { authUserId: string; email: string; name: string }) {
  const db = getSupabase();
  if (!db) throw new Error("O login com Google depende da configuração do Supabase.");

  const selection = "id, name, phone, email, password_hash, auth_user_id, created_at";
  const byAuth = await db.from("customer_accounts").select(selection).eq("auth_user_id", input.authUserId).maybeSingle();
  if (byAuth.error) throw new Error("A estrutura do login com Google ainda não foi aplicada no banco.");
  if (byAuth.data) {
    return {
      id: String(byAuth.data.id),
      name: String(byAuth.data.name),
      phone: byAuth.data.phone ? String(byAuth.data.phone) : "",
      email: String(byAuth.data.email),
      createdAt: String(byAuth.data.created_at),
      profileComplete: Boolean(byAuth.data.phone),
    } satisfies CustomerAccount;
  }

  const byEmail = await db.from("customer_accounts").select(selection).eq("email", input.email).maybeSingle();
  if (byEmail.error) throw new Error("Não foi possível verificar sua conta agora.");
  if (byEmail.data) {
    if (byEmail.data.auth_user_id && String(byEmail.data.auth_user_id) !== input.authUserId) {
      throw new Error("Este e-mail já está vinculado a outra conta Google.");
    }
    const linked = await db
      .from("customer_accounts")
      .update({ auth_user_id: input.authUserId, updated_at: now() })
      .eq("id", byEmail.data.id)
      .select("id, name, phone, email, created_at")
      .single();
    if (linked.error) throw new Error("Não foi possível vincular sua conta Google.");
    return {
      id: String(linked.data.id),
      name: String(linked.data.name),
      phone: linked.data.phone ? String(linked.data.phone) : "",
      email: String(linked.data.email),
      createdAt: String(linked.data.created_at),
      profileComplete: Boolean(linked.data.phone),
    } satisfies CustomerAccount;
  }

  const created = await db.from("customer_accounts").insert({
    auth_user_id: input.authUserId,
    name: input.name,
    email: input.email,
    phone: null,
    password_hash: null,
  }).select("id, name, phone, email, created_at").single();
  if (created.error) throw new Error("Não foi possível criar sua conta com o Google.");
  return {
    id: String(created.data.id),
    name: String(created.data.name),
    phone: "",
    email: String(created.data.email),
    createdAt: String(created.data.created_at),
    profileComplete: false,
  } satisfies CustomerAccount;
}

export async function updateCustomerPhone(id: string, phone: string) {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from("customer_accounts")
      .update({ phone, updated_at: now() })
      .eq("id", id)
      .select("id, name, phone, email, created_at")
      .single();
    if (error) throw new Error("Não foi possível salvar seu telefone.");
    return {
      id: String(data.id),
      name: String(data.name),
      phone: String(data.phone),
      email: String(data.email),
      createdAt: String(data.created_at),
      profileComplete: true,
    } satisfies CustomerAccount;
  }
  await ensureLocalCommerceLoaded();
  const account = memory.customerAccounts.find((candidate) => candidate.id === id);
  if (!account) throw new Error("Conta não encontrada.");
  account.phone = phone;
  account.profileComplete = true;
  await persistLocalCommerce();
  return deepCopy(publicCustomer(account));
}

export async function createOrder(input: CheckoutInput, customerId: string): Promise<{ order: Order; trackingToken: string }> {
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
    customerId,
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
      customer_id: customerId,
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
    await ensureLocalCommerceLoaded();
    memory.orders.unshift(order);
    memory.trackingHashes[order.id] = hashTrackingToken(trackingToken);
    await persistLocalCommerce();
  }

  return { order: deepCopy(order), trackingToken };
}

function mapRemoteOrder(row: Record<string, unknown>): Order {
  const lineRows = Array.isArray(row.order_items) ? row.order_items : [];
  const events = Array.isArray(row.order_events) ? row.order_events : [];
  const printJobs = Array.isArray(row.print_jobs) ? row.print_jobs : [];
  return {
    id: String(row.id),
    customerId: (row.customer_id as string | null) ?? undefined,
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
    printStatus: (printJobs[0] as { status?: Order["printStatus"] } | undefined)?.status,
    events: events.map((event) => ({
      at: String(event.created_at),
      from: event.from_status as OrderStatus | undefined,
      to: event.to_status as OrderStatus,
      reason: event.reason as string | undefined,
      actor: event.actor as Order["events"][number]["actor"],
    })),
  };
}

export async function getOrder(publicCode: string, trackingToken?: string, customerId?: string) {
  if (!trackingToken && !customerId) return null;
  const db = getSupabase();
  if (db) {
    const query = db
      .from("orders")
      .select("*, order_items(*), order_events(*), print_jobs(status)")
      .eq("public_code", publicCode)
      .order("created_at", { referencedTable: "order_events", ascending: true });
    if (trackingToken) query.eq("tracking_token_hash", hashTrackingToken(trackingToken));
    else query.eq("customer_id", customerId!);
    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return mapRemoteOrder(data as Record<string, unknown>);
  }
  await ensureLocalCommerceLoaded();
  return memory.orders.find((order) => order.publicCode === publicCode && (
    customerId ? order.customerId === customerId : Boolean(trackingToken && memory.trackingHashes[order.id] === hashTrackingToken(trackingToken))
  )) ?? null;
}

// Internal payment callbacks should address one order directly instead of loading
// the latest admin order page and scanning it in memory.
export async function getOrderById(orderId: string) {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from("orders")
      .select("*, order_items(*), order_events(*), print_jobs(status)")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw new Error("Não foi possível consultar o pedido.");
    return data ? mapRemoteOrder(data as Record<string, unknown>) : null;
  }
  await ensureLocalCommerceLoaded();
  return deepCopy(memory.orders.find((order) => order.id === orderId) ?? null);
}

export async function listCustomerOrders(customerId: string) {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from("orders")
      .select("*, order_items(*), order_events(*), print_jobs(status)")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Não foi possível carregar seus pedidos.");
    return (data ?? []).map((row) => mapRemoteOrder(row as Record<string, unknown>));
  }
  await ensureLocalCommerceLoaded();
  return deepCopy(memory.orders.filter((order) => order.customerId === customerId));
}

type PaymentWebhookDeliveryInput = {
  provider: string;
  requestId?: string;
  paymentId: string;
  payloadHash: string;
};

export async function registerPaymentWebhookDelivery(input: PaymentWebhookDeliveryInput) {
  const db = getSupabase();
  if (!db) return { id: undefined, duplicate: false, processedAt: undefined };

  const { data, error } = await db
    .from("payment_webhook_deliveries")
    .insert({
      provider: input.provider,
      request_id: input.requestId || null,
      payment_id: input.paymentId,
      signature_valid: true,
      payload_hash: input.payloadHash,
    })
    .select("id, processed_at")
    .single();

  if (!error && data) {
    return { id: String(data.id), duplicate: false, processedAt: data.processed_at as string | null | undefined };
  }
  if (error?.code !== "23505") throw new Error("Não foi possível registrar a entrega do webhook.");

  const { data: existing, error: lookupError } = await db
    .from("payment_webhook_deliveries")
    .select("id, processed_at")
    .eq("provider", input.provider)
    .eq("payload_hash", input.payloadHash)
    .maybeSingle();
  if (lookupError || !existing) throw new Error("Não foi possível verificar a entrega repetida do webhook.");
  return {
    id: String(existing.id),
    duplicate: true,
    processedAt: existing.processed_at as string | null | undefined,
  };
}

export async function completePaymentWebhookDelivery(id: string) {
  const db = getSupabase();
  if (!db || !id) return;
  const { error } = await db
    .from("payment_webhook_deliveries")
    .update({ processed_at: now(), error: null })
    .eq("id", id);
  if (error) throw new Error("Não foi possível finalizar o registro do webhook.");
}

export async function failPaymentWebhookDelivery(id: string, message: string) {
  const db = getSupabase();
  if (!db || !id) return;
  await db
    .from("payment_webhook_deliveries")
    .update({ error: message.slice(0, 500) })
    .eq("id", id);
}

export async function listOrders() {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from("orders")
      .select("*, order_items(*), order_events(*), print_jobs(status)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Não foi possível carregar os pedidos.");
    return (data ?? []).map((row) => mapRemoteOrder(row as Record<string, unknown>));
  }
  await ensureLocalCommerceLoaded();
  return deepCopy(memory.orders);
}

async function latestMetricsResetAt() {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from("audit_log")
      .select("created_at")
      .eq("action", "dashboard_metrics_reset")
      .eq("entity_type", "dashboard")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data?.created_at) memory.metricsResetAt = String(data.created_at);
  }
  return memory.metricsResetAt;
}

export async function listDashboardOrders() {
  const resetAt = await latestMetricsResetAt();
  const db = getSupabase();
  if (db) {
    let query = db
      .from("orders")
      .select("*, order_items(*), order_events(*), print_jobs(status)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (resetAt) query = query.gte("created_at", resetAt);
    const { data, error } = await query;
    if (error) throw new Error("Não foi possível carregar os pedidos.");
    return (data ?? []).map((row) => mapRemoteOrder(row as Record<string, unknown>));
  }
  await ensureLocalCommerceLoaded();
  const orders = resetAt ? memory.orders.filter((order) => order.createdAt >= resetAt) : memory.orders;
  return deepCopy(orders);
}

export async function resetDashboardMetrics() {
  const resetAt = now();
  const db = getSupabase();
  if (db) {
    const { error } = await db.from("audit_log").insert({
      actor: "admin",
      action: "dashboard_metrics_reset",
      entity_type: "dashboard",
      entity_id: "global",
      diff: { resetAt, reason: "test-data-reset" },
    });
    if (error) throw new Error("Não foi possível zerar os indicadores.");
  }
  memory.metricsResetAt = resetAt;
  await persistLocalCommerce();
  return { resetAt };
}

export async function transitionOrder(
  id: string,
  target: OrderStatus,
  expectedVersion: number,
  reason?: string,
  printerId?: string,
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
      const printerSettings = await getPrintSettings();
      const selectedPrinterId = printerId && printerSettings.printers.some((printer) => printer.id === printerId) ? printerId : printerSettings.selectedPrinterId;
      await db.from("print_jobs").upsert(
        { order_id: id, kind: "kitchen", status: "queued", payload: ticketPayload(existing, selectedPrinterId), attempts: 0, error: null, completed_at: null },
        { onConflict: "order_id,kind" },
      );
    }
    return { ...existing, status: target, version: expectedVersion + 1, updatedAt, events: [...existing.events, event] };
  }

  const targetOrder = memory.orders.find((order) => order.id === id)!;
  targetOrder.status = target;
  targetOrder.version += 1;
  targetOrder.updatedAt = updatedAt;
  targetOrder.events.push(event);
  if (target === "confirmed") {
    targetOrder.printStatus = "queued";
    const printerSettings = await getPrintSettings();
    memory.printJobs.push({ id: newOrderId(), orderId: id, status: "queued", attempts: 0, printerId: printerId && printerSettings.printers.some((printer) => printer.id === printerId) ? printerId : printerSettings.selectedPrinterId });
  }
  await persistLocalCommerce();
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
  await ensureLocalCommerceLoaded();
  const order = memory.orders.find((candidate) => candidate.id === orderId);
  if (order) {
    order.payment = payment;
    await persistLocalCommerce();
  }
}

export async function updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus, providerPaymentId?: string) {
  const db = getSupabase();
  if (db) {
    const { data: current, error: currentError } = await db
      .from("orders")
      .select("payment_status")
      .eq("id", orderId)
      .maybeSingle();
    if (currentError || !current) throw new Error("Pedido não encontrado para atualizar o pagamento.");
    // Payment notifications can arrive out of order. Never downgrade a payment
    // that was already confirmed by the gateway.
    if (current.payment_status === "approved" && paymentStatus !== "approved") return;
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
  await ensureLocalCommerceLoaded();
  const order = memory.orders.find((candidate) => candidate.id === orderId);
  if (order) {
    if (order.paymentStatus === "approved" && paymentStatus !== "approved") return;
    order.paymentStatus = paymentStatus;
    order.updatedAt = now();
    await persistLocalCommerce();
  }
}

type ProductSettingsUpdate = { isAvailable?: boolean; featured?: boolean };

function productIdFor(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "produto";
  return `${slug}-${randomUUID().slice(0, 8)}`;
}

async function assertProductInput(input: ProductInput, currentId?: string) {
  const catalog = await getCatalog();
  if (!catalog.categories.some((category) => category.id === input.categoryId)) throw new Error("Selecione uma categoria válida.");
  if (input.featured && !catalog.products.some((product) => product.id === currentId && product.featured)) {
    if (catalog.products.filter((product) => product.featured).length >= 5) throw new Error("O showcase aceita no máximo 5 produtos.");
  }
}

export async function createProduct(input: ProductInput) {
  await assertProductInput(input);
  const id = productIdFor(input.name);
  const fallbackImage = "/images/dogchef/hot-dog-tradicional.webp";
  const db = getSupabase();
  if (db) {
    const { data: lastProduct } = await db.from("products").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { error } = await db.from("products").insert({
      id,
      category_id: input.categoryId,
      name: input.name.trim(),
      description: input.description.trim(),
      price_cents: input.priceCents,
      emoji: "🌭",
      image_url: fallbackImage,
      is_available: input.isAvailable,
      featured: input.featured,
      highlight: input.highlight?.trim() || null,
      showcase_order: input.featured ? 99 : 0,
      prep_minutes: input.prepMinutes,
      sort_order: Number(lastProduct?.sort_order ?? 0) + 1,
    });
    if (error) throw new Error("Não foi possível cadastrar o produto. Confira se as migrações do painel foram aplicadas.");
  } else {
    await ensureLocalCatalogLoaded();
    products.push({
      id,
      categoryId: input.categoryId,
      name: input.name.trim(),
      description: input.description.trim(),
      priceCents: input.priceCents,
      emoji: "🌭",
      imageUrl: fallbackImage,
      images: [{ id: `seed-${id}`, url: fallbackImage, isMain: true, sortOrder: 0 }],
      isAvailable: input.isAvailable,
      featured: input.featured,
      highlight: input.highlight?.trim() || undefined,
      showcaseOrder: input.featured ? 99 : 0,
      prepMinutes: input.prepMinutes,
      optionGroups: [],
    });
    await persistLocalCatalog();
  }
  const product = (await getCatalog()).products.find((candidate) => candidate.id === id);
  if (!product) throw new Error("Produto cadastrado, mas não foi possível recarregá-lo.");
  return product;
}

export async function updateProduct(id: string, input: ProductInput) {
  await assertProductInput(input, id);
  const db = getSupabase();
  if (db) {
    const { data, error } = await db.from("products").update({
      category_id: input.categoryId,
      name: input.name.trim(),
      description: input.description.trim(),
      price_cents: input.priceCents,
      prep_minutes: input.prepMinutes,
      is_available: input.isAvailable,
      featured: input.featured,
      highlight: input.highlight?.trim() || null,
    }).eq("id", id).select("id").maybeSingle();
    if (error) throw new Error("Não foi possível salvar o produto.");
    if (!data) throw new Error("Produto não encontrado.");
  } else {
    await ensureLocalCatalogLoaded();
    const product = products.find((candidate) => candidate.id === id);
    if (!product) throw new Error("Produto não encontrado.");
    Object.assign(product, {
      categoryId: input.categoryId,
      name: input.name.trim(),
      description: input.description.trim(),
      priceCents: input.priceCents,
      prepMinutes: input.prepMinutes,
      isAvailable: input.isAvailable,
      featured: input.featured,
      highlight: input.highlight?.trim() || undefined,
    });
    await persistLocalCatalog();
  }
  const product = (await getCatalog()).products.find((candidate) => candidate.id === id);
  if (!product) throw new Error("Produto não encontrado.");
  return product;
}

export async function deleteProduct(id: string) {
  const db = getSupabase();
  if (db) {
    const { data: product, error: productError } = await db.from("products").select("id").eq("id", id).maybeSingle();
    if (productError || !product) throw new Error("Produto não encontrado.");
    const { data: images } = await db.from("product_images").select("storage_path").eq("product_id", id);
    await db.from("product_option_group_products").delete().eq("product_id", id);
    const { error } = await db.from("products").delete().eq("id", id);
    if (error) throw new Error("Não foi possível excluir o produto.");
    const paths = (images ?? []).map((image) => String(image.storage_path || "")).filter(Boolean);
    if (paths.length) await db.storage.from("product-images").remove(paths);
    return;
  }
  await ensureLocalCatalogLoaded();
  const index = products.findIndex((candidate) => candidate.id === id);
  if (index < 0) throw new Error("Produto não encontrado.");
  products.splice(index, 1);
  await rm(path.join(process.cwd(), "public", "uploads", "products", id), { recursive: true, force: true });
  await persistLocalCatalog();
}

function imageExtension(file: File) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  return extensions[file.type] ?? "jpg";
}

export async function addProductImages(productId: string, files: File[]) {
  if (!files.length) return [] as ProductImage[];
  const db = getSupabase();
  if (db) {
    const { data: product, error: productError } = await db.from("products").select("id").eq("id", productId).maybeSingle();
    if (productError || !product) throw new Error("Produto não encontrado.");
    const { data: currentImages, error: imageError } = await db.from("product_images").select("id, sort_order").eq("product_id", productId).order("sort_order");
    if (imageError) throw new Error("A galeria ainda não está configurada no banco.");
    let nextOrder = (currentImages?.at(-1)?.sort_order ?? -1) + 1;
    const added: ProductImage[] = [];
    for (const file of files) {
      const id = randomUUID();
      const storagePath = `products/${productId}/${id}.${imageExtension(file)}`;
      const { error: uploadError } = await db.storage.from("product-images").upload(storagePath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw new Error("Não foi possível enviar uma das fotos.");
      const publicUrl = db.storage.from("product-images").getPublicUrl(storagePath).data.publicUrl;
      const isMain = (currentImages?.length ?? 0) === 0 && added.length === 0;
      const { error: insertError } = await db.from("product_images").insert({
        id,
        product_id: productId,
        storage_path: storagePath,
        public_url: publicUrl,
        is_main: isMain,
        sort_order: nextOrder,
      });
      if (insertError) {
        await db.storage.from("product-images").remove([storagePath]);
        throw new Error("A foto foi enviada, mas não pôde ser vinculada ao produto.");
      }
      added.push({ id, url: publicUrl, isMain, sortOrder: nextOrder });
      nextOrder += 1;
      if (isMain) await db.from("products").update({ image_url: publicUrl }).eq("id", productId);
    }
    return added;
  }

  await ensureLocalCatalogLoaded();
  const product = products.find((candidate) => candidate.id === productId);
  if (!product) throw new Error("Produto não encontrado.");
  const directory = path.join(process.cwd(), "public", "uploads", "products", productId);
  await mkdir(directory, { recursive: true });
  const hasUploadedImage = product.images.some((image) => !image.id.startsWith("seed-"));
  const added: ProductImage[] = [];
  for (const [index, file] of files.entries()) {
    const id = randomUUID();
    const filename = `${id}.${imageExtension(file)}`;
    await writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()));
    const url = `/uploads/products/${productId}/${filename}`;
    const isMain = !hasUploadedImage && index === 0;
    if (isMain) product.images.forEach((image) => { image.isMain = false; });
    const image = { id, url, isMain, sortOrder: product.images.length + index };
    product.images.push(image);
    added.push(image);
    if (isMain) product.imageUrl = url;
  }
  await persistLocalCatalog();
  return added;
}

export async function setMainProductImage(productId: string, imageId: string) {
  const db = getSupabase();
  if (db) {
    const { data: image, error } = await db.from("product_images").select("id, public_url").eq("id", imageId).eq("product_id", productId).maybeSingle();
    if (error || !image) throw new Error("Foto não encontrada.");
    await db.from("product_images").update({ is_main: false }).eq("product_id", productId);
    const { error: mainError } = await db.from("product_images").update({ is_main: true }).eq("id", imageId);
    if (mainError) throw new Error("Não foi possível definir a foto principal.");
    await db.from("products").update({ image_url: image.public_url }).eq("id", productId);
    return;
  }
  await ensureLocalCatalogLoaded();
  const product = products.find((candidate) => candidate.id === productId);
  const image = product?.images.find((candidate) => candidate.id === imageId);
  if (!product || !image) throw new Error("Foto não encontrada.");
  product.images.forEach((candidate) => { candidate.isMain = candidate.id === imageId; });
  product.imageUrl = image.url;
  await persistLocalCatalog();
}

export async function deleteProductImage(productId: string, imageId: string) {
  const fallbackImage = "/images/dogchef/hot-dog-tradicional.webp";
  const db = getSupabase();
  if (db) {
    const { data: image, error } = await db.from("product_images").select("id, storage_path, is_main").eq("id", imageId).eq("product_id", productId).maybeSingle();
    if (error || !image) throw new Error("Foto não encontrada.");
    const { error: deleteError } = await db.from("product_images").delete().eq("id", imageId);
    if (deleteError) throw new Error("Não foi possível remover a foto.");
    if (image.storage_path) await db.storage.from("product-images").remove([String(image.storage_path)]);
    if (image.is_main) {
      const { data: nextImage } = await db.from("product_images").select("id, public_url").eq("product_id", productId).order("sort_order").limit(1).maybeSingle();
      if (nextImage) {
        await db.from("product_images").update({ is_main: true }).eq("id", nextImage.id);
        await db.from("products").update({ image_url: nextImage.public_url }).eq("id", productId);
      } else {
        await db.from("products").update({ image_url: fallbackImage }).eq("id", productId);
      }
    }
    return;
  }
  await ensureLocalCatalogLoaded();
  const product = products.find((candidate) => candidate.id === productId);
  const image = product?.images.find((candidate) => candidate.id === imageId);
  if (!product || !image) throw new Error("Foto não encontrada.");
  product.images = product.images.filter((candidate) => candidate.id !== imageId);
  if (image.url.startsWith("/uploads/products/")) {
    await unlink(path.join(process.cwd(), "public", image.url)).catch(() => undefined);
  }
  if (!product.images.length) product.images = [{ id: `seed-${productId}`, url: fallbackImage, isMain: true, sortOrder: 0 }];
  if (image.isMain || !product.images.some((candidate) => candidate.isMain)) {
    product.images.forEach((candidate, index) => { candidate.isMain = index === 0; });
  }
  product.imageUrl = product.images.find((candidate) => candidate.isMain)?.url ?? fallbackImage;
  await persistLocalCatalog();
}

export async function updateShowcaseProducts(productIds: string[]) {
  if (productIds.length > 5 || new Set(productIds).size !== productIds.length) throw new Error("Selecione até 5 produtos sem repetir itens.");
  const catalog = await getCatalog();
  if (productIds.some((id) => !catalog.products.some((product) => product.id === id && product.isAvailable))) {
    throw new Error("O showcase aceita somente produtos ativos.");
  }
  const db = getSupabase();
  if (db) {
    const { error } = await db.rpc("set_showcase_products", { p_product_ids: productIds });
    if (error) {
      // Keep older Supabase functions usable until the filtered migration is applied.
      const { error: clearError } = await db
        .from("products")
        .update({ featured: false, showcase_order: 0 })
        .eq("featured", true);
      if (clearError) throw new Error("Não foi possível salvar o showcase. A migration do banco ou as permissões ainda precisam ser atualizadas.");

      const updates = await Promise.all(productIds.map((id, index) => db
        .from("products")
        .update({ featured: true, showcase_order: index })
        .eq("id", id)));
      if (updates.some((result) => result.error)) throw new Error("Não foi possível concluir a atualização do showcase. Verifique a migration do banco.");
    }
  } else {
    await ensureLocalCatalogLoaded();
    products.forEach((product) => {
      const index = productIds.indexOf(product.id);
      product.featured = index >= 0;
      product.showcaseOrder = index >= 0 ? index : 0;
    });
    await persistLocalCatalog();
  }
  return productIds;
}

export async function updateProductSettings(id: string, update: ProductSettingsUpdate) {
  const db = getSupabase();
  if (db) {
    const { data: storedProduct, error: productError } = await db
      .from("products")
      .select("id, featured")
      .eq("id", id)
      .maybeSingle();
    if (productError) throw new Error("Não foi possível consultar o produto.");
    if (!storedProduct) throw new Error("Produto não encontrado.");

    if (update.featured === true && !storedProduct.featured) {
      const { count, error: countError } = await db
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("featured", true);
      if (countError) throw new Error("Não foi possível consultar os destaques do banner.");
      if ((count ?? 0) >= 5) throw new Error("O banner aceita no máximo 5 produtos.");
    }
    const payload: Record<string, boolean | number> = {};
    if (typeof update.isAvailable === "boolean") payload.is_available = update.isAvailable;
    if (typeof update.featured === "boolean") {
      payload.featured = update.featured;
      if (update.featured) payload.showcase_order = 99;
    }
    const { error } = await db.from("products").update(payload).eq("id", id);
    if (error) throw new Error("Não foi possível atualizar o produto.");
    const product = (await getCatalog()).products.find((candidate) => candidate.id === id);
    if (!product) throw new Error("Produto não encontrado.");
    return product;
  }
  await ensureLocalCatalogLoaded();
  const product = products.find((candidate) => candidate.id === id);
  if (!product) throw new Error("Produto não encontrado.");
  if (update.featured === true && !product.featured && products.filter((item) => item.featured).length >= 5) throw new Error("O banner aceita no máximo 5 produtos.");
  if (typeof update.isAvailable === "boolean") product.isAvailable = update.isAvailable;
  if (typeof update.featured === "boolean") {
    product.featured = update.featured;
    if (update.featured) product.showcaseOrder = 99;
  }
  await persistLocalCatalog();
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

async function discoveredPrinterSettings() {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from("print_agents")
      .select("name, capabilities, last_seen_at")
      .eq("is_active", true)
      .order("last_seen_at", { ascending: false })
      .limit(10);
    if (!error) {
      const latest = (data ?? []).find((agent) => parseDiscoveredPrinters((agent.capabilities as { printers?: unknown } | null)?.printers).length > 0);
      if (latest) {
        const printers = parseDiscoveredPrinters((latest.capabilities as { printers?: unknown } | null)?.printers);
        memory.discoveredPrinters = printers;
        memory.printAgentId = String(latest.name);
        memory.printAgentLastSeenAt = latest.last_seen_at ? String(latest.last_seen_at) : undefined;
        return { printers, agentId: memory.printAgentId, lastSeenAt: memory.printAgentLastSeenAt };
      }
    }
  }
  return {
    printers: memory.discoveredPrinters,
    agentId: memory.printAgentId,
    lastSeenAt: memory.printAgentLastSeenAt,
  };
}

export async function getPrintSettings(): Promise<PrintSettings> {
  const discovered = await discoveredPrinterSettings();
  const printers = discovered.printers.length ? discovered.printers : configuredPrinterOptions();
  const selectedPrinterId = printers.some((printer) => printer.id === memory.selectedPrinterId)
    ? memory.selectedPrinterId
    : preferredPrinterId(printers);
  const lastSeenMillis = discovered.lastSeenAt ? Date.parse(discovered.lastSeenAt) : 0;
  return {
    selectedPrinterId,
    printers,
    agentId: discovered.agentId,
    lastSeenAt: discovered.lastSeenAt,
    agentConnected: lastSeenMillis > 0 && Date.now() - lastSeenMillis < 30_000,
  };
}

export async function updateSelectedPrinter(selectedPrinterId: string) {
  const settings = await getPrintSettings();
  if (!settings.printers.some((printer) => printer.id === selectedPrinterId)) throw new Error("Selecione uma impressora encontrada no computador.");
  memory.selectedPrinterId = selectedPrinterId;
  return getPrintSettings();
}

export async function recordPrintAgentHeartbeat(agentId: string, printers: unknown, token: string) {
  const discoveredPrinters = parseDiscoveredPrinters(printers);
  const seenAt = now();
  const db = getSupabase();
  if (db) {
    const tokenHash = hashTrackingToken(token);
    const existing = await db.from("print_agents").select("id").eq("token_hash", tokenHash).maybeSingle();
    const payload = {
      name: agentId,
      token_hash: tokenHash,
      token_prefix: token.slice(0, 8),
      capabilities: { printers: discoveredPrinters },
      last_seen_at: seenAt,
      is_active: true,
    };
    const result = existing.data?.id
      ? await db.from("print_agents").update(payload).eq("id", existing.data.id)
      : await db.from("print_agents").upsert(payload, { onConflict: "name" });
    if (result.error) throw new Error("Não foi possível registrar as impressoras do computador.");
  }
  memory.discoveredPrinters = discoveredPrinters;
  memory.printAgentId = agentId;
  memory.printAgentLastSeenAt = seenAt;
  return { printers: discoveredPrinters, lastSeenAt: seenAt };
}

export async function updateDefaultDeliveryFee(defaultDeliveryFeeCents: number) {
  const db = getSupabase();
  if (db) {
    const { error } = await db
      .from("store_settings")
      .upsert({ id: true, default_delivery_fee_cents: defaultDeliveryFeeCents, updated_at: now() });
    if (error) throw new Error("Não foi possível atualizar a taxa padrão de entrega.");
  }
  memory.defaultDeliveryFeeCents = defaultDeliveryFeeCents;
  return { defaultDeliveryFeeCents };
}

export async function createDeliveryZoneOverride(name: string, feeCents: number) {
  const cleanName = name.trim();
  const normalizedName = normalizeNeighborhood(cleanName);
  const catalog = await getCatalog();
  if (catalog.deliveryZones.some((zone) => zone.aliases.some((alias) => normalizeNeighborhood(alias) === normalizedName))) {
    throw new Error("Esse bairro já possui uma taxa diferenciada.");
  }
  const zone: DeliveryZone = {
    id: `bairro-${newOrderId()}`,
    name: cleanName,
    aliases: [cleanName],
    feeCents,
    minimumOrderCents: 0,
    isAvailable: true,
  };
  const db = getSupabase();
  if (db) {
    const { error } = await db.from("delivery_zones").insert({
      id: zone.id,
      name: zone.name,
      aliases: zone.aliases,
      fee_cents: zone.feeCents,
      minimum_order_cents: 0,
      is_available: true,
    });
    if (error) throw new Error("Não foi possível cadastrar a taxa desse bairro.");
  } else {
    memory.deliveryZones.push(zone);
  }
  return zone;
}

export async function updateDeliveryZoneOverride(id: string, name: string, feeCents: number) {
  const cleanName = name.trim();
  const normalizedName = normalizeNeighborhood(cleanName);
  const catalog = await getCatalog();
  const existing = catalog.deliveryZones.find((zone) => zone.id === id);
  if (!existing) throw new Error("Bairro não encontrado.");
  if (catalog.deliveryZones.some((zone) => zone.id !== id && zone.aliases.some((alias) => normalizeNeighborhood(alias) === normalizedName))) {
    throw new Error("Outro bairro já utiliza esse nome.");
  }
  const db = getSupabase();
  if (db) {
    const { error } = await db
      .from("delivery_zones")
      .update({ name: cleanName, aliases: [cleanName], fee_cents: feeCents })
      .eq("id", id);
    if (error) throw new Error("Não foi possível atualizar a taxa desse bairro.");
  } else {
    const memoryZone = memory.deliveryZones.find((zone) => zone.id === id)!;
    memoryZone.name = cleanName;
    memoryZone.aliases = [cleanName];
    memoryZone.feeCents = feeCents;
  }
  return { ...existing, name: cleanName, aliases: [cleanName], feeCents };
}

export async function deleteDeliveryZoneOverride(id: string) {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from("delivery_zones")
      .update({ is_available: false })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error || !data) throw new Error("Não foi possível excluir a taxa desse bairro.");
  } else {
    const index = memory.deliveryZones.findIndex((zone) => zone.id === id);
    if (index < 0) throw new Error("Bairro não encontrado.");
    memory.deliveryZones.splice(index, 1);
  }
  return { ok: true };
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

function ticketPayload(order: Order, printerId?: string): PrintTicketPayload {
  return {
    printerId: printerId ?? defaultPrinterId(),
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

export async function createPrintTestJob(printerId?: string) {
  const settings = await getPrintSettings();
  const selectedPrinterId = printerId && settings.printers.some((printer) => printer.id === printerId) ? printerId : settings.selectedPrinterId;
  const createdAt = now();
  const payload: PrintTicketPayload = {
    printerId: selectedPrinterId,
    publicCode: "TESTE",
    createdAt,
    customerName: "Teste DogChef",
    customerPhone: "",
    deliveryType: "pickup",
    items: [{ productId: "print-test", productName: "Teste de impressão", quantity: 1, unitPriceCents: 0, optionals: [], totalCents: 0, note: "Se este papel saiu, a conexão está funcionando." }],
    totalCents: 0,
    paymentMethod: "cash",
  };
  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from("print_jobs")
      .insert({ order_id: null, kind: "test", status: "queued", payload, attempts: 0, error: null, completed_at: null })
      .select("id")
      .single();
    if (error || !data) throw new Error("Não foi possível colocar o teste na fila. A migração de teste de impressão ainda pode estar pendente.");
    return { id: String(data.id), status: "queued" as const, printerId: selectedPrinterId };
  }
  const id = newOrderId();
  memory.printJobs.push({ id, status: "queued", attempts: 0, printerId: selectedPrinterId, payload });
  return { id, status: "queued" as const, printerId: selectedPrinterId };
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
    const order = job.orderId ? memory.orders.find((candidate) => candidate.id === job.orderId) : undefined;
    if (!job.payload && !order) throw new Error("Trabalho de impressão sem pedido ou conteúdo.");
    return { id: job.id, leaseToken: job.leaseToken, leaseExpiresAt: new Date(job.leaseExpiresAt).toISOString(), agentId, payload: job.payload ?? ticketPayload(order!, job.printerId) };
  });
}

export async function completePrintJob(jobId: string, leaseToken: string, result: "printed" | "failed", error?: string) {
  const db = getSupabase();
  if (db) {
    const { data: leasedJob, error: leaseError } = await db
      .from("print_jobs")
      .select("attempts")
      .eq("id", jobId)
      .eq("lease_token", leaseToken)
      .gt("lease_expires_at", now())
      .maybeSingle();
    if (leaseError || !leasedJob) throw new Error("A reserva do trabalho de impressão expirou.");
    const nextStatus = result === "printed" ? "printed" : Number(leasedJob.attempts) >= MAX_PRINT_ATTEMPTS ? "dead" : "queued";
    const { data, error: updateError } = await db
      .from("print_jobs")
      .update({
        status: nextStatus,
        lease_token: null,
        lease_expires_at: null,
        error: error ?? null,
        completed_at: result === "printed" ? now() : null,
      })
      .eq("id", jobId)
      .eq("lease_token", leaseToken)
      .select("id")
      .maybeSingle();
    if (updateError || !data) throw new Error("A reserva do trabalho de impressão expirou.");
    return { ok: true, status: nextStatus, error };
  }
  const job = memory.printJobs.find((candidate) => candidate.id === jobId);
  if (!job || job.leaseToken !== leaseToken || (job.leaseExpiresAt ?? 0) < Date.now()) {
    throw new Error("A reserva do trabalho de impressão expirou.");
  }
  job.status = result === "printed" ? "printed" : job.attempts >= MAX_PRINT_ATTEMPTS ? "dead" : "queued";
  const order = memory.orders.find((candidate) => candidate.id === job.orderId);
  if (order) order.printStatus = job.status;
  return { ok: true, status: job.status, error };
}

export async function requeuePrintJob(orderId: string, printerId?: string) {
  const order = (await listOrders()).find((candidate) => candidate.id === orderId);
  if (!order) throw new Error("Pedido não encontrado.");
  if (!["confirmed", "preparing", "out_for_delivery", "delivered"].includes(order.status)) {
    throw new Error("O pedido precisa estar confirmado antes da impressão.");
  }

  const db = getSupabase();
  if (db) {
    const printerSettings = await getPrintSettings();
    const selectedPrinterId = printerId && printerSettings.printers.some((printer) => printer.id === printerId) ? printerId : printerSettings.selectedPrinterId;
    const { error } = await db.from("print_jobs").upsert(
      {
        order_id: orderId,
        kind: "kitchen",
        status: "queued",
        payload: ticketPayload(order, selectedPrinterId),
        attempts: 0,
        lease_token: null,
        lease_expires_at: null,
        completed_at: null,
        error: null,
      },
      { onConflict: "order_id,kind" },
    );
    if (error) throw new Error("Não foi possível colocar o pedido na fila de impressão.");
    return { status: "queued" as const };
  }

  const existing = memory.printJobs.find((candidate) => candidate.orderId === orderId);
  if (existing) {
    existing.status = "queued";
    existing.attempts = 0;
    existing.leaseToken = undefined;
    existing.leaseExpiresAt = undefined;
    const printerSettings = await getPrintSettings();
    existing.printerId = printerId && printerSettings.printers.some((printer) => printer.id === printerId) ? printerId : printerSettings.selectedPrinterId;
  } else {
    const printerSettings = await getPrintSettings();
    memory.printJobs.push({ id: newOrderId(), orderId, status: "queued", attempts: 0, printerId: printerId && printerSettings.printers.some((printer) => printer.id === printerId) ? printerId : printerSettings.selectedPrinterId });
  }
  const memoryOrder = memory.orders.find((candidate) => candidate.id === orderId);
  if (memoryOrder) memoryOrder.printStatus = "queued";
  return { status: "queued" as const };
}
