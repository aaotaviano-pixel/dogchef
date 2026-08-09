"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, LogIn, LockKeyhole, Mail, UserPlus } from "lucide-react";

import { getBrowserSupabase, hasGoogleSignIn } from "@/lib/supabase-browser";
import type { CustomerAccount } from "@/lib/types";

export function CustomerAccess({ onAuthenticated, googleReturnTo }: { onAuthenticated: (customer: CustomerAccount) => void; googleReturnTo?: string }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });

  const isForgot = mode === "forgot";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/v1/customer/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.details?.[0] || data.error || "Não foi possível acessar sua conta.");
      onAuthenticated(data.customer as CustomerAccount);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível acessar sua conta.");
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/v1/customer/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.details?.[0] || data.error || "Não foi possível iniciar a recuperação.");
      setNotice(data.message || "Se o e-mail estiver cadastrado, enviaremos um link para redefinir sua senha.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível iniciar a recuperação.");
    } finally {
      setBusy(false);
    }
  }

  async function enterWithGoogle() {
    setGoogleBusy(true);
    setError("");
    try {
      const supabase = getBrowserSupabase();
      if (!supabase) throw new Error("O login com Google ainda não está configurado.");
      const next = googleReturnTo || window.location.pathname;
      const callback = new URL("/auth/google", window.location.origin);
      callback.searchParams.set("next", next);
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.toString() },
      });
      if (oauthError) throw oauthError;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível abrir o acesso do Google.");
      setGoogleBusy(false);
    }
  }

  return <section className="customer-access">
    <div className="customer-access-heading"><span>{isForgot ? <Mail size={19}/> : mode === "login" ? <LockKeyhole size={19}/> : <UserPlus size={19}/>}</span><div><b>{isForgot ? "Recupere sua senha" : mode === "login" ? "Entre na sua conta" : "Crie sua conta"}</b><small>{isForgot ? "Enviaremos um link para o seu e-mail." : "Seus pedidos ficam salvos para consultar quando quiser."}</small></div></div>
    {!isForgot && <div className="customer-access-tabs" role="tablist" aria-label="Acesso à conta">
      <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "is-active" : ""} onClick={() => { setMode("login"); setError(""); }}>Entrar</button>
      <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "is-active" : ""} onClick={() => { setMode("register"); setError(""); }}>Criar conta</button>
    </div>}
    {isForgot ? <form onSubmit={requestPasswordReset}><label className="field"><span>E-mail</span><input required type="email" autoComplete="email" placeholder="voce@email.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></label>{error && <p className="form-error">{error}</p>}{notice && <p className="customer-notice"><CheckCircle2 size={16}/><span>{notice}</span></p>}<button className="button button-primary full" disabled={busy}>{busy ? "Enviando..." : <>Enviar link de recuperação<ArrowRight size={17}/></>}</button><button type="button" className="button button-ghost full access-back-button" onClick={() => { setMode("login"); setError(""); setNotice(""); }}><ArrowLeft size={17}/>Voltar para entrar</button></form> : <>
      {hasGoogleSignIn() && <><button type="button" className="button google-login-button full" disabled={googleBusy || busy} onClick={() => void enterWithGoogle()}><LogIn size={18}/>{googleBusy ? "Abrindo Google..." : "Continuar com Google"}</button><div className="access-divider"><span>ou use seu e-mail</span></div></>}
      <form onSubmit={submit}>
        {mode === "register" && <div className="form-grid"><label className="field"><span>Seu nome</span><input required minLength={2} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label><label className="field"><span>Telefone</span><input required minLength={10} inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })}/></label></div>}
        <label className="field"><span>E-mail</span><input required type="email" autoComplete="email" placeholder="voce@email.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></label>
        <label className="field"><span>Senha</span><input required type="password" minLength={mode === "register" ? 8 : 1} maxLength={72} autoComplete={mode === "register" ? "new-password" : "current-password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })}/>{mode === "register" && <small>Use pelo menos 8 caracteres.</small>}</label>
        {mode === "login" && <button type="button" className="text-button forgot-password-button" onClick={() => { setMode("forgot"); setError(""); setNotice(""); }}>Esqueci minha senha</button>}
        {error && <p className="form-error">{error}</p>}
        <button className="button button-primary full" disabled={busy}>{busy ? "Aguarde..." : <>{mode === "login" ? "Entrar" : "Criar conta"}<ArrowRight size={17}/></>}</button>
      </form>
    </>}
    <p className="access-legal">Ao continuar, você concorda com os <Link href="/termos-de-uso">Termos de uso</Link> e a <Link href="/politica-de-privacidade">Política de privacidade</Link>.</p>
  </section>;
}
