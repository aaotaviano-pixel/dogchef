export default function Loading() {
  return (
    <main className="route-loading" role="status" aria-live="polite">
      <div className="route-loading-card">
        <span className="brand-mark" aria-hidden="true" />
        <strong>Dog do Chef</strong>
        <span>Carregando...</span>
        <i aria-hidden="true" />
      </div>
    </main>
  );
}
