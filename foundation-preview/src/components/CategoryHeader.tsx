import type { ReactNode } from 'react';

type CategoryHeaderProps = {
  title: string;
  titleId: string;
  subtitle?: string;
  trailing?: ReactNode;
};

export function CategoryHeader({ title, titleId, subtitle, trailing }: CategoryHeaderProps) {
  return (
    <header className="category-header">
      <div className="category-header__copy">
        <h2 id={titleId}>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {trailing && <div className="category-header__trailing">{trailing}</div>}
    </header>
  );
}
