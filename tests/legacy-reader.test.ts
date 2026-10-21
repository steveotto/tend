import test from 'node:test';
import assert from 'node:assert/strict';
import { readLegacy, exportOriginal } from '../src/domain/legacy-reader.ts';

test('retains exact raw source, legacy goals, goal activity and unknown fields', () => {
  const text = '{\n "version":2,"goals":[{"id":"old"}],"events":[{"id":"e","goalId":"old"}],"unknown":{"future":1},"precise":9007199254740993\n}';
  const doc = readLegacy(text);
  assert.equal(exportOriginal(doc), text);
  assert.deepEqual(doc.state.goals, [{ id: 'old' }]);
  assert.equal(doc.events.length, 1);
  assert.deepEqual(doc.state.unknown, { future: 1 });
  assert.equal(doc.writable, false);
  // JS parsed numbers may lose precision; exact source is the archival contract.
  assert.equal(readLegacy(exportOriginal(doc)).originalText, text);
});

test('projects all four rhythm locations without merging identities or rewriting owners', () => {
  const text = JSON.stringify({
    rhythms: [{ id: 'f' }], areaRhythms: [{ id: 'a' }],
    people: [{ id: 'p', rhythms: [{ id: 'r' }] }], fitness: { rhythms: [{ id: 'x', extra: true }] }
  });
  const doc = readLegacy(text);
  assert.deepEqual(doc.rhythms.map(r => [r.source, r.ownerId, r.value.id]), [
    ['faith', null, 'f'], ['area', null, 'a'], ['person', 'p', 'r'], ['fitness-legacy', null, 'x']
  ]);
  assert.equal(exportOriginal(doc), text);
});

test('reports malformed collections and records without losing original material', () => {
  const text = '{"people":false,"events":[null,7,{"note":"preserve"}],"fitness":[]}';
  const doc = readLegacy(text);
  assert.deepEqual(doc.issues.map(i => i.code), [
    'invalid-collection', 'invalid-record', 'invalid-record', 'missing-id', 'invalid-record'
  ]);
  assert.equal(exportOriginal(doc), text);
  assert.equal(doc.events.length, 1);
});

test('retains duplicate records, repeated activity and missing definitions for review', () => {
  const doc = readLegacy(JSON.stringify({
    rhythms: [{ id: 'same' }], areaRhythms: [{ id: 'same' }],
    events: [{ id: 'e', rhythmId: 'gone' }, { id: 'e', rhythmId: 'same' },
      { id: 'e2', rhythmId: null }, { id: 'e3', rhythmId: '' }, { id: 'e4' }]
  }));
  assert.equal(doc.events.length, 5);
  assert.equal(doc.rhythms.length, 2);
  assert.equal(doc.issues.filter(i => i.code === 'duplicate-id').length, 2);
  assert.deepEqual(doc.issues.filter(i => i.code === 'unresolved-rhythm'), [
    { code: 'unresolved-rhythm', path: '/events/0/rhythmId' }
  ]);
});

test('row envelope and document versions stay distinct and explicit', () => {
  const text = '{"revision":238,"schema_version":1,"state":{"version":2,"state":{"custom":true},"people":[]}}';
  const doc = readLegacy(text, 'supabase-row');
  assert.deepEqual(doc.versions, { state: 2, database: 1 });
  assert.deepEqual(doc.state.state, { custom: true });
  assert.equal(exportOriginal(doc), text);
  assert.deepEqual(readLegacy(text).versions, { state: null, database: null });
});

test('rejects invalid top-level input without inventing an empty account', () => {
  for (const text of ['null', '[]', 'false', '{']) assert.throws(() => readLegacy(text));
  assert.throws(() => readLegacy('{"state":null}', 'supabase-row'));
});

test('prototype-shaped user fields remain inert preserved JSON', () => {
  const text = '{"__proto__":{"polluted":true},"constructor":{"x":1},"events":[]}';
  const doc = readLegacy(text);
  assert.equal(Object.prototype.hasOwnProperty.call(doc.state, '__proto__'), true);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.equal(exportOriginal(doc), text);
});
