import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import type { NextRequest } from "next/server";
import { z } from "zod";

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = "dogchef_customer";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
let localSessionSecret: string | undefined;

export const customerRegistrationSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(80),
  phone: z.string().trim().min(10, "Informe um telefone válido.").max(20),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(120),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72),
});

export const customerLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(120),
  password: z.string().min(1, "Informe sua senha.").max(72),
});

export const customerProfileSchema = z.object({
  phone: z.string().trim().min(10, "Informe um telefone válido.").max(20),
});

function sessionSecret() {
  if (process.env.CUSTOMER_SESSION_SECRET) return process.env.CUSTOMER_SESSION_SECRET;
  if (process.env.NODE_ENV !== "production") {
    if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
    if (localSessionSecret) return localSessionSecret;
    const secretFile = path.join(process.cwd(), ".data", "customer-session.secret");
    try {
      localSessionSecret = readFileSync(secretFile, "utf8").trim();
    } catch {
      mkdirSync(path.dirname(secretFile), { recursive: true });
      localSessionSecret = randomBytes(48).toString("base64url");
      writeFileSync(secretFile, localSessionSecret, { encoding: "utf8", mode: 0o600 });
    }
    return localSessionSecret;
  }
  return undefined;
}

function sign(payload: string) {
  const secret = sessionSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function isCustomerAuthConfigured() {
  return Boolean(sessionSecret());
}

export function createCustomerSession(customerId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `customer.${customerId}.${expiresAt}`;
  const signature = sign(payload);
  if (!signature) throw new Error("O acesso de clientes ainda não está configurado.");
  return `${payload}.${signature}`;
}

export function verifyCustomerSession(token?: string) {
  if (!token || !sessionSecret()) return null;
  const [role, customerId, rawExpiration, supplied] = token.split(".");
  if (role !== "customer" || !customerId || !rawExpiration || !supplied) return null;
  if (Number(rawExpiration) < Math.floor(Date.now() / 1000)) return null;
  const expected = sign(`${role}.${customerId}.${rawExpiration}`);
  if (!expected || expected.length !== supplied.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return null;
  return customerId;
}

export function customerIdFromRequest(request: NextRequest) {
  return verifyCustomerSession(request.cookies.get(COOKIE_NAME)?.value);
}

export function customerCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function normalizeCustomerEmail(email: string) {
  return email.trim().toLocaleLowerCase("pt-BR");
}

export function normalizeCustomerPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export async function hashCustomerPassword(password: string) {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyCustomerPassword(password: string, stored?: string | null) {
  if (!stored) return false;
  const [algorithm, encodedSalt, encodedHash] = stored.split("$");
  if (algorithm !== "scrypt" || !encodedSalt || !encodedHash) return false;
  const expected = Buffer.from(encodedHash, "base64url");
  const derived = (await scrypt(password, Buffer.from(encodedSalt, "base64url"), expected.length)) as Buffer;
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
