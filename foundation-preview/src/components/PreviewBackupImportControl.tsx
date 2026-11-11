import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { createPreviewEnvelope, parsePreviewBackup } from '../domain/preview-state.ts';
import type { PreviewData } from '../domain/preview-state.ts';
import type { PreviewPersistenceStatus } from './PreviewDataControls.tsx';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { downloadText } from './preview-download.ts';
import {
  foundationRhythmIds,
  missingRequiredFoundationCategories
} from '../domain/foundation-rhythm-associations.ts';

type PendingImport = {
  data: PreviewData;
  sourceSchemaVersion: number;
  resolvedPersonCategories: number;
  raw: string;
};

type PreviewBackupImportControlProps = {
  data: PreviewData;
  status: PreviewPersistenceStatus;
  currentDate: string;
  onImport: (data: PreviewData, sourceRaw?: string) => string | null;
  recoveryRaw?: string | null;
  recoverySourceRaw?: string | null;
  recoveryArchiveRaw?: string | null;
  recoveryError?: string | null;
  showExport?: boolean;
  presentation?: 'default' | 'recovery';
};

export function PreviewBackupImportControl({
  data,
  status,
  currentDate,
  onImport,
  recoveryRaw = null,
  recoverySourceRaw = null,
  recoveryArchiveRaw = null,
  recoveryError = null,
  showExport = false,
  presentation = 'default'
}: PreviewBackupImportControlProps) {
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const readers = useRef(new Set<FileReader>());
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      for (const reader of readers.current) reader.abort();
      readers.current.clear();
    };
  }, []);

  function readImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    const reader = new FileReader();
    readers.current.add(reader);
    reader.onloadend = () => readers.current.delete(reader);
    reader.onerror = () => {
      if (active.current) setMessage({ text: 'The selected backup could not be read.', error: true });
    };
    reader.onload = () => {
      if (!active.current) return;
      const raw = String(reader.result ?? '');
      const parsed = parsePreviewBackup(raw, currentDate);
      if (!parsed.valid) {
        setPending(null);
        setMessage({ text: parsed.message, error: true });
        return;
      }
      setMessage(null);
      setPending({
        data: parsed.envelope.data,
        sourceSchemaVersion: parsed.sourceSchemaVersion,
        resolvedPersonCategories: parsed.resolvedPersonCategories,
        raw
      });
    };
    reader.readAsText(file);
  }

  function exportCurrent() {
    const error = downloadText(
      'tend-synthetic-preview-backup.json',
      JSON.stringify(createPreviewEnvelope(data), null, 2),
      'application/json'
    );
    setMessage(error
      ? { text: error, error: true }
      : { text: presentation === 'recovery' ? 'This device’s data backup was downloaded.' : 'Preview backup downloaded.', error: false });
  }

  function downloadRecovery(raw: string, filename: string) {
    const error = downloadText(filename, raw, 'application/json');
    setMessage(error
      ? { text: error, error: true }
      : { text: 'Pre-import local recovery downloaded.', error: false });
  }

  function confirmImport() {
    if (!pending) return;
    const error = onImport(pending.data, pending.raw);
    if (error) {
      setMessage({ text: error, error: true });
      return;
    }
    setPending(null);
    setMessage({ text: 'Preview backup imported.', error: false });
  }

  const completionCount = pending
    ? pending.data.datedRhythmCompletions.length + pending.data.activeRhythmCompletions.length
    : 0;
  const importedRhythmsMissingLinks = pending
    ? pending.data.savedRhythms.filter(rhythm =>
        !pending.data.archivedRhythmIds.includes(rhythm.id)
        && missingRequiredFoundationCategories(
          rhythm.categoryIds,
          foundationRhythmIds(rhythm)
        ).length > 0
      )
    : [];
  const compactRecovery = presentation === 'recovery';
  const Wrapper = showExport && !compactRecovery ? 'section' : 'div';

  return (
    <Wrapper
      className={[
        'preview-backup-import',
        showExport && !compactRecovery ? 'settings-section' : '',
        compactRecovery ? 'preview-backup-import--recovery' : ''
      ].filter(Boolean).join(' ')}
      {...(showExport && !compactRecovery ? { 'aria-labelledby': 'preview-backup-import-title' } : {})}
    >
      {showExport && !compactRecovery && <h3 id="preview-backup-import-title">Preview backup</h3>}
      {showExport && !compactRecovery && (
        <p>Import replaces this account’s local Preview data on this device. It does not update the cloud backup.</p>
      )}
      <div className={compactRecovery ? 'preview-backup-import__rows' : 'preview-data-controls__actions'}>
        {showExport && (
          compactRecovery
            ? (
              <button
                type="button"
                className="preview-backup-import__row"
                onClick={exportCurrent}
                disabled={status.kind === 'loading'}
              >
                <span className="preview-backup-import__row-copy">
                  <span className="preview-backup-import__row-title">Export this device’s data</span>
                  <span className="preview-backup-import__row-description">Download a backup file.</span>
                </span>
                <span className="preview-backup-import__row-action" aria-hidden="true">↓</span>
              </button>
            )
            : (
              <button type="button" className="btn mini ghost" onClick={exportCurrent} disabled={status.kind === 'loading'}>
                Export preview backup
              </button>
            )
        )}
        {compactRecovery
          ? (
            <label className="preview-backup-import__row preview-backup-import__file-row">
              <span className="preview-backup-import__row-copy">
                <span className="preview-backup-import__row-title">Import a backup file</span>
                <span className="preview-backup-import__row-description">Restore data from a file you saved.</span>
              </span>
              <span className="preview-backup-import__row-action" aria-hidden="true">↑</span>
              <input
                type="file"
                accept="application/json,.json"
                aria-label="Import a backup file"
                onChange={readImport}
                disabled={status.kind === 'loading'}
              />
            </label>
          )
          : (
            <label className="btn mini ghost preview-data-controls__file-button">
              Import preview backup
              <input
                type="file"
                accept="application/json,.json"
                aria-label="Import preview backup"
                onChange={readImport}
                disabled={status.kind === 'loading'}
              />
            </label>
          )}
        {recoverySourceRaw !== null && (
          <button
            type="button"
            className={compactRecovery ? 'preview-backup-import__row' : 'btn mini ghost'}
            onClick={() => downloadRecovery(recoverySourceRaw, 'tend-preview-original-import.json')}
          >
            {compactRecovery ? (
              <span className="preview-backup-import__row-copy">
                <span className="preview-backup-import__row-title">Download original imported backup</span>
                <span className="preview-backup-import__row-description">Download the source file from the last import.</span>
              </span>
            ) : 'Download original imported backup'}
          </button>
        )}
        {recoveryRaw !== null && (
          <button
            type="button"
            className={compactRecovery ? 'preview-backup-import__row' : 'btn mini ghost'}
            onClick={() => downloadRecovery(recoveryRaw, 'tend-preview-before-import.json')}
          >
            {compactRecovery ? (
              <span className="preview-backup-import__row-copy">
                <span className="preview-backup-import__row-title">Download pre-import device copy</span>
                <span className="preview-backup-import__row-description">Recover data saved before the last import.</span>
              </span>
            ) : 'Download pre-import local data'}
          </button>
        )}
        {recoveryArchiveRaw !== null && (
          <button
            type="button"
            className={compactRecovery ? 'preview-backup-import__row' : 'btn mini ghost'}
            onClick={() => downloadRecovery(recoveryArchiveRaw, 'tend-preview-import-recovery-archive.json')}
          >
            {compactRecovery ? (
              <span className="preview-backup-import__row-copy">
                <span className="preview-backup-import__row-title">Download import recovery archive</span>
                <span className="preview-backup-import__row-description">Download a preserved recovery copy.</span>
              </span>
            ) : 'Download import recovery archive'}
          </button>
        )}
      </div>
      {message && (
        <p className={message.error ? 'preview-data-controls__error' : 'preview-data-controls__message'}
          role={message.error ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
      {recoveryError && <p className="preview-data-controls__error" role="alert">{recoveryError}</p>}
      {pending && (
        <MoneyGoalDialog
          title="Replace preview data?"
          intro={pending.sourceSchemaVersion >= 3
            ? 'This replaces this account’s local Preview data on this device. Your cloud backup is not changed.'
            : 'This backup predates archive status, so its Rhythms will be restored as active. It replaces this account’s local Preview data on this device; the cloud backup is not changed.'}
          onClose={() => setPending(null)}
        >
          <dl className="legacy-import-report">
            <div><dt>People</dt><dd>{pending.data.people.length}</dd></div>
            <div><dt>Saved Rhythms</dt><dd>{pending.data.savedRhythms.length}</dd></div>
            <div><dt>Recorded Rhythm completions</dt><dd>{completionCount}</dd></div>
            <div><dt>Goals and check-ins</dt><dd>{pending.data.goals.length} / {pending.data.goals.reduce((count, goal) => count + goal.checkIns.length, 0)}</dd></div>
          </dl>
          <p className="preview-data-controls__help">
            Supported People, Rhythm associations, completion and activity logs, settings, and other validated data will be imported. The current local data is preserved as a recovery copy before replacement. Schema {pending.sourceSchemaVersion} is validated and migrated where supported.
          </p>
          {importedRhythmsMissingLinks.length > 0 && (
            <p className="preview-data-controls__help" role="status">
              {importedRhythmsMissingLinks.length} active {importedRhythmsMissingLinks.length === 1 ? 'Rhythm lacks' : 'Rhythms lack'} a required Practice/Foundation link. The backup will still import unchanged, with no automatic link assignments. After import, edit each Rhythm to choose a matching Practice/Foundation.
            </p>
          )}
          {pending.resolvedPersonCategories > 0 && (
            <p className="preview-data-controls__help">
              Multiple category memberships were resolved for {pending.resolvedPersonCategories} {pending.resolvedPersonCategories === 1 ? 'person' : 'people'} using Marriage, then Parenting, then Friend priority. The selected backup file remains unchanged.
            </p>
          )}
          <p className="preview-data-controls__help">Cancel leaves the current preview unchanged.</p>
          <div className="money-goal-dialog__actions">
            <button type="button" className="btn mini ghost" onClick={exportCurrent}>
              Download current preview backup
            </button>
            <button type="button" className="btn mini" onClick={confirmImport}>Replace with backup</button>
            <button type="button" className="btn mini ghost" onClick={() => setPending(null)}>Cancel</button>
          </div>
        </MoneyGoalDialog>
      )}
    </Wrapper>
  );
}
