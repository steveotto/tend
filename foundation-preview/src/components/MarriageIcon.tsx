import type { CSSProperties, ImgHTMLAttributes } from 'react';
import connectionIcon from '../../../assets/tend-marriage-icons/foundations/connection.svg?url';
import communicationIcon from '../../../assets/tend-marriage-icons/foundations/communication.svg?url';
import funAdventureIcon from '../../../assets/tend-marriage-icons/foundations/fun-adventure.svg?url';
import intimacyIcon from '../../../assets/tend-marriage-icons/foundations/intimacy.svg?url';
import partnershipIcon from '../../../assets/tend-marriage-icons/foundations/partnership.svg?url';
import spiritualGrowthIcon from '../../../assets/tend-marriage-icons/foundations/spiritual-growth.svg?url';
import dailyConnectionIcon from '../../../assets/tend-marriage-icons/rhythms/daily-connection.svg?url';
import dateNightIcon from '../../../assets/tend-marriage-icons/rhythms/date-night.svg?url';
import dreamTogetherIcon from '../../../assets/tend-marriage-icons/rhythms/dream-together.svg?url';
import prayTogetherIcon from '../../../assets/tend-marriage-icons/rhythms/pray-together.svg?url';

const foundationIcons: Record<string, string> = {
  connection: connectionIcon,
  communication: communicationIcon,
  'fun-adventure': funAdventureIcon,
  'spiritual-growth': spiritualGrowthIcon,
  partnership: partnershipIcon,
  intimacy: intimacyIcon
};

const rhythmIcons: Record<string, string> = {
  'daily-connection': dailyConnectionIcon,
  'date-night': dateNightIcon,
  'dream-together': dreamTogetherIcon,
  'pray-together': prayTogetherIcon
};

type MarriageIconProps = {
  group: 'foundations' | 'rhythms';
  id: string;
} & Pick<ImgHTMLAttributes<HTMLImageElement>, 'className'>;

export function MarriageIcon({ group, id, className }: MarriageIconProps) {
  const src = (group === 'foundations' ? foundationIcons : rhythmIcons)[id];
  return src
    ? (
      <span
        className={`marriage-svg-icon${className ? ` ${className}` : ''}`}
        style={{ '--marriage-icon': `url("${src}")` } as CSSProperties}
        aria-hidden="true"
      />
    )
    : <span className={className} aria-hidden="true">♡</span>;
}
