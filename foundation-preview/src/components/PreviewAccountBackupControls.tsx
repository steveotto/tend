import { useCallback, useEffect, useRef, useState } from 'react';
import type { PreviewData, PreviewEnvelope } from '../domain/preview-state.ts';
import {
  createValidatedPreviewAccountDocument,
  PreviewAccountBackupError,
  previewEnvelopesEqual,
  validatePreviewAccountBackup
} from '../storage/preview-account-backup.ts';
import type { PreviewAccountBackupApi } from '../storage/preview-account-backup.ts';
import {
  PREVIEW_STORAGE_KEY,
  preservePreviewBeforeCloudRestore
} from '../storage/preview-storage.ts';
import type { PreviewStorage } from '../storage/preview-storage.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

type PendingConfirmation =
  | {
      kind: 'backup';
      document: PreviewEnvelope;
      expectedRevision: number;
      expectedLocalRaw: string | null;
    }
  | {
      kind: 'restore';
      data: PreviewData;
      expectedRevision: number;
      expectedLocalRaw: string | null;
    };

type PreviewAccountBackupControlsProps = {
  api: PreviewAccountBackupApi | null;
  accountId: string;
  storage: PreviewStorage;
  data: PreviewData;
  currentDate: string;
  localRaw: string | null;
  localRecoveryRaw: string | null;
  localRecoveryError?: string | null;
  enabled: boolean;
  isIdentityCurrent: () => boolean;
  onRestore: (data: PreviewData, expectedLocalRaw: string | null) => string | null;
  onRecoveryChanged: (raw: string | null) => void;
};

type AccountBackupStatus =
  | { kind: 'checking' }
  | { kind: 'empty' }
  | { kind: 'available'; revision: number; updatedAt: string | null }
  | { kind: 'unavailable'; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The account backup request failed. No data was changed.';
}

function formatBackupDate(updatedAt: string | null): string {
  if (updatedAt === null) return 'date unavailable';
  const date = new Date(updatedAt);
  if (!Number.isFinite(date.getTime())) return 'date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function downloadRecovery(raw: string): string | null {
  try {
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tend-preview-before-account-restore.json';
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'The recovery file download could not be started.';
  }
}

export function PreviewAccountBackupControls({
  api,
  accountId,
  storage,
  data,
  currentDate,
  localRaw,
  localRecoveryRaw,
  localRecoveryError = null,
  enabled,
  isIdentityCurrent,
  onRestore,
  onRecoveryChanged
}: PreviewAccountBackupControlsProps) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [backupStatus, setBackupStatus] = useState<AccountBackupStatus>(
    api === null
      ? { kind: 'unavailable', message: 'Account backup is unavailable in this Preview session.' }
      : { kind: 'checking' }
  );
  const operationInProgress = useRef(false);
  const statusRequestId = useRef(0);
  const identityCurrentRef = useRef(isIdentityCurrent);
  identityCurrentRef.current = isIdentityCurrent;

  const refreshBackupStatus = useCallback(async () => {
    const requestId = ++statusRequestId.current;
    if (!api) {
      setBackupStatus({
        kind: 'unavailable',
        message: 'Account backup is unavailable in this Preview session.'
      });
      return;
    }
    setBackupStatus({ kind: 'checking' });
    try {
      const record = await api.read();
      if (requestId !== statusRequestId.current || !identityCurrentRef.current()) return;
      if (!record) {
        setBackupStatus({ kind: 'empty' });
        return;
      }
      validatePreviewAccountBackup(record, currentDate);
      setBackupStatus({
        kind: 'available',
        revision: record.revision,
        updatedAt: record.updatedAt
      });
    } catch (requestError) {
      if (requestId !== statusRequestId.current || !identityCurrentRef.current()) return;
      setBackupStatus({ kind: 'unavailable', message: errorMessage(requestError) });
    }
  }, [api, currentDate]);

  useEffect(() => {
    void refreshBackupStatus();
    return () => {
      statusRequestId.current += 1;
    };
  }, [refreshBackupStatus]);

  async function beginBackup() {
    if (!enabled || !api || busy || operationInProgress.current || !isIdentityCurrent()) return;
    operationInProgress.current = true;
    statusRequestId.current += 1;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const document = createValidatedPreviewAccountDocument(data, currentDate);
      if (storage.getItem(PREVIEW_STORAGE_KEY) !== localRaw) {
        setError('This browser’s preview changed since it was saved. Save or reload the current preview before backing up.');
        return;
      }
      const cloud = await api.read();
      if (!isIdentityCurrent()) return;
      if (!cloud) {
        setBackupStatus({ kind: 'empty' });
        if (storage.getItem(PREVIEW_STORAGE_KEY) !== localRaw) {
          setError('This browser’s preview changed while the backup was being prepared. No account data was changed; try again.');
          return;
        }
        const revision = await api.save(document, 0);
        if (!isIdentityCurrent()) return;
        setMessage(`Backed up to your account (revision ${revision}).`);
        void refreshBackupStatus();
        return;
      }
      const validated = validatePreviewAccountBackup(cloud, currentDate);
      setBackupStatus({
        kind: 'available',
        revision: cloud.revision,
        updatedAt: cloud.updatedAt
      });
      if (previewEnvelopesEqual(validated.envelope, document)) {
        if (storage.getItem(PREVIEW_STORAGE_KEY) !== localRaw) {
          setError('This browser’s preview changed while the backup was being prepared. Review the current data and try again.');
          return;
        }
        setMessage(`Your account backup already matches this browser (revision ${cloud.revision}).`);
        return;
      }
      setPending({
        kind: 'backup',
        document,
        expectedRevision: cloud.revision,
        expectedLocalRaw: localRaw
      });
    } catch (requestError) {
      if (requestError instanceof PreviewAccountBackupError && requestError.kind === 'stale') {
        setPending(null);
      }
      if (isIdentityCurrent()) {
        setBackupStatus({ kind: 'unavailable', message: errorMessage(requestError) });
      }
      setError(errorMessage(requestError));
    } finally {
      operationInProgress.current = false;
      setBusy(false);
    }
  }

  async function beginRestore() {
    if (!enabled || !api || busy || operationInProgress.current || !isIdentityCurrent()) return;
    operationInProgress.current = true;
    statusRequestId.current += 1;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      if (storage.getItem(PREVIEW_STORAGE_KEY) !== localRaw) {
        setError('This browser’s preview changed since it was saved. Save or reload the current preview before restoring.');
        return;
      }
      const cloud = await api.read();
      if (!isIdentityCurrent()) return;
      if (!cloud) {
        setBackupStatus({ kind: 'empty' });
        setMessage('No account backup was found. This browser’s data was not changed.');
        return;
      }
      const validated = validatePreviewAccountBackup(cloud, currentDate);
      setBackupStatus({
        kind: 'available',
        revision: cloud.revision,
        updatedAt: cloud.updatedAt
      });
      const localEnvelope = createValidatedPreviewAccountDocument(data, currentDate);
      if (storage.getItem(PREVIEW_STORAGE_KEY) !== localRaw) {
        setError('This browser’s preview changed while the account backup was being read. No local data was changed.');
        return;
      }
      if (previewEnvelopesEqual(validated.envelope, localEnvelope)) {
        setMessage(`This browser already matches your account backup (revision ${cloud.revision}).`);
        return;
      }
      if (storage.getItem(PREVIEW_STORAGE_KEY) !== localRaw) {
        setError('This browser’s preview changed since it was saved. Save or reload the current preview before restoring.');
        return;
      }
      setPending({
        kind: 'restore',
        data: validated.data,
        expectedRevision: cloud.revision,
        expectedLocalRaw: localRaw
      });
    } catch (requestError) {
      if (isIdentityCurrent()) {
        setBackupStatus({ kind: 'unavailable', message: errorMessage(requestError) });
      }
      setError(errorMessage(requestError));
    } finally {
      operationInProgress.current = false;
      setBusy(false);
    }
  }

  async function confirmPending() {
    if (!pending || !api || busy || operationInProgress.current || !isIdentityCurrent()) return;
    operationInProgress.current = true;
    statusRequestId.current += 1;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      if (pending.kind === 'backup') {
        if (storage.getItem(PREVIEW_STORAGE_KEY) !== pending.expectedLocalRaw
          || pending.expectedLocalRaw !== localRaw) {
          setPending(null);
          setError('This browser’s preview changed after confirmation. No account data was replaced; back up again to review the latest copy.');
          return;
        }
        const revision = await api.save(pending.document, pending.expectedRevision);
        if (!isIdentityCurrent()) return;
        setPending(null);
        setMessage(`Updated your account backup (revision ${revision}).`);
        void refreshBackupStatus();
        return;
      }

      const latestCloud = await api.read();
      if (!isIdentityCurrent()) return;
      if (!latestCloud || latestCloud.revision !== pending.expectedRevision) {
        setPending(null);
        setError('The account backup changed after confirmation. No data was replaced; review the latest copy and try again.');
        return;
      }
      const validated = validatePreviewAccountBackup(latestCloud, currentDate);
      if (storage.getItem(PREVIEW_STORAGE_KEY) !== pending.expectedLocalRaw
        || pending.expectedLocalRaw !== localRaw) {
        setPending(null);
        setError('This browser’s preview changed after confirmation. No data was replaced; review the current copy and try again.');
        return;
      }
      const recovery = preservePreviewBeforeCloudRestore(storage, pending.expectedLocalRaw);
      if (recovery.kind !== 'preserved' && recovery.kind !== 'not-needed') {
        setPending(null);
        setError(recovery.message);
        return;
      }
      if (!isIdentityCurrent()) return;
      const writeError = onRestore(validated.data, pending.expectedLocalRaw);
      if (writeError) {
        setPending(null);
        setError(writeError);
        return;
      }
      onRecoveryChanged(pending.expectedLocalRaw);
      setPending(null);
      setMessage(`Restored your account backup (revision ${latestCloud.revision}). Your previous browser data is available as a recovery copy.`);
    } catch (requestError) {
      setPending(null);
      if (isIdentityCurrent()) {
        setBackupStatus({ kind: 'unavailable', message: errorMessage(requestError) });
      }
      setError(errorMessage(requestError));
    } finally {
      operationInProgress.current = false;
      setBusy(false);
    }
  }

  const pendingBackup = pending?.kind === 'backup';
  const pendingRestore = pending?.kind === 'restore';

  return (
    <section className="settings-section preview-account-backup" aria-labelledby="preview-account-backup-title">
      <h3 id="preview-account-backup-title">Account backup</h3>
      <p>Backups are manual. Changes on this browser are not sent to your account unless you choose Back up.</p>
      <p className="preview-account-backup__account">
        Signed-in account ending in {accountId.slice(-4)}.
      </p>
      <p
        className={backupStatus.kind === 'unavailable' ? 'preview-account-backup__error' : 'preview-account-backup__status'}
        role={backupStatus.kind === 'unavailable' && !error ? 'alert' : 'status'}
      >
        {backupStatus.kind === 'checking' && 'Checking account backup…'}
        {backupStatus.kind === 'empty' && 'No account backup yet.'}
        {backupStatus.kind === 'available'
          && `Last backup: ${formatBackupDate(backupStatus.updatedAt)} · revision ${backupStatus.revision}.`}
        {backupStatus.kind === 'unavailable' && backupStatus.message}
      </p>
      <p>
        Transfers the versioned Preview data document, including Rhythms, associations, completion and activity logs, People, goals, and settings. Authentication and session data are never included.
      </p>
      <div className="preview-account-backup__actions">
        <button type="button" className="btn mini" disabled={!enabled || !api || busy} onClick={() => void beginBackup()}>
          {busy ? 'Working…' : 'Back up to my account'}
        </button>
        <button type="button" className="btn mini ghost" disabled={!enabled || !api || busy} onClick={() => void beginRestore()}>
          Restore from my account
        </button>
      </div>
      {!enabled && <p className="preview-account-backup__note">Wait until this browser’s preview is saved before backing up or restoring.</p>}
      {localRecoveryRaw !== null && (
        <button
          type="button"
          className="btn mini ghost"
          onClick={() => setMessage(
            downloadRecovery(localRecoveryRaw)
              ?? 'The exact local data from before the last account restore was downloaded.'
          )}
        >
          Download local copy from before restore
        </button>
      )}
      {localRecoveryError && <p className="preview-account-backup__error" role="alert">{localRecoveryError}</p>}
      {message && <p className="preview-account-backup__message" role="status">{message}</p>}
      {error && <p className="preview-account-backup__error" role="alert">{error}</p>}
      {pendingBackup && (
        <MoneyGoalDialog
          title="Replace account backup?"
          intro={`These copies differ. This replaces account backup revision ${pending.expectedRevision} with the data currently saved in this browser. This browser’s data will not change.`}
          onClose={() => {
            if (!busy) setPending(null);
          }}
        >
          <div className="money-goal-dialog__actions">
            <button type="button" className="btn mini" disabled={busy} onClick={() => void confirmPending()}>
              Replace account backup
            </button>
            <button type="button" className="btn mini ghost" disabled={busy} onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </MoneyGoalDialog>
      )}
      {pendingRestore && (
        <MoneyGoalDialog
          title="Restore account backup?"
          intro={`These copies differ. This replaces the data saved in this browser with account backup revision ${pending.expectedRevision}. The exact current browser data will be kept as a recovery copy before replacement.`}
          onClose={() => {
            if (!busy) setPending(null);
          }}
        >
          <div className="money-goal-dialog__actions">
            <button type="button" className="btn mini" disabled={busy} onClick={() => void confirmPending()}>
              Replace this browser’s data
            </button>
            <button type="button" className="btn mini ghost" disabled={busy} onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </MoneyGoalDialog>
      )}
    </section>
  );
}
