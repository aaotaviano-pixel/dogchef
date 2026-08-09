"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChefHat, CircleAlert, LoaderCircle, LockKeyhole } from "lucide-react";

import { getBrowserSupabase } from "@/lib/supabase-browser";

export function PasswordResetForm() {
  const [status, setStatus] = useState<"loading" | "ready" | "success" | "error">("loading");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      window.setTimeout(() => {
        setError("A recuperação de senha ainda não está configurada.");
        setStatus("error");
      }, 0);
      return;
    }
    let active = true;
    const checkSession = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      let { data } = await supabase.auth.getSession();
      if (!data.session) {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        ({ data } = await supabase.auth.getSession());
      }
      if (!active) return;
      if (data.session) setStatus("ready");
      else {
        setError("Este link de recuperação expirou ou já foi utilizado. Solicite outro.");
        setStatus("error");
      }
    };
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) setStatus("ready");
    });
    void checkSession();
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setError("As senhas precisam ser iguais.");
      return;
    }
    setBusy(true);
    setError("");
    const supabase = getBrowserSupabase();
    try {
      if (!supabase) throw new Error("A recuperação de senha ainda não está configurada.");
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error("Este link de recuperação expirou. Solicite outro.");
      const response = await fetch("/api/v1/customer/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: data.session.access_token, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível atualizar sua senha.");
      await supabase.auth.signOut();
      setStatus("success");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível atualizar sua senha.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-callback-shell"><section className="auth-callback-card password-reset-card"><span className="brand-mark"><ChefHat size={24}/></span>
    {status === "loading" && <><LoaderCircle className="auth-spinner" size={30}/><h1>Verificando seu link</h1><p>Isso leva só alguns segundos.</p></>}
    {status === "error" && <><CircleAlert size={30}/><h1>Link indisponível</h1><p>{error}</p><Link className="button button-primary" href="/?account=1">Voltar para o acesso</Link></>}
    {status === "success" && <><CheckCircle2 size={30}/><h1>Senha atualizada</h1><p>Agora você já pode entrar na sua conta com a nova senha.</p><Link className="button button-primary" href="/?account=1">Entrar na conta</Link></>}
    {status === "ready" && <><LockKeyhole size={30}/><h1>Crie uma nova senha</h1><p>Escolha uma senha com pelo menos 8 caracteres.</p><form className="password-reset-form" onSubmit={submit}><label className="field"><span>Nova senha</span><input required minLength={8} maxLength={72} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)}/></label><label className="field"><span>Confirme a nova senha</span><input required minLength={8} maxLength={72} type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)}/></label>{error && <p className="form-error">{error}</p>}<button className="button button-primary full" disabled={busy}>{busy ? "Salvando..." : "Salvar nova senha"}</button></form></>}
  </section></main>;
}
