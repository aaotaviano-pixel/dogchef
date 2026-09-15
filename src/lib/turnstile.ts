import { RegistrationProtectionError } from "./registration-protection";

type TurnstileConfig = { secret?: string; siteKey?: string; hostname: string };

export async function verifyRegistrationChallenge(token: unknown, hostname: string, dependencies?: {
  config: TurnstileConfig;
  fetch: typeof fetch;
}) {
  const config = dependencies?.config || {
    secret: process.env.TURNSTILE_SECRET_KEY,
    siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    hostname,
  };
  // Rollout: rate limits and honeypot remain active before the external widget is
  // provisioned. A partial configuration always fails closed.
  if (!config.secret && !config.siteKey) return;
  if (!config.secret || !config.siteKey) {
    throw new RegistrationProtectionError("CAPTCHA_UNAVAILABLE", 503, "A verificação de segurança está temporariamente indisponível.", 60);
  }
  if (typeof token !== "string" || !token || token.length > 2048) {
    throw new RegistrationProtectionError("CAPTCHA_REQUIRED", 403, "Conclua a verificação de segurança para criar sua conta.");
  }
  try {
    const response = await (dependencies?.fetch || fetch)("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: config.secret, response: token }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Challenge provider unavailable");
    const result = await response.json();
    if (result.success !== true || result.hostname !== config.hostname || result.action !== "register") {
      throw new RegistrationProtectionError("CAPTCHA_INVALID", 403, "A verificação expirou ou não foi validada. Tente novamente.");
    }
  } catch (error) {
    if (error instanceof RegistrationProtectionError) throw error;
    throw new RegistrationProtectionError("CAPTCHA_UNAVAILABLE", 503, "Não foi possível verificar a segurança agora. Tente novamente em instantes.", 60);
  }
}
