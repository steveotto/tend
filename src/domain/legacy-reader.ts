/** A read-only interpretation of JSON. Never invokes legacy normalization. */
export type Json = null | boolean | number | string | Json[] | JsonObject;
export type JsonObject = { [key: string]: Json };
export type Issue = {
  code: 'invalid-collection' | 'invalid-record' | 'missing-id' | 'duplicate-id' | 'unresolved-rhythm';
  path: string;
};
export type RecordView = { path: string; value: JsonObject };
export type RhythmView = RecordView & {
  source: 'faith' | 'person' | 'area' | 'fitness-legacy';
  ownerId: string | null;
};
export type LegacyDocument = {
  /** Exact original text, including formatting and otherwise lossy numeric spellings. */
  originalText: string;
  state: JsonObject;
  versions: { state: Json; database: Json };
  events: RecordView[];
  people: RecordView[];
  rhythms: RhythmView[];
  issues: Issue[];
  writable: false;
};

function object(value: Json | undefined): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function nonemptyId(value: Json | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Accept a raw state or an explicit Supabase row envelope; never guess the format. */
export function readLegacy(text: string, format: 'state' | 'supabase-row' = 'state'): LegacyDocument {
  const input: Json = JSON.parse(text);
  if (!object(input)) throw new Error('Expected a JSON object; source text must be retained.');
  const state = format === 'supabase-row' ? input.state : input;
  if (!object(state)) throw new Error('Expected an object-valued state in the selected format.');
  const issues: Issue[] = [];
  const prefix = format === 'supabase-row' ? '/state' : '';
  function records(parent: JsonObject, key: string, path: string): RecordView[] {
    const value = parent[key];
    if (value === undefined) return [];
    if (!Array.isArray(value)) {
      issues.push({ code: 'invalid-collection', path });
      return [];
    }
    const result: RecordView[] = [];
    value.forEach((item, index) => {
      const itemPath = `${path}/${index}`;
      if (!object(item)) issues.push({ code: 'invalid-record', path: itemPath });
      else {
        if (!nonemptyId(item.id)) issues.push({ code: 'missing-id', path: itemPath });
        result.push({ path: itemPath, value: item });
      }
    });
    return result;
  }
  const people = records(state, 'people', `${prefix}/people`);
  const events = records(state, 'events', `${prefix}/events`);
  const rhythms: RhythmView[] = [];
  function add(items: RecordView[], source: RhythmView['source'], ownerId: string | null): void {
    rhythms.push(...items.map(item => ({ ...item, source, ownerId })));
  }
  add(records(state, 'rhythms', `${prefix}/rhythms`), 'faith', null);
  add(records(state, 'areaRhythms', `${prefix}/areaRhythms`), 'area', null);
  people.forEach(person => add(
    records(person.value, 'rhythms', `${person.path}/rhythms`),
    'person', nonemptyId(person.value.id) ? person.value.id : null
  ));
  if (state.fitness !== undefined && !object(state.fitness)) {
    issues.push({ code: 'invalid-record', path: `${prefix}/fitness` });
  } else if (object(state.fitness)) {
    add(records(state.fitness, 'rhythms', `${prefix}/fitness/rhythms`), 'fitness-legacy', null);
  }
  for (const group of [people, events, rhythms]) {
    const seen = new Set<string>();
    group.forEach(item => {
      const id = item.value.id;
      if (!nonemptyId(id)) return;
      if (seen.has(id)) issues.push({ code: 'duplicate-id', path: item.path });
      seen.add(id);
    });
  }
  const rhythmIds = new Set(rhythms.map(item => item.value.id).filter(nonemptyId));
  events.forEach(event => {
    const id = event.value.rhythmId;
    if (nonemptyId(id) && !rhythmIds.has(id)) {
      issues.push({ code: 'unresolved-rhythm', path: `${event.path}/rhythmId` });
    }
  });
  return {
    originalText: text, state,
    versions: { state: state.version ?? null, database: format === 'supabase-row' ? input.schema_version ?? null : null },
    people, events, rhythms, issues, writable: false
  };
}

/** Source export is exact; parsed projections must never replace a source backup. */
export function exportOriginal(document: LegacyDocument): string {
  return document.originalText;
}
