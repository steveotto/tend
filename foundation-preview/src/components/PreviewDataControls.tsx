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
  | { kind: 'import'; data: PreviewData }
  | { kind: 'reset' }
  | { kind: 'replace-external' };

type PreviewDataControlsProps = {
  data: PreviewData;
  status: PreviewPersistenceStatus;
  currentDate: string;
  onImport: (data: PreviewData) => string | null;
  onReset: () => string | null;
  onRetrySave: () => void;
  onReloadExternal: () => string | null;
  onReplaceExternal: () => string | null;
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
  data,
  status,
  currentDate,
  onImport,
  onReset,
  onRetrySave,
  onReloadExternal,
  onReplaceExternal
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
      setPendingAction({ kind: 'import', data: result.envelope.data });
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
    <section className="preview-data-controls card" aria-label="Preview data and backups">
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
      {message && <p className="preview-data-controls__message" role="status">{message}</p>}
      {pendingAction && (
        <MoneyGoalDialog
          title={pendingAction.kind === 'import' ? 'Replace preview data?' : pendingAction.kind === 'reset' ? 'Reset sample data?' : 'Replace the other tab?'}
          intro={pendingAction.kind === 'import'
            ? 'This replaces the current synthetic goals, check-ins, correction history, and Today completions with the validated backup.'
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
