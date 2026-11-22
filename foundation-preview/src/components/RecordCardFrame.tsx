import type { ReactNode } from 'react';

export function RecordCardFrame({
  className,
  headingId,
  children
}: {
  className?: string;
  headingId: string;
  children: ReactNode;
}) {
  return (
    <article
      className={['rhythm-card', className].filter(Boolean).join(' ')}
      aria-labelledby={headingId}
    >
      {children}
    </article>
  );
}
