import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const previewDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteCli = path.resolve(previewDirectory, 'node_modules/vite/bin/vite.js');

async function run(command: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv }) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code ?? 'unknown'}`));
    });
  });
}

async function availablePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate a browser-test port.');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function waitForPreview(url: string, server: ReturnType<typeof spawn>): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Vite preview exited early with code ${server.exitCode}.`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await delay(250);
    }
  }
  throw new Error(`Vite preview did not become available at ${url}.`);
}

async function main() {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'tend-pages-css-'));
  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let previewServer: ReturnType<typeof spawn> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

  try {
    await run(process.execPath, [
      viteCli,
      'build',
      '--mode',
      'pages',
      '--outDir',
      outputDirectory,
      '--emptyOutDir'
    ], {
      cwd: previewDirectory,
      env: {
        ...process.env,
        VITE_PREVIEW_ACCESS_READY: 'true',
        VITE_TEND_SUPABASE_URL: 'https://synthetic-test.supabase.co',
        VITE_TEND_SUPABASE_PUBLISHABLE_KEY: 'synthetic-browser-test-key'
      }
    });

    previewServer = spawn(process.execPath, [
      viteCli,
      'preview',
      '--mode',
      'pages',
      '--outDir',
      outputDirectory,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort'
    ], { cwd: previewDirectory, stdio: 'inherit' });
    await waitForPreview(`${baseUrl}/app-preview.html`, previewServer);
    browser = await chromium.launch({ headless: true });

    for (const identity of ['signed-out', 'dashboard'] as const) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await context.addInitScript((initialIdentity: string) => {
        const session = initialIdentity === 'dashboard'
          ? { user: { id: 'c0000000-0000-4000-8000-000000000003' } }
          : null;
        Object.assign(window, {
          supabase: {
            createClient: () => ({
              auth: {
                onAuthStateChange(callback: (event: string, value: typeof session) => void) {
                  callback('INITIAL_SESSION', session);
                  return { data: { subscription: { unsubscribe() {} } } };
                },
                async signInWithPassword() { return { error: null, data: { session } }; },
                async resetPasswordForEmail() { return { error: null }; },
                async updateUser() { return { error: null }; },
                async signOut() { return { error: null }; }
              }
            })
          }
        });
      }, identity);

      const page = await context.newPage();
      const classicCssRequests: string[] = [];
      await page.route('**/tend.css', async route => {
        classicCssRequests.push(route.request().url());
        await route.abort();
      });
      await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.route('https://fonts.gstatic.com/**', route => route.abort());
      await page.goto(`${baseUrl}/app-preview.html?identity=${identity}`);

      if (identity === 'signed-out') {
        await page.getByRole('heading', { name: 'Sign in with Tend' }).waitFor();
        const styles = await page.evaluate(() => {
          const body = getComputedStyle(document.body);
          const heading = document.querySelector('.preview-login__card h1');
          const button = document.querySelector('.preview-login__form button');
          const classicLink = document.querySelector('.preview-login__classic a');
          if (!heading || !button || !classicLink) {
            throw new Error('Sign-in view is missing expected elements.');
          }
          return {
            bodyBackground: body.backgroundColor,
            bodyFontFamily: body.fontFamily,
            bodyLineHeight: body.lineHeight,
            headingLetterSpacing: getComputedStyle(heading).letterSpacing,
            buttonCursor: getComputedStyle(button).cursor,
            classicLinkColor: getComputedStyle(classicLink).color,
            classicLinkWeight: getComputedStyle(classicLink).fontWeight,
            classicLinkDecoration: getComputedStyle(classicLink).textDecorationLine,
            classicLinkUnderlineOffset: getComputedStyle(classicLink).textUnderlineOffset
          };
        });
        assert.equal(styles.bodyBackground, 'rgb(247, 249, 247)');
        assert.match(styles.bodyFontFamily, /Inter/);
        assert.notEqual(styles.bodyLineHeight, 'normal');
        assert.notEqual(styles.headingLetterSpacing, 'normal');
        assert.equal(styles.buttonCursor, 'pointer');
        assert.equal(styles.classicLinkColor, 'rgb(36, 107, 82)');
        assert.equal(styles.classicLinkWeight, '600');
        assert.equal(styles.classicLinkDecoration, 'underline');
        assert.equal(styles.classicLinkUnderlineOffset, '3px');
      } else {
        await page.locator('.home-dashboard').waitFor();
        await page.setViewportSize({ width: 375, height: 812 });
        const styles = await page.evaluate(() => {
          const wrap = document.querySelector<HTMLElement>('.wrap');
          const header = document.querySelector<HTMLElement>('.apphead');
          const search = document.querySelector<HTMLElement>('.utility-search');
          const card = document.querySelector<HTMLElement>('.overall-card');
          const section = document.querySelector<HTMLElement>('.today-prayer-section');
          const module = document.querySelector<HTMLElement>('.today-prayer-section .prayer-entry-module');
          if (!wrap || !header || !search || !card || !section || !module) {
            throw new Error('Dashboard view is missing expected shell or Prayer module elements.');
          }
          return {
            wrapMaxWidth: getComputedStyle(wrap).maxWidth,
            headerDisplay: getComputedStyle(header).display,
            searchMinWidth: getComputedStyle(search).minWidth,
            cardBackground: getComputedStyle(card).backgroundColor,
            sectionPadding: getComputedStyle(section).padding,
            moduleDisplay: getComputedStyle(module).display,
            moduleColumns: getComputedStyle(module).gridTemplateColumns,
            moduleWidth: module.getBoundingClientRect().width
          };
        });
        assert.equal(styles.wrapMaxWidth, '1100px');
        assert.equal(styles.headerDisplay, 'flex');
        assert.equal(styles.searchMinWidth, '180px');
        assert.notEqual(styles.cardBackground, 'rgba(0, 0, 0, 0)');
        assert.equal(styles.sectionPadding, '12px');
        assert.equal(styles.moduleDisplay, 'grid');
        assert.equal(styles.moduleColumns.trim().split(/\s+/).length, 1);
        assert.ok(styles.moduleWidth > 0);
      }

      assert.deepEqual(classicCssRequests, [], 'React pages must not request tend.css.');
      await context.close();
    }

    console.log('Browser CSS contract passed: sign-in and mobile dashboard render without tend.css.');
  } finally {
    await browser?.close();
    if (previewServer?.pid && previewServer.exitCode === null && previewServer.signalCode === null) {
      const stopped = new Promise<void>(resolve => previewServer?.once('exit', () => resolve()));
      previewServer.kill('SIGTERM');
      await stopped;
    }
    await rm(outputDirectory, { recursive: true, force: true });
  }
}

await main();
