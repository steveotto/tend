import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FoundationRhythmGroup } from '../src/components/FoundationRhythmGroup.tsx';
import { RhythmScheduleGroups } from '../src/components/RhythmScheduleGroups.tsx';
import type { RhythmPreview } from '../src/domain/preview-data.ts';

afterEach(cleanup);

const rhythms: RhythmPreview[] = [
  {
    id: 'user-rhythm-11111111-1111-4111-8111-111111111111',
    title: 'Daily practice',
    automation: 'manual',
    cadence: 'Daily',
    status: 'Due today',
    personIds: [],
    schedule: { frequency: 'daily' }
  },
  {
    id: 'user-rhythm-22222222-2222-4222-8222-222222222222',
    title: 'Weekly practice',
    automation: 'manual',
    cadence: 'Weekly',
    status: 'Due today',
    personIds: [],
    schedule: { frequency: 'weekly', weekdays: [1] }
  },
  {
    id: 'user-rhythm-33333333-3333-4333-8333-333333333333',
    title: 'Seasonal practice',
    automation: 'manual',
    cadence: 'Quarterly',
    status: 'Due today',
    personIds: [],
    schedule: {
      frequency: 'quarterly',
      monthInQuarter: 1,
      pattern: { kind: 'dayOfMonth', day: 1 }
    }
  },
  {
    id: 'user-rhythm-44444444-4444-4444-8444-444444444444',
    title: 'Every other week practice',
    automation: 'manual',
    cadence: 'Every 2 weeks',
    status: 'Due today',
    personIds: [],
    schedule: {
      frequency: 'custom',
      unit: 'weeks',
      interval: 2,
      weekdays: [1],
      startDate: '2026-10-26'
    }
  }
];

describe('shared Rhythm schedule groups', () => {
  it('uses Faith group labels, order, counts, and custom schedule classification', () => {
    render(
      <RhythmScheduleGroups
        rhythms={rhythms}
        categoryToken="shared"
        renderGroup={groupRhythms => (
          <ul>{groupRhythms.map(rhythm => <li key={rhythm.id}>{rhythm.title}</li>)}</ul>
        )}
      />
    );

    expect(screen.getAllByRole('heading').map(heading => heading.textContent)).toEqual([
      'Daily',
      'Weekly',
      'Seasonal & Annual',
      'Custom schedule'
    ]);
    expect(screen.getByText('Every other week practice')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Custom schedule' })).toBeTruthy();
    expect(screen.queryAllByText('No active Rhythms.')).toHaveLength(0);
  });

  it('keeps the standard empty sections and message used by Faith', () => {
    render(
      <RhythmScheduleGroups
        rhythms={[]}
        categoryToken="empty"
        emptyCollectionMessage={<p>Start with a rhythm.</p>}
        renderGroup={() => null}
      />
    );

    expect(screen.getByText('Start with a rhythm.')).toBeTruthy();
    expect(screen.getAllByRole('heading').map(heading => heading.textContent)).toEqual([
      'Daily',
      'Weekly',
      'Seasonal & Annual'
    ]);
    expect(screen.getAllByText('No active Rhythms.')).toHaveLength(3);
    for (const title of ['Daily', 'Weekly', 'Seasonal & Annual']) {
      const group = screen.getByRole('region', { name: title });
      expect(within(group).getByText('No active Rhythms.')).toBeTruthy();
    }
  });

  it('keeps rhythms with unsupported schedules visible without changing Faith classification', () => {
    const rhythm: RhythmPreview = {
      id: 'user-rhythm-55555555-5555-4555-8555-555555555555',
      title: 'Legacy schedule',
      automation: 'manual',
      cadence: 'Legacy cadence',
      status: 'Due today',
      personIds: []
    };
    render(
      <RhythmScheduleGroups
        rhythms={[rhythm]}
        categoryToken="legacy"
        renderGroup={groupRhythms => (
          <ul>{groupRhythms.map(item => <li key={item.id}>{item.title}</li>)}</ul>
        )}
      />
    );

    expect(screen.getByRole('region', { name: 'Unclassified schedule' })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Unclassified schedule' }))
      .getByText('Legacy schedule')).toBeTruthy();
  });

  it('groups Foundation linked Rhythms without replacing their shared cards or actions', () => {
    render(
      <>
        <h3 id="foundation-rhythm-heading">Linked Rhythms</h3>
        <FoundationRhythmGroup
          people={[]}
          rhythms={rhythms}
          archivedRhythmIds={[]}
          headingId="foundation-rhythm-heading"
          rhythmScores={new Map()}
          completedRhythms={new Set()}
          undoableRhythms={new Set()}
          foundations={[]}
          categoryToken="faith"
          onTend={() => undefined}
          onEditRhythm={() => undefined}
        />
      </>
    );

    for (const [title, rhythm] of [
      ['Daily', rhythms[0]!],
      ['Weekly', rhythms[1]!],
      ['Seasonal & Annual', rhythms[2]!],
      ['Custom schedule', rhythms[3]!]
    ] as const) {
      const group = screen.getByRole('region', { name: title });
      expect(within(group).getByRole('article', { name: rhythm.title })).toBeTruthy();
      expect(within(group).getByRole('button', { name: `Tend ${rhythm.title}` })).toBeTruthy();
    }
    expect(screen.getByRole('heading', { name: 'Every other week practice' })).toBeTruthy();
  });
});
