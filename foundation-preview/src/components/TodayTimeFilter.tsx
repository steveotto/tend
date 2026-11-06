import { useLayoutEffect, useRef } from 'react';
import type { RhythmPreview } from '../domain/preview-data.ts';
import {
  selectTodayPlanGroups,
  todayFocusContext,
  todayFocusLabel
} from '../domain/today-plan.ts';
import type { TodayFocusId } from '../domain/today-plan.ts';
import type { TimeBlockSettings } from '../domain/time-blocks.ts';
import { StyledSelect } from './StyledSelect.tsx';
import type { StyledSelectOption } from './StyledSelect.tsx';

export function createTodayTimeFrameOptions(
  rhythms: readonly RhythmPreview[],
  instant: Date,
  timeBlocks: TimeBlockSettings
): readonly StyledSelectOption<TodayFocusId>[] {
  const scheduledItemCount = (timeFrame: TodayFocusId) =>
    selectTodayPlanGroups(rhythms, 'scheduled', timeFrame, instant, timeBlocks)
      .reduce((count, group) => count + group.rhythms.length, 0);
  const itemCountLabel = (timeFrame: TodayFocusId) => {
    const count = scheduledItemCount(timeFrame);
    return `${count} ${count === 1 ? 'item' : 'items'}`;
  };

  return [
    {
      value: 'now',
      label: 'Now',
      description: `${todayFocusContext('now', 'scheduled', instant, timeBlocks)} · ${itemCountLabel('now')}`,
      group: 'View'
    },
    {
      value: 'everything-today',
      label: 'Everything today',
      description: `Across every time block · ${itemCountLabel('everything-today')}`,
      group: 'View'
    },
    ...timeBlocks.blocks.map(block => ({
      value: block.id,
      label: block.name,
      description: `${todayFocusContext(block.id, 'scheduled', instant, timeBlocks)} · ${itemCountLabel(block.id)}`,
      group: 'Specific time'
    }))
  ];
}

export function TodayTimeFilter({
  rhythms,
  focus,
  onFocusChange,
  evaluationInstant,
  timeBlocks
}: {
  rhythms: readonly RhythmPreview[];
  focus: TodayFocusId;
  onFocusChange: (focus: TodayFocusId) => void;
  evaluationInstant: Date;
  timeBlocks: TimeBlockSettings;
}) {
  const restoreTimePickerFocus = useRef(false);
  const currentLabel = todayFocusLabel(focus, evaluationInstant, timeBlocks);
  const options = createTodayTimeFrameOptions(rhythms, evaluationInstant, timeBlocks);

  useLayoutEffect(() => {
    if (!restoreTimePickerFocus.current) return;
    restoreTimePickerFocus.current = false;
    document.getElementById('today-plan-time-select')?.focus();
  }, [focus]);

  return (
    <StyledSelect
      id="today-plan-time-select"
      label="Filter scheduled Rhythms by time"
      triggerAriaLabel={`Filter scheduled Rhythms by time, currently ${currentLabel}`}
      containerClassName="today-plan__focus-picker"
      triggerClassName="today-plan__focus-trigger"
      sizeTriggerToOptions
      popoverMinWidth={320}
      options={options}
      value={focus}
      onChange={nextFocus => {
        restoreTimePickerFocus.current = true;
        onFocusChange(nextFocus);
      }}
    />
  );
}
