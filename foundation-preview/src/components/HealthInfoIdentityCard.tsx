import type { HealthInfoIdentity } from '../domain/rhythm-contribution.ts';
import { AreaIcon } from './AreaIcon.tsx';
import { MarriageIcon } from './MarriageIcon.tsx';
import { RhythmRepeatIcon } from './RhythmMetadata.tsx';

export function HealthInfoIdentityCard({ identity }: { identity: HealthInfoIdentity }) {
  const identityLabel = identity.icon.kind === 'rhythm'
    ? 'Rhythm'
    : identity.icon.kind === 'foundation'
      ? 'Foundation'
      : 'Category';

  return (
    <section
      className="health-info-identity rhythm-health-identity"
      role="group"
      aria-label={`${identityLabel} identity: ${identity.name}${identity.secondary
        ? `, ${identity.secondary}`
        : ''}`}
    >
      <span className="rhythm-health-identity__icon" aria-hidden="true">
        {identity.icon.kind === 'category' && <AreaIcon id={identity.icon.id} />}
        {identity.icon.kind === 'foundation' && (
          <MarriageIcon group="foundations" id={identity.icon.id} />
        )}
        {identity.icon.kind === 'rhythm' && (
          <RhythmRepeatIcon className="rhythm-health-identity__repeat-icon" />
        )}
      </span>
      <span className="rhythm-health-identity__copy">
        <strong>{identity.name}</strong>
        {identity.secondary && (
          <span className="rhythm-health-identity__schedule">{identity.secondary}</span>
        )}
      </span>
    </section>
  );
}
