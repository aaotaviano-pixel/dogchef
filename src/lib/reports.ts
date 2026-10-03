import type { DeliveryType, OrderStatus, PaymentMethod } from "@/lib/types";

export const REPORT_PERIODS = ["day", "week", "month"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export type ReportOrder = {
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  deliveryType: DeliveryType;
  totalCents: number;
  deliveryFeeCents: number;
  createdAt: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    totalCents: number;
  }>;
};

export type SalesReport = {
  period: ReportPeriod;
  periodLabel: string;
  generatedAt: string;
  range: { startAt: string; endAt: string };
  summary: {
    grossRevenueCents: number;
    deliveryFeesCents: number;
    orderCount: number;
    completedCount: number;
    inProgressCount: number;
    cancelledCount: number;
    averageTicketCents: number;
    cancellationRate: number;
  };
  series: Array<{ label: string; revenueCents: number; orders: number }>;
  statuses: Array<{ status: OrderStatus; label: string; count: number }>;
  paymentMethods: Array<{ method: PaymentMethod; label: string; count: number; revenueCents: number }>;
  fulfillment: Array<{ type: DeliveryType; label: string; count: number; revenueCents: number }>;
  topProducts: Array<{ productId: string; name: string; quantity: number; revenueCents: number }>;
};

const TIME_ZONE = "America/Sao_Paulo";
const statusLabels: Record<OrderStatus, string> = {
  pending_approval: "Aguardando",
  confirmed: "Confirmados",
  preparing: "Em preparo",
  out_for_delivery: "Em entrega",
  delivered: "Concluídos",
  cancelled: "Cancelados",
};
const paymentLabels: Record<PaymentMethod, string> = { pix: "Pix", cash: "Dinheiro", card: "Cartão" };
const fulfillmentLabels: Record<DeliveryType, string> = { delivery: "Entrega", pickup: "Retirada" };

type ZonedParts = { year: number; month: number; day: number; hour: number };

function zonedParts(date: Date): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: read("year"), month: read("month"), day: read("day"), hour: read("hour") };
}

function timeZoneOffsetMs(date: Date) {
  const parts = zonedParts(date);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour) - Math.floor(date.getTime() / 3_600_000) * 3_600_000;
}

function zonedStartToUtc(year: number, month: number, day: number) {
  const localAsUtc = Date.UTC(year, month - 1, day);
  const guess = new Date(localAsUtc);
  const firstOffset = timeZoneOffsetMs(guess);
  let result = new Date(localAsUtc - firstOffset);
  const correctedOffset = timeZoneOffsetMs(result);
  if (correctedOffset !== firstOffset) result = new Date(localAsUtc - correctedOffset);
  return result;
}

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}

export function isReportPeriod(value: string | null): value is ReportPeriod {
  return REPORT_PERIODS.includes(value as ReportPeriod);
}

export function getReportRange(period: ReportPeriod, now = new Date()) {
  const local = zonedParts(now);
  const localDaySerial = Date.UTC(local.year, local.month - 1, local.day);
  let startSerial = localDaySerial;
  if (period === "week") {
    const weekday = new Date(localDaySerial).getUTCDay();
    startSerial -= ((weekday + 6) % 7) * 86_400_000;
  } else if (period === "month") {
    startSerial = Date.UTC(local.year, local.month - 1, 1);
  }
  const startDate = new Date(startSerial);
  const startAt = zonedStartToUtc(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, startDate.getUTCDate());
  const shortDate = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "short" });
  const periodLabel = period === "day"
    ? capitalize(new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, dateStyle: "long" }).format(now))
    : period === "week"
      ? `Semana de ${shortDate.format(startAt)} a ${shortDate.format(now)}`
      : capitalize(new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, month: "long", year: "numeric" }).format(now));
  return { startAt: startAt.toISOString(), endAt: now.toISOString(), periodLabel };
}

function buildSeries(period: ReportPeriod, now: Date) {
  const local = zonedParts(now);
  if (period === "day") {
    return Array.from({ length: 24 }, (_, hour) => ({ label: `${String(hour).padStart(2, "0")}h`, revenueCents: 0, orders: 0 }));
  }
  if (period === "week") {
    return ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((label) => ({ label, revenueCents: 0, orders: 0 }));
  }
  const daysInMonth = new Date(Date.UTC(local.year, local.month, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, index) => ({ label: String(index + 1).padStart(2, "0"), revenueCents: 0, orders: 0 }));
}

function seriesIndex(period: ReportPeriod, createdAt: string, now: Date) {
  const order = zonedParts(new Date(createdAt));
  if (period === "day") return order.hour;
  if (period === "month") return order.day - 1;
  const current = zonedParts(now);
  const currentSerial = Date.UTC(current.year, current.month - 1, current.day);
  const weekday = new Date(currentSerial).getUTCDay();
  const mondaySerial = currentSerial - ((weekday + 6) % 7) * 86_400_000;
  const orderSerial = Date.UTC(order.year, order.month - 1, order.day);
  return Math.floor((orderSerial - mondaySerial) / 86_400_000);
}

export function buildSalesReport(orders: ReportOrder[], period: ReportPeriod, now = new Date()): SalesReport {
  const range = getReportRange(period, now);
  const completed = orders.filter((order) => order.status === "delivered");
  const cancelled = orders.filter((order) => order.status === "cancelled");
  const inProgress = orders.filter((order) => !["delivered", "cancelled"].includes(order.status));
  const grossRevenueCents = completed.reduce((sum, order) => sum + order.totalCents, 0);
  const deliveryFeesCents = completed.reduce((sum, order) => sum + order.deliveryFeeCents, 0);
  const series = buildSeries(period, now);
  completed.forEach((order) => {
    const index = seriesIndex(period, order.createdAt, now);
    if (!series[index]) return;
    series[index].orders += 1;
    series[index].revenueCents += order.totalCents;
  });

  const productTotals = new Map<string, SalesReport["topProducts"][number]>();
  completed.forEach((order) => order.items.forEach((item) => {
    const current = productTotals.get(item.productId) ?? { productId: item.productId, name: item.productName, quantity: 0, revenueCents: 0 };
    current.quantity += item.quantity;
    current.revenueCents += item.totalCents;
    productTotals.set(item.productId, current);
  }));

  const paymentMethods = (["pix", "cash", "card"] as PaymentMethod[]).map((method) => {
    const matching = completed.filter((order) => order.paymentMethod === method);
    return { method, label: paymentLabels[method], count: matching.length, revenueCents: matching.reduce((sum, order) => sum + order.totalCents, 0) };
  });
  const fulfillment = (["delivery", "pickup"] as DeliveryType[]).map((type) => {
    const matching = completed.filter((order) => order.deliveryType === type);
    return { type, label: fulfillmentLabels[type], count: matching.length, revenueCents: matching.reduce((sum, order) => sum + order.totalCents, 0) };
  });

  return {
    period,
    periodLabel: range.periodLabel,
    generatedAt: now.toISOString(),
    range: { startAt: range.startAt, endAt: range.endAt },
    summary: {
      grossRevenueCents,
      deliveryFeesCents,
      orderCount: orders.length,
      completedCount: completed.length,
      inProgressCount: inProgress.length,
      cancelledCount: cancelled.length,
      averageTicketCents: completed.length ? Math.round(grossRevenueCents / completed.length) : 0,
      cancellationRate: orders.length ? Math.round((cancelled.length / orders.length) * 1_000) / 10 : 0,
    },
    series,
    statuses: (Object.keys(statusLabels) as OrderStatus[]).map((status) => ({ status, label: statusLabels[status], count: orders.filter((order) => order.status === status).length })),
    paymentMethods,
    fulfillment,
    topProducts: [...productTotals.values()].sort((left, right) => right.quantity - left.quantity || right.revenueCents - left.revenueCents).slice(0, 5),
  };
}
