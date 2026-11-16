import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  PreviewData,
  PreviewEnvelope,
  PreviewValidationDiagnostic
} from '../domain/preview-state.ts';
import {
  createValidatedPreviewAccountDocument,
  PreviewAccountBackupError,
  previewEnvelopesEqual,
  validatePreviewAccountBackup
} from '../storage/preview-account-backup.ts';
import type { PreviewAccountBackupApi } from '../storage/preview-account-backup.ts';
import {
  PREVIEW_CLOUD_RESTORE_RECOVERY_KEY,
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
    }
  | {
      kind: 'repair';
      workoutId: string;
      expectedAccountId: string;
      expectedLocalRaw: string;
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
  cloudRecoveryRaw?: string | null;
  cloudRecoveryError?: string | null;
  deviceRecoveryRaw?: string | null;
  deviceRecoveryError?: string | null;
  autoSyncEnabled?: boolean;
  enabled: boolean;
  syncBusy?: boolean;
  verifiedAccountStatus?: VerifiedAccountStatus | null;
  syncStatus: PreviewAccountSyncState;
  isIdentityCurrent: () => boolean;
  onRestore: (data: PreviewData, expectedLocalRaw: string | null) => string | null;
  onRepair: (data: PreviewData, expectedLocalRaw: string) => string | null;
  onRecoveryChanged: (raw: string | null) => void;
  onExclusiveChange?: (locked: boolean) => void;
  onOperationFinished?: () => void;
};

export type VerifiedAccountStatus =
  | { kind: 'empty' }
  | { kind: 'available'; revision: number; updatedAt: string | null };

export type PreviewAccountSyncState =
  | 'checking'
  | 'device'
  | 'pending'
  | 'saving'
  | 'account'
  | 'offline'
  | 'attention'
  | 'conflict';

type AccountBackupStatus =
  | { kind: 'not-checked' }
  | { kind: 'checking' }
  | VerifiedAccountStatus
  | { kind: 'unavailable'; message: string };

type MissingCompletionInspection = {
  workoutId: string;
  workoutName: string;
  date: string;
  matchingCompletionExists: boolean;
};

const repairWorkoutName = 'Lower Body';
const repairWorkoutDate = '2026-10-19';

function strengthWorkoutName(data: PreviewData, workout: PreviewData['strength']['workouts'][number]): string {
  const savedWorkout = data.strength.savedWorkouts.find(item => item.id === workout.savedWorkoutId);
  return workout.workoutName?.trim() || savedWorkout?.name || 'Unnamed workout';
}

function inspectSingleMissingCompletion(
  data: PreviewData,
  diagnostic: PreviewValidationDiagnostic | undefined
): MissingCompletionInspection | null {
  const counts = diagnostic?.strengthCompletionLinks;
  if (!counts || counts.invalid !== 1 || counts.missingCompletion !== 1
    || counts.incompleteLink !== 0 || counts.missingRhythm !== 0 || counts.nonHealthRhythm !== 0
    || counts.rhythmMismatch !== 0 || counts.dateMismatch !== 0
    || counts.repeatedCompletion !== 0 || counts.archivedRhythm !== 0) return null;

  const targets = data.strength.workouts.filter(workout =>
    Boolean(workout.rhythmId && workout.completionId)
    && !data.datedRhythmCompletions.some(completion => completion.id === workout.completionId)
  );
  if (targets.length !== 1) return null;
  const target = targets[0]!;
  return {
    workoutId: target.id,
    workoutName: strengthWorkoutName(data, target),
    date: target.date,
    matchingCompletionExists: data.datedRhythmCompletions.some(completion =>
      completion.rhythmId === target.rhythmId && completion.effectiveDate === target.date
    )
  };
}

function approvedRepairCandidate(
  data: PreviewData,
  diagnostic: PreviewValidationDiagnostic | undefined
): MissingCompletionInspection | null {
  const inspection = inspectSingleMissingCompletion(data, diagnostic);
  if (!inspection || inspection.workoutName !== repairWorkoutName
    || inspection.date !== repairWorkoutDate || inspection.matchingCompletionExists) return null;
  const namedWorkouts = data.strength.workouts.filter(workout =>
    workout.date === repairWorkoutDate && strengthWorkoutName(data, workout) === repairWorkoutName
  );
  if (namedWorkouts.length !== 1 || namedWorkouts[0]?.id !== inspection.workoutId) return null;
  const target = namedWorkouts[0];
  if (!target.rhythmId || target.rhythmOccurrence !== repairWorkoutDate
    || !target.completionId
    || data.datedRhythmCompletions.some(completion => completion.id === target.completionId)) return null;
  return inspection;
}

function currentApprovedRepairCandidate(
  data: PreviewData,
  currentDate: string
): MissingCompletionInspection | null {
  try {
    createValidatedPreviewAccountDocument(data, currentDate);
    return null;
  } catch (validationError) {
    if (!(validationError instanceof PreviewAccountBackupError)
      || validationError.diagnostic?.code !== 'preview.strength.completion-link.invalid') return null;
    return approvedRepairCandidate(data, validationError.diagnostic);
  }
}

function removeApprovedWorkoutAssociation(data: PreviewData, workoutId: string): PreviewData | null {
  const matches = data.strength.workouts.filter(workout => workout.id === workoutId);
  if (matches.length !== 1) return null;
  return {
    ...data,
    strength: {
      ...data.strength,
      workouts: data.strength.workouts.map(workout => {
        if (workout.id !== workoutId) return workout;
        const {
          rhythmId,
          rhythmOccurrence,
          completionId,
          ...preservedWorkout
        } = workout;
        void rhythmId;
        void rhythmOccurrence;
        void completionId;
        return preservedWorkout;
      })
    }
  };
}

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

function downloadRecovery(
  raw: string,
  filename = 'tend-preview-before-account-restore.json'
): string | null {
  try {
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
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

type RecoveryActionRowProps = {
  title: string;
  description: string;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
};

function RecoveryActionRow({
  title,
  description,
  disabled = false,
  busy = false,
  onClick
}: RecoveryActionRowProps) {
  return (
    <button
      type="button"
      className="preview-account-backup__row"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="preview-account-backup__row-copy">
        <span className="preview-account-backup__row-title">{title}</span>
        <span className="preview-account-backup__row-description">{description}</span>
      </span>
      <span className="preview-account-backup__row-action" aria-hidden="true">
        {busy ? 'Working…' : '›'}
      </span>
    </button>
  );
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
  cloudRecoveryRaw = null,
  cloudRecoveryError = null,
  deviceRecoveryRaw = null,
  deviceRecoveryError = null,
  autoSyncEnabled = true,
  enabled,
  syncBusy = false,
  verifiedAccountStatus = null,
  syncStatus,
  isIdentityCurrent,
  onRestore,
  onRepair,
  onRecoveryChanged,
  onExclusiveChange,
  onOperationFinished
}: PreviewAccountBackupControlsProps) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeOperation, setActiveOperation] =
    useState<'backup' | 'restore' | 'download' | 'repair' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [missingCompletionInspection, setMissingCompletionInspection] =
    useState<MissingCompletionInspection | null>(null);
  const [repairSyncOutcome, setRepairSyncOutcome] =
    useState<'waiting' | 'confirmed' | 'offline' | 'attention' | 'conflict' | null>(null);
  const [repairSyncPending, setRepairSyncPending] = useState(false);
  const [backupStatus, setBackupStatus] = useState<AccountBackupStatus>(
    api === null
      ? { kind: 'unavailable', message: 'Account backup is unavailable in this Preview session.' }
      : autoSyncEnabled
        ? { kind: 'checking' }
        : { kind: 'not-checked' }
  );
  const operationInProgress = useRef(false);
  const statusRequestId = useRef(0);
  const identityCurrentRef = useRef(isIdentityCurrent);
  const exclusiveHeld = useRef(false);
  const repairSyncBaseline = useRef<PreviewAccountSyncState | null>(null);
  const repairSyncObservedActivity = useRef(false);
  identityCurrentRef.current = isIdentityCurrent;
  const exclusiveChangeRef = useRef(onExclusiveChange);
  exclusiveChangeRef.current = onExclusiveChange;

  function setExclusiveLocked(locked: boolean) {
    if (exclusiveHeld.current === locked) return;
    exclusiveHeld.current = locked;
    exclusiveChangeRef.current?.(locked);
  }

  useEffect(() => {
    if (!repairSyncPending) return;
    if (syncStatus === 'checking' || syncStatus === 'pending' || syncStatus === 'saving') {
      repairSyncObservedActivity.current = true;
      return;
    }
    if (syncStatus === 'offline') {
      if (repairSyncOutcome !== 'offline') setRepairSyncOutcome('offline');
      return;
    }
    if (!repairSyncObservedActivity.current && syncStatus === repairSyncBaseline.current) return;
    if (syncStatus === 'account') {
      setRepairSyncOutcome('confirmed');
      setRepairSyncPending(false);
    } else if (syncStatus === 'conflict') {
      setRepairSyncOutcome('conflict');
      setRepairSyncPending(false);
    } else if (syncStatus === 'attention') {
      setRepairSyncOutcome('attention');
      setRepairSyncPending(false);
    }
  }, [repairSyncOutcome, repairSyncPending, syncStatus]);

  function checkDeviceData() {
    setMessage('');
    setError('');
    setMissingCompletionInspection(null);
    setRepairSyncOutcome(null);
    setRepairSyncPending(false);
    try {
      createValidatedPreviewAccountDocument(data, currentDate);
      setMessage('This device’s data passed backup validation. No storage or account data was changed.');
    } catch (validationError) {
      if (validationError instanceof PreviewAccountBackupError
        && validationError.diagnostic?.code === 'preview.strength.completion-link.invalid') {
        setMissingCompletionInspection(inspectSingleMissingCompletion(data, validationError.diagnostic));
      }
      setError(validationError instanceof PreviewAccountBackupError
        ? validationError.message
        : 'This device’s data could not be validated. No storage or account data was changed.');
    }
  }

  function beginRepair() {
    setMessage('');
    setError('');
    if (!enabled || syncBusy || !autoSyncEnabled || !api || busy
      || operationInProgress.current || !isIdentityCurrent() || !accountId.trim() || localRaw === null) {
      setError('Repair is unavailable until this signed-in account and its saved device copy are ready.');
      return;
    }
    if (syncStatus === 'conflict') {
      setError('The device and account copies are in conflict. Resolve that conflict before repairing this workout.');
      return;
    }
    try {
      if (storage.getItem(PREVIEW_STORAGE_KEY) !== localRaw) {
        setMissingCompletionInspection(null);
        setError('The saved device data changed. Run Check data again; no repair was made.');
        return;
      }
    } catch (storageError) {
      setError(`The saved device data could not be checked. No repair was made. ${errorMessage(storageError)}`);
      return;
    }
    const candidate = currentApprovedRepairCandidate(data, currentDate);
    if (!candidate || candidate.workoutId !== missingCompletionInspection?.workoutId) {
      setMissingCompletionInspection(null);
      setError('The approved workout no longer matches the diagnostic. Run Check data again; no repair was made.');
      return;
    }
    setExclusiveLocked(true);
    statusRequestId.current += 1;
    setPending({
      kind: 'repair',
      workoutId: candidate.workoutId,
      expectedAccountId: accountId,
      expectedLocalRaw: localRaw
    });
  }

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
    if (!autoSyncEnabled) {
      statusRequestId.current += 1;
      setBackupStatus(api === null
        ? { kind: 'unavailable', message: 'Account backup is unavailable in this Preview session.' }
        : { kind: 'not-checked' });
      return () => {
        statusRequestId.current += 1;
        if (exclusiveHeld.current) {
          exclusiveHeld.current = false;
          exclusiveChangeRef.current?.(false);
        }
      };
    }
    void refreshBackupStatus();
    return () => {
      statusRequestId.current += 1;
      if (exclusiveHeld.current) {
        exclusiveHeld.current = false;
        exclusiveChangeRef.current?.(false);
      }
    };
  }, [refreshBackupStatus, autoSyncEnabled, api]);

  useEffect(() => {
    if (verifiedAccountStatus === null) return;
    statusRequestId.current += 1;
    setBackupStatus(verifiedAccountStatus);
  }, [verifiedAccountStatus]);

  async function beginBackup() {
    if (!enabled || syncBusy || !api || busy || operationInProgress.current || !isIdentityCurrent()) return;
    setExclusiveLocked(true);
    operationInProgress.current = true;
    statusRequestId.current += 1;
    setBusy(true);
    setActiveOperation('backup');
    setMessage('');
    setError('');
    let keepLockedForConfirmation = false;
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
        await api.save(document, 0);
        if (!isIdentityCurrent()) return;
        setMessage('This device’s data was saved to your account.');
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
        setMessage('Your account copy already matches this device.');
        return;
      }
      setPending({
        kind: 'backup',
        document,
        expectedRevision: cloud.revision,
        expectedLocalRaw: localRaw
      });
      keepLockedForConfirmation = true;
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
      setActiveOperation(null);
      if (!keepLockedForConfirmation) {
        setExclusiveLocked(false);
        onOperationFinished?.();
      }
    }
  }

  async function beginRestore() {
    if (!enabled || syncBusy || !api || busy || operationInProgress.current || !isIdentityCurrent()) return;
    setExclusiveLocked(true);
    operationInProgress.current = true;
    statusRequestId.current += 1;
    setBusy(true);
    setActiveOperation('restore');
    setMessage('');
    setError('');
    let keepLockedForConfirmation = false;
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
        setMessage('This device already matches the account copy.');
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
      keepLockedForConfirmation = true;
    } catch (requestError) {
      if (isIdentityCurrent()) {
        setBackupStatus({ kind: 'unavailable', message: errorMessage(requestError) });
      }
      setError(errorMessage(requestError));
    } finally {
      operationInProgress.current = false;
      setBusy(false);
      setActiveOperation(null);
      if (!keepLockedForConfirmation) {
        setExclusiveLocked(false);
        onOperationFinished?.();
      }
    }
  }

  async function downloadAccountBackup() {
    if (!enabled || syncBusy || !api || busy || operationInProgress.current || !isIdentityCurrent()) return;
    setExclusiveLocked(true);
    operationInProgress.current = true;
    statusRequestId.current += 1;
    setBusy(true);
    setActiveOperation('download');
    setMessage('');
    setError('');
    try {
      const record = await api.read();
      if (!isIdentityCurrent()) return;
      if (!record) {
        setBackupStatus({ kind: 'empty' });
        setMessage('No account backup was found. No data was changed.');
        return;
      }
      const validated = validatePreviewAccountBackup(record, currentDate);
      setBackupStatus({
        kind: 'available',
        revision: record.revision,
        updatedAt: record.updatedAt
      });
      const downloadError = downloadRecovery(JSON.stringify(validated.envelope, null, 2));
      if (downloadError) throw new Error(downloadError);
      setMessage('The account copy was downloaded. No account data was changed.');
    } catch (requestError) {
      if (isIdentityCurrent()) {
        setBackupStatus({ kind: 'unavailable', message: errorMessage(requestError) });
      }
      setError(errorMessage(requestError));
    } finally {
      operationInProgress.current = false;
      setBusy(false);
      setActiveOperation(null);
      setExclusiveLocked(false);
      onOperationFinished?.();
    }
  }

  async function confirmPending() {
    if (!pending) return;
    if (!isIdentityCurrent()) {
      if (pending.kind === 'repair') {
        setPending(null);
        setError('The signed-in account changed after confirmation. No repair was made.');
        setExclusiveLocked(false);
        onOperationFinished?.();
      }
      return;
    }
    if (syncBusy || !api || busy || operationInProgress.current) return;
    operationInProgress.current = true;
    statusRequestId.current += 1;
    setBusy(true);
    setActiveOperation(pending.kind);
    setMessage('');
    setError('');
    try {
      if (pending.kind === 'repair') {
        if (!autoSyncEnabled || syncStatus === 'conflict'
          || pending.expectedAccountId !== accountId
          || pending.expectedLocalRaw !== localRaw
          || storage.getItem(PREVIEW_STORAGE_KEY) !== pending.expectedLocalRaw) {
          setPending(null);
          setError('The signed-in account or saved device data changed after confirmation. No repair was made.');
          return;
        }
        const candidate = currentApprovedRepairCandidate(data, currentDate);
        if (!candidate || candidate.workoutId !== pending.workoutId) {
          setPending(null);
          setMissingCompletionInspection(null);
          setError('The approved workout no longer matches the diagnostic. No repair was made.');
          return;
        }
        const recovery = preservePreviewBeforeCloudRestore(storage, pending.expectedLocalRaw);
        if (recovery.kind !== 'preserved'
          || storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY) !== pending.expectedLocalRaw) {
          setPending(null);
          setError(recovery.kind === 'preserved'
            ? 'The exact recovery copy could not be verified. No repair was made.'
            : recovery.kind === 'conflict' || recovery.kind === 'error'
              ? recovery.message
              : 'No recovery copy was created. No repair was made.');
          return;
        }
        if (!isIdentityCurrent() || pending.expectedAccountId !== accountId
          || storage.getItem(PREVIEW_STORAGE_KEY) !== pending.expectedLocalRaw
          || pending.expectedLocalRaw !== localRaw) {
          setPending(null);
          setError('The account or saved device data changed while preserving recovery. No repair was made.');
          return;
        }
        const repairedData = removeApprovedWorkoutAssociation(data, candidate.workoutId);
        if (!repairedData) {
          setPending(null);
          setError('The approved workout is no longer unique. No repair was made.');
          return;
        }
        createValidatedPreviewAccountDocument(repairedData, currentDate);
        if (storage.getItem(PREVIEW_STORAGE_KEY) !== pending.expectedLocalRaw
          || pending.expectedLocalRaw !== localRaw
          || !isIdentityCurrent()
          || pending.expectedAccountId !== accountId) {
          setPending(null);
          setError('The account or saved device data changed before saving. No repair was made.');
          return;
        }
        repairSyncBaseline.current = syncStatus;
        repairSyncObservedActivity.current = syncStatus === 'offline';
        const writeError = onRepair(repairedData, pending.expectedLocalRaw);
        if (writeError) {
          repairSyncBaseline.current = null;
          setPending(null);
          setError(writeError);
          return;
        }
        onRecoveryChanged(pending.expectedLocalRaw);
        setPending(null);
        setMissingCompletionInspection(null);
        setRepairSyncOutcome(syncStatus === 'offline' ? 'offline' : 'waiting');
        setRepairSyncPending(true);
        setMessage('Local save: confirmed.');
        return;
      }

      if (pending.kind === 'backup') {
        if (storage.getItem(PREVIEW_STORAGE_KEY) !== pending.expectedLocalRaw
          || pending.expectedLocalRaw !== localRaw) {
          setPending(null);
          setError('This browser’s preview changed after confirmation. No account data was replaced; back up again to review the latest copy.');
          return;
        }
        await api.save(pending.document, pending.expectedRevision);
        if (!isIdentityCurrent()) return;
        setPending(null);
        setMessage('The account copy was updated.');
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
      setMessage('The account copy replaced this device’s data. The previous device copy is available as a recovery copy.');
    } catch (requestError) {
      setPending(null);
      if (isIdentityCurrent()) {
        setBackupStatus({ kind: 'unavailable', message: errorMessage(requestError) });
      }
      setError(errorMessage(requestError));
    } finally {
      operationInProgress.current = false;
      setBusy(false);
      setActiveOperation(null);
      setExclusiveLocked(false);
      onOperationFinished?.();
    }
  }

  function cancelPending() {
    if (busy) return;
    setPending(null);
    setExclusiveLocked(false);
    onOperationFinished?.();
  }

  const pendingBackup = pending?.kind === 'backup';
  const pendingRestore = pending?.kind === 'restore';
  const pendingRepair = pending?.kind === 'repair';
  const repairCandidate = missingCompletionInspection
    ? currentApprovedRepairCandidate(data, currentDate)
    : null;
  const accountActionDisabled = !enabled || syncBusy || !api || busy;
  const repairActionDisabled = accountActionDisabled || !autoSyncEnabled || syncStatus === 'conflict'
    || !accountId.trim();

  return (
    <>
      <button
        type="button"
        className="preview-account-backup__entry"
        onClick={() => setAdvancedOpen(true)}
      >
        <span className="preview-account-backup__row-copy">
          <span className="preview-account-backup__row-title">Account recovery</span>
          <span className="preview-account-backup__row-description">Manual account backup and restore.</span>
        </span>
        <span className="preview-account-backup__row-action" aria-hidden="true">›</span>
      </button>
      {advancedOpen && (
        <MoneyGoalDialog
          title="Account recovery"
          titleId="preview-account-backup-dialog-title"
          labelledBy="preview-account-backup-dialog-title"
          intro="Account-copy tools for this signed-in account. Replacing a copy is not a merge."
          phoneFullScreen
          dialogClassName="preview-account-backup-dialog"
          onClose={() => {
            if (pending && !busy) cancelPending();
            setAdvancedOpen(false);
          }}
        >
          <div className="preview-account-backup__dialog-content">
            {!autoSyncEnabled && (
              <p className="preview-account-backup__note">
                Cross-device sync is off. These account actions run only when you choose them.
              </p>
            )}
            {!api && (
              <p className="preview-account-backup__error" role="alert">
                Account recovery is not configured in this Preview.
              </p>
            )}
            <div className="preview-account-backup__rows">
              <RecoveryActionRow
                title="Check data"
                description="Validate this device’s saved copy only. No account access or changes."
                disabled={busy}
                onClick={checkDeviceData}
              />
              {repairCandidate
                && repairCandidate.workoutId === missingCompletionInspection?.workoutId
                && (
                  <RecoveryActionRow
                    title="Repair this workout’s broken Rhythm link"
                    description="Keep the workout and remove only its broken Rhythm association."
                    disabled={repairActionDisabled}
                    onClick={beginRepair}
                  />
                )}
              <RecoveryActionRow
                title="Save this device’s copy to account"
                description="Copy the data saved on this device to your account."
                disabled={accountActionDisabled}
                busy={activeOperation === 'backup'}
                onClick={() => void beginBackup()}
              />
              <RecoveryActionRow
                title="Replace this device’s data with account copy"
                description="Replace local data with the account copy. This is not a merge."
                disabled={accountActionDisabled}
                busy={activeOperation === 'restore'}
                onClick={() => void beginRestore()}
              />
              <RecoveryActionRow
                title="Download account copy"
                description="Download the current data stored in your account."
                disabled={accountActionDisabled}
                busy={activeOperation === 'download'}
                onClick={() => void downloadAccountBackup()}
              />
            </div>
            {!enabled && (
              <p className="preview-account-backup__note">
                Wait until this device’s changes are saved before using account recovery.
              </p>
            )}
            {(localRecoveryRaw !== null || cloudRecoveryRaw !== null || deviceRecoveryRaw !== null) && (
              <div className="preview-account-backup__rows preview-account-backup__recovery-files">
                {localRecoveryRaw !== null && (
                  <RecoveryActionRow
                    title="Download pre-restore copy"
                    description="Download the device data preserved before its last account restore."
                    onClick={() => setMessage(
                      downloadRecovery(localRecoveryRaw)
                        ?? 'The pre-restore device copy was downloaded.'
                    )}
                  />
                )}
                {cloudRecoveryRaw !== null && (
                  <RecoveryActionRow
                    title="Download previous account copy"
                    description="Download the account data preserved before replacing it."
                    onClick={() => setMessage(
                      downloadRecovery(cloudRecoveryRaw, 'tend-preview-before-account-sync.json')
                        ?? 'The previous account copy was downloaded.'
                    )}
                  />
                )}
                {deviceRecoveryRaw !== null && (
                  <RecoveryActionRow
                    title="Download previous device copy"
                    description="Download the device data preserved before restoring the account copy."
                    onClick={() => setMessage(
                      downloadRecovery(deviceRecoveryRaw, 'tend-preview-before-device-restore.json')
                        ?? 'The previous device copy was downloaded.'
                    )}
                  />
                )}
              </div>
            )}
            {(localRecoveryError || cloudRecoveryError || deviceRecoveryError) && (
              <p className="preview-account-backup__error" role="alert">
                {localRecoveryError || cloudRecoveryError || deviceRecoveryError}
              </p>
            )}
            {message && <p className="preview-account-backup__message" role="status">{message}</p>}
            {repairSyncOutcome && (
              <p className="preview-account-backup__status" role="status">
                Account sync: {repairSyncOutcome === 'waiting' && 'waiting for confirmation.'}
                {repairSyncOutcome === 'confirmed' && 'confirmed.'}
                {repairSyncOutcome === 'offline' && 'not confirmed; the device is offline. Sync will retry when available.'}
                {repairSyncOutcome === 'attention' && 'not confirmed; account sync needs attention.'}
                {repairSyncOutcome === 'conflict' && 'not confirmed; the account and device copies conflict.'}
              </p>
            )}
            {error && <p className="preview-account-backup__error" role="alert">{error}</p>}
            {missingCompletionInspection && (
              <p className="preview-account-backup__status" role="status">
                Workout: {missingCompletionInspection.workoutName}. Date: {missingCompletionInspection.date}.
                {' '}Matching completion for the same Rhythm/date:{' '}
                {missingCompletionInspection.matchingCompletionExists ? 'yes' : 'no'}.
              </p>
            )}
            <details className="preview-account-backup__technical">
              <summary>Technical details</summary>
              <p
                className={backupStatus.kind === 'unavailable' ? 'preview-account-backup__error' : 'preview-account-backup__status'}
                role="status"
              >
                {backupStatus.kind === 'not-checked' && 'Account copy status has not been checked.'}
                {backupStatus.kind === 'checking' && 'Checking account copy…'}
                {backupStatus.kind === 'empty' && 'No account copy is available.'}
                {backupStatus.kind === 'available'
                  && `Last updated ${formatBackupDate(backupStatus.updatedAt)} · revision ${backupStatus.revision}.`}
                {backupStatus.kind === 'unavailable' && backupStatus.message}
              </p>
              <p>Account identity: {accountId.slice(-4)}.</p>
            </details>
          </div>
          {pendingBackup && (
            <MoneyGoalDialog
              title="Replace account copy?"
              titleId="preview-account-backup-confirm-title"
              labelledBy="preview-account-backup-confirm-title"
              intro="These copies differ. This replaces the account copy with this device’s saved data; this device will not change."
              onClose={cancelPending}
            >
              <div className="money-goal-dialog__actions">
                <button type="button" className="btn mini" disabled={busy || syncBusy} onClick={() => void confirmPending()}>
                  Replace account copy
                </button>
                <button type="button" className="btn mini ghost" disabled={busy} onClick={cancelPending}>
                  Cancel
                </button>
              </div>
            </MoneyGoalDialog>
          )}
          {pendingRestore && (
            <MoneyGoalDialog
              title="Replace this device’s data?"
              titleId="preview-account-backup-confirm-title"
              labelledBy="preview-account-backup-confirm-title"
              intro="This replaces local data with the account copy; it does not merge them. The current device data is preserved as a recovery copy before replacement."
              onClose={cancelPending}
            >
              <div className="money-goal-dialog__actions">
                <button type="button" className="btn mini" disabled={busy || syncBusy} onClick={() => void confirmPending()}>
                  Replace this device’s data
                </button>
                <button type="button" className="btn mini ghost" disabled={busy} onClick={cancelPending}>
                  Cancel
                </button>
              </div>
            </MoneyGoalDialog>
          )}
          {pendingRepair && (
            <MoneyGoalDialog
              title="Repair this workout’s Rhythm link?"
              titleId="preview-account-backup-confirm-title"
              labelledBy="preview-account-backup-confirm-title"
              intro={`The ${repairWorkoutName} workout from ${repairWorkoutDate} will stay intact in History. Only its broken Rhythm association (rhythmId, rhythmOccurrence, completionId) will be removed. The original saved data will be preserved byte-for-byte before writing, and normal sync may upload the repaired document to the signed-in account.`}
              onClose={cancelPending}
            >
              <div className="money-goal-dialog__actions">
                <button type="button" className="btn mini" disabled={busy || syncBusy} onClick={() => void confirmPending()}>
                  Repair this workout
                </button>
                <button type="button" className="btn mini ghost" disabled={busy} onClick={cancelPending}>
                  Cancel
                </button>
              </div>
            </MoneyGoalDialog>
          )}
        </MoneyGoalDialog>
      )}
    </>
  );
}
