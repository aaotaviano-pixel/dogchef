import { NextResponse } from "next/server";

import { isAdminConfigured, isAdminRequest } from "@/lib/auth";
import { unauthorized } from "@/lib/http";
import { getCatalog, getPrintSettings, isDatabaseConfigured, listOrders } from "@/lib/store";

export async function GET(request: import("next/server").NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  const [orders, catalog, print] = await Promise.all([listOrders(), getCatalog(), getPrintSettings()]);
  return NextResponse.json(
    {
      orders,
      catalog,
      databaseConfigured: isDatabaseConfigured(),
      adminConfigured: isAdminConfigured(),
      integrations: {
        pix: catalog.pixConfigured ? "configured" : "waiting",
        siteNotifications: "active",
      },
      print,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
