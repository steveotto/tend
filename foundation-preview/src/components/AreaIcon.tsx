import type { CSSProperties } from 'react';
import faithIcon from '../assets/tend-approved-icons/categories/faith.svg?url';
import faithSvg from '../assets/tend-approved-icons/categories/faith.svg?raw';
import financesIcon from '../assets/tend-approved-icons/categories/finances.svg?url';
import friendshipsIcon from '../assets/tend-approved-icons/categories/friendships.svg?url';
import friendshipsSvg from '../assets/tend-approved-icons/categories/friendships.svg?raw';
import healthFitnessIcon from '../assets/tend-approved-icons/categories/health-fitness.svg?url';
import healthFitnessSvg from '../assets/tend-approved-icons/categories/health-fitness.svg?raw';
import marriageIcon from '../assets/tend-approved-icons/categories/marriage.svg?url';
import parentingIcon from '../assets/tend-approved-icons/categories/parenting.svg?url';
import parentingSvg from '../assets/tend-approved-icons/categories/parenting.svg?raw';
import { areas } from '../domain/preview-data.ts';

type CategoryId = (typeof areas)[number]['id'];

const categoryIcons: Record<(typeof areas)[number]['id'], string> = {
  faith: faithIcon,
  marriage: marriageIcon,
  parenting: parentingIcon,
  health: healthFitnessIcon,
  finances: financesIcon,
  friendships: friendshipsIcon
};

function summaryIcon(svg: string, from: string, to: string) {
  if (!svg.includes(from)) {
    throw new Error('Approved Category SVG no longer matches the expected summary icon treatment.');
  }
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(from, to))}`;
}

const todaySummaryIconOverrides: Partial<Record<CategoryId, string>> = {
  faith: summaryIcon(faithSvg, 'stroke-width="2.5"', 'stroke-width="2.75"'),
  parenting: summaryIcon(parentingSvg, 'fill="currentColor" fill-opacity="0.12"', 'fill="none"'),
  health: summaryIcon(healthFitnessSvg, 'fill="currentColor" fill-opacity="0.12"', 'fill="none"'),
  friendships: summaryIcon(friendshipsSvg, 'fill="currentColor" fill-opacity="0.12"', 'fill="none"')
};

export function AreaIcon({ id, variant = 'default' }: {
  id: CategoryId;
  variant?: 'default' | 'today-summary';
}) {
  const icon = variant === 'today-summary'
    ? todaySummaryIconOverrides[id] ?? categoryIcons[id]
    : categoryIcons[id];
  return (
    <span
      className={`area-svg-icon${variant === 'today-summary' ? ' area-svg-icon--today-summary' : ''}`}
      style={{ '--area-icon': `url("${icon}")` } as CSSProperties}
      aria-hidden="true"
    />
  );
}
