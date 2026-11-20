import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'node:test';
import postcss from 'postcss';

const testsDirectory = import.meta.dirname;
const previewDirectory = path.resolve(testsDirectory, '..');
const artifactDirectory = path.resolve(
  process.env.TEND_PAGES_ARTIFACT_DIR ?? path.resolve(previewDirectory, 'dist')
);

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not reserve a Pages test port.');
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
  return address.port;
}

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
  it('bundles the Calendar Pages Function into its production route manifest', () => {
    const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'tend-pages-function-'));
    const workerDirectory = path.join(temporaryDirectory, 'worker');
    const routesPath = path.join(temporaryDirectory, '_routes.json');
    try {
      execFileSync(path.resolve(previewDirectory, 'node_modules/.bin/wrangler'), [
        'pages',
        'functions',
        'build',
        'functions',
        '--outdir',
        workerDirectory,
        '--output-routes-path',
        routesPath,
        '--project-directory',
        previewDirectory,
        '--build-output-directory',
        artifactDirectory,
        '--compatibility-date',
        '2026-11-14'
      ], { cwd: previewDirectory, stdio: 'pipe' });

      const routes = JSON.parse(readFileSync(routesPath, 'utf8')) as {
        include: string[];
        exclude: string[];
      };
      assert.deepEqual(routes.include, ['/api/calendar/read']);
      assert.deepEqual(routes.exclude, []);
      const workerPath = path.join(workerDirectory, 'index.js');
      assert.equal(statSync(workerPath).isFile(), true);
      const worker = readFileSync(workerPath, 'utf8');
      assert.match(worker, /Calendar request is invalid\./);
      assert.match(worker, /feed-parse-failed/);
      assert.match(worker, /icloud\.com/);
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it('routes /api/calendar/read through Wrangler Pages to the Function handler', async () => {
    const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'tend-pages-dev-'));
    const port = await availablePort();
    const server = spawn(path.resolve(previewDirectory, 'node_modules/.bin/wrangler'), [
      'pages',
      'dev',
      artifactDirectory,
      '--ip',
      '127.0.0.1',
      '--port',
      String(port),
      '--persist-to',
      path.join(temporaryDirectory, 'state'),
      '--no-show-interactive-dev-session',
      '--log-level',
      'error'
    ], { cwd: previewDirectory, stdio: 'ignore' });
    try {
      let response: Response | null = null;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        if (server.exitCode !== null) throw new Error(`Wrangler Pages dev exited with ${server.exitCode}.`);
        try {
          response = await fetch(`http://127.0.0.1:${port}/api/calendar/read`);
          break;
        } catch {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      assert.ok(response, 'Wrangler Pages dev should start and accept the API request.');
      assert.equal(response.status, 405);
      assert.equal(response.headers.get('allow'), 'POST');
      assert.match(response.headers.get('content-type') ?? '', /application\/json/);
    } finally {
      server.kill('SIGTERM');
      await new Promise<void>(resolve => {
        if (server.exitCode !== null) resolve();
        else server.once('exit', () => resolve());
      });
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it('bounds synthetic recurrence work through the Wrangler Pages runtime', async () => {
    const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'tend-pages-calendar-runtime-'));
    const functionDirectory = path.join(temporaryDirectory, 'functions', 'api', 'calendar');
    const port = await availablePort();
    const historyFeed = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:synthetic-old-daily',
      'DTSTART:18000101T090000Z',
      'DTEND:18000101T093000Z',
      'RRULE:FREQ=DAILY',
      'SUMMARY:Historical daily event',
      'END:VEVENT',
      'END:VCALENDAR',
      ''
    ].join('\r\n');
    const historyExceptionsFeed = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:synthetic-old-daily-with-exceptions',
      'DTSTART:20000101T090000Z',
      'DTEND:20000101T093000Z',
      'RRULE:FREQ=DAILY',
      'SUMMARY:Daily meeting',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:synthetic-old-daily-with-exceptions',
      'RECURRENCE-ID:20000102T090000Z',
      'DTSTART:20261114T110000Z',
      'DTEND:20261114T113000Z',
      'SUMMARY:Moved meeting',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:synthetic-old-daily-with-exceptions',
      'RECURRENCE-ID:20261115T090000Z',
      'STATUS:CANCELLED',
      'SUMMARY:Cancelled meeting',
      'END:VEVENT',
      'END:VCALENDAR',
      ''
    ].join('\r\n');
    const denseFeed = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:synthetic-secondly',
      'DTSTART:20261114T120000Z',
      'DTEND:20261114T120001Z',
      'RRULE:FREQ=SECONDLY',
      'SUMMARY:Sensitive synthetic summary',
      'END:VEVENT',
      'END:VCALENDAR',
      ''
    ].join('\r\n');
    const timeZoneFeed = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:synthetic-pages-new-york',
      'DTSTART;TZID=America/New_York:20261118T090000',
      'DTEND;TZID=America/New_York:20261118T093000',
      'SUMMARY:New York appointment',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:synthetic-pages-floating',
      'DTSTART:20261118T090000',
      'DTEND:20261118T093000',
      'SUMMARY:Floating appointment',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:synthetic-pages-utc',
      'DTSTART:20261118T140000Z',
      'DTEND:20261118T143000Z',
      'SUMMARY:UTC appointment',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:synthetic-pages-kolkata',
      'DTSTART;TZID=Asia/Kolkata:20261118T090000',
      'DTEND;TZID=Asia/Kolkata:20261118T093000',
      'SUMMARY:Kolkata appointment',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:synthetic-pages-all-day',
      'DTSTART;VALUE=DATE:20261118',
      'DTEND;VALUE=DATE:20261119',
      'SUMMARY:All-day appointment',
      'END:VEVENT',
      'END:VCALENDAR',
      ''
    ].join('\r\n');
    const dstFeed = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:synthetic-pages-dst-series',
      'DTSTART;TZID=America/New_York:20260307T090000',
      'DTEND;TZID=America/New_York:20260307T100000',
      'RRULE:FREQ=DAILY;COUNT=3',
      'SUMMARY:Daily check-in',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:synthetic-pages-dst-series',
      'RECURRENCE-ID;TZID=America/New_York:20260308T090000',
      'DTSTART;TZID=America/New_York:20260308T110000',
      'DTEND;TZID=America/New_York:20260308T120000',
      'SUMMARY:Moved check-in',
      'END:VEVENT',
      'END:VCALENDAR',
      ''
    ].join('\r\n');
    const newYorkTimeZone = [
      'BEGIN:VTIMEZONE',
      'TZID:America/New_York',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:-0500',
      'TZOFFSETTO:-0400',
      'TZNAME:EDT',
      'DTSTART:19700308T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:-0400',
      'TZOFFSETTO:-0500',
      'TZNAME:EST',
      'DTSTART:19701101T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
      'END:STANDARD',
      'END:VTIMEZONE'
    ].join('\r\n');
    const largeFeedEvents = [
      [
        'BEGIN:VEVENT',
        'UID:synthetic-large-daily',
        'DTSTART;TZID=America/New_York:20261113T090000',
        'DTEND;TZID=America/New_York:20261113T093000',
        'RRULE:FREQ=DAILY',
        'SUMMARY:Daily meeting',
        'END:VEVENT'
      ].join('\r\n'),
      [
        'BEGIN:VEVENT',
        'UID:synthetic-large-daily',
        'RECURRENCE-ID;TZID=America/New_York:20261114T090000',
        'DTSTART;TZID=America/New_York:20261114T110000',
        'DTEND;TZID=America/New_York:20261114T113000',
        'SUMMARY:Moved meeting',
        'END:VEVENT'
      ].join('\r\n'),
      [
        'BEGIN:VEVENT',
        'UID:synthetic-large-daily',
        'RECURRENCE-ID;TZID=America/New_York:20261115T090000',
        'STATUS:CANCELLED',
        'SUMMARY:Cancelled meeting',
        'END:VEVENT'
      ].join('\r\n'),
      [
        'BEGIN:VEVENT',
        'UID:synthetic-large-cancelled-master',
        'DTSTART;TZID=America/New_York:20261114T080000',
        'DTEND;TZID=America/New_York:20261114T083000',
        'RRULE:FREQ=DAILY',
        'STATUS:CANCELLED',
        'SUMMARY:Cancelled master',
        'END:VEVENT'
      ].join('\r\n'),
      [
        'BEGIN:VEVENT',
        'UID:synthetic-overlapping-all-day',
        'DTSTART;VALUE=DATE:20261113',
        'DTEND;VALUE=DATE:20261115',
        'SUMMARY:Overlapping all-day',
        'END:VEVENT'
      ].join('\r\n'),
      [
        'BEGIN:VEVENT',
        'UID:synthetic-overlapping-overnight',
        'DTSTART:20261114T043000Z',
        'DTEND:20261114T053000Z',
        'SUMMARY:Overlapping overnight',
        'END:VEVENT'
      ].join('\r\n'),
      [
        'BEGIN:VEVENT',
        'UID:synthetic-in-range-single',
        'DTSTART:20261114T170000Z',
        'DTEND:20261114T173000Z',
        'SUMMARY:In-range single',
        'END:VEVENT'
      ].join('\r\n'),
      ...Array.from({ length: 213 }, (_, index) => [
        'BEGIN:VEVENT',
        `UID:synthetic-old-recurring-${index}`,
        'DTSTART:20250101T090000Z',
        'DTEND:20250101T093000Z',
        'RRULE:FREQ=YEARLY;COUNT=1',
        `SUMMARY:Out-of-range recurrence ${index}`,
        'END:VEVENT'
      ].join('\r\n')),
      ...Array.from({ length: 3_937 }, (_, index) => [
        'BEGIN:VEVENT',
        `UID:synthetic-old-single-${index}`,
        'DTSTART:20250101T090000Z',
        'DTEND:20250101T093000Z',
        `SUMMARY:Out-of-range single ${index}`,
        'END:VEVENT'
      ].join('\r\n'))
    ];
    assert.equal(largeFeedEvents.length, 4_157);
    const manyEventFeed = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      newYorkTimeZone,
      ...largeFeedEvents,
      'END:VCALENDAR',
      ''
    ].join('\r\n');
    const readerPath = path.resolve(previewDirectory, 'src/domain/calendar-reader.ts');
    const functionSource = [
      `import { handleCalendarRead } from ${JSON.stringify(readerPath)};`,
      `const feeds = ${JSON.stringify({
        history: historyFeed,
        historyExceptions: historyExceptionsFeed,
        dense: denseFeed,
        timeZone: timeZoneFeed,
        dst: dstFeed,
        manyEvents: manyEventFeed
      })};`,
      'export async function onRequest({ request }: { request: Request }) {',
      '  return handleCalendarRead(request, {',
      '    fetchImpl: async (target) => {',
      '      const key = new URL(String(target)).pathname.split("/").at(-1);',
      '      return new Response(feeds[key], { status: 200, headers: { "content-type": "text/calendar" } });',
      '    }',
      '  });',
      '}'
    ].join('\n');
    mkdirSync(functionDirectory, { recursive: true });
    writeFileSync(path.join(functionDirectory, 'read.ts'), functionSource);

    const server = spawn(path.resolve(previewDirectory, 'node_modules/.bin/wrangler'), [
      'pages',
      'dev',
      artifactDirectory,
      '--ip',
      '127.0.0.1',
      '--port',
      String(port),
      '--persist-to',
      path.join(temporaryDirectory, 'state'),
      '--no-show-interactive-dev-session',
      '--log-level',
      'error'
    ], { cwd: temporaryDirectory, stdio: 'ignore' });
    try {
      const origin = `http://127.0.0.1:${port}`;
      let ready = false;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        if (server.exitCode !== null) throw new Error(`Wrangler Pages dev exited with ${server.exitCode}.`);
        try {
          await fetch(`${origin}/api/calendar/read`, { method: 'GET' });
          ready = true;
          break;
        } catch {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      assert.equal(ready, true, 'Wrangler Pages dev should start and accept requests.');

      const readFeed = (
        name: 'history' | 'historyExceptions' | 'dense' | 'timeZone' | 'dst' | 'manyEvents',
        timeZone = 'UTC',
        rangeStart = Date.parse('2026-11-14T00:00:00Z'),
        rangeEnd = rangeStart + 31 * 86_400_000
      ) => fetch(`${origin}/api/calendar/read`, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify({
          source: {
            id: 'calendar-source-fixture',
            name: 'Synthetic fixture',
            url: `webcal://p123-caldav.icloud.com/published/${name}`
          },
          now: rangeStart,
          rangeStart,
          rangeEnd,
          timeZone
        })
      });

      const historyResponse = await readFeed('history');
      const historyResult = await historyResponse.json() as {
        events: Array<{ startsAt: number }>;
        issueCount: number;
      };
      assert.equal(historyResponse.status, 200);
      assert.equal(historyResult.events.length, 31);
      assert.equal(historyResult.issueCount, 0);
      assert.equal(historyResult.events[0]?.startsAt, Date.parse('2026-11-14T09:00:00Z'));
      assert.equal(historyResult.events.at(-1)?.startsAt, Date.parse('2026-12-14T09:00:00Z'));

      const exceptionResponse = await readFeed('historyExceptions');
      const exceptionResult = await exceptionResponse.json() as {
        events: Array<{ startsAt: number }>;
        issueCount: number;
      };
      assert.equal(exceptionResponse.status, 200);
      assert.equal(exceptionResult.events.length, 31);
      assert.equal(exceptionResult.issueCount, 0);
      assert.ok(exceptionResult.events.some(event => event.startsAt === Date.parse('2026-11-14T11:00:00Z')));
      assert.ok(!exceptionResult.events.some(event => event.startsAt === Date.parse('2026-11-15T09:00:00Z')));

      const denseResponse = await readFeed('dense');
      const denseText = await denseResponse.text();
      assert.equal(denseResponse.status, 422);
      assert.match(denseText, /"code":"feed-expansion-limit"/);
      assert.doesNotMatch(denseText, /Sensitive synthetic summary/);

      const manyEventsResponse = await readFeed(
        'manyEvents',
        'America/New_York',
        Date.parse('2026-11-14T05:00:00Z')
      );
      const manyEventsResult = await manyEventsResponse.json() as {
        events: Array<{ title: string; startsAt: number; endsAt: number; allDay: boolean }>;
        issueCount: number;
      };
      assert.equal(manyEventsResponse.status, 200);
      assert.equal(manyEventsResult.events.length, 33);
      assert.equal(manyEventsResult.events.filter(event => event.title === 'Daily meeting').length, 29);
      assert.ok(manyEventsResult.events.some(event =>
        event.title === 'Moved meeting' && event.startsAt === Date.parse('2026-11-14T16:00:00Z')));
      assert.ok(!manyEventsResult.events.some(event =>
        event.title === 'Cancelled meeting' || event.title === 'Cancelled master'));
      assert.ok(manyEventsResult.events.some(event => event.title === 'Overlapping all-day' && event.allDay));
      assert.ok(manyEventsResult.events.some(event =>
        event.title === 'Overlapping overnight'
        && event.startsAt === Date.parse('2026-11-14T04:30:00Z')
        && event.endsAt === Date.parse('2026-11-14T05:30:00Z')));
      assert.ok(manyEventsResult.events.some(event => event.title === 'In-range single'));
      assert.ok(!manyEventsResult.events.some(event => event.title.startsWith('Out-of-range')));
      assert.equal(manyEventsResult.issueCount, 0);

      const timeZoneResponse = await readFeed(
        'timeZone',
        'America/Los_Angeles',
        Date.parse('2026-11-18T00:00:00Z'),
        Date.parse('2026-11-19T00:00:00Z')
      );
      const timeZoneResult = await timeZoneResponse.json() as {
        events: Array<{ title: string; startsAt: number }>;
        issueCount: number;
      };
      assert.equal(timeZoneResponse.status, 200);
      assert.equal(timeZoneResult.issueCount, 0);
      assert.deepEqual(
        Object.fromEntries(timeZoneResult.events.map(event => [event.title, event.startsAt])),
        {
          'All-day appointment': Date.parse('2026-11-18T08:00:00Z'),
          'Kolkata appointment': Date.parse('2026-11-18T03:30:00Z'),
          'New York appointment': Date.parse('2026-11-18T14:00:00Z'),
          'UTC appointment': Date.parse('2026-11-18T14:00:00Z'),
          'Floating appointment': Date.parse('2026-11-18T17:00:00Z')
        }
      );

      const dstResponse = await readFeed(
        'dst',
        'Asia/Kolkata',
        Date.parse('2026-03-07T00:00:00Z'),
        Date.parse('2026-03-10T00:00:00Z')
      );
      const dstResult = await dstResponse.json() as {
        events: Array<{ title: string; startsAt: number; endsAt: number }>;
        issueCount: number;
      };
      assert.equal(dstResponse.status, 200);
      assert.equal(dstResult.issueCount, 0);
      assert.deepEqual(
        dstResult.events.map(event => [event.title, event.startsAt, event.endsAt]),
        [
          ['Daily check-in', Date.parse('2026-03-07T14:00:00Z'), Date.parse('2026-03-07T15:00:00Z')],
          ['Moved check-in', Date.parse('2026-03-08T15:00:00Z'), Date.parse('2026-03-08T16:00:00Z')],
          ['Daily check-in', Date.parse('2026-03-09T13:00:00Z'), Date.parse('2026-03-09T14:00:00Z')]
        ]
      );
    } finally {
      server.kill('SIGTERM');
      await new Promise<void>(resolve => {
        if (server.exitCode !== null) resolve();
        else server.once('exit', () => resolve());
      });
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

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

  it('keeps React token assets separate from the Classic shell copy', () => {
    const reactTokens = readFileSync(path.resolve(artifactDirectory, 'brand/tend-tokens.css'), 'utf8');
    const classicTokens = readFileSync(path.resolve(artifactDirectory, 'classic/brand/tend-tokens.css'), 'utf8');

    assert.match(reactTokens, /--tend-tool-zone-background:\s*#EEF2F7/i);
    assert.doesNotMatch(classicTokens, /--tend-tool-zone-background/i);
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
