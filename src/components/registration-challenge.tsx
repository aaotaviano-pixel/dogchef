"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

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

export function RegistrationChallenge({ onToken }: { onToken: (token: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!ready || !sitekey || !host.current || !window.turnstile) return;
    const api = window.turnstile;
    const id = api.render(host.current, {
      sitekey, action: "register", theme: "auto", size: "flexible",
      callback: (token) => { setError(false); onToken(token); },
      "expired-callback": () => onToken(""),
      "error-callback": () => { onToken(""); setError(true); },
    });
    return () => { api.remove(id); };
  }, [ready, sitekey, onToken]);

  if (!sitekey) return null;
  return <div className="registration-challenge">
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive"
      onReady={() => setReady(true)} onError={() => setError(true)} />
    <div ref={host} />
    {!ready && !error && <small role="status">Carregando verificação de segurança…</small>}
    {error && <p className="form-error" role="alert">Não foi possível carregar a verificação. Atualize a página para tentar novamente.</p>}
  </div>;
}
