import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type PolicyName = "publicRead" | "auth" | "orderCreate" | "write";

type Policy = {
  name: PolicyName;
  limit: number;
  window: "1 m";
};

const PUBLIC_READ_POLICY: Policy = { name: "publicRead", limit: 60, window: "1 m" };
const AUTH_POLICY: Policy = { name: "auth", limit: 5, window: "1 m" };
const ORDER_POLICY: Policy = { name: "orderCreate", limit: 10, window: "1 m" };
const WRITE_POLICY: Policy = { name: "write", limit: 30, window: "1 m" };

const AUTH_PATHS = new Set([
  "/api/v1/admin/login",
  "/api/v1/customer/login",
  "/api/v1/customer/register",
  "/api/v1/customer/google",
  "/api/v1/customer/password/forgot",
  "/api/v1/customer/password/reset",
]);

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const hasUpstashConfiguration = Boolean(redisUrl && redisToken);

const redis = hasUpstashConfiguration ? new Redis({ url: redisUrl!, token: redisToken! }) : null;

const limiters = redis
  ? {
      publicRead: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(PUBLIC_READ_POLICY.limit, PUBLIC_READ_POLICY.window),
        prefix: "dogchef:ratelimit:public-read",
        timeout: 1000,
      }),
      auth: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(AUTH_POLICY.limit, AUTH_POLICY.window),
        prefix: "dogchef:ratelimit:auth",
        timeout: 1000,
      }),
      orderCreate: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(ORDER_POLICY.limit, ORDER_POLICY.window),
        prefix: "dogchef:ratelimit:orders",
        timeout: 1000,
      }),
      write: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(WRITE_POLICY.limit, WRITE_POLICY.window),
        prefix: "dogchef:ratelimit:write",
        timeout: 1000,
      }),
    }
  : null;

function validIp(value: string | null) {
  if (!value) return null;
  const candidate = value.trim().replace(/^\[|\]$/g, "").split("%")[0];
  if (!candidate || candidate.length > 45) return null;

  const ipv4Parts = candidate.split(".");
  if (ipv4Parts.length === 4 && ipv4Parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) {
    return candidate;
  }

  if (candidate.includes(":") && /^[0-9a-f:]+$/i.test(candidate)) {
    return candidate.toLowerCase();
  }

  return null;
}

function clientIp(request: NextRequest) {
  const realIp = validIp(request.headers.get("x-real-ip"));
  if (realIp) return realIp;

  const forwardedIps = request.headers.get("x-forwarded-for")?.split(",") ?? [];
  for (const forwardedIp of forwardedIps) {
    const parsedIp = validIp(forwardedIp);
    if (parsedIp) return parsedIp;
  }

  return "unknown";
}

function policyFor(request: NextRequest): Policy | null {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/api/v1/") || request.method === "OPTIONS") return null;

  if (request.method === "POST" && AUTH_PATHS.has(pathname)) return AUTH_POLICY;
  if (request.method === "POST" && pathname === "/api/v1/orders") return ORDER_POLICY;
  if (request.method === "GET") return PUBLIC_READ_POLICY;
  return WRITE_POLICY;
}

function rateHeaders(policy: Policy, remaining: number, reset: number) {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", String(policy.limit));
  headers.set("X-RateLimit-Remaining", String(Math.max(0, remaining)));
  headers.set("X-RateLimit-Reset", String(Math.ceil(reset / 1000)));
  return headers;
}

function retryAfter(reset: number) {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

export async function middleware(request: NextRequest) {
  const policy = policyFor(request);
  if (!policy || !limiters) return NextResponse.next();

  const limiter = limiters[policy.name];
  const identifier = `${request.nextUrl.hostname}:${clientIp(request)}`;

  try {
    const result = await limiter.limit(identifier);
    const headers = rateHeaders(policy, result.remaining, result.reset);

    if (!result.success) {
      const seconds = retryAfter(result.reset);
      headers.set("Retry-After", String(seconds));
      headers.set("Cache-Control", "no-store");
      return NextResponse.json(
        {
          error: "Muitas requisições. Tente novamente em instantes.",
          code: "RATE_LIMITED",
          retryAfter: seconds,
        },
        { status: 429, headers },
      );
    }

    const response = NextResponse.next();
    headers.forEach((value, key) => response.headers.set(key, value));
    return response;
  } catch {
    // Upstash is an availability layer. Its timeout is fail-open so an outage does not
    // take the storefront or checkout offline; Vercel/Upstash should still be monitored.
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/api/v1/:path*"],
};
