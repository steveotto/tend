import type { ReactNode } from 'react';

export function FoundationRoutineSummary({
  className,
  title,
  description,
  metadata,
  metadataClassName,
  children
}: {
  className: string;
  title: string;
  description: ReactNode;
  metadata?: ReactNode;
  metadataClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className={className}>
      <h3>{title}</h3>
      <p>{description}</p>
      {metadata !== undefined && (
        <p className={metadataClassName}>{metadata}</p>
      )}
      {children}
    </div>
  );
}
