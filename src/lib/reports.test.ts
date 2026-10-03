import assert from "node:assert/strict";
import test from "node:test";

import { buildSalesReport, getReportRange, type ReportOrder } from "./reports";

const now = new Date("2026-10-02T15:00:00.000Z");

function order(update: Partial<ReportOrder> = {}): ReportOrder {
  return {
    status: "delivered",
    paymentMethod: "cash",
    deliveryType: "delivery",
    totalCents: 4000,
    deliveryFeeCents: 800,
    createdAt: "2026-10-02T14:00:00.000Z",
    items: [{ productId: "dog-1", productName: "Dog do Chef", quantity: 2, totalCents: 3200 }],
    ...update,
  };
}

test("report ranges follow São Paulo day, Monday week and calendar month", () => {
  assert.equal(getReportRange("day", now).startAt, "2026-10-02T03:00:00.000Z");
  assert.equal(getReportRange("week", now).startAt, "2026-09-28T03:00:00.000Z");
  assert.equal(getReportRange("month", now).startAt, "2026-10-01T03:00:00.000Z");
});

test("sales report counts only delivered orders as revenue", () => {
  const report = buildSalesReport([
    order(),
    order({ status: "cancelled", totalCents: 9000 }),
    order({ status: "preparing", totalCents: 5000 }),
    order({ paymentMethod: "pix", deliveryType: "pickup", totalCents: 6000, deliveryFeeCents: 0, items: [{ productId: "dog-1", productName: "Dog do Chef", quantity: 1, totalCents: 6000 }] }),
  ], "day", now);

  assert.deepEqual(report.summary, {
    grossRevenueCents: 10000,
    deliveryFeesCents: 800,
    orderCount: 4,
    completedCount: 2,
    inProgressCount: 1,
    cancelledCount: 1,
    averageTicketCents: 5000,
    cancellationRate: 25,
  });
  assert.equal(report.topProducts[0].quantity, 3);
  assert.equal(report.paymentMethods.find((item) => item.method === "pix")?.revenueCents, 6000);
  assert.equal(report.fulfillment.find((item) => item.type === "pickup")?.count, 1);
  assert.equal(report.series[11].revenueCents, 10000);
});

test("weekly and monthly series place sales in the correct local bucket", () => {
  const weekly = buildSalesReport([order({ createdAt: "2026-09-28T12:00:00.000Z" })], "week", now);
  assert.equal(weekly.series[0].orders, 1);
  const monthly = buildSalesReport([order({ createdAt: "2026-10-02T14:00:00.000Z" })], "month", now);
  assert.equal(monthly.series[1].revenueCents, 4000);
  assert.equal(monthly.series.length, 31);
});
