import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { NextRequest } from "next/server";

import { POST as login } from "../app/api/v1/customer/login/route";
import { GET as session } from "../app/api/v1/customer/session/route";
import { hashCustomerPassword } from "./customer-auth";

const originalEnv = { ...process.env };
process.env.CUSTOMER_SESSION_SECRET = "customer-login-tests-only-strong-secret";
process.env.SUPABASE_URL = "https://dogchef-login.test";
process.env.SUPABASE_SECRET_KEY = "test-key";
test.after(() => { process.env = originalEnv; });

const account = {
  id: "00000000-0000-4000-8000-000000000021",
  name: "Cliente Teste",
  phone: "35991234567",
  email: "cliente@example.com",
  auth_user_id: null,
  created_at: "2026-01-01T00:00:00Z",
};

function fakeCustomerDatabase(t: TestContext, passwordHash: string) {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method || "GET"} ${url}`);
    if (!url.startsWith("https://dogchef-login.test/rest/v1/customer_accounts")) {
      throw new Error(`Unexpected external request: ${new URL(url).hostname}`);
    }
    return Response.json({ ...account, password_hash: passwordHash });
  });
  return calls;
}

test("email login creates a usable customer session on the first attempt", async (t) => {
  const password = "senha-segura-123";
  const calls = fakeCustomerDatabase(t, await hashCustomerPassword(password));
  const loginResponse = await login(new NextRequest("https://dogchef.example/api/v1/customer/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: account.email, password }),
  }));

  assert.equal(loginResponse.status, 200);
  assert.equal((await loginResponse.clone().json()).customer.id, account.id);
  const setCookie = loginResponse.headers.get("Set-Cookie");
  assert.match(setCookie!, /dogchef_customer=/);

  const cookie = setCookie!.split(";", 1)[0];
  const sessionResponse = await session(new NextRequest("https://dogchef.example/api/v1/customer/session", {
    headers: { Cookie: cookie },
  }));
  assert.equal(sessionResponse.status, 200);
  assert.equal((await sessionResponse.json()).customer.id, account.id);
  assert.equal(calls.length, 3);
});
