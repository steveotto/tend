import { createEmptyPreviewData, createPreviewEnvelope, validatePreviewEnvelope } from './preview-state.ts';
import type { PreviewData } from './preview-state.ts';
import { isValidPersonPhotoDataUrl, isValidMonthDay } from './person-details.ts';
import type { PersonDetails } from './person-details.ts';
import { isValidPersonId } from './preview-data.ts';
import type { PersonId, PersonPickerGroupId } from './preview-data.ts';
import { readLegacy } from '../../../src/domain/legacy-reader.ts';

export type LegacyImportIssue = {
  path: string;
  count: number;
};

export type LegacyImportReport = {
  supported: {
    people: number;
    details: number;
    classifications: number;
  };
  unsupported: LegacyImportIssue[];
  ambiguous: LegacyImportIssue[];
  invalid: LegacyImportIssue[];
  remappedIds: number;
};

export type LegacyImportDryRun = {
  report: LegacyImportReport;
  candidate: PreviewData | null;
  recoveryPackage: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addIssue(issues: LegacyImportIssue[], path: string, count = 1): void {
  const existing = issues.find(issue => issue.path === path);
  if (existing) existing.count += count;
  else issues.push({ path, count });
}

function recordCount(value: unknown): number {
  return Array.isArray(value) ? value.length : value === undefined ? 0 : 1;
}

function deterministicId(sourceId: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of sourceId) {
    hash ^= BigInt(character.codePointAt(0)!);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `legacy-person-${hash.toString(16).padStart(16, '0')}`;
}

function sourceDate(value: unknown): { monthDay: string; year?: number } | null {
  if (typeof value !== 'string') return null;
  const full = /^(\d{4})-(\d{2}-\d{2})$/.exec(value);
  if (full) {
    const year = Number(full[1]);
    if (!Number.isInteger(year) || year < 1 || !isValidMonthDay(full[2]!)) return null;
    return { monthDay: full[2]!, year };
  }
  if (/^\d{2}-\d{2}$/.test(value) && isValidMonthDay(value)) return { monthDay: value };
  return null;
}

function groupForArea(value: unknown): PersonPickerGroupId | null {
  if (value === 'marriage' || value === 'parenting') return value;
  if (value === 'friendships') return 'friends';
  return null;
}

function createRecoveryPackage(originalText: string, report: LegacyImportReport, parseError?: string): string {
  return JSON.stringify({
    format: 'tend.legacy-import-recovery',
    schemaVersion: 1,
    sourceText: originalText,
    report,
    ...(parseError ? { parseError } : {})
  }, null, 2);
}

export function analyzeLegacyTendImport(originalText: string, currentDate: string): LegacyImportDryRun {
  const report: LegacyImportReport = {
    supported: { people: 0, details: 0, classifications: 0 },
    unsupported: [],
    ambiguous: [],
    invalid: [],
    remappedIds: 0
  };
  let document;
  try {
    document = readLegacy(originalText);
  } catch {
    addIssue(report.invalid, '/');
    return { report, candidate: null, recoveryPackage: createRecoveryPackage(originalText, report, 'Source is not valid legacy JSON.') };
  }

  const state = document.state;
  if (!Array.isArray(state.people)) {
    addIssue(report.invalid, '/people');
    return { report, candidate: null, recoveryPackage: createRecoveryPackage(originalText, report) };
  }

  const sourceRows: Record<string, unknown>[] = [];
  const sourceIds = new Set<string>();
  const reservedIds = new Set<string>();
  state.people.forEach((value, index) => {
    const path = `/people/${index}`;
    if (!isRecord(value)) {
      addIssue(report.invalid, path);
      return;
    }
    if (typeof value.id !== 'string' || value.id.trim().length === 0) {
      addIssue(report.invalid, `${path}/id`);
      return;
    }
    if (sourceIds.has(value.id)) {
      addIssue(report.ambiguous, `${path}/id`);
      return;
    }
    sourceIds.add(value.id);
    sourceRows.push(value);
    if (isValidPersonId(value.id)) reservedIds.add(value.id);
  });

  const candidate = createEmptyPreviewData();
  const details: PersonDetails[] = [];
  const groups = new Map<PersonPickerGroupId, PersonId[]>([
    ['marriage', []],
    ['parenting', []],
    ['friends', []]
  ]);
  const mappedIds = new Set<PersonId>();

  for (const [index, row] of sourceRows.entries()) {
    const sourceId = row.id as string;
    let id: PersonId = sourceId;
    if (!isValidPersonId(sourceId)) {
      id = deterministicId(sourceId);
      let suffix = 2;
      while (reservedIds.has(id) || mappedIds.has(id)) {
        id = `${deterministicId(sourceId)}-${suffix++}`;
      }
      report.remappedIds++;
    }
    if (typeof row.name !== 'string' || row.name.trim().length === 0 || row.name.length > 120) {
      addIssue(report.invalid, `/people/${index}/name`);
      continue;
    }
    mappedIds.add(id);
    candidate.people.push({ id, displayName: row.name });
    report.supported.people++;

    const detail: PersonDetails = { personId: id };
    let hasDetails = false;
    if (row.relation !== undefined) {
      if (typeof row.relation !== 'string' || (row.relation.length > 80)) {
        addIssue(report.invalid, `/people/${index}/relation`);
      } else if (row.relation.length > 0) {
        if (row.relation.trim().length === 0) {
          addIssue(report.invalid, `/people/${index}/relation`);
        } else {
          detail.relationshipLabel = row.relation;
          hasDetails = true;
        }
      }
    }
    for (const field of ['birthday', 'anniversary'] as const) {
      const sourceDateValue = row[field];
      if (sourceDateValue === undefined || sourceDateValue === '') continue;
      const parsed = sourceDate(sourceDateValue);
      if (!parsed) {
        addIssue(report.invalid, `/people/${index}/${field}`);
        continue;
      }
      detail[field] = parsed;
      hasDetails = true;
    }
    if (row.photo !== undefined && row.photo !== '') {
      if (typeof row.photo !== 'string' || !isValidPersonPhotoDataUrl(row.photo)) {
        addIssue(report.invalid, `/people/${index}/photo`);
      } else {
        detail.photoDataUrl = row.photo;
        hasDetails = true;
      }
    }
    if (hasDetails) {
      details.push(detail);
      report.supported.details++;
    }
    const group = groupForArea(row.area);
    if (group) {
      groups.get(group)!.push(id);
      report.supported.classifications++;
    } else if (row.area !== undefined && row.area !== '') {
      addIssue(report.unsupported, `/people/${index}/area`);
    }
    if (Array.isArray(row.rhythms) && row.rhythms.length > 0) {
      addIssue(report.unsupported, `/people/${index}/rhythms`, row.rhythms.length);
    }
    for (const key of Object.keys(row)) {
      if (!['id', 'name', 'relation', 'area', 'birthday', 'anniversary', 'photo', 'rhythms'].includes(key)) {
        addIssue(report.unsupported, `/people/${index}/${key}`);
      }
    }
  }

  const consumedRootKeys = new Set(['people', 'version', 'schemaVersion', 'databaseVersion']);
  for (const key of Object.keys(state)) {
    if (!consumedRootKeys.has(key)) addIssue(report.unsupported, `/${key}`, recordCount(state[key]));
  }

  candidate.personDetails = details;
  candidate.peopleGroups = candidate.peopleGroups.map(group => ({
    ...group,
    memberIds: groups.get(group.id) ?? []
  }));
  const validation = validatePreviewEnvelope(createPreviewEnvelope(candidate), currentDate);
  if (!validation.valid) addIssue(report.invalid, '/people');

  const candidateIsSafe = report.invalid.length === 0 && report.ambiguous.length === 0 && validation.valid;
  const recoveryPackage = createRecoveryPackage(originalText, report);
  return {
    report,
    candidate: candidateIsSafe ? candidate : null,
    recoveryPackage
  };
}
