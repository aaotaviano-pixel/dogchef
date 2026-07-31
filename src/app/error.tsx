"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="centered-error">
      <span className="brand-mark">D</span>
      <h1>Algo saiu da cozinha.</h1>
      <p>Não conseguimos carregar esta página agora. Tente mais uma vez.</p>
      <button className="button button-primary" onClick={reset}>Tentar novamente</button>
    </main>
  );
}
