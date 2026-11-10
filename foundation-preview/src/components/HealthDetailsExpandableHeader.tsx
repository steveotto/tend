export function HealthDetailsExpandableHeader({
  id,
  contentId,
  title,
  expanded,
  onToggle
}: {
  id: string;
  contentId: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <h3 id={id} className="health-details-expandable-header__heading">
      <button
        type="button"
        className="health-details-expandable-header"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={onToggle}
      >
        <span>{title}</span>
        <svg className="disclosure-chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d={expanded ? 'm3 10 5-5 5 5' : 'm3 6 5 5 5-5'} />
        </svg>
      </button>
    </h3>
  );
}
