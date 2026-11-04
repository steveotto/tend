export function ArchivedRhythmsControl({
  count,
  openerRef,
  expanded = false,
  onOpen
}: {
  count: number;
  openerRef: { current: HTMLElement | null };
  expanded?: boolean;
  onOpen: () => void;
}) {
  if (count === 0) {
    return (
      <span
        ref={node => {
          openerRef.current = node;
        }}
        className="category-archived-rhythms-count"
        tabIndex={-1}
      >
        Archived rhythms (0)
      </span>
    );
  }

  return (
    <button
      ref={node => {
        openerRef.current = node;
      }}
      type="button"
      className="category-archived-rhythms-toggle"
      aria-expanded={expanded}
      aria-haspopup="dialog"
      aria-controls="archived-rhythms-dialog"
      onClick={onOpen}
    >
      Archived rhythms ({count})
    </button>
  );
}
