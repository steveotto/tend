import type { ReactNode } from 'react';
import { PageHeroHeaderStack } from './PageHeroHeaderStack.tsx';

type CategoryHeaderProps = {
  title: string;
  titleId: string;
  icon: ReactNode;
  onHome: () => void;
};

export function CategoryHeader({ title, titleId, icon, onHome }: CategoryHeaderProps) {
  const header = (
    <header className="category-header category-header--hero">
      <div className="category-header__copy page-hero-header__copy">
        <h2 id={titleId}>{title}</h2>
        <p>Structure beats good intentions</p>
      </div>
      <span className="page-hero-header__icon page-hero-header__icon--category" aria-hidden="true">
        {icon}
      </span>
    </header>
  );

  return (
    <PageHeroHeaderStack backLabel="Home" onBack={onHome} className="category-header-stack">
      {header}
    </PageHeroHeaderStack>
  );
}
