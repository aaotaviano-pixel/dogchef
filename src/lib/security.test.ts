import assert from "node:assert/strict";
import test from "node:test";

import { contentSecurityPolicy, privateResponseHeaders, securityHeaders } from "./security";

test("production security headers enforce HTTPS and browser protections", () => {
  const headers = new Map(securityHeaders(true).map(({ key, value }) => [key, value]));

  assert.equal(headers.get("Strict-Transport-Security"), "max-age=63072000; includeSubDomains");
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.match(headers.get("Content-Security-Policy") ?? "", /upgrade-insecure-requests/);
});

test("CSP keeps external access narrow while preserving Supabase and local QZ printing", () => {
  assert.match(contentSecurityPolicy, /default-src 'self'/);
  assert.match(contentSecurityPolicy, /frame-ancestors 'none'/);
  assert.match(contentSecurityPolicy, /https:\/\/\*\.supabase\.co/);
  assert.match(contentSecurityPolicy, /wss:\/\/localhost:\*/);
  assert.doesNotMatch(contentSecurityPolicy, /default-src \*/);
});

test("private routes cannot be cached or indexed", () => {
  const headers = new Map(privateResponseHeaders.map(({ key, value }) => [key, value]));

  assert.match(headers.get("Cache-Control") ?? "", /no-store/);
  assert.match(headers.get("X-Robots-Tag") ?? "", /noindex/);
});
