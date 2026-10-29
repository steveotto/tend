import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { StrengthView } from './StrengthView.tsx';
import type { StrengthViewProps } from './StrengthView.tsx';
import { WeightView } from './WeightView.tsx';
import type { WeightViewProps } from './WeightView.tsx';
import { CardioView } from './CardioView.tsx';
import type { CardioViewProps } from './CardioView.tsx';

type HealthFitnessViewProps = {
  strength: StrengthViewProps;
  weight: WeightViewProps;
  cardio: CardioViewProps;
};

const fitnessTabs = [
  { id: 'strength', label: 'Strength' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'weight', label: 'Weight' }
] as const;

export function HealthFitnessView({ strength, weight, cardio }: HealthFitnessViewProps) {
  const [selected, setSelected] = useState<(typeof fitnessTabs)[number]['id']>('strength');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % fitnessTabs.length
      : event.key === 'ArrowLeft' ? (index - 1 + fitnessTabs.length) % fitnessTabs.length
        : event.key === 'Home' ? 0
          : event.key === 'End' ? fitnessTabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    setSelected(fitnessTabs[next]!.id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="health-fitness-view">
      <div className="health-fitness-tabs" role="tablist" aria-label="Health and Fitness">
        {fitnessTabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={element => { tabRefs.current[index] = element; }}
            type="button"
            role="tab"
            id={`health-fitness-tab-${tab.id}`}
            aria-controls={`health-fitness-panel-${tab.id}`}
            aria-selected={selected === tab.id}
            tabIndex={selected === tab.id ? 0 : -1}
            onClick={() => setSelected(tab.id)}
            onKeyDown={event => onTabKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section id="health-fitness-panel-strength" role="tabpanel"
        aria-labelledby="health-fitness-tab-strength" hidden={selected !== 'strength'}>
        <StrengthView {...strength} />
      </section>
      <section id="health-fitness-panel-cardio" role="tabpanel"
        aria-labelledby="health-fitness-tab-cardio" hidden={selected !== 'cardio'}>
        <CardioView {...cardio} />
      </section>
      <section id="health-fitness-panel-weight" role="tabpanel"
        aria-labelledby="health-fitness-tab-weight" hidden={selected !== 'weight'}>
        <WeightView {...weight} />
      </section>
    </div>
  );
}
