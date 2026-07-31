import { createHmac, timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

const COOKIE_NAME = "dogchef_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function secret() {
  return process.env.ADMIN_SESSION_SECRET;
}

function signature(payload: string) {
  const value = secret();
  if (!value) return null;
  return createHmac("sha256", value).update(payload).digest("base64url");
}

export function isAdminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && secret());
}

export function createAdminSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `admin.${expiresAt}`;
  const digest = signature(payload);
  if (!digest) throw new Error("O acesso administrativo ainda não está configurado.");
  return `${payload}.${digest}`;
}

export function verifyAdminSession(token?: string) {
  if (!token || !secret()) return false;
  const [role, rawExpiration, supplied] = token.split(".");
  if (role !== "admin" || !rawExpiration || !supplied) return false;
  if (Number(rawExpiration) < Math.floor(Date.now() / 1000)) return false;
  const expected = signature(`${role}.${rawExpiration}`);
  if (!expected || expected.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export function isAdminRequest(request: NextRequest) {
  return verifyAdminSession(request.cookies.get(COOKIE_NAME)?.value);
}

export function adminCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function hasValidAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length !== password.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(password));
}
