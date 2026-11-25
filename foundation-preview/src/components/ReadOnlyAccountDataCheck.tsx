import { useState } from 'react';
import type { PreviewData } from '../domain/preview-state.ts';
import { createPreviewEnvelope, parsePreviewBackup } from '../domain/preview-state.ts';
import {
  previewEnvelopesEqual,
  validatePreviewAccountBackup
} from '../storage/preview-account-backup.ts';
import type {
  PreviewAccountBackupApi,
  PreviewAccountBackupRecord
} from '../storage/preview-account-backup.ts';
import { PREVIEW_STORAGE_KEY } from '../storage/preview-storage.ts';
import type { PreviewStorage } from '../storage/preview-storage.ts';

type DataCounts = {
  people: number;
  prayers: number;
  prayerLogs: number;
  personDetails: number;
  personPhotos: number;
  personNotes: number;
  personSparks: number;
  savedRhythms: number;
  datedRhythmCompletions: number;
  activeRhythmCompletions: number;
  rhythmCompletionOverrides: number;
  rhythmHistoryIds: number;
  strengthWorkouts: number;
  weightWeighIns: number;
  cardioRuns: number;
  flexibilitySessions: number;
  categoryPreferenceKeys: number;
  foundationPreferenceKeys: number;
};

type AccountCheckResult = {
  accountIdSuffix: string;
  localStorage: 'current' | 'changed-since-load' | 'missing' | 'invalid' | 'unavailable';
  localStorageCounts: DataCounts | null;
  localModelCounts: DataCounts;
  localModelMatchesStorage: boolean | null;
  account:
    | { kind: 'empty' }
    | {
        kind: 'available';
        revision: number;
        updatedAt: string | null;
        canonicalCounts: {
          people: number;
          prayers: number;
          prayerLogs: number;
          prayersWithNullPersonId: number;
          embeddedPreview?: NonNullable<PreviewAccountBackupRecord['canonicalStructure']>['embeddedPreview'];
        };
        projectedCounts: DataCounts;
        localModelMatchesProjection: boolean | null;
      };
};

type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'result'; value: AccountCheckResult }
  | { kind: 'error'; code: string };

function dataCounts(data: PreviewData): DataCounts {
  return {
    people: data.people.length,
    prayers: data.prayerRequests.length,
    prayerLogs: data.prayerRequests.reduce((total, prayer) => total + prayer.prayerLogs.length, 0),
    personDetails: data.personDetails.length,
    personPhotos: data.personDetails.filter(details => Boolean(details.photoDataUrl)).length,
    personNotes: data.personNotes.length,
    personSparks: data.personSparks.length,
    savedRhythms: data.savedRhythms.length,
    datedRhythmCompletions: data.datedRhythmCompletions.length,
    activeRhythmCompletions: data.activeRhythmCompletions.length,
    rhythmCompletionOverrides: data.rhythmCompletionOverrides.length,
    rhythmHistoryIds: data.rhythmHistoryIds.length,
    strengthWorkouts: data.strength.workouts.length,
    weightWeighIns: data.weight.weighIns.length,
    cardioRuns: data.cardio.runs.length,
    flexibilitySessions: data.flexibility.sessions.length,
    categoryPreferenceKeys: Object.keys(data.categoryPreferences).length,
    foundationPreferenceKeys: Object.keys(data.foundationPreferences).length
  };
}

function safeReadErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('invalid owner reference')) return 'canonical.prayer.owner-reference-invalid';
  if (message.includes('missing from the account')) return 'canonical.prayer.person-reference-unresolved';
  if (message.includes('schema is not supported')) return 'canonical.schema-unsupported';
  if (message.includes('could not be read')) return 'canonical.read-failed';
  return 'account.read-or-validation-failed';
}

function formatCounts(counts: DataCounts | null): string {
  return counts
    ? `${counts.people} People; ${counts.prayers} Prayer requests; ${counts.prayerLogs} Prayer history logs; `
      + `${counts.personDetails} profile details (${counts.personPhotos} saved photo${counts.personPhotos === 1 ? '' : 's'}); ${counts.personNotes} notes; `
      + `${counts.personSparks} Sparks; ${counts.savedRhythms} saved Rhythms; `
      + `${counts.datedRhythmCompletions} dated completions; ${counts.activeRhythmCompletions} active completions; `
      + `${counts.rhythmCompletionOverrides} completion overrides; ${counts.rhythmHistoryIds} Rhythm history links; `
      + `scoring inputs: ${counts.strengthWorkouts} Strength workouts, ${counts.weightWeighIns} Weight records, `
      + `${counts.cardioRuns} Cardio runs, ${counts.flexibilitySessions} Flexibility sessions; `
      + `${counts.categoryPreferenceKeys} category preferences; ${counts.foundationPreferenceKeys} Foundation preferences`
    : 'unavailable';
}

export function ReadOnlyAccountDataCheck({
  accountId,
  api,
  currentDate,
  data,
  isIdentityCurrent,
  localRaw,
  storage
}: {
  accountId: string | null;
  api: PreviewAccountBackupApi | null;
  currentDate: string;
  data: PreviewData;
  isIdentityCurrent: () => boolean;
  localRaw: string | null;
  storage: PreviewStorage;
}) {
  const [checkState, setCheckState] = useState<CheckState>({ kind: 'idle' });

  async function runCheck() {
    if (checkState.kind === 'checking') return;
    if (!api || !accountId) {
      setCheckState({ kind: 'error', code: 'account.read-unavailable' });
      return;
    }

    setCheckState({ kind: 'checking' });
    try {
      if (!isIdentityCurrent()) {
        setCheckState({ kind: 'error', code: 'identity.changed-before-read' });
        return;
      }

      const localModelEnvelope = createPreviewEnvelope(data);
      const localModelCounts = dataCounts(data);
      let localStorageState: AccountCheckResult['localStorage'] = 'unavailable';
      let localStorageCounts: DataCounts | null = null;
      let localModelMatchesStorage: boolean | null = null;
      try {
        const storedRaw = storage.getItem(PREVIEW_STORAGE_KEY);
        if (storedRaw === null) {
          localStorageState = 'missing';
        } else {
          const parsed = parsePreviewBackup(storedRaw, currentDate);
          if (!parsed.valid) {
            localStorageState = 'invalid';
          } else {
            localStorageCounts = dataCounts(parsed.envelope.data);
            localModelMatchesStorage = previewEnvelopesEqual(
              localModelEnvelope,
              parsed.envelope
            );
            localStorageState = storedRaw === localRaw ? 'current' : 'changed-since-load';
          }
        }
      } catch {
        localStorageState = 'unavailable';
      }

      const record = await api.read();
      if (!isIdentityCurrent()) {
        setCheckState({ kind: 'error', code: 'identity.changed-during-read' });
        return;
      }
      if (record === null) {
        setCheckState({
          kind: 'result',
          value: {
            accountIdSuffix: accountId.slice(-4),
            localStorage: localStorageState,
            localStorageCounts,
            localModelCounts,
            localModelMatchesStorage,
            account: { kind: 'empty' }
          }
        });
        return;
      }

      const validated = validatePreviewAccountBackup(record, currentDate);
      const projectedCounts = dataCounts(validated.data);
      const canonicalCounts = record.canonicalStructure ?? {
        people: projectedCounts.people,
        prayers: projectedCounts.prayers,
        prayerLogs: projectedCounts.prayerLogs,
        prayersWithNullPersonId: 0
      };
      setCheckState({
        kind: 'result',
        value: {
          accountIdSuffix: accountId.slice(-4),
          localStorage: localStorageState,
          localStorageCounts,
          localModelCounts,
          localModelMatchesStorage,
          account: {
            kind: 'available',
            revision: record.revision,
            updatedAt: record.updatedAt,
            canonicalCounts,
            projectedCounts,
            localModelMatchesProjection: previewEnvelopesEqual(
              localModelEnvelope,
              validated.envelope
            )
          }
        }
      });
    } catch (error) {
      setCheckState({ kind: 'error', code: safeReadErrorCode(error) });
    }
  }

  return (
    <main className="settings-page" aria-labelledby="read-only-account-check-title">
      <header className="settings-page__heading">
        <h1 id="read-only-account-check-title">Read-only account data check</h1>
      </header>
      <section className="settings-section" aria-label="Account data check">
        <p>
          Automatic account sync and local auto-save are paused on this page. The check reads
          counts and revisions only; it does not save, restore, or replace data.
        </p>
        <button
          type="button"
          className="btn mini"
          disabled={checkState.kind === 'checking' || !api || !accountId}
          onClick={() => void runCheck()}
        >
          {checkState.kind === 'checking' ? 'Checking…' : 'Run read-only account check'}
        </button>
        {checkState.kind === 'error' && (
          <p role="alert">Read-only check stopped safely. Diagnostic: {checkState.code}.</p>
        )}
        {checkState.kind === 'result' && (
          <div className="preview-account-sync__message" role="status" aria-live="polite">
            <p>Signed-in account suffix: {checkState.value.accountIdSuffix}.</p>
            <p>
              This device’s loaded app model: {formatCounts(checkState.value.localModelCounts)}.
            </p>
            <p>
              This device’s saved local snapshot: {checkState.value.localStorage}
              {checkState.value.localStorageCounts
                ? ` (${formatCounts(checkState.value.localStorageCounts)})`
                : ''}.
            </p>
            <p>
              App model matches saved local snapshot:{' '}
              {checkState.value.localModelMatchesStorage === null
                ? 'not verified'
                : checkState.value.localModelMatchesStorage ? 'yes' : 'no'}.
            </p>
            {checkState.value.account.kind === 'empty'
              ? <p>Canonical account: no account row is available.</p>
              : (
                <>
                  <p>
                    Canonical account revision read on this device: {checkState.value.account.revision}
                    {checkState.value.account.updatedAt
                      ? ` · updated ${checkState.value.account.updatedAt}`
                      : ''}.
                  </p>
                  <p>
                    Canonical stored counts: {checkState.value.account.canonicalCounts.people} People;
                    {' '}{checkState.value.account.canonicalCounts.prayers} Prayer records;
                    {' '}{checkState.value.account.canonicalCounts.prayerLogs} Prayer history logs;
                    {' '}{checkState.value.account.canonicalCounts.prayersWithNullPersonId} with an explicit null Person association.
                  </p>
                  {checkState.value.account.canonicalCounts.embeddedPreview && (
                    <p>
                      Embedded Preview snapshot: {checkState.value.account.canonicalCounts.embeddedPreview.present
                        ? `schema ${checkState.value.account.canonicalCounts.embeddedPreview.schemaVersion ?? 'unknown'}`
                        : 'not present'};
                      {' '}{formatCounts({
                        ...checkState.value.account.canonicalCounts.embeddedPreview,
                        prayers: checkState.value.account.canonicalCounts.embeddedPreview.prayerRequests
                      })}.
                    </p>
                  )}
                  <p>
                    Account projection used by the app: {formatCounts(checkState.value.account.projectedCounts)}.
                  </p>
                  <p>
                    This device’s app model matches that account projection:{' '}
                    {checkState.value.account.localModelMatchesProjection === null
                      ? 'not verified'
                      : checkState.value.account.localModelMatchesProjection ? 'yes' : 'no'}.
                  </p>
                </>
              )}
            <p>Counts and revisions do not expose or compare record contents.</p>
          </div>
        )}
      </section>
    </main>
  );
}
