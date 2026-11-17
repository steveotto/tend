import type { ReactNode } from 'react';

type CategoryHeaderProps = {
  title: string;
  titleId: string;
  icon: ReactNode;
  subtitle?: string;
  trailing?: ReactNode;
};

export function CategoryHeader({ title, titleId, icon, subtitle, trailing }: CategoryHeaderProps) {
  return (
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
}
