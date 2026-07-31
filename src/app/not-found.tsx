import Link from "next/link";

export default function NotFound() {
  return (
    <main className="centered-error">
      <span className="brand-mark">D</span>
      <h1>Essa página não está no cardápio.</h1>
      <p>Confira o link ou volte para fazer seu pedido.</p>
      <Link className="button button-primary" href="/">Ver cardápio</Link>
    </main>
  );
}
