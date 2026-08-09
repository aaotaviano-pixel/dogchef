import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import type { NextRequest } from "next/server";

import { getSupabase } from "@/lib/supabase";

const COOKIE_NAME = "dogchef_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const scrypt = promisify(scryptCallback);
const localAdminPasswordFile = path.join(process.cwd(), ".data", "admin-password.json");

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

async function hashAdminPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(password, Buffer.from(salt, "base64url"), 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

async function verifyAdminPasswordHash(password: string, encoded: string) {
  const [, salt, expectedEncoded] = encoded.split("$");
  if (!salt || !expectedEncoded) return false;
  try {
    const expected = Buffer.from(expectedEncoded, "base64url");
    const derived = await scrypt(password, Buffer.from(salt, "base64url"), expected.length) as Buffer;
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

async function readStoredAdminPasswordHash() {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db
      .from("admin_settings")
      .select("password_hash, bootstrap_used")
      .eq("id", true)
      .maybeSingle();
    if (error) {
      if (error.code === "42P01" || error.message.toLowerCase().includes("admin_settings")) return null;
      throw new Error("Não foi possível consultar a senha administrativa.");
    }
    return data?.password_hash ? { hash: String(data.password_hash), bootstrapUsed: Boolean(data.bootstrap_used) } : null;
  }
  if (process.env.NODE_ENV === "production") return null;
  try {
    const stored = JSON.parse(await readFile(localAdminPasswordFile, "utf8")) as { passwordHash?: string; bootstrapUsed?: boolean };
    return stored.passwordHash ? { hash: stored.passwordHash, bootstrapUsed: Boolean(stored.bootstrapUsed) } : null;
  } catch {
    return null;
  }
}

export async function verifyAdminPassword(password: string) {
  const storedHash = await readStoredAdminPasswordHash();
  if (!storedHash) return hasValidAdminPassword(password);
  if (!storedHash.bootstrapUsed && hasValidAdminPassword(password)) return true;
  return verifyAdminPasswordHash(password, storedHash.hash);
}

export async function changeAdminPassword(currentPassword: string, nextPassword: string) {
  if (!(await verifyAdminPassword(currentPassword))) throw new Error("A senha atual está incorreta.");
  const passwordHash = await hashAdminPassword(nextPassword);
  const db = getSupabase();
  if (db) {
    const { error } = await db.from("admin_settings").upsert({
      id: true,
      password_hash: passwordHash,
      bootstrap_used: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (error) {
      if (error.code === "42P01" || error.message.toLowerCase().includes("admin_settings")) {
        throw new Error("A migração de senha administrativa ainda não foi aplicada no banco.");
      }
      throw new Error("Não foi possível salvar a nova senha administrativa.");
    }
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("A persistência da senha administrativa não está configurada.");
  await mkdir(path.dirname(localAdminPasswordFile), { recursive: true });
  const temporaryFile = `${localAdminPasswordFile}.${process.pid}.tmp`;
  await writeFile(temporaryFile, JSON.stringify({ passwordHash, bootstrapUsed: true }, null, 2), { encoding: "utf8", mode: 0o600 });
  await rename(temporaryFile, localAdminPasswordFile);
}
