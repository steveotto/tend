import type { CSSProperties, ImgHTMLAttributes } from 'react';
import connectionIcon from '../assets/tend-approved-icons/foundations/connection.svg?url';
import communicationIcon from '../assets/tend-approved-icons/foundations/communication.svg?url';
import funAdventureIcon from '../assets/tend-approved-icons/foundations/fun-adventure.svg?url';
import intimacyIcon from '../assets/tend-approved-icons/foundations/intimacy.svg?url';
import partnershipIcon from '../assets/tend-approved-icons/foundations/partnership.svg?url';
import spiritualGrowthIcon from '../assets/tend-approved-icons/foundations/spiritual-growth.svg?url';
import sparklesIcon from '../assets/tend-approved-icons/foundations/sparkles.svg?url';
import heartPlusIcon from '../assets/tend-approved-icons/foundations/heart-plus.svg?url';
import faithSabbathIcon from '../assets/tend-approved-icons/foundations/faith-sabbath.svg?url';
import faithPrayerIcon from '../assets/tend-approved-icons/foundations/faith-prayer.svg?url';
import faithFastingIcon from '../assets/tend-approved-icons/foundations/faith-fasting.svg?url';
import faithSolitudeIcon from '../assets/tend-approved-icons/foundations/faith-solitude.svg?url';
import faithGenerosityIcon from '../assets/tend-approved-icons/foundations/faith-generosity.svg?url';
import faithCommunityIcon from '../assets/tend-approved-icons/foundations/faith-community.svg?url';
import faithServiceIcon from '../assets/tend-approved-icons/foundations/faith-service.svg?url';
import faithWitnessIcon from '../assets/tend-approved-icons/foundations/faith-witness.svg?url';
import faithScriptureIcon from '../assets/tend-approved-icons/foundations/faith-scripture.svg?url';
import dailyConnectionIcon from '../../../assets/tend-marriage-icons/rhythms/daily-connection.svg?url';
import dateNightIcon from '../../../assets/tend-marriage-icons/rhythms/date-night.svg?url';
import dreamTogetherIcon from '../../../assets/tend-marriage-icons/rhythms/dream-together.svg?url';
import marriageCheckInIcon from '../../../assets/tend-marriage-icons/rhythms/marriage-check-in.svg?url';
import marriageEnrichmentIcon from '../../../assets/tend-marriage-icons/rhythms/marriage-enrichment.svg?url';
import overnightAwayIcon from '../../../assets/tend-marriage-icons/rhythms/overnight-away.svg?url';
import prayTogetherIcon from '../../../assets/tend-marriage-icons/rhythms/pray-together.svg?url';
import thoughtfulActOfLoveIcon from '../../../assets/tend-marriage-icons/rhythms/thoughtful-act-of-love.svg?url';
import weekAwayTogetherIcon from '../../../assets/tend-marriage-icons/rhythms/week-away-together.svg?url';

const foundationIcons: Record<string, string> = {
  connection: connectionIcon,
  communication: communicationIcon,
  'fun-adventure': funAdventureIcon,
  'spiritual-growth': spiritualGrowthIcon,
  partnership: partnershipIcon,
  intimacy: intimacyIcon,
  'parenting-connection-belonging': connectionIcon,
  'parenting-communication-trust': communicationIcon,
  'parenting-fun-memories': sparklesIcon,
  'parenting-spiritual-growth': spiritualGrowthIcon,
  'parenting-guidance-equipping': funAdventureIcon,
  'parenting-encouragement-affirmation': heartPlusIcon,
  'faith-sabbath': faithSabbathIcon,
  'faith-prayer': faithPrayerIcon,
  'faith-fasting': faithFastingIcon,
  'faith-solitude': faithSolitudeIcon,
  'faith-generosity': faithGenerosityIcon,
  'faith-community': faithCommunityIcon,
  'faith-service': faithServiceIcon,
  'faith-witness': faithWitnessIcon,
  'faith-scripture': faithScriptureIcon
};

export function hasFoundationIcon(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(foundationIcons, id);
}

const rhythmIcons: Record<string, string> = {
  'daily-connection': dailyConnectionIcon,
  'date-night': dateNightIcon,
  'dream-together': dreamTogetherIcon,
  'pray-together': prayTogetherIcon,
  'marriage-check-in': marriageCheckInIcon,
  'thoughtful-act-of-love': thoughtfulActOfLoveIcon,
  'overnight-away': overnightAwayIcon,
  'marriage-enrichment': marriageEnrichmentIcon,
  'week-away-together': weekAwayTogetherIcon
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
