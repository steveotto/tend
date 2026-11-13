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
        assert.equal(styles.sectionPadding, '0px');
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
            desktopFontSize: '14px',
            pressed: false
          },
          {
            size: 'medium',
            toggleBackground: 'rgb(229, 242, 235)',
            toggleColor: 'rgb(36, 107, 82)',
            toggleFontSize: '18px',
            phoneFontSize: '14.625px',
            desktopFontSize: '15.75px',
            pressed: true
          },
          {
            size: 'large',
            toggleBackground: 'rgb(36, 107, 82)',
            toggleColor: 'rgb(255, 255, 255)',
            toggleFontSize: '20px',
            phoneFontSize: '16.25px',
            desktopFontSize: '17.5px',
            pressed: true
          }
        ] as const;

        for (const expected of expectedSizes) {
          for (const viewportWidth of [375, 390, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 844 });
            await page.waitForTimeout(180);
            const phoneStyles = await page.evaluate(() => {
              const headerActions = document.querySelector<HTMLElement>('.mobile-head-actions');
              const mobileSearch = document.querySelector<HTMLButtonElement>('.mobile-head-button:not(.mobile-display-toggle)');
              const sizeToggle = document.querySelector<HTMLButtonElement>('.mobile-display-toggle');
              const brandTagline = document.querySelector<HTMLElement>('.brand-tagline');
              const stickyNav = document.querySelector<HTMLElement>('.sticky-nav');
              const areaNavigation = document.querySelector<HTMLElement>('.nav-row-areas');
              const utilitySearch = document.querySelector<HTMLElement>('.utility-search');
              const menuGrid = document.querySelector<HTMLElement>('.home-dashboard .overall-card .menu-grid');
              const firstMenuArea = document.querySelector<HTMLElement>('.home-dashboard .overall-card .menu-area');
              const currentTool = document.querySelector<HTMLButtonElement>('.utility-primary-button[aria-current="page"]');
              if (!headerActions || !mobileSearch || !sizeToggle || !brandTagline || !stickyNav
                || !areaNavigation || !utilitySearch || !menuGrid || !firstMenuArea || !currentTool) {
                throw new Error('Dashboard is missing an expected mobile shell or Health category element.');
              }
              const searchStyle = getComputedStyle(mobileSearch);
              const toggleStyle = getComputedStyle(sizeToggle);
              const toolStyle = getComputedStyle(currentTool);
              const gridStyle = getComputedStyle(menuGrid);
              const gridRect = menuGrid.getBoundingClientRect();
              const areaRect = firstMenuArea.getBoundingClientRect();
              const navRect = stickyNav.getBoundingClientRect();
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
                bottomNavigation: {
                  position: getComputedStyle(stickyNav).position,
                  top: navRect.top,
                  bottom: navRect.bottom,
                  paddingBottom: getComputedStyle(stickyNav).paddingBottom
                },
                areaNavigationDisplay: getComputedStyle(areaNavigation).display,
                utilitySearchDisplay: getComputedStyle(utilitySearch).display,
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
                categoryGrid: {
                  display: gridStyle.display,
                  columns: gridStyle.gridTemplateColumns.trim().split(/\s+/).length,
                  width: gridRect.width,
                  itemWidth: areaRect.width,
                  itemCount: menuGrid.querySelectorAll('.menu-area').length
                }
              };
            });
            assert.equal(phoneStyles.viewportWidth, viewportWidth);
            assert.equal(phoneStyles.documentWidth, viewportWidth, `Phone shell controls must not cause page-level horizontal overflow at ${viewportWidth}px / ${expected.size}: ${JSON.stringify(phoneStyles.overflowingElements)}`);
            assert.equal(phoneStyles.brandTagline.whiteSpace, 'nowrap');
            assert.ok(phoneStyles.brandTagline.height < 25);
            assert.equal(phoneStyles.brandTagline.scrollWidth, phoneStyles.brandTagline.clientWidth);
            assert.ok(phoneStyles.brandTagline.right <= viewportWidth);
            assert.equal(phoneStyles.headerActionsDisplay, 'flex');
            assert.equal(phoneStyles.bottomNavigation.position, 'fixed');
            assert.equal(phoneStyles.bottomNavigation.bottom, 844);
            assert.ok(Number.parseFloat(phoneStyles.bottomNavigation.paddingBottom) >= 7);
            assert.equal(phoneStyles.areaNavigationDisplay, 'none');
            assert.equal(phoneStyles.utilitySearchDisplay, 'none');
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
            assert.equal(phoneStyles.categoryGrid.display, 'grid');
            assert.equal(phoneStyles.categoryGrid.columns, 1, `Health categories must use a readable single column at ${viewportWidth}px / ${expected.size}.`);
            assert.ok(phoneStyles.categoryGrid.itemCount > 0);
            assert.ok(Math.abs(phoneStyles.categoryGrid.itemWidth - phoneStyles.categoryGrid.width) < 1,
              `Health category items must fill the grid at ${viewportWidth}px / ${expected.size}.`);
          }

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
        const expandedSearch = await page.evaluate(() => {
          const toggle = document.querySelector<HTMLElement>('.mobile-head-button[aria-expanded="true"]');
          const search = document.querySelector<HTMLElement>('.utility-search');
          if (!toggle || !search) throw new Error('Opened mobile search is missing its control or input.');
          return {
            color: getComputedStyle(toggle).color,
            display: getComputedStyle(search).display,
            position: getComputedStyle(search).position
          };
        });
        assert.equal(expandedSearch.color, 'rgb(36, 107, 82)');
        assert.equal(expandedSearch.display, 'flex');
        assert.equal(expandedSearch.position, 'fixed');
        await page.keyboard.press('Escape');
        await page.locator('.mobile-head-button[aria-expanded="false"]').waitFor();
        assert.equal(await page.locator('.utility-search').evaluate(element => getComputedStyle(element).display), 'none');

        await page.locator('.brand-home').focus();
        for (let attempt = 0; attempt < 4; attempt += 1) await page.keyboard.press('Tab');
        const mobileNavFocus = await page.evaluate(() => {
          const active = document.activeElement;
          if (!(active instanceof HTMLButtonElement)) return null;
          return {
            label: active.innerText.replace('✦', '').trim(),
            visibleFocus: active.matches(':focus-visible'),
            outlineColor: getComputedStyle(active).outlineColor,
            outlineWidth: getComputedStyle(active).outlineWidth
          };
        });
        assert.deepEqual(mobileNavFocus, {
          label: 'Focus',
          visibleFocus: true,
          outlineColor: 'rgb(36, 107, 82)',
          outlineWidth: '2px'
        });
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.querySelector('.utility-primary-button[aria-current="page"]')?.textContent?.includes('Focus'));
        await page.waitForFunction(() => {
          const current = document.querySelector<HTMLElement>('.utility-primary-button[aria-current="page"]');
          return current
            && getComputedStyle(current).backgroundColor === 'rgb(229, 242, 235)'
            && getComputedStyle(current).color === 'rgb(36, 107, 82)';
        });
        const selectedMobileTool = await page.locator('.utility-primary-button[aria-current="page"]').evaluate(element => {
          const style = getComputedStyle(element);
          return {
            className: element.className,
            background: style.backgroundColor,
            color: style.color
          };
        });
        assert.deepEqual(selectedMobileTool, {
          className: 'utility-primary-button active',
          background: 'rgb(229, 242, 235)',
          color: 'rgb(36, 107, 82)'
        });
        await page.locator('.utility-primary-button').filter({ hasText: 'Today' }).focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.querySelector('.utility-primary-button[aria-current="page"]')?.textContent?.includes('Today'));

        await page.setViewportSize({ width: 1280, height: 900 });
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

        await page.locator('.utility-primary-button').filter({ hasText: 'Today' }).click();
        await page.locator('.home-dashboard .overall-card .menu-area')
          .filter({ hasText: 'Health & Fitness' })
          .click();
        await page.getByRole('tablist', { name: 'Health and Fitness' }).waitFor();
        await page.setViewportSize({ width: 390, height: 844 });
        const categoryTabs = page.getByRole('tablist', { name: 'Health and Fitness' });
        const categoryTabStyles = await categoryTabs.evaluate(element => {
          const selected = element.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
          const inactive = element.querySelector<HTMLElement>('[role="tab"][aria-selected="false"]');
          if (!selected || !inactive) throw new Error('Health category tabs are missing a selected or inactive tab.');
          const selectedStyle = getComputedStyle(selected);
          const inactiveStyle = getComputedStyle(inactive);
          return {
            display: getComputedStyle(element).display,
            width: element.getBoundingClientRect().width,
            borderRadius: getComputedStyle(element).borderRadius,
            background: getComputedStyle(element).backgroundColor,
            selectedLabel: selected.textContent?.trim(),
            selectedBackground: selectedStyle.backgroundColor,
            selectedBorderRadius: selectedStyle.borderRadius,
            selectedColor: selectedStyle.color,
            selectedHeight: selected.getBoundingClientRect().height,
            inactiveBackground: inactiveStyle.backgroundColor,
            inactiveColor: inactiveStyle.color
          };
        });
        assert.equal(categoryTabStyles.display, 'grid');
        assert.ok(categoryTabStyles.width > 0);
        assert.equal(categoryTabStyles.borderRadius, '14px');
        assert.equal(categoryTabStyles.background, 'rgb(247, 249, 247)');
        assert.equal(categoryTabStyles.selectedLabel, 'Foundations');
        assert.equal(categoryTabStyles.selectedBackground, 'rgb(255, 255, 255)');
        assert.equal(categoryTabStyles.selectedBorderRadius, '10px');
        assert.equal(categoryTabStyles.selectedColor, 'rgb(28, 88, 68)');
        assert.ok(categoryTabStyles.selectedHeight >= 42);
        assert.equal(categoryTabStyles.inactiveBackground, 'rgba(0, 0, 0, 0)');
        assert.equal(categoryTabStyles.inactiveColor, 'rgb(94, 107, 99)');
        await categoryTabs.getByRole('tab', { name: 'Foundations' }).focus();
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => {
          const tab = document.querySelector<HTMLElement>('.health-fitness-page [role="tablist"][aria-label="Health and Fitness"] [role="tab"][aria-selected="true"]');
          return tab?.textContent?.trim() === 'Today' && tab === document.activeElement;
        });
        await page.locator('.health-fitness-page [role="tablist"][aria-label="Health and Fitness"] [role="tab"][aria-selected="true"]')
          .evaluate(element => element.blur());

        await page.locator('.utility-primary-button').filter({ hasText: 'Today' }).click();
        await page.getByRole('tab', { name: 'Now', exact: true }).waitFor();
        const timeframeSizeToggle = page.locator('.mobile-display-toggle');
        for (const textSize of ['small', 'medium', 'large'] as const) {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            if (await timeframeSizeToggle.getAttribute('data-text-size') === textSize) break;
            await timeframeSizeToggle.click();
          }
          assert.equal(await timeframeSizeToggle.getAttribute('data-text-size'), textSize);
          for (const viewportWidth of [375, 390, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 844 });
            for (const viewName of ['Now', 'Flexible', 'All today'] as const) {
              const tab = page.getByRole('tab', { name: viewName, exact: true });
              await tab.click();
              if (viewName !== 'Now') {
                await page.evaluate(targetView => {
                  let surface = document.querySelector<HTMLElement>('#timeframe-browser-fixture');
                  if (!surface) {
                    surface = document.createElement('div');
                    surface.id = 'timeframe-browser-fixture';
                    surface.className = 'home-dashboard today-plan-section';
                    document.body.append(surface);
                  }
                  Object.assign(surface.style, {
                    position: 'fixed',
                    top: '0',
                    left: '0',
                    width: `${window.innerWidth}px`,
                    padding: '16px',
                    opacity: '0',
                    pointerEvents: 'none',
                    zIndex: '-1'
                  });
                  surface.replaceChildren();
                  const groupsContainer = document.createElement('div');
                  const isAllToday = targetView === 'All today';
                  groupsContainer.className = isAllToday
                    ? 'today-plan__accordion-groups'
                    : 'current-plan-items current-plan-items--flexible';
                  surface.append(groupsContainer);
                  const groupFixtures = [
                    ['Anytime', 'On your schedule'],
                    ['All-day', 'Throughout the day']
                  ] as const;
                  for (const [index, [titleText, rangeText]] of groupFixtures.entries()) {
                    const group = document.createElement('section');
                    group.className = isAllToday
                      ? 'today-plan__accordion-group'
                      : 'today-plan__flexible-group';
                    const header = document.createElement('h4');
                    header.className = 'today-timeframe-header';
                    const content = document.createElement('span');
                    content.className = 'today-timeframe-header__content';
                    const titleRow = document.createElement('span');
                    titleRow.className = 'today-timeframe-header__title-row';
                    const title = document.createElement('span');
                    title.className = 'today-plan__view-heading';
                    title.textContent = titleText;
                    const meta = document.createElement('span');
                    meta.className = 'today-timeframe-header__meta';
                    const progress = document.createElement('span');
                    progress.className = 'today-timeframe-header__progress';
                    progress.textContent = '0 of 1';
                    if (isAllToday) progress.setAttribute('aria-hidden', 'true');
                    meta.append(progress);
                    if (isAllToday) {
                      const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                      chevron.classList.add('today-plan__accordion-chevron');
                      chevron.setAttribute('viewBox', '0 0 16 16');
                      chevron.setAttribute('aria-hidden', 'true');
                      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                      path.setAttribute('d', index === 0 ? 'm3 10 5-5 5 5' : 'm3 6 5 5 5-5');
                      chevron.append(path);
                      meta.append(chevron);
                    }
                    titleRow.append(title, meta);
                    const range = document.createElement('span');
                    range.className = 'today-timeframe-header__range';
                    range.textContent = rangeText;
                    content.append(titleRow, range);
                    let accordionPanel: HTMLElement | null = null;
                    if (isAllToday) {
                      const disclosure = document.createElement('button');
                      const disclosureId = `synthetic-timeframe-${index}-disclosure`;
                      const panelId = `synthetic-timeframe-${index}-panel`;
                      disclosure.type = 'button';
                      disclosure.id = disclosureId;
                      disclosure.className = 'today-timeframe-header__disclosure';
                      disclosure.setAttribute('aria-label', `${titleText}, ${rangeText}, 0 of 1 tended`);
                      disclosure.setAttribute('aria-expanded', index === 0 ? 'true' : 'false');
                      disclosure.setAttribute('aria-controls', panelId);
                      disclosure.append(content);
                      header.append(disclosure);
                      accordionPanel = document.createElement('div');
                      accordionPanel.id = panelId;
                      accordionPanel.className = 'today-plan__accordion-panel';
                      accordionPanel.setAttribute('role', 'region');
                      accordionPanel.setAttribute('aria-labelledby', disclosureId);
                      if (index !== 0) accordionPanel.hidden = true;
                      const panelContent = document.createElement('div');
                      panelContent.className = 'today-plan__accordion-panel-content current-plan-item-group';
                      accordionPanel.append(panelContent);
                    } else {
                      header.append(content);
                    }
                    const rhythmGroup = accordionPanel ?? document.createElement('div');
                    rhythmGroup.classList.add('current-plan-item-group');
                    group.append(header, rhythmGroup);
                    groupsContainer.append(group);
                  }
                }, viewName);
              }
              const snapshot = await page.evaluate(targetView => {
                const surface = targetView === 'Now'
                  ? document.querySelector<HTMLElement>('.today-plan-section')
                  : document.querySelector<HTMLElement>('#timeframe-browser-fixture');
                const header = surface?.querySelector<HTMLElement>('.today-timeframe-header');
                const title = header?.querySelector<HTMLElement>('.today-plan__view-heading');
                const range = header?.querySelector<HTMLElement>('.today-timeframe-header__range');
                const meta = header?.querySelector<HTMLElement>('.today-timeframe-header__meta');
                const progress = header?.querySelector<HTMLElement>('.today-timeframe-header__progress');
                const disclosure = header?.querySelector<HTMLButtonElement>('.today-timeframe-header__disclosure');
                if (!header || !title || !range || !meta || !progress) {
                  throw new Error(`Today ${targetView} timeframe header is incomplete: ${JSON.stringify({
                    header: Boolean(header),
                    title: Boolean(title),
                    range: Boolean(range),
                    meta: Boolean(meta),
                    progress: Boolean(progress)
                  })}`);
                }
                const titleStyle = getComputedStyle(title);
                const rangeStyle = getComputedStyle(range);
                const progressStyle = getComputedStyle(progress);
                const titleRect = title.getBoundingClientRect();
                const progressRect = progress.getBoundingClientRect();
                const metaRect = meta.getBoundingClientRect();
                const groupSelector = targetView === 'Flexible'
                  ? '.today-plan__flexible-group'
                  : '.today-plan__accordion-group';
                const groups = [...(surface?.querySelectorAll<HTMLElement>(groupSelector) ?? [])];
                return {
                  headerBackground: getComputedStyle(header).backgroundColor,
                  headerRadius: getComputedStyle(header).borderRadius,
                  titleSize: Number.parseFloat(titleStyle.fontSize),
                  titleWeight: titleStyle.fontWeight,
                  rangeSize: Number.parseFloat(rangeStyle.fontSize),
                  progressSize: Number.parseFloat(progressStyle.fontSize),
                  progressBackground: progressStyle.backgroundColor,
                  progressRadius: progressStyle.borderRadius,
                  progressText: progress.textContent?.trim(),
                  progressRightGap: metaRect.right - progressRect.right,
                  titleRight: titleRect.right,
                  progressLeft: progressRect.left,
                  disclosure: Boolean(disclosure),
                  chevron: Boolean(header.querySelector('.today-plan__accordion-chevron')),
                  expanded: disclosure?.getAttribute('aria-expanded') ?? null,
                  panelId: disclosure?.getAttribute('aria-controls') ?? null,
                  groupDivider: groups[1] ? getComputedStyle(groups[1]).borderTopWidth : null,
                  documentWidth: document.documentElement.scrollWidth,
                  viewportWidth: window.innerWidth,
                  scale: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-text-scale'))
                };
              }, viewName);
              const expectedTitleSize = 20 * snapshot.scale * 0.85;
              const expectedRangeSize = 20 * snapshot.scale * 0.7;
              const expectedProgressSize = 20 * snapshot.scale * 0.6;
              assert.equal(snapshot.headerBackground, 'rgba(0, 0, 0, 0)', `${viewName} ${viewportWidth}px ${textSize}`);
              assert.equal(snapshot.headerRadius, '0px', `${viewName} ${viewportWidth}px ${textSize}`);
              assert.ok(Math.abs(snapshot.titleSize - expectedTitleSize) < 0.1);
              assert.equal(snapshot.titleWeight, '600');
              assert.ok(Math.abs(snapshot.rangeSize - expectedRangeSize) < 0.1);
              assert.ok(Math.abs(snapshot.progressSize - expectedProgressSize) < 0.1);
              assert.equal(snapshot.progressBackground, 'rgb(241, 242, 242)');
              assert.equal(snapshot.progressRadius, '999px');
              assert.match(snapshot.progressText ?? '', /^\d+ of \d+$/);
              assert.ok(snapshot.progressRightGap >= 0 && snapshot.progressRightGap < 30);
              assert.ok(snapshot.titleRight <= snapshot.progressLeft);
              assert.equal(snapshot.documentWidth, snapshot.viewportWidth, `${viewName} ${viewportWidth}px ${textSize}`);
              assert.equal(snapshot.disclosure, viewName === 'All today');
              assert.equal(snapshot.chevron, viewName === 'All today');
              if (viewName === 'All today') {
                assert.ok(snapshot.panelId);
                assert.ok(snapshot.expanded === 'true' || snapshot.expanded === 'false');
              }
              if (snapshot.groupDivider !== null) assert.equal(snapshot.groupDivider, '1px');

              if (viewName === 'All today') {
                const stressResult = await page.evaluate(() => {
                  const header = document.querySelector<HTMLElement>('#timeframe-browser-fixture .today-timeframe-header');
                  const title = header?.querySelector<HTMLElement>('.today-plan__view-heading');
                  const progress = header?.querySelector<HTMLElement>('.today-timeframe-header__progress');
                  if (!title || !progress) throw new Error('Cannot stress-test a missing timeframe title or progress pill.');
                  const originalTitle = title.textContent;
                  const originalProgress = progress.textContent;
                  title.textContent = 'A deliberately long custom timeframe name for responsive layout verification';
                  progress.textContent = '123 of 123';
                  const titleRect = title.getBoundingClientRect();
                  const progressRect = progress.getBoundingClientRect();
                  const result = {
                    documentWidth: document.documentElement.scrollWidth,
                    viewportWidth: window.innerWidth,
                    titleWidth: titleRect.width,
                    titleRight: titleRect.right,
                    progressLeft: progressRect.left
                  };
                  title.textContent = originalTitle;
                  progress.textContent = originalProgress;
                  return result;
                });
                assert.equal(stressResult.documentWidth, stressResult.viewportWidth);
                assert.ok(stressResult.titleWidth > 0);
                assert.ok(stressResult.titleRight <= stressResult.progressLeft);
              }
            }
          }
        }

        await page.setViewportSize({ width: 1280, height: 900 });
        await page.getByRole('tab', { name: 'Now', exact: true }).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1280);
      }

      assert.deepEqual(classicCssRequests, [], 'React pages must not request tend.css.');
      await context.close();
    }

    console.log('Browser CSS contract passed: sign-in and dashboard layouts render without tend.css.');
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
