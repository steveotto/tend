import type { FocusEvent, ReactNode } from 'react';
import type { RhythmPreview } from '../domain/preview-data.ts';
import type { TendedRhythmDisplayItem } from '../domain/category-rhythms.ts';

type Props = {
  rhythms: readonly RhythmPreview[];
  tendedRhythmIds: ReadonlySet<string>;
  displayItems: readonly TendedRhythmDisplayItem[];
  expandedRhythmIds: ReadonlySet<string>;
  onToggleRhythm: (rhythmId: string) => void;
  itemProps: (rhythmId: string) => {
    className: string;
    'data-tended-rhythm-item': string;
    inert: boolean;
    onFocusCapture: (event: FocusEvent<HTMLDivElement>) => void;
    onBlurCapture: (event: FocusEvent<HTMLDivElement>) => void;
  };
  className: string;
  renderRhythmCard: (rhythm: RhythmPreview) => ReactNode;
  renderExpandedRhythm: (item: TendedRhythmDisplayItem) => ReactNode;
};

export function TendedRhythmItems({
  rhythms,
  tendedRhythmIds,
  displayItems,
  expandedRhythmIds,
  onToggleRhythm,
  itemProps,
  className,
  renderRhythmCard,
  renderExpandedRhythm
}: Props) {
  if (rhythms.length === 0) return null;
  const displayItemsByRhythmId = new Map(displayItems.map(item => [item.rhythm.id, item]));

  return (
    <div className={className}>
      {rhythms.map(rhythm => {
        const props = itemProps(rhythm.id);
        const item = displayItemsByRhythmId.get(rhythm.id);
        if (!tendedRhythmIds.has(rhythm.id)) {
          return (
            <div key={rhythm.id} {...props}>
              {renderRhythmCard(rhythm)}
            </div>
          );
        }
        if (!item) throw new Error(`Missing tended display item for Rhythm ${rhythm.id}.`);
        const expanded = expandedRhythmIds.has(rhythm.id);
        return (
          <div key={rhythm.id} {...props}>
            <div className="tended-rhythm-done-row__item">
              <button
                type="button"
                className={`tended-rhythm-done-row${item.carriesOver
                  ? ' tended-rhythm-done-row--carry-over'
                  : ''}`}
                data-tended-rhythm-done-button={item.rhythm.id}
                aria-expanded={expanded}
                aria-label={`${item.rhythm.title}, ${item.timeLabel}`}
                onClick={() => onToggleRhythm(item.rhythm.id)}
              >
                <span className="tended-rhythm-done-row__check" aria-hidden="true">✓</span>
                <span className="tended-rhythm-done-row__title">{item.rhythm.title}</span>
                {item.dateTime
                  ? <time className="tended-rhythm-done-row__time" dateTime={item.dateTime}>{item.timeLabel}</time>
                  : <span className="tended-rhythm-done-row__time">{item.timeLabel}</span>}
              </button>
              {expanded && (
                <div className="tended-rhythm-done-row__expanded">
                  {renderExpandedRhythm(item)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
