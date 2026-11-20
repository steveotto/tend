import { describe, expect, it } from 'vitest';
import { selectTendedRhythmDisplayItems } from '../src/domain/category-rhythms.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';

const rhythm = (id: string, title: string, completionHistory?: RhythmPreview['completionHistory']): RhythmPreview => ({
  id,
  title,
  automation: 'manual',
  status: 'Due today',
  ...(completionHistory ? { completionHistory } : {})
});

describe('tended Rhythm display items', () => {
  it('preserves schedule order while formatting saved local completion times', () => {
    const rhythms = [
      rhythm('late', 'Evening walk', [{
        id: 'late-completion',
        effectiveDate: '2026-03-10',
        localTime: '17:30',
        completedAt: '2026-03-10T21:30:00.000Z'
      }]),
      rhythm('early', 'Morning prayer', [{
        id: 'early-completion',
        effectiveDate: '2026-03-10',
        localTime: '07:12',
        completedAt: '2026-03-10T11:12:00.000Z'
      }])
    ];

    expect(selectTendedRhythmDisplayItems(
      rhythms,
      new Set(['late', 'early']),
      '2026-03-10'
    ).map(item => [item.rhythm.id, item.timeLabel])).toEqual([
      ['late', 'Tended 5:30 pm'],
      ['early', 'Tended 7:12 am']
    ]);
  });

  it('marks a prior-day completion as carry-over without treating older history as today', () => {
    const rhythms = [
      rhythm('yesterday', 'Stretch', [{
        id: 'yesterday-completion',
        effectiveDate: '2026-03-09',
        localTime: '22:05',
        completedAt: '2026-03-10T02:05:00.000Z'
      }]),
      rhythm('earlier', 'Weekly planning', [{
        id: 'earlier-completion',
        effectiveDate: '2026-03-06',
        localTime: '16:00',
        completedAt: '2026-03-06T20:00:00.000Z'
      }])
    ];

    expect(selectTendedRhythmDisplayItems(
      rhythms,
      new Set(['yesterday', 'earlier']),
      '2026-03-10'
    ).map(item => [item.rhythm.id, item.timeLabel, item.carriesOver])).toEqual([
      ['yesterday', 'Tended yesterday', true],
      ['earlier', 'Tended 4 days ago', true]
    ]);
  });

  it('does not invent a time when only a tended state is available', () => {
    const rows = selectTendedRhythmDisplayItems(
      [rhythm('legacy', 'Legacy Rhythm')],
      new Set(['legacy']),
      '2026-03-10'
    );

    expect(rows).toEqual([{
      rhythm: rhythm('legacy', 'Legacy Rhythm'),
      timeLabel: 'Tended today',
      carriesOver: false
    }]);
  });
});
