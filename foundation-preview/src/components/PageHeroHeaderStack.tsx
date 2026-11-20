import type { ReactNode } from 'react';
import { BackButton } from './BackButton.tsx';

type PageHeroHeaderStackProps = {
  backLabel: string;
  children: ReactNode;
  onBack: () => void;
  className?: string;
};

export function PageHeroHeaderStack({
  backLabel,
  children,
  onBack,
  className
}: PageHeroHeaderStackProps) {
  return (
    <div className={`page-hero-header-stack${className ? ` ${className}` : ''}`}>
      <BackButton onClick={onBack} variant="plain">{backLabel}</BackButton>
      {children}
    </div>
  );
}
