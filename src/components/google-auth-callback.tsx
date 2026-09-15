"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChefHat, CircleAlert, LoaderCircle } from "lucide-react";

import { getBrowserSupabase } from "@/lib/supabase-browser";
import { RegistrationChallenge } from "@/components/registration-challenge";

function safeNextPath() {
  const next = new URLSearchParams(window.location.search).get("next") || "/meus-pedidos";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/meus-pedidos";
}

export function GoogleAuthCallback() {
  const [error, setError] = useState("");
  const [needsChallenge, setNeedsChallenge] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [challengeAttempt, setChallengeAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    if (needsChallenge && !captchaToken) return;
    const finish = async () => {
      try {
        const supabase = getBrowserSupabase();
        if (!supabase) throw new Error("O login com Google ainda não está configurado.");
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session?.access_token) throw new Error("O Google não devolveu uma sessão válida.");
        const response = await fetch("/api/v1/customer/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: data.session.access_token, captchaToken }),
        });
        const payload = await response.json();
        if (!active) return;
        if (payload.code === "CAPTCHA_REQUIRED" || payload.code === "CAPTCHA_INVALID") {
          setCaptchaToken("");
          setNeedsChallenge(true);
          setChallengeAttempt((attempt) => attempt + 1);
          return;
        }
        if (!response.ok) throw new Error(payload.error || "Não foi possível concluir o login.");
        window.location.replace(safeNextPath());
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Não foi possível concluir o login.");
      }
    };
    void finish();
    return () => { active = false; };
  }, [captchaToken, needsChallenge]);

  return <main className="auth-callback-shell"><section className="auth-callback-card"><span className="brand-mark"><ChefHat size={24}/></span>{error ? <><CircleAlert size={28}/><h1>Não conseguimos entrar com o Google</h1><p>{error}</p><Link className="button button-primary" href="/meus-pedidos">Voltar para o acesso</Link></> : needsChallenge && !captchaToken ? <><h1>Quase pronto!</h1><p>Confirme a verificação de segurança para criar sua conta.</p><RegistrationChallenge key={challengeAttempt} onToken={setCaptchaToken}/></> : <><LoaderCircle className="auth-spinner" size={30}/><h1>Confirmando seu acesso</h1><p>Isso leva só alguns segundos.</p></>}</section></main>;
}
