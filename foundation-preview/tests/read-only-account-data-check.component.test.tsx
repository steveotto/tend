import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadOnlyAccountDataCheck } from '../src/components/ReadOnlyAccountDataCheck.tsx';
import { createEmptyPreviewData, createPreviewEnvelope } from '../src/domain/preview-state.ts';
import type { PreviewAccountBackupApi, PreviewAccountBackupRecord } from '../src/storage/preview-account-backup.ts';
import type { PreviewStorage } from '../src/storage/preview-storage.ts';

afterEach(cleanup);

describe('read-only account data check', () => {
  it('compares local and account counts/revisions without writes or revealing record values', async () => {
    const accountData = createEmptyPreviewData();
    accountData.people = [
      { id: 'private-person-one', displayName: 'Private person one' },
      { id: 'private-person-two', displayName: 'Private person two' }
    ];
    accountData.prayerRequests = [
      {
        id: 'private-prayer-one',
        personId: 'private-person-one',
        title: 'Private Prayer title one',
        status: 'active',
        createdAt: '2026-11-20T12:00:00.000Z',
        updatedAt: '2026-11-24T12:00:00.000Z',
        prayerLogs: [{ id: 'private-log-one', prayedAt: '2026-11-22T12:00:00.000Z' }]
      },
      {
        id: 'private-prayer-two',
        personId: 'private-person-two',
        title: 'Private Prayer title two',
        status: 'active',
        createdAt: '2026-11-21T12:00:00.000Z',
        updatedAt: '2026-11-24T12:00:00.000Z',
        prayerLogs: [
          { id: 'private-log-two', prayedAt: '2026-11-23T12:00:00.000Z' },
          { id: 'private-log-three', prayedAt: '2026-11-24T12:00:00.000Z' }
        ]
      }
    ];
    const envelope = createPreviewEnvelope(accountData);
    const record: PreviewAccountBackupRecord = {
      document: envelope,
      schemaVersion: envelope.schemaVersion,
      revision: 23,
      updatedAt: '2026-11-25T12:00:00.000Z',
      canonicalStructure: {
        people: 2,
        prayers: 3,
        prayerLogs: 5,
        prayersWithNullPersonId: 1,
        embeddedPreview: {
          present: true,
          schemaVersion: 59,
          people: 2,
          personDetails: 2,
          personPhotos: 1,
          personNotes: 3,
          personSparks: 4,
          prayerRequests: 2,
          prayerLogs: 3,
          savedRhythms: 5,
          datedRhythmCompletions: 6,
          activeRhythmCompletions: 7,
          rhythmCompletionOverrides: 8,
          rhythmHistoryIds: 9,
          strengthWorkouts: 10,
          weightWeighIns: 11,
          cardioRuns: 12,
          flexibilitySessions: 13,
          categoryPreferenceKeys: 6,
          foundationPreferenceKeys: 20
        }
      }
    };
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => structuredClone(record)),
      save: vi.fn(async () => 24)
    };
    const values = new Map<string, string>();
    const storage: PreviewStorage = {
      getItem: vi.fn(key => values.get(key) ?? null),
      setItem: vi.fn((key, value) => { values.set(key, value); })
    };
    const originalStorage = new Map(values);

    render(
      <ReadOnlyAccountDataCheck
        accountId="a0000000-0000-4000-8000-123456789abc"
        api={api}
        currentDate="2026-11-25"
        data={createEmptyPreviewData()}
        isIdentityCurrent={() => true}
        localRaw={null}
        storage={storage}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run read-only account check' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('revision read on this device: 23'));

    const report = screen.getByRole('status').textContent ?? '';
    expect(report).toContain('Signed-in account suffix: 9abc');
    expect(report).toContain('0 People; 0 Prayer requests; 0 Prayer history logs');
    expect(report).toContain('Canonical stored counts: 2 People; 3 Prayer records; 5 Prayer history logs; 1 with an explicit null Person association.');
    expect(report).toContain('Embedded Preview snapshot: schema 59; 2 People; 2 Prayer requests; 3 Prayer history logs; 2 profile details (1 saved photo);');
    expect(report).toContain('5 saved Rhythms; 6 dated completions; 7 active completions; 8 completion overrides; 9 Rhythm history links;');
    expect(report).toContain('scoring inputs: 10 Strength workouts, 11 Weight records, 12 Cardio runs, 13 Flexibility sessions; 6 category preferences; 20 Foundation preferences.');
    expect(report).toContain('Account projection used by the app: 2 People; 2 Prayer requests; 3 Prayer history logs');
    expect(report).toContain('This device’s app model matches that account projection: no');
    expect(report).not.toMatch(/Private|private-person|private-prayer|private-log/i);
    expect(api.read).toHaveBeenCalledOnce();
    expect(api.save).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(values).toEqual(originalStorage);
  });

  it('reports the read failure by safe code without showing error contents', async () => {
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => {
        throw new Error('A canonical Prayer record has an invalid owner reference. Diagnostic: {"personIdType":"object","private":"value"}');
      }),
      save: vi.fn(async () => 1)
    };
    const storage: PreviewStorage = {
      getItem: () => null,
      setItem: vi.fn()
    };

    render(
      <ReadOnlyAccountDataCheck
        accountId="a0000000-0000-4000-8000-000000000001"
        api={api}
        currentDate="2026-11-25"
        data={createEmptyPreviewData()}
        isIdentityCurrent={() => true}
        localRaw={null}
        storage={storage}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run read-only account check' }));
    expect((await screen.findByRole('alert')).textContent)
      .toContain('canonical.prayer.owner-reference-invalid');
    expect(screen.getByRole('alert').textContent).not.toContain('private');
    expect(api.save).not.toHaveBeenCalled();
  });
});
