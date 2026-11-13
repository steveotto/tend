import { describe, expect, it } from 'vitest';
import {
  foundationCatalogue,
  type RhythmPreview
} from '../src/domain/preview-data.ts';
import { selectRhythmContribution } from '../src/domain/rhythm-contribution.ts';
import type { RhythmScoreSelection } from '../src/domain/rhythm-scoring.ts';

const evidence = {
  frequency: 'daily' as const,
  windowStartDate: '2026-10-20',
  windowEndDate: '2026-10-23',
  eligibleDueCount: 1,
  completedCount: 1,
  notCompletedCount: 0,
  limitedHistoryDays: null,
  todayIncluded: true,
  occurrences: []
};

function scored(consistency: number, onTrack: number): RhythmScoreSelection {
  return {
    kind: 'rhythm-score',
    asOfDate: '2026-10-23',
    timeZone: 'UTC',
    trackingStartDate: '2026-10-20',
    consistency: {
      kind: 'scored',
      score: consistency,
      exactPercent: consistency,
      evidence
    },
    onTrack: {
      kind: 'scored',
      score: onTrack,
      evidence: {
        lastQualifyingCompletionDate: '2026-10-23',
        missedOccurrenceCount: 0,
        pointsPerMissedOccurrence: 10,
        deduction: 0,
        occurrences: [],
        repeatedZeroScoreSpans: [],
        scheduleChanges: []
      }
    },
    healthScore: consistency * 0.75 + onTrack * 0.25
  };
}

describe('Rhythm contribution selection', () => {
  it('uses actual multi-category Foundation relationships and the shared score selectors', () => {
    const rhythm: RhythmPreview = {
      id: 'walk',
      title: 'Take a walk',
      automation: 'manual',
      status: 'Due today',
      primaryFoundationId: 'faith-prayer',
      secondaryFoundationIds: ['connection'],
      categoryIds: ['faith', 'marriage']
    };
    const peer: RhythmPreview = {
      id: 'peer-prayer',
      title: 'Pray together',
      automation: 'manual',
      status: 'Due today',
      primaryFoundationId: 'faith-prayer'
    };
    const contribution = selectRhythmContribution({
      rhythm,
      foundations: foundationCatalogue,
      relatedRhythms: [rhythm, peer],
      rhythmScores: new Map([
        [rhythm.id, scored(80, 60)],
        [peer.id, scored(100, 80)]
      ]),
      archivedRhythmIds: [],
      categoryHealthScores: new Map([
        ['faith', 60],
        ['marriage', 0],
        ['health', 90]
      ]),
      rhythmHealthScore: 75
    });

    expect(contribution.categories.map(item => [item.id, item.label, item.score])).toEqual([
      ['faith', 'Faith', 60],
      ['marriage', 'Marriage', 0]
    ]);
    expect(contribution.foundations.map(item => [item.id, item.label, item.categoryLabel, item.score]))
      .toEqual([
        ['faith-prayer', 'Prayer', 'Faith', 85],
        ['connection', 'Connection', 'Marriage', 75]
      ]);
    expect(contribution.overallScore).toBe(50);
    expect(contribution.rhythm.score).toBe(75);
  });

  it('does not present a Cardio Rhythm association as a scoring contribution', () => {
    const rhythm: RhythmPreview = {
      id: 'cardio-run',
      title: 'Cardio run',
      automation: 'manual',
      status: 'Due today',
      categoryIds: ['health'],
      primaryFoundationId: 'health-cardio',
      healthLogCapability: 'cardio'
    };
    const contribution = selectRhythmContribution({
      rhythm,
      foundations: foundationCatalogue,
      relatedRhythms: [rhythm],
      rhythmScores: new Map([[rhythm.id, scored(100, 100)]]),
      archivedRhythmIds: [],
      categoryHealthScores: new Map([['health', 75]]),
      rhythmHealthScore: 100
    });

    expect(contribution.categories).toEqual([]);
    expect(contribution.foundations).toEqual([]);
  });

  it('retains unresolved Foundation IDs without fabricating a category or score', () => {
    const rhythm: RhythmPreview = {
      id: 'unresolved-link',
      title: 'Unresolved link example',
      automation: 'manual',
      status: 'Due today',
      primaryFoundationId: 'missing-foundation'
    };
    const contribution = selectRhythmContribution({
      rhythm,
      foundations: foundationCatalogue,
      relatedRhythms: [rhythm],
      rhythmScores: new Map([[rhythm.id, scored(100, 100)]]),
      archivedRhythmIds: [],
      categoryHealthScores: new Map(),
      rhythmHealthScore: 100
    });

    expect(contribution.unresolvedFoundationIds).toEqual(['missing-foundation']);
    expect(contribution.foundations).toEqual([{
      id: 'missing-foundation',
      label: 'missing-foundation (unresolved)',
      categoryLabel: 'Category unavailable',
      score: null
    }]);
    expect(contribution.categories).toEqual([]);
    expect(contribution.overallScore).toBeNull();
  });
});
