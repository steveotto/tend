import type { ReactNode } from 'react';
import { BackButton } from './BackButton.tsx';

type CategoryHeaderProps = {
  title: string;
  titleId: string;
  icon: ReactNode;
  onHome: () => void;
  subtitle?: string;
  trailing?: ReactNode;
};

export function CategoryHeader({ title, titleId, icon, onHome, subtitle, trailing }: CategoryHeaderProps) {
  const header = (
    <header className="category-header category-header--hero">
      <div className="category-header__copy">
        <h2 id={titleId}>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <span className="page-hero-header__icon page-hero-header__icon--category" aria-hidden="true">
        {icon}
      </span>
      {trailing && <div className="category-header__trailing">{trailing}</div>}
    </header>
  );

  return (
    <div className="category-header-stack">
      <BackButton onClick={onHome} variant="plain">Home</BackButton>
      {header}
    </div>
  );
}
