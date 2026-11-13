import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'node:test';
import postcss from 'postcss';

const testsDirectory = import.meta.dirname;
const previewDirectory = path.resolve(testsDirectory, '..');
const artifactDirectory = path.resolve(previewDirectory, 'dist');

function artifactPath(reference: string): string | null {
  if (/^[a-z][a-z\d+.-]*:/i.test(reference)) return null;
  const cleanReference = reference.split(/[?#]/, 1)[0]!;
  return path.resolve(artifactDirectory, cleanReference.replace(/^\/+/, ''));
}

function stylesheetCustomProperties(css: string): { definitions: Set<string>; requiredReferences: Set<string> } {
  const definitions = new Set<string>();
  const requiredReferences = new Set<string>();
  const root = postcss.parse(css);

  root.walkDecls((declaration) => {
    if (declaration.prop.startsWith('--')) definitions.add(declaration.prop);
    for (const match of declaration.value.matchAll(/var\(\s*(--[\w-]+)(\s*,|\s*\))/g)) {
      if (match[2]!.includes(',')) continue;
      requiredReferences.add(match[1]!);
    }
  });

  return { definitions, requiredReferences };
}

describe('Pages production artifact', () => {
  it('serves the React production entry and all referenced assets at the root', () => {
    const sourceShell = readFileSync(path.resolve(previewDirectory, 'index.html'), 'utf8');
    const rootHtml = readFileSync(path.resolve(artifactDirectory, 'index.html'), 'utf8');
    assert.match(sourceShell, /<title>Tend<\/title>/);
    assert.doesNotMatch(sourceShell, /Today preview/);
    assert.match(rootHtml, /<title>Tend<\/title>/);
    assert.doesNotMatch(rootHtml, /Today preview|app-core\.js|tend-scoring\.js/);
    assert.match(rootHtml, /<div id="root"><\/div>/);
    assert.match(rootHtml, /<script type="module" crossorigin src="\/assets\/[^"]+\.js"><\/script>/);

    for (const match of rootHtml.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
      const localPath = artifactPath(match[1]!);
      if (localPath !== null) assert.equal(statSync(localPath).isFile(), true, `${match[1]} should be emitted`);
    }
    for (const match of rootHtml.matchAll(/<link\b[^>]*\bhref="([^"]+)"[^>]*>/g)) {
      const localPath = artifactPath(match[1]!);
      if (localPath !== null) assert.equal(statSync(localPath).isFile(), true, `${match[1]} should be emitted`);
    }
  });

  it('defines every production stylesheet custom property that has no fallback', () => {
    const rootHtml = readFileSync(path.resolve(artifactDirectory, 'index.html'), 'utf8');
    const definitions = new Set<string>();
    const requiredReferences = new Set<string>();

    for (const match of rootHtml.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)) {
      const localPath = artifactPath(match[1]!);
      if (localPath === null) continue;

      const stylesheet = readFileSync(localPath, 'utf8');
      const properties = stylesheetCustomProperties(stylesheet);
      properties.definitions.forEach((property) => definitions.add(property));
      properties.requiredReferences.forEach((property) => requiredReferences.add(property));
    }

    const undefinedProperties = [...requiredReferences].filter((property) => !definitions.has(property)).sort();
    assert.deepEqual(undefinedProperties, [], 'all referenced CSS custom properties should be defined');
  });

  it('keeps React Pages entries independent from the Classic stylesheet', () => {
    for (const entry of ['index.html', 'app-preview.html']) {
      const html = readFileSync(path.resolve(artifactDirectory, entry), 'utf8');
      assert.doesNotMatch(html, /(?:src|href)="[^"]*tend\.css(?:[?#][^"]*)?"/, `${entry} must not load tend.css`);
    }

    assert.equal(existsSync(path.resolve(artifactDirectory, 'tend.css')), false);
    assert.equal(statSync(path.resolve(artifactDirectory, 'classic/tend.css')).isFile(), true);
  });

  it('keeps the React Preview available at /app-preview.html', () => {
    const previewHtml = readFileSync(path.resolve(artifactDirectory, 'app-preview.html'), 'utf8');
    assert.match(previewHtml, /<div id="root"><\/div>/);
    assert.match(previewHtml, /<title>Tend · Today preview<\/title>/);
    assert.match(previewHtml, /<script type="module" crossorigin src="\/assets\/[^"]+\.js"><\/script>/);
    for (const match of previewHtml.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const localPath = artifactPath(match[1]!);
      if (localPath !== null) assert.equal(statSync(localPath).isFile(), true, `${match[1]} should be emitted`);
    }
  });

  it('serves the Classic fallback shell and its assets under /classic/', () => {
    const sourceShell = readFileSync(path.resolve(previewDirectory, '../index.html'), 'utf8');
    const classicDirectory = path.resolve(artifactDirectory, 'classic');
    const builtShell = readFileSync(path.resolve(classicDirectory, 'index.html'), 'utf8');
    const scoringTag = '<script src="tend-scoring.js"></script>';

    assert.equal((builtShell.match(/<script src="tend-scoring\.js"><\/script>/g) ?? []).length, 1);
    assert.equal(builtShell.replace(scoringTag, ''), sourceShell.replace(scoringTag, ''));
    assert.equal(statSync(classicDirectory).isDirectory(), true);
    for (const match of builtShell.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
      const localPath = /^[a-z][a-z\d+.-]*:/i.test(match[1]!)
        ? null
        : artifactPath(`/classic/${match[1]!}`);
      if (localPath !== null) assert.equal(statSync(localPath).isFile(), true, `${match[1]} should be emitted`);
    }
    for (const match of builtShell.matchAll(/<link\b[^>]*\bhref="([^"]+)"[^>]*>/g)) {
      const localPath = /^[a-z][a-z\d+.-]*:/i.test(match[1]!)
        ? null
        : artifactPath(`/classic/${match[1]!}`);
      if (localPath !== null) assert.equal(statSync(localPath).isFile(), true, `${match[1]} should be emitted`);
    }
    assert.equal(
      statSync(path.resolve(classicDirectory, 'tend-scoring.js')).isFile(),
      true,
      'Classic scoring bundle should be emitted at /classic/tend-scoring.js'
    );
  });

  it('exposes the shared scoring API from the Classic fallback browser script', () => {
    const window: { TendScoring?: Record<string, unknown> } = {};
    const scoringScript = readFileSync(path.resolve(artifactDirectory, 'classic/tend-scoring.js'), 'utf8');
    runInNewContext(scoringScript, { window });
    assert.equal(typeof window.TendScoring?.scoreRhythm, 'function');
    assert.equal(typeof window.TendScoring?.consistencyWindowForSchedule, 'function');
    assert.equal(typeof window.TendScoring?.blendScores, 'function');
    assert.equal(typeof window.TendScoring?.averageScores, 'function');
    assert.equal(window.TendScoring?.CONSISTENCY_WEIGHT, 0.75);
  });
});
