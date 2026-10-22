import { useState } from 'react';
import type { FoundationLifecycle } from '../../src/domain/capabilities.ts';
import {
  financeFoundation,
  goals,
  marriageFoundation,
  personById,
  peopleForRhythm,
  rhythms,
  type PersonId
} from './domain/preview-data.ts';
import { FoundationCard, GoalCard, RhythmCard, ScoreMeter } from './components/Cards.tsx';
import { PersonProfilePlaceholder } from './components/PersonProfilePlaceholder.tsx';

export function CatalogApp() {
  const [financeLifecycle, setFinanceLifecycle] = useState<FoundationLifecycle>(financeFoundation.lifecycle);
  const [selectedPersonId, setSelectedPersonId] = useState<PersonId | null>(null);
  const financeFoundationView = { ...financeFoundation, lifecycle: financeLifecycle };
  const selectedPerson = selectedPersonId === null ? null : personById(selectedPersonId);

  if (selectedPerson) {
    return (
      <PersonProfilePlaceholder
        person={selectedPerson}
        backLabel="Component catalogue"
        onBack={() => setSelectedPersonId(null)}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand-link" href="#preview" aria-label="Tend component preview">
          <img src="/brand/tend-logo.png" alt="Tend" />
        </a>
        <div className="header-copy">
          <p className="eyebrow">Local component preview</p>
          <p className="tagline">Care for what matters.</p>
        </div>
        <span className="preview-pill">Synthetic data</span>
      </header>

      <section className="intro" id="preview">
        <p className="eyebrow">Tend 2.0 · Foundation</p>
        <h1>One shared language. Room for what’s different.</h1>
        <p>
          Shared cards adapt through category capabilities. Everything here is synthetic and stays in
          this local preview.
        </p>
      </section>

      <section className="category-section" aria-labelledby="marriage-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Category example</p>
            <h2 id="marriage-heading">Marriage</h2>
          </div>
          <span className="section-note">Ongoing foundation</span>
        </div>
        <FoundationCard foundation={marriageFoundation} />
        <section className="catalogue-score-examples" aria-labelledby="catalogue-score-examples-title">
          <h3 id="catalogue-score-examples-title">Score meter examples · synthetic UI only</h3>
          <div>
            {[0, 50, 100].map(score => (
              <article key={score}>
                <span>{score === 50 ? 'Midpoint' : `${score} example`}</span>
                <ScoreMeter
                  label={`Synthetic score meter example: ${score} out of 100`}
                  score={score}
                  markerPlacement="below"
                />
              </article>
            ))}
          </div>
          <p>Illustrative component states only; no Marriage score is calculated or implied.</p>
        </section>
      </section>

      <section className="category-section" aria-labelledby="finances-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Category example</p>
            <h2 id="finances-heading">Finances</h2>
          </div>
          <span className="section-note">Sample only · taxonomy not finalized</span>
        </div>
        <FoundationCard
          foundation={financeFoundationView}
          lifecycle={financeLifecycle}
          onComplete={() => setFinanceLifecycle('completed')}
          onReopen={() => setFinanceLifecycle('active')}
        />

        <div className="subsection-heading">
          <div>
            <h3>Goals</h3>
            <p>One goal-card structure supports different money directions.</p>
          </div>
        </div>
        <div className="goal-grid">
          {goals.map(goal => <GoalCard goal={goal} key={goal.id} />)}
        </div>

        <div className="subsection-heading rhythm-subsection-heading">
          <div>
            <h3>Supporting Rhythm</h3>
            <p>External automation is descriptive metadata, never a completion or balance update.</p>
          </div>
        </div>
        <div className="rhythm-list">
          {rhythms.map(rhythm => (
            <RhythmCard
              rhythm={rhythm}
              people={peopleForRhythm(rhythm)}
              onPersonSelect={setSelectedPersonId}
              key={rhythm.id}
            />
          ))}
        </div>
      </section>

      <footer className="safety-note">
        <strong>Preview only.</strong> No account data, banking connection, score calculation, or save
        action is active.
      </footer>
    </main>
  );
}
