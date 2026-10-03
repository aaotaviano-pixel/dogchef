import { NextResponse, type NextRequest } from "next/server";

import { isAdminRequest } from "@/lib/auth";
import { unauthorized } from "@/lib/http";
import { buildSalesReport, getReportRange, isReportPeriod } from "@/lib/reports";
import { listReportOrders } from "@/lib/store";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const requestedPeriod = request.nextUrl.searchParams.get("period");
  const period = isReportPeriod(requestedPeriod) ? requestedPeriod : "day";
  const now = new Date();
  const range = getReportRange(period, now);
  const orders = await listReportOrders(range.startAt, range.endAt);
  return NextResponse.json(buildSalesReport(orders, period, now), {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
