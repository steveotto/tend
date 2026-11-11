import type { ReactNode } from 'react';
import { formatScore } from '../domain/score-display.ts';
import { strengthMuscles } from '../domain/strength.ts';
import type { StrengthMuscleId, StrengthMuscleScore } from '../domain/strength.ts';

export type FitnessBodyMapRegion = {
  id: string;
  name: string;
  group: string;
  front: boolean;
  back: boolean;
  score: number | null;
  status: string;
  fill: string;
};

export type FitnessBodyMapConfig = {
  title: string;
  eventType: string;
  verb: string;
  regions: readonly FitnessBodyMapRegion[];
};

export type FitnessBodyMapConfigFor<RegionId extends string> =
  Omit<FitnessBodyMapConfig, 'regions'> & {
    regions: readonly (FitnessBodyMapRegion & { id: RegionId })[];
  };

const strengthPaintOrder = [
  'shoulders', 'chest', 'back', 'biceps', 'triceps', 'abs', 'quads', 'hamstrings', 'calves'
];

const regionPaths: Readonly<Record<string, Partial<Record<'front' | 'back', string>>>> = {
  shoulders: {
    front: 'M93 79Q65 74 54 98L53 114L74 107L80 86Z M127 79Q155 74 166 98L167 114L146 107L140 86Z',
    back: 'M93 79Q65 74 54 98L53 114L74 107L80 86Z M127 79Q155 74 166 98L167 114L146 107L140 86Z'
  },
  chest: { front: 'M81 89Q96 80 108 87L107 129Q86 137 76 122Z M139 89Q124 80 112 87L113 129Q134 137 144 122Z' },
  back: { back: 'M81 89L107 81L107 178L91 184L81 158L76 117Z M139 89L113 81L113 178L129 184L139 158L144 117Z' },
  biceps: { front: 'M52 116L71 112L66 145L57 162L44 153Z M168 116L149 112L154 145L163 162L176 153Z' },
  triceps: { back: 'M52 116L71 112L66 145L57 162L44 153Z M168 116L149 112L154 145L163 162L176 153Z' },
  abs: { front: 'M89 139L107 137L107 190L90 197L83 163Z M131 139L113 137L113 190L130 197L137 163Z' },
  quads: { front: 'M73 206L105 205L101 265L83 272L74 259Z M147 206L115 205L119 265L137 272L146 259Z' },
  hamstrings: { back: 'M73 213L105 214L101 265L83 272L74 259Z M147 213L115 214L119 265L137 272L146 259Z' },
  calves: { back: 'M79 284L100 279L95 317L82 318Z M141 284L120 279L125 317L138 318Z' },
  'hip-flexors': { front: 'M75 188Q89 184 102 193L99 211L78 214L70 203Z M145 188Q131 184 118 193L121 211L142 214L150 203Z' },
  glutes: { back: 'M72 180Q88 173 107 181L107 213Q91 221 76 210Z M148 180Q132 173 113 181L113 213Q129 221 144 210Z' },
  neck: {
    front: 'M99 60L121 60L124 78L96 78Z',
    back: 'M99 60L121 60L124 78L96 78Z'
  }
};

export function createStrengthBodyMapConfig(
  scores: readonly StrengthMuscleScore[]
): FitnessBodyMapConfig & { regions: readonly (FitnessBodyMapRegion & { id: StrengthMuscleId })[] } {
  return {
    title: 'Muscle training status',
    eventType: 'strength',
    verb: 'training',
    regions: strengthMuscles
      .map(muscle => {
        const score = scores.find(item => item.id === muscle.id)!;
        return {
          id: muscle.id,
          name: muscle.name,
          group: muscle.group,
          front: muscle.front,
          back: muscle.back,
          score: score.health,
          status: score.status,
          fill: scoreFill(score.health)
        };
      })
      .sort((left, right) => strengthPaintOrder.indexOf(left.id) - strengthPaintOrder.indexOf(right.id))
  };
}

export function FitnessBodyMap<RegionId extends string>({
  config,
  view,
  selectedId,
  onSelect
}: {
  config: FitnessBodyMapConfigFor<RegionId>;
  view: 'front' | 'back';
  selectedId: RegionId;
  onSelect: (id: RegionId) => void;
}) {
  const visible = config.regions.filter(region => region[view]);
  return (
    <div className="strength-map-wrap">
      <svg
        className="strength-body-svg"
        viewBox="0 0 220 350"
        role="group"
        aria-label={config.eventType === 'strength'
          ? `${view === 'front' ? 'Front' : 'Back'} muscle training status map`
          : `${view === 'front' ? 'Front' : 'Back'} ${config.title} ${config.verb} map`}
        data-event-type={config.eventType}
      >
        <g fill="var(--tend-mist)" aria-hidden="true">
          <ellipse cx="110" cy="36" rx="23" ry="28" />
          <path d="M98 60L97 73Q57 72 48 99L30 181L23 207Q22 218 34 220L47 202L64 139L72 162L69 210L74 294L78 335L99 335L107 244L113 244L121 335L142 335L146 294L151 210L148 162L156 139L173 202L186 220Q198 218 197 207L190 181L172 99Q163 72 123 73L122 60Z" />
        </g>
        {visible.map(region => {
          const path = regionPaths[region.id]?.[view];
          if (!path) return null;
          return (
            <path
              key={region.id}
              className="strength-body-muscle"
              data-region={region.id}
              {...(config.eventType === 'strength' ? { 'data-muscle': region.id } : {})}
              d={path}
              fill={region.fill}
              tabIndex={0}
              role="button"
              aria-pressed={selectedId === region.id}
              aria-label={`${region.name}, ${config.eventType === 'strength' ? 'Health' : `${config.verb} consistency`} ${
                region.score === null ? 'score unavailable' : `${formatScore(region.score)} out of 100`
              }, ${region.status}`}
              onClick={() => onSelect(region.id as RegionId)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(region.id as RegionId);
                }
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}

export function FitnessBodyMapLayout<RegionId extends string>({
  config,
  view,
  selectedId,
  onSelect,
  listLabel,
  children
}: {
  config: FitnessBodyMapConfigFor<RegionId>;
  view: 'front' | 'back';
  selectedId: RegionId;
  onSelect: (id: RegionId) => void;
  listLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="strength-map-layout">
      <FitnessBodyMap
        config={config}
        view={view}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      <div className="strength-muscle-list" role="group" aria-label={listLabel}>
        {children}
      </div>
    </div>
  );
}

function scoreFill(score: number | null): string {
  if (score === null) return 'var(--score-neutral)';
  return score >= 80 ? 'var(--score-green)' : score >= 50 ? 'var(--score-yellow)' : 'var(--score-red)';
}
