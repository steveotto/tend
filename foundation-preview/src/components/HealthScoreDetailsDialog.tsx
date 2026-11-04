import { useId } from 'react';
import type { ReactNode } from 'react';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

export function HealthScoreDetailsDialog({
  title,
  children,
  onClose,
  className = '',
  phoneFullScreen = true
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  phoneFullScreen?: boolean;
}) {
  const titleId = useId();

  return (
    <MoneyGoalDialog
      title={title}
      titleId={titleId}
      labelledBy={titleId}
      initialFocusId={titleId}
      closeLabel="Close Health details"
      stopEscapePropagation
      portalToBody
      phoneFullScreen={phoneFullScreen}
      dialogClassName={`health-score-details-dialog ${className}`.trim()}
      bodyClassName="health-score-details-dialog__body"
      onClose={onClose}
    >
      {children}
    </MoneyGoalDialog>
  );
}
