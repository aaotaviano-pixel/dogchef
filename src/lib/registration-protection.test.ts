import assert from "node:assert/strict";
import test from "node:test";
import { enforceRegistrationLimits, registrationEmailKey, registrationIp, registrationProtectionResponse, RegistrationProtectionError, type RegistrationLimiters } from "./registration-protection";
import { readRegistrationJson } from "./registration-request";
import { verifyRegistrationChallenge } from "./turnstile";
import { customerRegistrationSchema } from "./customer-auth";

const headers = new Headers({ "x-forwarded-for": "192.0.2.1" });
const allow = { success: true, reset: 60000 };
function limits(result: { success: boolean; reset: number; reason?: string } = allow): RegistrationLimiters {
  return { hourly: { limit: async () => result }, daily: { limit: async () => result }, email: { limit: async () => result } };
}

test("new account quotas count repeated attempts and reject the fourth attempt", async () => {
  let attempts = 0;
  const limiters = limits();
  limiters.hourly.limit = async () => ({ success: ++attempts <= 3, reset: 60000 });
  for (let attempt = 0; attempt < 3; attempt++) {
    await enforceRegistrationLimits(headers, `user${attempt}@example.com`, { limiters, secret: "test", now: 0 });
  }
  await assert.rejects(enforceRegistrationLimits(headers, "user4@example.com", { limiters, secret: "test", now: 0 }),
    (error: unknown) => error instanceof RegistrationProtectionError && error.status === 429 && error.retryAfter === 60);
});

test("daily and identity limits are enforced independently with the longest retry delay", async () => {
  const limiters = limits();
  limiters.daily.limit = async () => ({ success: false, reset: 86400000 });
  limiters.email.limit = async () => ({ success: false, reset: 3600000 });
  await assert.rejects(enforceRegistrationLimits(headers, "user@example.com", { limiters, secret: "test", now: 0 }),
    (error: unknown) => error instanceof RegistrationProtectionError && error.retryAfter === 86400);
});

test("Redis failures and Upstash success:true timeout responses fail closed", async () => {
  const unavailable = limits();
  unavailable.hourly.limit = async () => { throw new Error("offline"); };
  for (const limiters of [unavailable, limits({ ...allow, reason: "timeout" })]) {
    await assert.rejects(enforceRegistrationLimits(headers, "user@example.com", { limiters, secret: "test" }),
      (error: unknown) => error instanceof RegistrationProtectionError && error.status === 503);
  }
});

test("all hostnames share quotas and rate keys do not expose emails or IPs", async () => {
  const keys: string[] = [];
  const limiters = limits();
  for (const limiter of Object.values(limiters)) limiter.limit = async (key: string) => { keys.push(key); return allow; };
  await enforceRegistrationLimits(new Headers({ ...Object.fromEntries(headers), host: "dogchef-one.vercel.app" }), "User.Name+one@gmail.com", { limiters, secret: "test" });
  await enforceRegistrationLimits(new Headers({ ...Object.fromEntries(headers), host: "dogdochef.ddns.net" }), "username+two@googlemail.com", { limiters, secret: "test" });
  assert.deepEqual(keys.slice(0, 3), keys.slice(3));
  assert.ok(keys.every((key) => /^[a-f0-9]{64}$/.test(key)));
  assert.notEqual(keys[0], keys[2]);
});

test("trusted Vercel IP ignores arbitrary x-real-ip; IPv6 rotations share a subnet quota", () => {
  assert.equal(registrationIp(new Headers({ "x-vercel-forwarded-for": "192.0.2.1", "x-real-ip": "198.51.100.1" }), true), "192.0.2.1");
  assert.equal(registrationIp(new Headers({ "x-real-ip": "198.51.100.1" }), true), "unknown");
  assert.equal(registrationIp(new Headers({ "x-forwarded-for": "garbage" })), "unknown");
  assert.equal(registrationIp(new Headers({ "x-forwarded-for": "::ffff:192.0.2.1" })), "192.0.2.1");
  for (const ip of ["2001:db8:abcd:1234::1", "2001:0db8:abcd:1234:0000:0000:0000:1234"]) {
    assert.equal(registrationIp(new Headers({ "x-forwarded-for": ip })), "2001:db8:abcd:1234::/64");
  }
});

test("only Gmail aliases are canonicalized for throttling", () => {
  assert.equal(registrationEmailKey(" A.B+tag@googlemail.com "), "ab@gmail.com");
  assert.equal(registrationEmailKey(" A.B+tag@example.com "), "a.b+tag@example.com");
});

test("blocked signup responses are never cached and include Retry-After", async () => {
  const response = registrationProtectionResponse(new RegistrationProtectionError("REGISTRATION_RATE_LIMITED", 429, "Aguarde", 3600));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "3600");
  assert.match(response.headers.get("Cache-Control")!, /no-store/);
  assert.equal((await response.json()).code, "REGISTRATION_RATE_LIMITED");
});

const config = { secret: "test-secret", siteKey: "test-site", hostname: "dogchef.example" };
function provider(body: unknown, status = 200): typeof fetch {
  return async () => Response.json(body, { status });
}

test("Turnstile validates the single-use token, action and exact hostname on the server", async () => {
  await verifyRegistrationChallenge("token", config.hostname, { config, fetch: provider({ success: true, hostname: config.hostname, action: "register" }) });
  for (const body of [
    { success: false, "error-codes": ["timeout-or-duplicate"] },
    { success: true, hostname: "attacker.example", action: "register" },
    { success: true, hostname: config.hostname, action: "login" },
    { success: "true", hostname: config.hostname, action: "register" },
  ]) {
    await assert.rejects(verifyRegistrationChallenge("token", config.hostname, { config, fetch: provider(body) }),
      (error: unknown) => error instanceof RegistrationProtectionError && error.status === 403);
  }
});

test("missing, oversized, expired and unavailable challenges do not allow signup", async () => {
  for (const token of [undefined, "", "x".repeat(2049)]) {
    await assert.rejects(verifyRegistrationChallenge(token, config.hostname, { config, fetch: provider({ success: true }) }));
  }
  for (const fetcher of [provider({}, 500), (async () => { throw new Error("offline"); }) as typeof fetch]) {
    await assert.rejects(verifyRegistrationChallenge("token", config.hostname, { config, fetch: fetcher }),
      (error: unknown) => error instanceof RegistrationProtectionError && error.status === 503);
  }
  await assert.rejects(verifyRegistrationChallenge("token", config.hostname, { config: { ...config, secret: undefined }, fetch: provider({}) }));
});

test("registration JSON size is bounded even without content-length", async () => {
  const request = (body: string) => new Request("https://dogchef.example/register", { method: "POST", headers: { "Content-Type": "application/json" }, body });
  assert.deepEqual(await readRegistrationJson(request('{"name":"Cliente"}')), { name: "Cliente" });
  assert.equal(await readRegistrationJson(request("invalid")), null);
  assert.equal(await readRegistrationJson(request(JSON.stringify({ name: "x".repeat(17000) }))), null);
  const plain = new Request("https://dogchef.example/register", { method: "POST", body: "{}" });
  assert.equal(await readRegistrationJson(plain), null);
});

test("phone validation accepts formatted Brazilian numbers and rejects text or missing DDD", () => {
  const base = { name: "Cliente", email: "user@example.com", password: "strong-test-password" };
  assert.equal(customerRegistrationSchema.parse({ ...base, phone: "(35) 99123-4567" }).phone, "35991234567");
  for (const phone of ["abcdefghijk", "00000000000", "991234567", "35 123"]) {
    assert.equal(customerRegistrationSchema.safeParse({ ...base, phone }).success, false);
  }
});
