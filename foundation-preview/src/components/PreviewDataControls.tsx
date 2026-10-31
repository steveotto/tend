import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { createPreviewEnvelope, parsePreviewBackup } from '../domain/preview-state.ts';
import type { PreviewData } from '../domain/preview-state.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

export type PreviewPersistenceStatus =
  | { kind: 'loading' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'corrupt'; message: string; raw: string }
  | { kind: 'unsupported'; message: string; raw: string }
  | { kind: 'conflict' };

type PendingAction =
  | { kind: 'import'; data: PreviewData; hasArchiveStatus: boolean }
  | { kind: 'reset' }
  | { kind: 'replace-external' };

type PreviewDataControlsProps = {
  hidden?: boolean;
  data: PreviewData;
  status: PreviewPersistenceStatus;
  currentDate: string;
  onImport: (data: PreviewData) => string | null;
  onReset: () => string | null;
  onRetrySave: () => void;
  onReloadExternal: () => string | null;
  onReplaceExternal: () => string | null;
  v1RecoveryCopy?: string | null;
  v1RecoveryError?: string | null;
  v2RecoveryCopy?: string | null;
  v2RecoveryError?: string | null;
  v3RecoveryCopy?: string | null;
  v3RecoveryError?: string | null;
  v4RecoveryCopy?: string | null;
  v4RecoveryError?: string | null;
  v5RecoveryCopy?: string | null;
  v5RecoveryError?: string | null;
  v6RecoveryCopy?: string | null;
  v6RecoveryError?: string | null;
  v7RecoveryCopy?: string | null;
  v7RecoveryError?: string | null;
  v8RecoveryCopy?: string | null;
  v8RecoveryError?: string | null;
  v9RecoveryCopy?: string | null;
  v9RecoveryError?: string | null;
  v10RecoveryCopy?: string | null;
  v10RecoveryError?: string | null;
  v11RecoveryCopy?: string | null;
  v11RecoveryError?: string | null;
  v12RecoveryCopy?: string | null;
  v12RecoveryError?: string | null;
  v13RecoveryCopy?: string | null;
  v13RecoveryError?: string | null;
  v14RecoveryCopy?: string | null;
  v14RecoveryError?: string | null;
  v15RecoveryCopy?: string | null;
  v15RecoveryError?: string | null;
  v16RecoveryCopy?: string | null;
  v16RecoveryError?: string | null;
  v17RecoveryCopy?: string | null;
  v17RecoveryError?: string | null;
  v18RecoveryCopy?: string | null;
  v18RecoveryError?: string | null;
  v19RecoveryCopy?: string | null;
  v19RecoveryError?: string | null;
  v20RecoveryCopy?: string | null;
  v20RecoveryError?: string | null;
  v21RecoveryCopy?: string | null;
  v21RecoveryError?: string | null;
  v22RecoveryCopy?: string | null;
  v22RecoveryError?: string | null;
  v23RecoveryCopy?: string | null;
  v23RecoveryError?: string | null;
  v25RecoveryCopy?: string | null;
  v25RecoveryError?: string | null;
  v26RecoveryCopy?: string | null;
  v26RecoveryError?: string | null;
  v27RecoveryCopy?: string | null;
  v27RecoveryError?: string | null;
  v28RecoveryCopy?: string | null;
  v28RecoveryError?: string | null;
  v29RecoveryCopy?: string | null;
  v29RecoveryError?: string | null;
};

function downloadText(filename: string, content: string, type: string): string | null {
  try {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'The browser could not start the download.';
  }
}

export function PreviewDataControls({
  hidden = false,
  data,
  status,
  currentDate,
  onImport,
  onReset,
  onRetrySave,
  onReloadExternal,
  onReplaceExternal,
  v1RecoveryCopy = null,
  v1RecoveryError = null,
  v2RecoveryCopy = null,
  v2RecoveryError = null,
  v3RecoveryCopy = null,
  v3RecoveryError = null,
  v4RecoveryCopy = null,
  v4RecoveryError = null,
  v5RecoveryCopy = null,
  v5RecoveryError = null,
  v6RecoveryCopy = null,
  v6RecoveryError = null,
  v7RecoveryCopy = null,
  v7RecoveryError = null,
  v8RecoveryCopy = null,
  v8RecoveryError = null,
  v9RecoveryCopy = null,
  v9RecoveryError = null,
  v10RecoveryCopy = null,
  v10RecoveryError = null,
  v11RecoveryCopy = null,
  v11RecoveryError = null,
  v12RecoveryCopy = null,
  v12RecoveryError = null,
  v13RecoveryCopy = null,
  v13RecoveryError = null,
  v14RecoveryCopy = null,
  v14RecoveryError = null,
  v15RecoveryCopy = null,
  v15RecoveryError = null,
  v16RecoveryCopy = null,
  v16RecoveryError = null,
  v17RecoveryCopy = null,
  v17RecoveryError = null,
  v18RecoveryCopy = null,
  v18RecoveryError = null,
  v19RecoveryCopy = null,
  v19RecoveryError = null,
  v20RecoveryCopy = null,
  v20RecoveryError = null,
  v21RecoveryCopy = null,
  v21RecoveryError = null,
  v22RecoveryCopy = null,
  v22RecoveryError = null,
  v23RecoveryCopy = null,
  v23RecoveryError = null,
  v25RecoveryCopy = null,
  v25RecoveryError = null,
  v26RecoveryCopy = null,
  v26RecoveryError = null,
  v27RecoveryCopy = null,
  v27RecoveryError = null,
  v28RecoveryCopy = null,
  v28RecoveryError = null,
  v29RecoveryCopy = null,
  v29RecoveryError = null
}: PreviewDataControlsProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [message, setMessage] = useState('');

  function exportCurrent() {
    const error = downloadText(
      'tend-synthetic-preview-backup.json',
      JSON.stringify(createPreviewEnvelope(data), null, 2),
      'application/json'
    );
    setMessage(error ?? 'Preview backup downloaded.');
  }

  function downloadRecovery(raw: string) {
    const error = downloadText('tend-synthetic-preview-recovery.txt', raw, 'text/plain');
    setMessage(error ?? 'Raw recovery file downloaded unchanged.');
  }

  function readImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => setMessage('The selected backup could not be read.');
    reader.onload = () => {
      const result = parsePreviewBackup(String(reader.result ?? ''), currentDate);
      if (!result.valid) {
        setMessage(result.message);
        return;
      }
      setMessage('');
      setPendingAction({
        kind: 'import',
        data: result.envelope.data,
        hasArchiveStatus: result.sourceSchemaVersion >= 3
      });
    };
    reader.readAsText(file);
  }

  function confirmPendingAction() {
    if (!pendingAction) return;
    const error = pendingAction.kind === 'import'
      ? onImport(pendingAction.data)
      : pendingAction.kind === 'reset'
        ? onReset()
        : onReplaceExternal();
    if (error) {
      setMessage(error);
      return;
    }
    setMessage(pendingAction.kind === 'import'
      ? 'Preview backup imported.'
      : pendingAction.kind === 'reset'
        ? 'Sample data restored.'
        : 'This preview replaced the other tab’s saved data.');
    setPendingAction(null);
  }

  const statusMessage = status.kind === 'loading'
    ? 'Loading preview data…'
    : status.kind === 'saving'
      ? 'Saving preview data…'
      : status.kind === 'saved'
        ? 'Preview data saved in this browser.'
        : status.kind === 'unavailable'
          ? `Browser storage is unavailable. Changes are not saved. ${status.message}`
          : status.kind === 'error'
            ? `Preview data was not saved. ${status.message}`
            : status.kind === 'corrupt'
              ? `Saved preview data could not be read. The original value is preserved. ${status.message}`
              : status.kind === 'unsupported'
                ? `Saved preview data uses an unsupported version. The original value is preserved. ${status.message}`
                : 'This preview changed in another tab. Reload it or explicitly replace it after downloading a backup.';

  return (
    <section className="preview-data-controls card" aria-label="Preview data and backups" hidden={hidden}>
      <div className="preview-data-controls__copy">
        <p className="preview-data-controls__notice" role={status.kind === 'saved' ? 'status' : 'alert'}>
          <strong>{statusMessage}</strong> This is separate from your live Tend account and does not sync across devices.
        </p>
        {status.kind === 'conflict' && (
          <p className="preview-data-controls__help">Another preview tab changed this storage key. No further writes will occur until you choose what to do.</p>
        )}
        {(status.kind === 'corrupt' || status.kind === 'unsupported') && (
          <p className="preview-data-controls__help">Automatic saving is disabled to protect the stored value. Download the raw recovery file before resetting if you need to inspect it.</p>
        )}
      </div>
      <div className="preview-data-controls__actions">
        <button type="button" className="btn mini ghost" onClick={exportCurrent} disabled={status.kind === 'loading'}>Export preview backup</button>
        {v1RecoveryCopy !== null && (
          <button
            type="button"
            className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v1-recovery.json',
              v1RecoveryCopy,
              'application/json'
            ) ?? 'Original v1 recovery backup downloaded.')}
          >
            Download original v1 recovery backup
          </button>
        )}
        {v2RecoveryCopy !== null && (
          <button
            type="button"
            className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v2-recovery.json',
              v2RecoveryCopy,
              'application/json'
            ) ?? 'Original v2 recovery backup downloaded.')}
          >
            Download original v2 recovery backup
          </button>
        )}
        {v3RecoveryCopy !== null && (
          <button
            type="button"
            className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v3-recovery.json',
              v3RecoveryCopy,
              'application/json'
            ) ?? 'Original v3 recovery backup downloaded.')}
          >
            Download original v3 recovery backup
          </button>
        )}
        {v4RecoveryCopy !== null && (
          <button
            type="button"
            className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v4-recovery.json',
              v4RecoveryCopy,
              'application/json'
            ) ?? 'Original v4 recovery backup downloaded.')}
          >
            Download original v4 recovery backup
          </button>
        )}
        {v5RecoveryCopy !== null && (
          <button
            type="button"
            className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v5-recovery.json',
              v5RecoveryCopy,
              'application/json'
            ) ?? 'Original v5 recovery backup downloaded.')}
          >
            Download original v5 recovery backup
          </button>
        )}
        {v6RecoveryCopy !== null && (
          <button
            type="button"
            className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v6-recovery.json',
              v6RecoveryCopy,
              'application/json'
            ) ?? 'Original v6 recovery backup downloaded.')}
          >
            Download original v6 recovery backup
          </button>
        )}
        {v7RecoveryCopy !== null && (
          <button
            type="button"
            className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v7-recovery.json',
              v7RecoveryCopy,
              'application/json'
            ) ?? 'Original v7 recovery backup downloaded.')}
          >
            Download original v7 recovery backup
          </button>
        )}
        {v8RecoveryCopy !== null && (
          <button
            type="button"
            className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v8-recovery.json',
              v8RecoveryCopy,
              'application/json'
            ) ?? 'Original v8 recovery backup downloaded.')}
          >
            Download original v8 recovery backup
          </button>
        )}
        {v9RecoveryCopy !== null && (
          <button
            type="button"
            className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v9-recovery.json',
              v9RecoveryCopy,
              'application/json'
            ) ?? 'Original v9 recovery backup downloaded.')}
          >
            Download original v9 recovery backup
          </button>
        )}
        {v10RecoveryCopy !== null && (
          <button
            type="button"
            className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v10-recovery.json',
              v10RecoveryCopy,
              'application/json'
            ) ?? 'Original v10 recovery backup downloaded.')}
          >
            Download original v10 recovery backup
          </button>
        )}
        {v11RecoveryCopy !== null && (
          <button
            type="button"
            className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v11-recovery.json',
              v11RecoveryCopy,
              'application/json'
            ) ?? 'Original v11 recovery backup downloaded.')}
          >
            Download original v11 recovery backup
          </button>
        )}
        {v12RecoveryCopy !== null && (
          <button
            type="button"
            className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v12-recovery.json',
              v12RecoveryCopy,
              'application/json'
            ) ?? 'Original v12 recovery backup downloaded.')}
          >
            Download original v12 recovery backup
          </button>
        )}
        {v13RecoveryCopy !== null && (
          <button
            type="button"
            className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v13-recovery.json',
              v13RecoveryCopy,
              'application/json'
            ) ?? 'Original v13 recovery backup downloaded.')}
          >
            Download original v13 recovery backup
          </button>
        )}
        {v14RecoveryCopy !== null && (
          <button
            type="button"
            className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v14-recovery.json',
              v14RecoveryCopy,
              'application/json'
            ) ?? 'Original v14 recovery backup downloaded.')}
          >
            Download original v14 recovery backup
          </button>
        )}
        {v15RecoveryCopy !== null && (
          <button
            type="button"
            className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v15-recovery.json',
              v15RecoveryCopy,
              'application/json'
            ) ?? 'Original v15 recovery backup downloaded.')}
          >
            Download original v15 recovery backup
          </button>
        )}
        {v16RecoveryCopy !== null && (
          <button
            type="button"
            className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v16-recovery.json',
              v16RecoveryCopy,
              'application/json'
            ) ?? 'Original v16 recovery backup downloaded.')}
          >
            Download original v16 recovery backup
          </button>
        )}
        {v17RecoveryCopy !== null && (
          <button type="button" className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v17-recovery.json',
              v17RecoveryCopy,
              'application/json'
            ) ?? 'Original v17 recovery backup downloaded.')}>
            Download original v17 recovery backup
          </button>
        )}
        {v18RecoveryCopy !== null && (
          <button type="button" className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v18-recovery.json',
              v18RecoveryCopy,
              'application/json'
            ) ?? 'Original v18 recovery backup downloaded.')}>
            Download original v18 recovery backup
          </button>
        )}
        {v19RecoveryCopy !== null && (
          <button type="button" className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v19-recovery.json',
              v19RecoveryCopy,
              'application/json'
            ) ?? 'Original v19 recovery backup downloaded.')}>
            Download original v19 recovery backup
          </button>
        )}
        {v20RecoveryCopy !== null && (
          <button type="button" className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v20-recovery.json',
              v20RecoveryCopy,
              'application/json'
            ) ?? 'Original v20 recovery backup downloaded.')}>
            Download original v20 recovery backup
          </button>
        )}
        {v21RecoveryCopy !== null && (
          <button type="button" className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v21-recovery.json',
              v21RecoveryCopy,
              'application/json'
            ) ?? 'Original v21 recovery backup downloaded.')}>
            Download original v21 recovery backup
          </button>
        )}
        {v22RecoveryCopy !== null && (
          <button type="button" className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v22-recovery.json',
              v22RecoveryCopy,
              'application/json'
            ) ?? 'Original v22 recovery backup downloaded.')}>
            Download original v22 recovery backup
          </button>
        )}
        {v23RecoveryCopy !== null && (
          <button type="button" className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v23-recovery.json',
              v23RecoveryCopy,
              'application/json'
            ) ?? 'Original v23 recovery backup downloaded.')}>
            Download original v23 recovery backup
          </button>
        )}
        {v25RecoveryCopy !== null && (
          <button type="button" className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v25-recovery.json',
              v25RecoveryCopy,
              'application/json'
            ) ?? 'Original v25 recovery backup downloaded.')}>
            Download original v25 recovery backup
          </button>
        )}
        {v26RecoveryCopy !== null && (
          <button type="button" className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v26-recovery.json',
              v26RecoveryCopy,
              'application/json'
            ) ?? 'Original v26 recovery backup downloaded.')}>
            Download original v26 recovery backup
          </button>
        )}
        {v27RecoveryCopy !== null && (
          <button type="button" className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v27-recovery.json',
              v27RecoveryCopy,
              'application/json'
            ) ?? 'Original v27 recovery backup downloaded.')}>
            Download original v27 recovery backup
          </button>
        )}
        {v28RecoveryCopy !== null && (
          <button type="button" className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v28-recovery.json',
              v28RecoveryCopy,
              'application/json'
            ) ?? 'Original v28 recovery backup downloaded.')}>
            Download original v28 recovery backup
          </button>
        )}
        {v29RecoveryCopy !== null && (
          <button type="button" className="btn mini ghost"
            onClick={() => setMessage(downloadText(
              'tend-synthetic-preview-original-v29-recovery.json',
              v29RecoveryCopy,
              'application/json'
            ) ?? 'Original v29 recovery backup downloaded.')}>
            Download original v29 recovery backup
          </button>
        )}
        <label className="btn mini ghost preview-data-controls__file-button">
          Import preview backup
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            aria-label="Import preview backup"
            onChange={readImport}
            disabled={status.kind === 'loading'}
          />
        </label>
        <button
          type="button"
          className="btn mini ghost"
          onClick={() => setPendingAction({ kind: 'reset' })}
          disabled={status.kind === 'loading'}
        >
          Reset sample data
        </button>
        {status.kind === 'error' && (
          <button type="button" className="btn mini ghost" onClick={onRetrySave}>Retry saving</button>
        )}
        {(status.kind === 'corrupt' || status.kind === 'unsupported') && (
          <>
            <button type="button" className="btn mini ghost" onClick={() => downloadRecovery(status.raw)}>Download raw recovery file</button>
          </>
        )}
        {status.kind === 'conflict' && (
          <>
            <button type="button" className="btn mini ghost" onClick={() => {
              const error = onReloadExternal();
              setMessage(error ?? 'Loaded the other tab’s preview data.');
            }}>Reload other tab’s preview</button>
            <button type="button" className="btn mini" onClick={() => setPendingAction({ kind: 'replace-external' })}>Replace other tab’s data</button>
          </>
        )}
      </div>
      {v1RecoveryError && <p className="preview-data-controls__help" role="alert">The original v1 recovery copy could not be read: {v1RecoveryError}</p>}
      {v2RecoveryError && <p className="preview-data-controls__help" role="alert">The original v2 recovery copy could not be read: {v2RecoveryError}</p>}
      {v3RecoveryError && <p className="preview-data-controls__help" role="alert">The original v3 recovery copy could not be read: {v3RecoveryError}</p>}
      {v4RecoveryError && <p className="preview-data-controls__help" role="alert">The original v4 recovery copy could not be read: {v4RecoveryError}</p>}
      {v5RecoveryError && <p className="preview-data-controls__help" role="alert">The original v5 recovery copy could not be read: {v5RecoveryError}</p>}
      {v6RecoveryError && <p className="preview-data-controls__help" role="alert">The original v6 recovery copy could not be read: {v6RecoveryError}</p>}
      {v7RecoveryError && <p className="preview-data-controls__help" role="alert">The original v7 recovery copy could not be read: {v7RecoveryError}</p>}
      {v8RecoveryError && <p className="preview-data-controls__help" role="alert">The original v8 recovery copy could not be read: {v8RecoveryError}</p>}
      {v9RecoveryError && <p className="preview-data-controls__help" role="alert">The original v9 recovery copy could not be read: {v9RecoveryError}</p>}
      {v10RecoveryError && <p className="preview-data-controls__help" role="alert">The original v10 recovery copy could not be read: {v10RecoveryError}</p>}
      {v11RecoveryError && <p className="preview-data-controls__help" role="alert">The original v11 recovery copy could not be read: {v11RecoveryError}</p>}
      {v12RecoveryError && <p className="preview-data-controls__help" role="alert">The original v12 recovery copy could not be read: {v12RecoveryError}</p>}
      {v13RecoveryError && <p className="preview-data-controls__help" role="alert">The original v13 recovery copy could not be read: {v13RecoveryError}</p>}
      {v14RecoveryError && <p className="preview-data-controls__help" role="alert">The original v14 recovery copy could not be read: {v14RecoveryError}</p>}
      {v15RecoveryError && <p className="preview-data-controls__help" role="alert">The original v15 recovery copy could not be read: {v15RecoveryError}</p>}
      {v16RecoveryError && <p className="preview-data-controls__help" role="alert">The original v16 recovery copy could not be read: {v16RecoveryError}</p>}
      {v17RecoveryError && <p className="preview-data-controls__help" role="alert">The original v17 recovery copy could not be read: {v17RecoveryError}</p>}
      {v18RecoveryError && <p className="preview-data-controls__help" role="alert">The original v18 recovery copy could not be read: {v18RecoveryError}</p>}
      {v19RecoveryError && <p className="preview-data-controls__help" role="alert">The original v19 recovery copy could not be read: {v19RecoveryError}</p>}
      {v20RecoveryError && <p className="preview-data-controls__help" role="alert">The original v20 recovery copy could not be read: {v20RecoveryError}</p>}
      {v21RecoveryError && <p className="preview-data-controls__help" role="alert">The original v21 recovery copy could not be read: {v21RecoveryError}</p>}
      {v22RecoveryError && <p className="preview-data-controls__help" role="alert">The original v22 recovery copy could not be read: {v22RecoveryError}</p>}
      {v23RecoveryError && <p className="preview-data-controls__help" role="alert">The original v23 recovery copy could not be read: {v23RecoveryError}</p>}
      {v25RecoveryError && <p className="preview-data-controls__help" role="alert">The original v25 recovery copy could not be read: {v25RecoveryError}</p>}
      {v26RecoveryError && <p className="preview-data-controls__help" role="alert">The original v26 recovery copy could not be read: {v26RecoveryError}</p>}
      {v27RecoveryError && <p className="preview-data-controls__help" role="alert">The original v27 recovery copy could not be read: {v27RecoveryError}</p>}
      {v28RecoveryError && <p className="preview-data-controls__help" role="alert">The original v28 recovery copy could not be read: {v28RecoveryError}</p>}
      {v29RecoveryError && <p className="preview-data-controls__help" role="alert">The original v29 recovery copy could not be read: {v29RecoveryError}</p>}
      {message && <p className="preview-data-controls__message" role="status">{message}</p>}
      {pendingAction && (
        <MoneyGoalDialog
          title={pendingAction.kind === 'import' ? 'Replace preview data?' : pendingAction.kind === 'reset' ? 'Reset sample data?' : 'Replace the other tab?'}
          intro={pendingAction.kind === 'import'
            ? pendingAction.hasArchiveStatus
              ? 'This replaces the current synthetic goals, check-ins, correction history, and Rhythm data with the validated backup.'
              : 'This backup predates archive status, so its Rhythms will be restored as active. It replaces the current preview; download a backup first if needed.'
            : pendingAction.kind === 'reset'
              ? 'This replaces the current synthetic preview state with the original examples, changing only this preview’s saved key.'
              : 'This overwrites the other tab’s saved preview with the data currently shown here.'}
          onClose={() => setPendingAction(null)}
        >
          <p className="preview-data-controls__help">Download a backup of the current preview before replacing it if you may need these changes later. Cancel leaves the current preview unchanged.</p>
          <div className="money-goal-dialog__actions">
            <button type="button" className="btn mini ghost" onClick={exportCurrent}>Download current preview backup</button>
            <button type="button" className="btn mini" onClick={confirmPendingAction}>
              {pendingAction.kind === 'import' ? 'Replace with backup' : pendingAction.kind === 'reset' ? 'Reset sample data' : 'Replace other tab'}
            </button>
            <button type="button" className="btn mini ghost" onClick={() => setPendingAction(null)}>Cancel</button>
          </div>
        </MoneyGoalDialog>
      )}
    </section>
  );
}
