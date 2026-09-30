"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (element: HTMLElement, options: {
    sitekey: string; action: string; theme: string; size: string;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }) => string;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: TurnstileApi } }

export function RegistrationChallenge({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const readinessGeneration = useRef(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  const confirmApiReady = useCallback(() => {
    const generation = ++readinessGeneration.current;
    let attempts = 0;
    const check = () => {
      if (generation !== readinessGeneration.current) return;
      if (window.turnstile) {
        setError(false);
        setReady(true);
        return;
      }
      attempts += 1;
      if (attempts >= 40) {
        setError(true);
        return;
      }
      window.setTimeout(check, 100);
    };
    check();
  }, []);

  useEffect(() => {
    if (window.turnstile) confirmApiReady();
    return () => { readinessGeneration.current += 1; };
  }, [confirmApiReady]);

  useEffect(() => {
    if (!ready || !host.current || !window.turnstile) return;
    const api = window.turnstile;
    let id: string;
    try {
      id = api.render(host.current, {
        sitekey: siteKey, action: "register", theme: "auto", size: "flexible",
        callback: (token) => { setError(false); onToken(token); },
        "expired-callback": () => onToken(""),
        "error-callback": () => { onToken(""); setError(true); },
      });
    } catch {
      const timer = window.setTimeout(() => setError(true), 0);
      return () => window.clearTimeout(timer);
    }
    return () => { api.remove(id); };
  }, [ready, siteKey, onToken]);

  return <div className="registration-challenge">
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive"
      onLoad={confirmApiReady} onReady={confirmApiReady} onError={() => setError(true)} />
    <div ref={host} />
    {!ready && !error && <small role="status">Carregando verificação de segurança…</small>}
    {error && <p className="form-error" role="alert">Não foi possível carregar a verificação. Atualize a página para tentar novamente.</p>}
  </div>;
}
