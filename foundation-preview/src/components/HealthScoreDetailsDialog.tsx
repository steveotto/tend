import { createContext, useContext, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

const HealthDetailsNestedDialogContext = createContext<((open: boolean) => void) | null>(null);

export function useHealthDetailsNestedDialog(): (open: boolean) => void {
  return useContext(HealthDetailsNestedDialogContext) ?? (() => {});
}

export function HealthScoreDetailsDialog({
  title,
  titleLeadingAction,
  children,
  onClose,
  className = '',
  phoneFullScreen = true,
  closeLabel = 'Close Health details',
  showCloseButton = true
}: {
  title: string;
  titleLeadingAction?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  phoneFullScreen?: boolean;
  closeLabel?: string;
  showCloseButton?: boolean;
}) {
  const titleId = useId();
  const [nestedDialogOpen, setNestedDialogOpen] = useState(false);

  return (
    <HealthDetailsNestedDialogContext.Provider value={setNestedDialogOpen}>
      <MoneyGoalDialog
        title={title}
        titleLeadingAction={titleLeadingAction}
        titleId={titleId}
        labelledBy={titleId}
        initialFocusId={titleId}
        {...(showCloseButton ? { closeLabel } : {})}
        stopEscapePropagation
        closeOnEscape
        portalToBody
        phoneFullScreen={phoneFullScreen}
        dialogClassName={`health-score-details-dialog ${className}`.trim()}
        bodyClassName="health-score-details-dialog__body"
        inert={nestedDialogOpen}
        onClose={onClose}
      >
        {children}
      </MoneyGoalDialog>
    </HealthDetailsNestedDialogContext.Provider>
  );
}
