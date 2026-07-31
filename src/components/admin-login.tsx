"use client";

import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/v1/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível entrar.");
      router.replace("/admin");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível entrar.");
    } finally { setLoading(false); }
  }

  return <main className="admin-login"><section className="admin-login-card"><div className="brand-lockup"><span className="brand-mark">D</span><span><strong>DogChef</strong><small>operação</small></span></div><div className="login-icon"><LockKeyhole size={24}/></div><h1>Entrar no painel</h1><p>Use a senha definida nas variáveis de ambiente da loja.</p><form onSubmit={signIn}><label className="field"><span>Senha administrativa</span><input autoFocus required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)}/></label>{error && <p className="form-error">{error}</p>}<button className="button button-primary full" disabled={loading}>{loading ? "Entrando…" : "Entrar no painel"}</button></form></section></main>;
}
