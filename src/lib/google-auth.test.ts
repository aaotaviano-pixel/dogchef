import assert from "node:assert/strict";
import test from "node:test";

import { googleCallbackError, waitForGoogleAccessToken } from "./google-auth";

test("Google callback explains provider cancellation without exposing raw parameters", () => {
  assert.equal(
    googleCallbackError("?error=access_denied&error_description=raw-provider-message", ""),
    "O acesso pelo Google foi cancelado. Você pode tentar novamente quando quiser.",
  );
  assert.equal(googleCallbackError("?next=%2Fmeus-pedidos", "#access_token=private"), "");
});

test("Google callback waits briefly while Supabase finishes restoring the session", async () => {
  let reads = 0;
  const token = await waitForGoogleAccessToken(
    async () => ({ accessToken: ++reads === 3 ? "valid-access-token" : undefined }),
    { attempts: 4, wait: async () => undefined },
  );
  assert.equal(token, "valid-access-token");
  assert.equal(reads, 3);
});

test("Google callback returns the authentication error after bounded retries", async () => {
  await assert.rejects(
    waitForGoogleAccessToken(async () => ({ error: "Sessão expirada." }), { attempts: 2, wait: async () => undefined }),
    /Sessão expirada/,
  );
});
