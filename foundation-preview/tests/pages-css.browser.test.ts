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

        const mobileSizeToggle = page.locator('.mobile-display-toggle');
        const expectedSizes = [
          {
            size: 'small',
            toggleBackground: 'rgb(255, 255, 255)',
            toggleColor: 'rgb(32, 39, 35)',
            toggleFontSize: '16px',
            phoneFontSize: '13px',
            phoneAreaFontSize: '12px',
            desktopFontSize: '14px',
            pressed: false
          },
          {
            size: 'medium',
            toggleBackground: 'rgb(229, 242, 235)',
            toggleColor: 'rgb(36, 107, 82)',
            toggleFontSize: '18px',
            phoneFontSize: '14.625px',
            phoneAreaFontSize: '13.5px',
            desktopFontSize: '15.75px',
            pressed: true
          },
          {
            size: 'large',
            toggleBackground: 'rgb(36, 107, 82)',
            toggleColor: 'rgb(255, 255, 255)',
            toggleFontSize: '20px',
            phoneFontSize: '16.25px',
            phoneAreaFontSize: '15px',
            desktopFontSize: '17.5px',
            pressed: true
          }
        ] as const;

        for (const expected of expectedSizes) {
          await page.setViewportSize({ width: 375, height: 812 });
          await page.waitForTimeout(180);
          const phoneStyles = await page.evaluate(() => {
            const headerActions = document.querySelector<HTMLElement>('.mobile-head-actions');
            const mobileSearch = document.querySelector<HTMLButtonElement>('.mobile-head-button:not(.mobile-display-toggle)');
            const sizeToggle = document.querySelector<HTMLButtonElement>('.mobile-display-toggle');
            const brandTagline = document.querySelector<HTMLElement>('.brand-tagline');
            const currentTool = document.querySelector<HTMLButtonElement>('.utility-primary-button[aria-current="page"]');
            const areaShortcut = document.querySelector<HTMLButtonElement>('.areanav button');
            if (!headerActions || !mobileSearch || !sizeToggle || !brandTagline || !currentTool || !areaShortcut) {
              throw new Error('Dashboard is missing a shell navigation or mobile header control.');
            }
            const searchStyle = getComputedStyle(mobileSearch);
            const toggleStyle = getComputedStyle(sizeToggle);
            const toolStyle = getComputedStyle(currentTool);
            const areaStyle = getComputedStyle(areaShortcut);
            return {
              viewportWidth: document.documentElement.clientWidth,
              documentWidth: document.documentElement.scrollWidth,
              brandTagline: {
                whiteSpace: getComputedStyle(brandTagline).whiteSpace,
                height: brandTagline.getBoundingClientRect().height,
                right: brandTagline.getBoundingClientRect().right,
                clientWidth: brandTagline.clientWidth,
                scrollWidth: brandTagline.scrollWidth
              },
              overflowingElements: [...document.querySelectorAll<HTMLElement>('*')]
                .filter(element => !element.closest('.areanav') && element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
                .slice(0, 8)
                .map(element => ({
                  tag: element.tagName,
                  className: typeof element.className === 'string' ? element.className : '',
                  right: element.getBoundingClientRect().right,
                  width: element.getBoundingClientRect().width
                })),
              headerActionsDisplay: getComputedStyle(headerActions).display,
              mobileSearch: {
                width: searchStyle.width,
                height: searchStyle.height,
                borderStyle: searchStyle.borderStyle,
                borderRadius: searchStyle.borderRadius,
                background: searchStyle.backgroundColor
              },
              toggle: {
                textSize: sizeToggle.dataset.textSize,
                pressed: sizeToggle.getAttribute('aria-pressed'),
                width: toggleStyle.width,
                height: toggleStyle.height,
                borderStyle: toggleStyle.borderStyle,
                borderRadius: toggleStyle.borderRadius,
                background: toggleStyle.backgroundColor,
                color: toggleStyle.color,
                fontSize: toggleStyle.fontSize
              },
              primary: {
                display: toolStyle.display,
                current: currentTool.getAttribute('aria-current'),
                background: toolStyle.backgroundColor,
                borderStyle: toolStyle.borderStyle,
                borderRadius: toolStyle.borderRadius,
                color: toolStyle.color,
                fontSize: toolStyle.fontSize
              },
              area: {
                display: areaStyle.display,
                background: areaStyle.backgroundColor,
                borderStyle: areaStyle.borderStyle,
                borderRadius: areaStyle.borderRadius,
                fontSize: areaStyle.fontSize
              }
            };
          });
          assert.equal(phoneStyles.viewportWidth, 375);
          assert.equal(phoneStyles.documentWidth, 375, `Phone shell controls must not cause page-level horizontal overflow at ${expected.size}: ${JSON.stringify(phoneStyles.overflowingElements)}`);
          assert.equal(phoneStyles.brandTagline.whiteSpace, 'nowrap');
          assert.ok(phoneStyles.brandTagline.height < 25);
          assert.equal(phoneStyles.brandTagline.scrollWidth, phoneStyles.brandTagline.clientWidth);
          assert.ok(phoneStyles.brandTagline.right <= 375);
          assert.equal(phoneStyles.headerActionsDisplay, 'flex');
          assert.equal(phoneStyles.mobileSearch.width, '46px');
          assert.equal(phoneStyles.mobileSearch.height, '46px');
          assert.equal(phoneStyles.mobileSearch.borderStyle, 'solid');
          assert.equal(phoneStyles.mobileSearch.borderRadius, '13px');
          assert.equal(phoneStyles.mobileSearch.background, 'rgb(255, 255, 255)');
          assert.equal(phoneStyles.toggle.textSize, expected.size);
          assert.equal(phoneStyles.toggle.pressed, String(expected.pressed));
          assert.equal(phoneStyles.toggle.width, '46px');
          assert.equal(phoneStyles.toggle.height, '46px');
          assert.equal(phoneStyles.toggle.borderStyle, 'solid');
          assert.equal(phoneStyles.toggle.borderRadius, '13px');
          assert.equal(phoneStyles.toggle.background, expected.toggleBackground);
          assert.equal(phoneStyles.toggle.color, expected.toggleColor);
          assert.equal(phoneStyles.toggle.fontSize, expected.toggleFontSize);
          assert.equal(phoneStyles.primary.display, 'flex');
          assert.equal(phoneStyles.primary.current, 'page');
          assert.equal(phoneStyles.primary.background, 'rgb(229, 242, 235)');
          assert.equal(phoneStyles.primary.borderStyle, 'solid');
          assert.equal(phoneStyles.primary.borderRadius, '12px');
          assert.equal(phoneStyles.primary.color, 'rgb(36, 107, 82)');
          assert.equal(phoneStyles.primary.fontSize, expected.phoneFontSize);
          assert.ok(phoneStyles.area.display.includes('flex'));
          assert.equal(phoneStyles.area.background, 'rgba(0, 0, 0, 0)');
          assert.equal(phoneStyles.area.borderStyle, 'solid');
          assert.equal(phoneStyles.area.borderRadius, '10px');
          assert.equal(phoneStyles.area.fontSize, expected.phoneAreaFontSize);

          await page.setViewportSize({ width: 1280, height: 900 });
          const desktopStyles = await page.evaluate(() => {
            const headerActions = document.querySelector<HTMLElement>('.mobile-head-actions');
            const currentTool = document.querySelector<HTMLButtonElement>('.utility-primary-button[aria-current="page"]');
            const areaShortcut = document.querySelector<HTMLButtonElement>('.areanav button');
            const search = document.querySelector<HTMLElement>('.utility-search');
            if (!headerActions || !currentTool || !areaShortcut || !search) {
              throw new Error('Dashboard is missing desktop shell navigation controls.');
            }
            const toolStyle = getComputedStyle(currentTool);
            const areaStyle = getComputedStyle(areaShortcut);
            return {
              viewportWidth: document.documentElement.clientWidth,
              documentWidth: document.documentElement.scrollWidth,
              headerActionsDisplay: getComputedStyle(headerActions).display,
              searchDisplay: getComputedStyle(search).display,
              primary: {
                display: toolStyle.display,
                current: currentTool.getAttribute('aria-current'),
                background: toolStyle.backgroundColor,
                borderStyle: toolStyle.borderStyle,
                borderWidth: toolStyle.borderWidth,
                borderRadius: toolStyle.borderRadius,
                color: toolStyle.color,
                fontSize: toolStyle.fontSize
              },
              area: {
                display: areaStyle.display,
                background: areaStyle.backgroundColor,
                borderStyle: areaStyle.borderStyle,
                borderRadius: areaStyle.borderRadius
              }
            };
          });
          assert.equal(desktopStyles.viewportWidth, 1280);
          assert.equal(desktopStyles.documentWidth, 1280, 'Desktop shell controls must not cause page-level horizontal overflow.');
          assert.equal(desktopStyles.headerActionsDisplay, 'none');
          assert.equal(desktopStyles.searchDisplay, 'flex');
          assert.ok(desktopStyles.primary.display.includes('flex'));
          assert.equal(desktopStyles.primary.current, 'page');
          assert.equal(desktopStyles.primary.background, 'rgb(229, 242, 235)');
          assert.equal(desktopStyles.primary.borderStyle, 'solid');
          assert.equal(desktopStyles.primary.borderWidth, '1px');
          assert.equal(desktopStyles.primary.borderRadius, '12px');
          assert.equal(desktopStyles.primary.color, 'rgb(36, 107, 82)');
          assert.equal(desktopStyles.primary.fontSize, expected.desktopFontSize);
          assert.ok(desktopStyles.area.display.includes('flex'));
          assert.equal(desktopStyles.area.background, 'rgba(0, 0, 0, 0)');
          assert.equal(desktopStyles.area.borderStyle, 'solid');
          assert.equal(desktopStyles.area.borderRadius, '10px');

          if (expected.size !== 'large') {
            await page.setViewportSize({ width: 375, height: 812 });
            await mobileSizeToggle.click();
          }
        }

        await page.setViewportSize({ width: 375, height: 812 });
        await page.locator('.brand-home').focus();
        await page.keyboard.press('Tab');
        const mobileKeyboardFocus = await page.evaluate(() => {
          const active = document.activeElement;
          if (!(active instanceof HTMLButtonElement)) return null;
          const style = getComputedStyle(active);
          return {
            matchesSearchToggle: active.matches('.mobile-head-button:not(.mobile-display-toggle)'),
            visibleFocus: active.matches(':focus-visible'),
            outlineStyle: style.outlineStyle,
            outlineColor: style.outlineColor,
            outlineWidth: style.outlineWidth
          };
        });
        assert.deepEqual(mobileKeyboardFocus, {
          matchesSearchToggle: true,
          visibleFocus: true,
          outlineStyle: 'solid',
          outlineColor: 'rgb(36, 107, 82)',
          outlineWidth: '2px'
        });
        await page.keyboard.press('Enter');
        await page.locator('.mobile-head-button[aria-expanded="true"]').waitFor();
        await page.waitForTimeout(180);
        const expandedSearchColor = await page.locator('.mobile-head-button[aria-expanded="true"]').evaluate(
          element => getComputedStyle(element).color
        );
        assert.equal(expandedSearchColor, 'rgb(36, 107, 82)');
        await page.locator('.mobile-head-button[aria-expanded="true"]').click();

        await page.locator('.brand-home').focus();
        let areaFocused = false;
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await page.keyboard.press('Tab');
          areaFocused = await page.evaluate(() => document.activeElement?.matches('.areanav button') ?? false);
          if (areaFocused) break;
        }
        assert.equal(areaFocused, true, 'Keyboard tab order must reach the area shortcuts.');
        const areaFocusStyles = await page.evaluate(() => {
          const active = document.activeElement;
          if (!(active instanceof HTMLButtonElement)) throw new Error('No area shortcut has keyboard focus.');
          const style = getComputedStyle(active);
          return {
            label: active.innerText.trim(),
            visibleFocus: active.matches(':focus-visible'),
            outlineColor: style.outlineColor,
            outlineWidth: style.outlineWidth
          };
        });
        assert.equal(areaFocusStyles.label, 'Faith');
        assert.equal(areaFocusStyles.visibleFocus, true);
        assert.equal(areaFocusStyles.outlineColor, 'rgb(36, 107, 82)');
        assert.equal(areaFocusStyles.outlineWidth, '2px');
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.querySelector('.areanav button[aria-current="page"]')?.textContent?.includes('Faith'));
        await page.waitForTimeout(180);
        const selectedAreaStyles = await page.locator('.areanav button[aria-current="page"]').evaluate(element => {
          const style = getComputedStyle(element);
          return {
            background: style.backgroundColor,
            borderColor: style.borderColor,
            color: style.color
          };
        });
        assert.equal(selectedAreaStyles.background, 'rgb(255, 255, 255)');
        assert.equal(selectedAreaStyles.borderColor, 'rgb(103, 197, 163)');
        assert.equal(selectedAreaStyles.color, 'rgb(36, 107, 82)');

        await page.setViewportSize({ width: 1280, height: 900 });
        await page.locator('.brand-home').focus();
        await page.keyboard.press('Tab');
        const desktopKeyboardFocus = await page.evaluate(() => {
          const active = document.activeElement;
          if (!(active instanceof HTMLButtonElement)) return null;
          const style = getComputedStyle(active);
          return {
            label: active.innerText.trim(),
            visibleFocus: active.matches(':focus-visible'),
            outlineColor: style.outlineColor,
            outlineWidth: style.outlineWidth
          };
        });
        assert.deepEqual(desktopKeyboardFocus, {
          label: 'Today',
          visibleFocus: true,
          outlineColor: 'rgb(36, 107, 82)',
          outlineWidth: '2px'
        });
        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.querySelector('.utility-primary-button[aria-current="page"]')?.textContent?.includes('Focus'));
        await page.waitForTimeout(180);
        const selectedToolBackground = await page.locator('.utility-primary-button[aria-current="page"]').evaluate(
          element => getComputedStyle(element).backgroundColor
        );
        assert.equal(selectedToolBackground, 'rgb(229, 242, 235)');
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
