import type { NextConfig } from "next";

import { privateResponseHeaders, securityHeaders } from "./src/lib/security";

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "192.168.1.16"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
  },
  async headers() {
    const globalHeaders = securityHeaders(process.env.NODE_ENV === "production");
    return [
      { source: "/(.*)", headers: globalHeaders },
      { source: "/admin/:path*", headers: privateResponseHeaders },
      { source: "/auth/:path*", headers: privateResponseHeaders },
      { source: "/meus-pedidos", headers: privateResponseHeaders },
      { source: "/pedido/:path*", headers: privateResponseHeaders },
      { source: "/api/v1/admin/:path*", headers: privateResponseHeaders },
      { source: "/api/v1/customer/:path*", headers: privateResponseHeaders },
      { source: "/api/v1/orders/:path*", headers: privateResponseHeaders },
      { source: "/api/v1/print-agent/:path*", headers: privateResponseHeaders },
    ];
  },
};

export default nextConfig;
