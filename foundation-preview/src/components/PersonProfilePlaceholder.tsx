import type { PersonPreview } from '../domain/preview-data.ts';

export function PersonProfilePlaceholder({
  person,
  backLabel,
  onBack
}: {
  person: PersonPreview;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <main className="category-page preview-placeholder" aria-labelledby="person-placeholder-title">
      <header className="category-page-heading">
        <h2 id="person-placeholder-title" tabIndex={-1}>{person.displayName}</h2>
        <span className="hint">Synthetic profile example</span>
      </header>
      <section className="card placeholder-card">
        <p className="empty">Person profiles are not implemented in this preview. This example is synthetic and does not connect to an account.</p>
        <button type="button" className="btn mini" onClick={onBack}>Back to {backLabel}</button>
      </section>
    </main>
  );
}
