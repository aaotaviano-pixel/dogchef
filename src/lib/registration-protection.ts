import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export class RegistrationProtectionError extends Error {
  constructor(public code: string, public status: number, message: string, public retryAfter?: number) {
    super(message);
  }
}

type LimitResult = { success: boolean; reset: number; reason?: string };
export type RegistrationLimiters = {
  hourly: { limit: (key: string) => Promise<LimitResult> };
  daily: { limit: (key: string) => Promise<LimitResult> };
  email: { limit: (key: string) => Promise<LimitResult> };
};

let limiters: RegistrationLimiters | undefined;

function unavailable(): never {
  throw new RegistrationProtectionError("REGISTRATION_UNAVAILABLE", 503,
    "Não foi possível verificar a segurança do cadastro agora. Tente novamente em instantes.", 60);
}

function getLimiters(): RegistrationLimiters {
  if (limiters) return limiters;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return unavailable();
  const redis = new Redis({ url, token });
  // Shared by every domain and deployment of this store. No hostname in the key:
  // switching between the custom domain and vercel.app must not reset the quota.
  limiters = {
    hourly: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, "1 h"), prefix: "dogchef:registration:hour", timeout: 1500 }),
    daily: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 d"), prefix: "dogchef:registration:day", timeout: 1500 }),
    email: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, "1 h"), prefix: "dogchef:registration:email", timeout: 1500 }),
  };
  return limiters;
}

export function registrationIp(headers: Headers, onVercel = process.env.VERCEL === "1") {
  // Vercel overwrites these proxy headers. Never accept an arbitrary client-supplied
  // header instead of the platform's authoritative address.
  const raw = onVercel
    ? headers.get("x-vercel-forwarded-for") || headers.get("x-forwarded-for")
    : headers.get("x-forwarded-for") || headers.get("x-real-ip");
  const ip = raw?.split(",")[0]?.trim();
  if (!ip || !isIP(ip)) return "unknown";
  if (isIP(ip) === 4) return ip;
  const canonical = new URL(`http://[${ip}]`).hostname.slice(1, -1);
  // IPv4-mapped IPv6 addresses share the IPv4 quota.
  if (canonical.startsWith("::ffff:")) {
    const words = canonical.slice(7).split(":").map((word) => parseInt(word, 16));
    return [words[0] >> 8, words[0] & 255, words[1] >> 8, words[1] & 255].join(".");
  }
  const [left, right] = canonical.split("::");
  const start = left ? left.split(":") : [];
  const end = right ? right.split(":") : [];
  const words = right === undefined ? start : [...start, ...Array(8 - start.length - end.length).fill("0"), ...end];
  // IPv6 clients commonly rotate host addresses in the same /64 network.
  return `${words.slice(0, 4).map((word) => parseInt(word, 16).toString(16)).join(":")}::/64`;
}

export function registrationEmailKey(email: string) {
  const [local, domain] = email.trim().toLowerCase().split("@");
  // Canonicalization is used ONLY for throttling, never to merge customer records.
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${local.split("+")[0].replaceAll(".", "")}@gmail.com`;
  }
  return `${local}@${domain}`;
}

export async function enforceRegistrationLimits(
  headers: Headers,
  email: string,
  dependencies?: { limiters: RegistrationLimiters; secret: string; now?: number; onVercel?: boolean },
) {
  const secret = dependencies?.secret || process.env.CUSTOMER_SESSION_SECRET;
  if (!secret) return unavailable();
  const hash = (value: string) => createHmac("sha256", secret).update(`registration:${value}`).digest("hex");
  const ip = hash(`ip:${registrationIp(headers, dependencies?.onVercel)}`);
  const identity = hash(`email:${registrationEmailKey(email)}`);
  try {
    const limits = dependencies?.limiters || getLimiters();
    const results = await Promise.all([limits.hourly.limit(ip), limits.daily.limit(ip), limits.email.limit(identity)]);
    // Upstash timeouts return success:true with reason:timeout. Treat those as
    // unavailable too, so an outage cannot disable protection for new accounts.
    if (results.some((result) => result.reason === "timeout")) return unavailable();
    const blocked = results.filter((result) => !result.success);
    if (blocked.length) {
      const retryAfter = Math.max(1, Math.ceil((Math.max(...blocked.map((result) => result.reset)) - (dependencies?.now ?? Date.now())) / 1000));
      throw new RegistrationProtectionError("REGISTRATION_RATE_LIMITED", 429,
        "Muitas tentativas de cadastro nesta conexão. Aguarde antes de tentar novamente. Se já tem conta, use Entrar.", retryAfter);
    }
  } catch (error) {
    if (error instanceof RegistrationProtectionError) throw error;
    return unavailable();
  }
}

export function registrationProtectionResponse(error: unknown) {
  const known = error instanceof RegistrationProtectionError ? error
    : new RegistrationProtectionError("REGISTRATION_UNAVAILABLE", 503, "Não foi possível verificar a segurança do cadastro agora.", 60);
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  if (known.retryAfter) headers.set("Retry-After", String(known.retryAfter));
  return Response.json({ error: known.message, code: known.code, retryAfter: known.retryAfter }, { status: known.status, headers });
}
