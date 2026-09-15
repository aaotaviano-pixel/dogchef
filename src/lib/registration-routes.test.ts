import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { NextRequest } from "next/server";
import { POST as register } from "../app/api/v1/customer/register/route";
import { POST as google } from "../app/api/v1/customer/google/route";
import { verifyCustomerPassword } from "./customer-auth";

const originalEnv = { ...process.env };
process.env.CUSTOMER_SESSION_SECRET = "registration-route-tests-only-strong-secret";
process.env.SUPABASE_URL = "https://dogchef-auth.test";
process.env.SUPABASE_SECRET_KEY = "test-key";
for (const key of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN", "TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY"]) delete process.env[key];
test.after(() => { process.env = originalEnv; });

function request(path: string, body: unknown) {
  return new NextRequest(`https://dogchef.example/api/v1/customer/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.1" }, body: JSON.stringify(body),
  });
}
const registration = { name: "Test Customer", email: "test@example.com", phone: "35991234567", password: "test-password" };
const token = "test-access-token-for-route-validation";
const authUser = { id: "00000000-0000-4000-8000-000000000001", email: "test@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", identities: [{ provider: "google" }], user_metadata: { full_name: "Test Customer" }, app_metadata: { provider: "google" } };
const account = { id: "00000000-0000-4000-8000-000000000002", auth_user_id: authUser.id, name: "Test Customer", email: authUser.email, phone: "35991234567", created_at: "2026-01-01T00:00:00Z" };

test("registration rejects bot fields and malformed input before any database call", async (t) => {
  const fetcher = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected database call"); });
  for (const body of [{ ...registration, website: "https://spam.test" }, { ...registration, phone: "abcdefghijk" }, {}]) {
    const response = await register(request("register", body));
    assert.equal(response.status, 422);
    assert.equal(response.headers.has("Set-Cookie"), false);
  }
  assert.equal(fetcher.mock.callCount(), 0);
});

test("registration fails closed without Redis and creates neither a customer nor a session", async (t) => {
  const fetcher = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected database call"); });
  const response = await register(request("register", registration));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "REGISTRATION_UNAVAILABLE");
  assert.equal(response.headers.has("Set-Cookie"), false);
  assert.equal(fetcher.mock.callCount(), 0);
});

function fakeSupabase(t: TestContext, existing: boolean, provider = "google") {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method || "GET"} ${url}`);
    if (init?.method && init.method !== "GET") throw new Error("Unexpected mutation in login test");
    if (url.startsWith("https://dogchef-auth.test/auth/v1/user")) return Response.json({ ...authUser, identities: [{ provider }] });
    if (url.startsWith("https://dogchef-auth.test/rest/v1/customer_accounts")) return Response.json(existing ? account : null);
    throw new Error(`Unexpected external request: ${new URL(url).hostname}`);
  });
  return calls;
}

test("returning Google customers can log in while Redis is unavailable", async (t) => {
  const calls = fakeSupabase(t, true);
  const response = await google(request("google", { accessToken: token }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).customer.id, account.id);
  assert.match(response.headers.get("Set-Cookie")!, /dogchef_customer=/);
  assert.ok(calls.every((call) => call.startsWith("GET ")));
});

test("new Google accounts are blocked when Redis is unavailable", async (t) => {
  const calls = fakeSupabase(t, false);
  const response = await google(request("google", { accessToken: token }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.has("Set-Cookie"), false);
  assert.ok(calls.every((call) => call.startsWith("GET ")));
});

test("Google endpoint rejects non-Google tokens even when email is confirmed", async (t) => {
  const calls = fakeSupabase(t, false, "email");
  const response = await google(request("google", { accessToken: token }));
  assert.equal(response.status, 401);
  assert.equal(response.headers.has("Set-Cookie"), false);
  assert.equal(calls.length, 1);
});

test("Turnstile is required only for new Google customers when configured", async (t) => {
  process.env.TURNSTILE_SECRET_KEY = "test-secret";
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site";
  t.after(() => { delete process.env.TURNSTILE_SECRET_KEY; delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY; });
  fakeSupabase(t, false);
  const response = await google(request("google", { accessToken: token }));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "CAPTCHA_REQUIRED");
  assert.equal(response.headers.has("Set-Cookie"), false);
});

test("protected registration persists a hashed password and Google creates an account only after the quotas pass", async (t) => {
  process.env.KV_REST_API_URL = "https://dogchef-redis.test";
  process.env.KV_REST_API_TOKEN = "test-redis-token";
  t.after(() => { delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN; });
  const writes: Record<string, unknown>[] = [];
  let quotaChecks = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://dogchef-redis.test")) {
      const body = JSON.parse(String(init?.body));
      const commands = Array.isArray(body[0]) ? body : [body];
      quotaChecks += commands.length;
      const results = commands.map(() => ({ result: [2, 3] }));
      return Response.json(Array.isArray(body[0]) ? results : results[0]);
    }
    if (url.startsWith("https://dogchef-auth.test/auth/v1/user")) return Response.json(authUser);
    if (url.startsWith("https://dogchef-auth.test/rest/v1/customer_accounts")) {
      if (init?.method === "POST") {
        assert.ok(quotaChecks >= (writes.length + 1) * 3, "all quotas must pass before insertion");
        const row = JSON.parse(String(init.body));
        writes.push(row);
        return Response.json({ ...account, ...row }, { status: 201 });
      }
      assert.ok(!init?.method || init.method === "GET");
      return Response.json(null);
    }
    throw new Error(`Unexpected external request: ${new URL(url).hostname}`);
  });

  const response = await register(request("register", registration));
  assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
  const payload = await response.json();
  assert.equal(payload.customer.email, registration.email);
  assert.equal(payload.customer.passwordHash, undefined);
  assert.equal(payload.customer.password_hash, undefined);
  assert.match(response.headers.get("Set-Cookie")!, /dogchef_customer=/);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].phone, registration.phone);
  assert.equal(await verifyCustomerPassword(registration.password, String(writes[0].password_hash)), true);

  const googleResponse = await google(request("google", { accessToken: token }));
  assert.equal(googleResponse.status, 200, JSON.stringify(await googleResponse.clone().json()));
  assert.match(googleResponse.headers.get("Set-Cookie")!, /dogchef_customer=/);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].auth_user_id, authUser.id);
  assert.equal(writes[1].password_hash, null);
  assert.equal(quotaChecks, 6);
});
