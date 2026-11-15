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
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        hasTouch: identity === 'dashboard'
      });
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
              const calendarSection = document.querySelector<HTMLElement>('.today-calendar-section');
              const calendarHeadingRow = document.querySelector<HTMLElement>('.calendar-heading-row');
              const calendarHeading = document.querySelector<HTMLElement>('.calendar-heading-row h2');
              const prayerHeading = document.querySelector<HTMLElement>('.today-prayer-section > .sectiontitle h2');
              let calendarRange = document.querySelector<HTMLElement>('.calendar-range-control');
              let calendarRangeLabel = document.querySelector<HTMLElement>('.calendar-range-label');
              const currentTool = document.querySelector<HTMLButtonElement>('.utility-primary-button[aria-current="page"]');
              if (!calendarRange && calendarHeadingRow) {
                calendarRange = document.createElement('div');
                calendarRange.className = 'calendar-range-control';
                calendarRange.setAttribute('role', 'group');
                calendarRange.setAttribute('aria-label', 'Synthetic Calendar date range');
                for (const [label, dotMarkup] of [
                  ['Today', '<circle class="calendar-range-icon__dot calendar-range-icon__dot--today" cx="12" cy="15.75" r="3"></circle>'],
                  ['Week', [5.8, 7.87, 9.93, 12, 14.07, 16.13, 18.2].map(x => `<circle class="calendar-range-icon__dot" cx="${x}" cy="15.75" r="1.05"></circle>`).join('')],
                  ['Month', [7.1, 10.37, 13.63, 16.9].flatMap(x => [13, 16.25, 19.5].map(y => `<circle class="calendar-range-icon__dot" cx="${x}" cy="${y}" r="1.05"></circle>`)).join('')]
                ] as const) {
                  const button = document.createElement('button');
                  button.type = 'button';
                  button.className = 'calendar-range-control__button';
                  button.setAttribute('aria-label', label);
                  button.setAttribute('aria-pressed', String(label === 'Today'));
                  button.title = label;
                  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="16" rx="2.5"></rect><path d="M8 3.75v3.5M16 3.75v3.5M3.75 10.25h16.5"></path>${dotMarkup}</svg>`;
                  calendarRange.append(button);
                }
                calendarHeadingRow.append(calendarRange);
              }
              if (!calendarRangeLabel && calendarSection) {
                calendarRangeLabel = document.createElement('p');
                calendarRangeLabel.className = 'calendar-range-label';
                calendarRangeLabel.textContent = 'Synthetic week range';
                calendarSection.querySelector('.calendar-section-title')?.append(calendarRangeLabel);
              }
              if (!headerActions || !mobileSearch || !sizeToggle || !brandTagline || !stickyNav
                || !areaNavigation || !utilitySearch || !menuGrid || !firstMenuArea || !currentTool
                || !calendarSection || !calendarHeadingRow || !calendarHeading || !prayerHeading
                || !calendarRange || !calendarRangeLabel) {
                throw new Error('Dashboard is missing an expected mobile shell or Health category element.');
              }
              const searchStyle = getComputedStyle(mobileSearch);
              const toggleStyle = getComputedStyle(sizeToggle);
              const toolStyle = getComputedStyle(currentTool);
              const gridStyle = getComputedStyle(menuGrid);
              const gridRect = menuGrid.getBoundingClientRect();
              const areaRect = firstMenuArea.getBoundingClientRect();
              const navRect = stickyNav.getBoundingClientRect();
              const calendarHeadingRect = calendarHeading.getBoundingClientRect();
              const calendarHeadingStyle = getComputedStyle(calendarHeading);
              const prayerHeadingStyle = getComputedStyle(prayerHeading);
              const calendarRangeRect = calendarRange.getBoundingClientRect();
              const calendarButtons = [...calendarRange.querySelectorAll<HTMLButtonElement>('button')];
              const calendarIcons = calendarButtons.map(button => button.querySelector<SVGSVGElement>('svg'));
              const calendarContent = document.querySelector<HTMLElement>('.calendar-agenda-content');
              if (!calendarContent) throw new Error('Calendar content is missing.');
              const placeholder = document.createElement('div');
              placeholder.className = 'calendar-event calendar-event--status calendar-event--loading';
              placeholder.setAttribute('role', 'status');
              placeholder.setAttribute('aria-live', 'polite');
              const placeholderTile = document.createElement('span');
              placeholderTile.className = 'calendar-event__date-tile calendar-event__date-tile--status';
              placeholderTile.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="16" rx="2.5"></rect><path d="M8 3.75v3.5M16 3.75v3.5M3.75 10.25h16.5"></path></svg>';
              const placeholderDetails = document.createElement('span');
              placeholderDetails.className = 'calendar-event__details';
              const placeholderTitle = document.createElement('span');
              placeholderTitle.className = 'calendar-event__loading-label';
              placeholderTitle.textContent = 'Loading events…';
              placeholderDetails.append(placeholderTitle);
              placeholder.append(placeholderTile, placeholderDetails);
              calendarContent.append(placeholder);
              const placeholderRect = placeholder.getBoundingClientRect();
              const placeholderStyle = getComputedStyle(placeholder);
              const placeholderTileStyle = getComputedStyle(placeholderTile);
              const longPlaceholder = placeholder.cloneNode(true) as HTMLElement;
              longPlaceholder.querySelector('.calendar-event__loading-label')!.textContent =
                'Calendar events could not be loaded. The browser could not connect to the Calendar reader. Code: reader-network-failed. Retry.';
              calendarContent.append(longPlaceholder);
              const longPlaceholderHeight = longPlaceholder.getBoundingClientRect().height;
              const tileRect = placeholderTile.getBoundingClientRect();
              const iconRect = placeholderTile.querySelector('svg')!.getBoundingClientRect();
              const loadingLabelStyle = getComputedStyle(placeholderTitle);
              const loadingLabelRect = placeholderTitle.getBoundingClientRect();
              const placeholderMetrics = {
                width: placeholderRect.width,
                sectionWidth: calendarContent.getBoundingClientRect().width,
                renderedHeight: placeholderRect.height,
                minHeight: placeholderStyle.minHeight,
                longTextHeight: longPlaceholderHeight,
                overflow: placeholderStyle.overflow,
                border: placeholderStyle.borderTopWidth,
                radius: placeholderStyle.borderTopLeftRadius,
                padding: placeholderStyle.padding,
                tileWidth: placeholderTile.getBoundingClientRect().width,
                tileHeight: tileRect.height,
                tileGridRows: placeholderTileStyle.gridTemplateRows,
                tileAlignSelf: placeholderTileStyle.alignSelf,
                tileJustifySelf: placeholderTileStyle.justifySelf,
                iconCenterOffsetX: iconRect.left + iconRect.width / 2 - (tileRect.left + tileRect.width / 2),
                iconCenterOffsetY: iconRect.top + iconRect.height / 2 - (tileRect.top + tileRect.height / 2),
                labelCenterOffsetY: loadingLabelRect.top + loadingLabelRect.height / 2 - (tileRect.top + tileRect.height / 2),
                labelFontSize: loadingLabelStyle.fontSize,
                labelFontWeight: loadingLabelStyle.fontWeight,
                labelColor: loadingLabelStyle.color,
                titleScrollHeight: placeholderTitle.scrollHeight,
                titleClientHeight: placeholderTitle.clientHeight,
                tileAlignment: placeholderStyle.gridTemplateAreas,
                tileColor: placeholderTileStyle.color,
                liveRole: placeholder.getAttribute('role'),
                livePoliteness: placeholder.getAttribute('aria-live'),
                textScale: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-text-scale'))
              };
              placeholder.remove();
              longPlaceholder.remove();
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
                },
                calendarRange: {
                  headingText: calendarHeading.textContent?.trim(),
                  headingFontFamily: calendarHeadingStyle.fontFamily,
                  headingFontSize: calendarHeadingStyle.fontSize,
                  headingFontWeight: calendarHeadingStyle.fontWeight,
                  headingColor: calendarHeadingStyle.color,
                  headingLineHeight: calendarHeadingStyle.lineHeight,
                  prayerHeadingFontFamily: prayerHeadingStyle.fontFamily,
                  prayerHeadingFontSize: prayerHeadingStyle.fontSize,
                  prayerHeadingFontWeight: prayerHeadingStyle.fontWeight,
                  prayerHeadingColor: prayerHeadingStyle.color,
                  prayerHeadingLineHeight: prayerHeadingStyle.lineHeight,
                  headingSectionClass: calendarHeading.closest('.sectiontitle')?.className,
                  buttonNames: calendarButtons.map(button => button.getAttribute('aria-label')),
                  buttonTitles: calendarButtons.map(button => button.title),
                  buttonSizes: calendarButtons.map(button => {
                    const rect = button.getBoundingClientRect();
                    return { width: rect.width, height: rect.height, pressed: button.getAttribute('aria-pressed') };
                  }),
                  icons: calendarIcons.map((icon, index) => {
                    if (!icon) return null;
                    const rect = icon.getBoundingClientRect();
                    return {
                      viewBox: icon.getAttribute('viewBox'),
                      width: rect.width,
                      height: rect.height,
                      stroke: getComputedStyle(icon).stroke,
                      buttonColor: getComputedStyle(calendarButtons[index]!).color,
                      strokeWidth: getComputedStyle(icon).strokeWidth,
                      outline: [...icon.children].slice(0, 2).map(shape => shape.outerHTML),
                      dotCount: icon.querySelectorAll('.calendar-range-icon__dot').length
                    };
                  }),
                  right: calendarRangeRect.right,
                  labelTop: calendarRangeLabel.getBoundingClientRect().top,
                  rowBottom: calendarHeadingRow.getBoundingClientRect().bottom,
                  headingOverlap: calendarHeadingRect.left < calendarRangeRect.right
                    && calendarHeadingRect.right > calendarRangeRect.left
                    && calendarHeadingRect.top < calendarRangeRect.bottom
                    && calendarHeadingRect.bottom > calendarRangeRect.top,
                  sectionRight: calendarSection.getBoundingClientRect().right
                },
                calendarPlaceholder: placeholderMetrics
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
            assert.deepEqual(phoneStyles.calendarRange.buttonNames, ['Today', 'Week', 'Month']);
            assert.deepEqual(phoneStyles.calendarRange.buttonTitles, ['Today', 'Week', 'Month']);
            assert.equal(phoneStyles.calendarRange.headingText, 'Calendar');
            assert.equal(phoneStyles.calendarRange.headingSectionClass, 'sectiontitle calendar-section-title');
            assert.equal(phoneStyles.calendarRange.headingFontFamily, phoneStyles.calendarRange.prayerHeadingFontFamily);
            assert.equal(phoneStyles.calendarRange.headingFontSize, phoneStyles.calendarRange.prayerHeadingFontSize);
            assert.equal(phoneStyles.calendarRange.headingFontWeight, phoneStyles.calendarRange.prayerHeadingFontWeight);
            assert.equal(phoneStyles.calendarRange.headingColor, phoneStyles.calendarRange.prayerHeadingColor);
            assert.equal(phoneStyles.calendarRange.headingLineHeight, phoneStyles.calendarRange.prayerHeadingLineHeight);
            assert.deepEqual(phoneStyles.calendarRange.buttonSizes.map(button => [button.width, button.height]), [
              [44, 44],
              [44, 44],
              [44, 44]
            ], `Calendar range targets must remain at least 44px at ${viewportWidth}px / ${expected.size}.`);
            assert.deepEqual(phoneStyles.calendarRange.icons.map(icon => icon && [
              icon.viewBox,
              icon.width,
              icon.height,
              icon.strokeWidth
            ]), [
              ['0 0 24 24', 22, 22, '1.8px'],
              ['0 0 24 24', 22, 22, '1.8px'],
              ['0 0 24 24', 22, 22, '1.8px']
            ]);
            phoneStyles.calendarRange.icons.forEach(icon => {
              assert.equal(icon?.stroke, icon?.buttonColor,
                `Calendar icon strokes must follow currentColor at ${viewportWidth}px / ${expected.size}.`);
            });
            assert.deepEqual(phoneStyles.calendarRange.icons.map(icon => icon?.outline), [
              phoneStyles.calendarRange.icons[0]?.outline,
              phoneStyles.calendarRange.icons[0]?.outline,
              phoneStyles.calendarRange.icons[0]?.outline
            ]);
            assert.deepEqual(phoneStyles.calendarRange.icons.map(icon => icon?.dotCount), [1, 7, 12]);
            assert.equal(phoneStyles.calendarRange.buttonSizes[0]?.pressed, 'true');
            assert.ok(phoneStyles.calendarRange.right <= phoneStyles.calendarRange.sectionRight + 1,
              `Calendar range controls must stay within the section at ${viewportWidth}px / ${expected.size}.`);
            assert.equal(phoneStyles.calendarRange.headingOverlap, false,
              `Calendar range controls must wrap rather than overlap the heading at ${viewportWidth}px / ${expected.size}.`);
            assert.ok(phoneStyles.calendarRange.labelTop >= phoneStyles.calendarRange.rowBottom,
              `Calendar range label must remain laid out at ${viewportWidth}px / ${expected.size}.`);
            assert.equal(phoneStyles.calendarPlaceholder.width, phoneStyles.calendarPlaceholder.sectionWidth);
            assert.equal(phoneStyles.calendarPlaceholder.minHeight, '66px');
            assert.equal(phoneStyles.calendarPlaceholder.overflow, 'visible');
            assert.equal(phoneStyles.calendarPlaceholder.border, '1px');
            assert.equal(phoneStyles.calendarPlaceholder.radius, '12px');
            assert.equal(phoneStyles.calendarPlaceholder.padding, '9px 10px');
            assert.equal(phoneStyles.calendarPlaceholder.tileWidth, 44);
            assert.equal(phoneStyles.calendarPlaceholder.tileHeight, 46);
            assert.equal(phoneStyles.calendarPlaceholder.tileGridRows, '44px');
            assert.equal(phoneStyles.calendarPlaceholder.tileAlignSelf, 'center');
            assert.equal(phoneStyles.calendarPlaceholder.tileJustifySelf, 'center');
            assert.equal(phoneStyles.calendarPlaceholder.tileAlignment, '"date details"');
            assert.ok(Math.abs(phoneStyles.calendarPlaceholder.iconCenterOffsetX) < 0.5);
            assert.ok(Math.abs(phoneStyles.calendarPlaceholder.iconCenterOffsetY) < 0.5);
            assert.ok(Math.abs(phoneStyles.calendarPlaceholder.labelCenterOffsetY) < 0.5,
              `Calendar status text must center with its icon tile at ${viewportWidth}px / ${expected.size}; offset was ${phoneStyles.calendarPlaceholder.labelCenterOffsetY}px.`);
            assert.equal(phoneStyles.calendarPlaceholder.labelFontSize, `${14 * phoneStyles.calendarPlaceholder.textScale}px`);
            assert.equal(phoneStyles.calendarPlaceholder.labelFontWeight, '400');
            assert.equal(phoneStyles.calendarPlaceholder.labelColor, 'rgb(94, 107, 99)');
            assert.equal(phoneStyles.calendarPlaceholder.liveRole, 'status');
            assert.equal(phoneStyles.calendarPlaceholder.livePoliteness, 'polite');
            assert.ok(phoneStyles.calendarPlaceholder.renderedHeight >= 66);
            assert.ok(phoneStyles.calendarPlaceholder.longTextHeight > phoneStyles.calendarPlaceholder.renderedHeight,
              `Calendar status cards must grow for wrapped text at ${viewportWidth}px / ${expected.size}.`);
            assert.ok(phoneStyles.calendarPlaceholder.titleScrollHeight >= phoneStyles.calendarPlaceholder.titleClientHeight);
            const pastEventStyles = await page.evaluate(() => {
              const content = document.querySelector<HTMLElement>('.today-calendar-section .calendar-agenda-content');
              if (!content) throw new Error('Calendar agenda content is missing from the CSS fixture.');
              const list = document.createElement('ol');
              list.className = 'calendar-events';
              const makeRow = (isPast: boolean) => {
                const row = document.createElement('li');
                row.className = `calendar-event${isPast ? ' calendar-event--past' : ''}`;
                const date = document.createElement('time');
                date.className = 'calendar-event__date-tile';
                date.innerHTML = '<span class="calendar-event__month">NOV</span><span class="calendar-event__day">30</span>';
                const details = document.createElement('span');
                details.className = 'calendar-event__details';
                details.innerHTML = '<strong>Synthetic event with naturally wrapping title</strong><span class="calendar-event__date-time">Mon, Nov 30 · 2:00 PM–3:00 PM</span>';
                const relative = document.createElement('span');
                relative.className = 'calendar-event__relative';
                relative.textContent = 'Today';
                row.append(date, details, relative);
                return row;
              };
              const normal = makeRow(false);
              const past = makeRow(true);
              list.append(normal, past);
              content.append(list);
              const normalRect = normal.getBoundingClientRect();
              const pastRect = past.getBoundingClientRect();
              const normalMonth = normal.querySelector<HTMLElement>('.calendar-event__month')!;
              const pastMonth = past.querySelector<HTMLElement>('.calendar-event__month')!;
              const pastTitle = past.querySelector<HTMLElement>('.calendar-event__details strong')!;
              const pastDate = past.querySelector<HTMLElement>('.calendar-event__date-time')!;
              const result = {
                normalBackground: getComputedStyle(normal).backgroundColor,
                pastBackground: getComputedStyle(past).backgroundColor,
                normalDateTileBackground: getComputedStyle(normal.querySelector<HTMLElement>('.calendar-event__date-tile')!).backgroundColor,
                pastDateTileBackground: getComputedStyle(past.querySelector<HTMLElement>('.calendar-event__date-tile')!).backgroundColor,
                normalMonthBackground: getComputedStyle(normalMonth).backgroundColor,
                pastMonthBackground: getComputedStyle(pastMonth).backgroundColor,
                pastMonthColor: getComputedStyle(pastMonth).color,
                pastDayColor: getComputedStyle(past.querySelector<HTMLElement>('.calendar-event__day')!).color,
                pastTitleColor: getComputedStyle(pastTitle).color,
                pastDateColor: getComputedStyle(pastDate).color,
                pastRelativeColor: getComputedStyle(past.querySelector<HTMLElement>('.calendar-event__relative')!).color,
                pastPadding: getComputedStyle(past).padding,
                pastRadius: getComputedStyle(past).borderTopLeftRadius,
                pastOpacity: getComputedStyle(past).opacity,
                pastDecoration: getComputedStyle(pastTitle).textDecorationLine,
                normalWidth: normalRect.width,
                pastWidth: pastRect.width,
                normalHeight: normalRect.height,
                pastHeight: pastRect.height,
                viewportWidth: window.innerWidth
              };
              list.remove();
              return result;
            });
            assert.equal(pastEventStyles.pastBackground, 'rgb(255, 255, 255)');
            assert.equal(pastEventStyles.pastBackground, pastEventStyles.normalBackground);
            assert.equal(pastEventStyles.pastDateTileBackground, pastEventStyles.normalDateTileBackground);
            assert.notEqual(pastEventStyles.pastMonthBackground, pastEventStyles.normalMonthBackground);
            assert.equal(pastEventStyles.pastMonthBackground, 'rgb(232, 234, 237)');
            assert.equal(pastEventStyles.pastMonthColor, 'rgb(95, 99, 104)');
            assert.equal(pastEventStyles.pastDayColor, 'rgb(98, 103, 107)');
            assert.equal(pastEventStyles.pastTitleColor, 'rgb(98, 103, 107)');
            assert.equal(pastEventStyles.pastDateColor, 'rgb(98, 103, 107)');
            assert.equal(pastEventStyles.pastRelativeColor, 'rgb(98, 103, 107)');
            assert.equal(pastEventStyles.pastPadding, '9px 10px');
            assert.equal(pastEventStyles.pastRadius, '12px');
            assert.equal(pastEventStyles.pastOpacity, '1');
            assert.equal(pastEventStyles.pastTitleColor, pastEventStyles.pastDateColor);
            assert.equal(pastEventStyles.pastTitleColor, pastEventStyles.pastRelativeColor);
            assert.equal(pastEventStyles.pastDecoration, 'none');
            assert.equal(pastEventStyles.pastWidth, pastEventStyles.normalWidth);
            assert.equal(pastEventStyles.pastHeight, pastEventStyles.normalHeight);
            assert.ok(pastEventStyles.pastWidth <= pastEventStyles.viewportWidth);

            const peoplePickerStyles = await page.evaluate(() => {
              const dialog = document.createElement('dialog');
              dialog.className = 'money-goal-dialog money-goal-dialog--association-picker money-goal-dialog--people-picker dialog--phone-fullscreen';
              dialog.open = true;
              dialog.style.position = 'fixed';
              dialog.style.inset = '0';
              dialog.style.margin = '0';

              const surface = document.createElement('div');
              surface.className = 'money-goal-dialog__surface';
              const rhythmTitle = document.createElement('h2');
              rhythmTitle.textContent = 'A long unsaved Rhythm title that should wrap naturally on a phone';
              surface.append(rhythmTitle);

              const picker = document.createElement('section');
              picker.className = 'rhythm-association-picker';
              const heading = document.createElement('h3');
              heading.textContent = 'Choose people';
              picker.append(heading);
              const groups = document.createElement('div');
              groups.className = 'rhythm-association-picker__groups';
              groups.textContent = 'People groups';
              picker.append(groups);
              const options = document.createElement('div');
              options.className = 'rhythm-association-picker__options';
              for (let index = 0; index < 24; index += 1) {
                const option = document.createElement('button');
                option.className = 'rhythm-association-picker__option';
                option.textContent = `Synthetic person ${index + 1}`;
                options.append(option);
              }
              picker.append(options);
              const actions = document.createElement('div');
              actions.className = 'money-goal-dialog__actions rhythm-association-picker__actions';
              actions.innerHTML = '<button type="button">Done</button><button type="button">Cancel</button>';
              picker.append(actions);
              surface.append(picker);
              dialog.append(surface);
              document.body.append(dialog);

              const dialogRect = dialog.getBoundingClientRect();
              const titleStyle = getComputedStyle(rhythmTitle);
              const optionsStyle = getComputedStyle(options);
              const actionRect = actions.getBoundingClientRect();
              const titleRect = rhythmTitle.getBoundingClientRect();
              const headingRect = heading.getBoundingClientRect();
              const result = {
                width: dialogRect.width,
                height: dialogRect.height,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                surfacePadding: getComputedStyle(surface).padding,
                titleWidth: titleRect.width,
                titleScrollWidth: rhythmTitle.scrollWidth,
                titleOverflowWrap: titleStyle.overflowWrap,
                titleTop: titleRect.top,
                headingTop: headingRect.top,
                optionsOverflowY: optionsStyle.overflowY,
                optionsHeight: options.clientHeight,
                optionsScrollHeight: options.scrollHeight,
                actionsTop: actionRect.top,
                actionsBottom: actionRect.bottom,
                dialogBottom: dialogRect.bottom
              };
              dialog.remove();
              return result;
            });
            assert.equal(peoplePickerStyles.width, peoplePickerStyles.viewportWidth);
            assert.equal(peoplePickerStyles.height, peoplePickerStyles.viewportHeight);
            assert.match(peoplePickerStyles.surfacePadding, /18px/);
            assert.match(peoplePickerStyles.surfacePadding, /12px/);
            assert.equal(peoplePickerStyles.titleOverflowWrap, 'anywhere');
            assert.ok(peoplePickerStyles.titleWidth > 0);
            assert.ok(peoplePickerStyles.titleScrollWidth <= peoplePickerStyles.titleWidth);
            assert.ok(peoplePickerStyles.headingTop > peoplePickerStyles.titleTop);
            assert.equal(peoplePickerStyles.optionsOverflowY, 'auto');
            assert.ok(peoplePickerStyles.optionsHeight > 0);
            assert.ok(peoplePickerStyles.optionsScrollHeight > peoplePickerStyles.optionsHeight,
              `People options must scroll independently at ${viewportWidth}px / ${expected.size}.`);
            assert.ok(peoplePickerStyles.actionsTop > peoplePickerStyles.headingTop);
            assert.ok(peoplePickerStyles.actionsBottom <= peoplePickerStyles.dialogBottom);
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
            await page.getByRole('button', { name: /^Start focused prayer for/ }).focus();
            await page.keyboard.press('Enter');
            const prayerDialog = page.locator('dialog.faith-prayer-session');
            await prayerDialog.waitFor();
            const activePrayerLayout = await prayerDialog.evaluate(dialog => {
              const surface = dialog.querySelector<HTMLElement>('.money-goal-dialog__surface');
              const title = dialog.querySelector<HTMLElement>('.faith-session-heading h1');
              const requestTitle = dialog.querySelector<HTMLElement>('.faith-session-card h2');
              const description = dialog.querySelector<HTMLElement>('.faith-session-card > p');
              const actions = [...dialog.querySelectorAll<HTMLButtonElement>('.faith-session-actions > button')];
              if (!surface || !title || !requestTitle || !description || actions.length !== 3) {
                throw new Error('Focused Prayer is missing the shared dialog surface, title, or actions.');
              }
              requestTitle.textContent = 'Synthetic request title for responsive text wrapping '.repeat(5);
              description.textContent = 'Synthetic prayer description for responsive text wrapping '.repeat(14);
              const badge = dialog.querySelector<HTMLElement>('.faith-session-person .person-badge-visual');
              const track = dialog.querySelector<HTMLElement>('.faith-session-track');
              const progressFill = track?.querySelector<HTMLElement>('span');
              const prayed = dialog.querySelector<HTMLButtonElement>('.faith-session-prayed');
              const secondary = actions[0];
              const dialogRect = dialog.getBoundingClientRect();
              const surfaceRect = surface.getBoundingClientRect();
              return {
                dialogWidth: dialogRect.width,
                dialogHeight: dialogRect.height,
                dialogBorder: getComputedStyle(dialog).borderTopWidth,
                dialogRadius: getComputedStyle(dialog).borderTopLeftRadius,
                dialogFont: getComputedStyle(dialog).fontSize,
                labelledBy: dialog.getAttribute('aria-labelledby'),
                titleId: title.id,
                surfacePadding: getComputedStyle(surface).padding,
                surfaceOverflow: getComputedStyle(surface).overflowY,
                surfaceScrollHeight: surface.scrollHeight,
                surfaceClientHeight: surface.clientHeight,
                titleFontSize: getComputedStyle(title).fontSize,
                requestTitleFontSize: getComputedStyle(requestTitle).fontSize,
                descriptionFontSize: getComputedStyle(description).fontSize,
                textScale: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-text-scale')),
                titleScrollWidth: title.scrollWidth,
                titleClientWidth: title.clientWidth,
                requestTitleScrollWidth: requestTitle.scrollWidth,
                requestTitleClientWidth: requestTitle.clientWidth,
                descriptionScrollWidth: description.scrollWidth,
                descriptionClientWidth: description.clientWidth,
                documentWidth: document.documentElement.scrollWidth,
                eyebrowColor: getComputedStyle(dialog.querySelector('.faith-eyebrow')!).color,
                badgeBorder: badge ? getComputedStyle(badge).borderTopColor : null,
                progressTrack: track ? getComputedStyle(track).backgroundColor : null,
                progressFill: progressFill ? getComputedStyle(progressFill).backgroundColor : null,
                prayedBackground: prayed ? getComputedStyle(prayed).backgroundColor : null,
                secondaryBorder: secondary ? getComputedStyle(secondary).borderTopColor : null,
                secondaryColor: secondary ? getComputedStyle(secondary).color : null,
                progressMax: dialog.querySelector('[role="progressbar"]')?.getAttribute('aria-valuemax'),
                actionHeights: actions.map(button => button.getBoundingClientRect().height),
                actionBounds: actions.map(button => {
                  const rect = button.getBoundingClientRect();
                  return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
                }),
                surfaceBounds: {
                  left: surfaceRect.left,
                  right: surfaceRect.right,
                  top: surfaceRect.top,
                  bottom: surfaceRect.bottom
                },
                requestTitleText: requestTitle.textContent
              };
            });
            assert.equal(activePrayerLayout.dialogWidth, viewportWidth);
            assert.equal(activePrayerLayout.dialogHeight, 844);
            assert.equal(activePrayerLayout.dialogBorder, '0px');
            assert.equal(activePrayerLayout.dialogRadius, '0px');
            assert.equal(activePrayerLayout.labelledBy, 'today-prayer-session-title');
            assert.match(activePrayerLayout.surfacePadding, /18px/);
            assert.equal(activePrayerLayout.surfaceOverflow, 'auto');
            assert.ok(Math.abs(Number.parseFloat(activePrayerLayout.titleFontSize) - 19.2 * activePrayerLayout.textScale) < 0.1);
            assert.ok(Math.abs(Number.parseFloat(activePrayerLayout.requestTitleFontSize) - 19.2 * activePrayerLayout.textScale) < 0.1);
            assert.ok(Math.abs(Number.parseFloat(activePrayerLayout.descriptionFontSize) - 16.512 * activePrayerLayout.textScale) < 0.1);
            assert.ok(activePrayerLayout.titleScrollWidth <= activePrayerLayout.titleClientWidth);
            assert.ok(activePrayerLayout.requestTitleScrollWidth <= activePrayerLayout.requestTitleClientWidth);
            assert.ok(activePrayerLayout.descriptionScrollWidth <= activePrayerLayout.descriptionClientWidth);
            assert.ok(activePrayerLayout.documentWidth <= viewportWidth);
            assert.equal(activePrayerLayout.eyebrowColor, 'rgb(112, 90, 141)');
            assert.equal(activePrayerLayout.badgeBorder, 'rgb(210, 197, 223)');
            assert.equal(activePrayerLayout.progressTrack, 'rgb(240, 234, 245)');
            assert.equal(activePrayerLayout.progressFill, 'rgb(128, 98, 154)');
            assert.equal(activePrayerLayout.prayedBackground, 'rgb(128, 98, 154)');
            assert.equal(activePrayerLayout.secondaryBorder, 'rgb(222, 213, 231)');
            assert.equal(activePrayerLayout.secondaryColor, 'rgb(143, 125, 161)');
            assert.match(activePrayerLayout.progressMax ?? '', /^[1-9]\d*$/);
            assert.ok(activePrayerLayout.actionHeights.every(height => height >= 44));
            assert.ok(activePrayerLayout.actionBounds.every(bounds =>
              bounds.left >= activePrayerLayout.surfaceBounds.left
              && bounds.right <= activePrayerLayout.surfaceBounds.right
            ));
            assert.ok(activePrayerLayout.surfaceScrollHeight > activePrayerLayout.surfaceClientHeight);
            await prayerDialog.locator('.faith-session-prayed').scrollIntoViewIfNeeded();
            const reachableActionBounds = await prayerDialog.evaluate(dialog => {
              const surface = dialog.querySelector<HTMLElement>('.money-goal-dialog__surface');
              if (!surface) throw new Error('Focused Prayer dialog surface is missing.');
              const surfaceBounds = surface.getBoundingClientRect();
              return [...dialog.querySelectorAll<HTMLElement>('.faith-session-actions > button')].map(button => {
                const bounds = button.getBoundingClientRect();
                return bounds.top >= surfaceBounds.top && bounds.bottom <= surfaceBounds.bottom;
              });
            });
            assert.ok(reachableActionBounds.every(Boolean));
            assert.ok(activePrayerLayout.requestTitleText);
            const backButton = prayerDialog.getByRole('button', { name: 'Back' });
            const skipButton = prayerDialog.getByRole('button', { name: 'Skip' });
            const initialProgress = (await prayerDialog.locator('.faith-session-progress').textContent())?.trim();
            const singleRequest = initialProgress === 'Request 1 of 1';
            assert.equal(await backButton.isDisabled(), true);
            assert.equal(await skipButton.isDisabled(), singleRequest);
            const disabledBackPalette = await backButton.evaluate(button => {
              const style = getComputedStyle(button);
              return {
                background: style.backgroundColor,
                border: style.borderTopColor,
                color: style.color
              };
            });
            assert.deepEqual(disabledBackPalette, {
              background: 'rgb(250, 248, 252)',
              border: 'rgb(222, 213, 231)',
              color: 'rgb(143, 125, 161)'
            });
            await backButton.hover();
            assert.equal(await backButton.evaluate(button => getComputedStyle(button).backgroundColor), 'rgb(250, 248, 252)');
            await page.keyboard.press('ArrowLeft');
            assert.equal((await prayerDialog.locator('.faith-session-progress').textContent())?.trim(), initialProgress);

            if (singleRequest) {
              assert.equal(initialProgress, 'Request 1 of 1');
              assert.deepEqual(await skipButton.evaluate(button => {
                const style = getComputedStyle(button);
                return {
                  background: style.backgroundColor,
                  border: style.borderTopColor,
                  color: style.color
                };
              }), disabledBackPalette);
              await skipButton.hover();
              assert.equal(await skipButton.evaluate(button => getComputedStyle(button).backgroundColor), 'rgb(250, 248, 252)');
              const disabledSkipBounds = await skipButton.boundingBox();
              if (!disabledSkipBounds) throw new Error('Cannot measure the disabled Prayer Skip button.');
              await page.touchscreen.tap(
                disabledSkipBounds.x + disabledSkipBounds.width / 2,
                disabledSkipBounds.y + disabledSkipBounds.height / 2
              );
              await page.keyboard.press('ArrowRight');
              assert.equal((await prayerDialog.locator('.faith-session-progress').textContent())?.trim(), initialProgress);

              await prayerDialog.getByRole('button', { name: 'End session' }).focus();
              await page.keyboard.press('Tab');
              const prayedFocus = await prayerDialog.evaluate(() => ({
                name: document.activeElement?.textContent?.trim(),
                focusVisible: document.activeElement instanceof HTMLElement && document.activeElement.matches(':focus-visible'),
                outline: document.activeElement instanceof HTMLElement ? getComputedStyle(document.activeElement).outlineWidth : null
              }));
              assert.equal(prayedFocus.name, 'Prayed');
              assert.equal(prayedFocus.focusVisible, true);
              assert.equal(prayedFocus.outline, '3px');
              await page.keyboard.press('Shift+Tab');
              assert.equal((await prayerDialog.evaluate(() => document.activeElement?.textContent?.trim())), 'End session');
            } else {
              assert.equal(initialProgress, 'Request 1 of 2');
              assert.equal(await skipButton.isDisabled(), false);
              await skipButton.click();
              await prayerDialog.getByText('Request 2 of 2').waitFor();
              assert.equal(await backButton.isDisabled(), false);
              assert.equal(await skipButton.isDisabled(), true);
              assert.deepEqual(await skipButton.evaluate(button => {
                const style = getComputedStyle(button);
                return {
                  background: style.backgroundColor,
                  border: style.borderTopColor,
                  color: style.color
                };
              }), disabledBackPalette);
              await skipButton.hover();
              assert.equal(await skipButton.evaluate(button => getComputedStyle(button).backgroundColor), 'rgb(250, 248, 252)');
              await page.keyboard.press('ArrowRight');
              assert.ok(await prayerDialog.getByText('Request 2 of 2').isVisible());
              await backButton.hover();
              await page.waitForTimeout(180);
              assert.equal(await backButton.evaluate(button => getComputedStyle(button).backgroundColor), 'rgb(230, 220, 238)');
              const backBounds = await backButton.boundingBox();
              if (!backBounds) throw new Error('Cannot measure the active Prayer Back button.');
              await page.mouse.move(backBounds.x + backBounds.width / 2, backBounds.y + backBounds.height / 2);
              await page.mouse.down();
              await page.waitForTimeout(180);
              assert.equal(await backButton.evaluate(button => getComputedStyle(button).backgroundColor), 'rgb(220, 206, 232)');
              await page.mouse.up();

              await prayerDialog.getByText('Request 1 of 2').waitFor();
              assert.equal(await backButton.isDisabled(), true);
              await skipButton.tap();
              await prayerDialog.getByText('Request 2 of 2').waitFor();
              await backButton.tap();
              await prayerDialog.getByText('Request 1 of 2').waitFor();
              await page.keyboard.press('ArrowLeft');
              assert.ok(await prayerDialog.getByText('Request 1 of 2').isVisible());

              await prayerDialog.getByRole('button', { name: 'End session' }).focus();
              await page.keyboard.press('Tab');
              const skipFocus = await prayerDialog.evaluate(() => ({
                name: document.activeElement?.textContent?.trim(),
                focusVisible: document.activeElement instanceof HTMLElement && document.activeElement.matches(':focus-visible'),
                outline: document.activeElement instanceof HTMLElement ? getComputedStyle(document.activeElement).outlineWidth : null
              }));
              assert.equal(skipFocus.name, 'Skip');
              assert.equal(skipFocus.focusVisible, true);
              assert.equal(skipFocus.outline, '3px');
              await page.keyboard.press('Shift+Tab');
              const endFocus = await prayerDialog.evaluate(() => ({
                name: document.activeElement?.textContent?.trim(),
                focusVisible: document.activeElement instanceof HTMLElement && document.activeElement.matches(':focus-visible'),
                outline: document.activeElement instanceof HTMLElement ? getComputedStyle(document.activeElement).outlineWidth : null
              }));
              assert.equal(endFocus.name, 'End session');
              assert.equal(endFocus.focusVisible, true);
              assert.equal(endFocus.outline, '3px');
              await page.keyboard.press('ArrowRight');
              await prayerDialog.getByText('Request 2 of 2').waitFor();
              await prayerDialog.getByRole('button', { name: 'End session' }).focus();
              await page.keyboard.press('Tab');
              const backFocus = await prayerDialog.evaluate(() => ({
                name: document.activeElement?.textContent?.trim(),
                focusVisible: document.activeElement instanceof HTMLElement && document.activeElement.matches(':focus-visible'),
                outline: document.activeElement instanceof HTMLElement ? getComputedStyle(document.activeElement).outlineWidth : null,
                outlineColor: document.activeElement instanceof HTMLElement ? getComputedStyle(document.activeElement).outlineColor : null
              }));
              assert.equal(backFocus.name, 'Back');
              assert.equal(backFocus.focusVisible, true);
              assert.equal(backFocus.outline, '3px');
              assert.equal(backFocus.outlineColor, 'rgb(112, 90, 141)');
              await page.keyboard.press('Tab');
              const prayedFocus = await prayerDialog.evaluate(() => ({
                name: document.activeElement?.textContent?.trim(),
                focusVisible: document.activeElement instanceof HTMLElement && document.activeElement.matches(':focus-visible'),
                outline: document.activeElement instanceof HTMLElement ? getComputedStyle(document.activeElement).outlineWidth : null
              }));
              assert.equal(prayedFocus.name, 'Prayed');
              assert.equal(prayedFocus.focusVisible, true);
              assert.equal(prayedFocus.outline, '3px');
            }

            await prayerDialog.getByRole('button', { name: 'End session' }).click();
            await prayerDialog.getByRole('heading', { name: 'Prayer session ended' }).waitFor();
            const headingFocus = await prayerDialog.evaluate(dialog => {
              const title = dialog.querySelector<HTMLElement>('.faith-session-complete h1');
              if (!title) throw new Error('Prayer completion title is missing.');
              const style = getComputedStyle(title);
              return {
                focused: document.activeElement === title,
                outlineStyle: style.outlineStyle,
                boxShadow: style.boxShadow
              };
            });
            assert.equal(headingFocus.focused, true);
            assert.equal(headingFocus.outlineStyle, 'none');
            assert.equal(headingFocus.boxShadow, 'none');
            await page.keyboard.press('Tab');
            const endedLayout = await prayerDialog.evaluate(dialog => {
              const surface = dialog.querySelector<HTMLElement>('.money-goal-dialog__surface');
              const title = dialog.querySelector<HTMLElement>('.faith-session-complete h1');
              const finish = dialog.querySelector<HTMLButtonElement>('.faith-session-close');
              if (!surface || !title || !finish) throw new Error('Ended Prayer screen is missing its title or Finish action.');
              return {
                border: getComputedStyle(dialog).borderTopWidth,
                titleSize: getComputedStyle(title).fontSize,
                finishHeight: finish.getBoundingClientRect().height,
                finishBottom: finish.getBoundingClientRect().bottom,
                surfaceBottom: surface.getBoundingClientRect().bottom,
                cardBackground: getComputedStyle(dialog.querySelector('.faith-session-complete__card')!).backgroundColor,
                finishBorder: getComputedStyle(finish).borderTopColor,
                finishColor: getComputedStyle(finish).color,
                finishFocused: document.activeElement === finish,
                finishFocusVisible: finish.matches(':focus-visible'),
                finishFocusStyle: getComputedStyle(finish).outlineStyle,
                finishFocusWidth: getComputedStyle(finish).outlineWidth,
                summary: dialog.querySelector('.faith-session-complete p')?.textContent?.trim()
              };
            });
            assert.equal(endedLayout.border, '0px');
            assert.ok(Math.abs(Number.parseFloat(endedLayout.titleSize) - 19.2 * activePrayerLayout.textScale) < 0.1);
            assert.ok(endedLayout.finishHeight >= 44);
            assert.ok(endedLayout.finishBottom <= endedLayout.surfaceBottom);
            assert.equal(endedLayout.cardBackground, 'rgb(255, 255, 255)');
            assert.equal(endedLayout.finishBorder, 'rgb(210, 197, 223)');
            assert.equal(endedLayout.finishColor, 'rgb(112, 90, 141)');
            assert.equal(endedLayout.finishFocused, true);
            assert.equal(endedLayout.finishFocusVisible, true);
            assert.equal(endedLayout.finishFocusStyle, 'solid');
            assert.equal(endedLayout.finishFocusWidth, '3px');
            assert.equal(endedLayout.summary, 'You marked 0 requests prayed.');
            await prayerDialog.getByRole('button', { name: 'Finish' }).click();
            await prayerDialog.waitFor({ state: 'detached' });
            assert.equal(await page.evaluate(() => (
              document.activeElement instanceof HTMLElement
              && document.activeElement.matches('[data-prayer-session-start]')
            )), true);
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
                    boxSizing: 'border-box',
                    opacity: '0',
                    pointerEvents: 'none',
                    zIndex: '-1'
                  });
                  surface.replaceChildren();
                  const controls = document.createElement('div');
                  controls.className = 'today-plan__controls';
                  const tabs = document.createElement('div');
                  tabs.className = 'faith-practice-tabs home-plan-type-tabs browser-test-timeframe-tabs';
                  tabs.setAttribute('role', 'tablist');
                  for (const label of ['Now', 'Flexible', 'All today']) {
                    const tab = document.createElement('button');
                    tab.type = 'button';
                    tab.textContent = label;
                    tabs.append(tab);
                  }
                  controls.append(tabs);
                  const groupsContainer = document.createElement('div');
                  const isAllToday = targetView === 'All today';
                  groupsContainer.className = isAllToday
                    ? 'today-plan__accordion-groups today-plan__agenda-rail today-plan__agenda-rail--all-today'
                    : 'today-plan__agenda-rail today-plan__agenda-rail--flexible';
                  surface.append(controls, groupsContainer);
                  const groupFixtures = [
                    ['Anytime', 'On your schedule'],
                    ['All-day', 'Throughout the day']
                  ] as const;
                  const makeRhythmCard = () => {
                    const card = document.createElement('article');
                    card.className = 'today-rhythm-details-dialog today-rhythm-details-dialog--inline browser-test-rhythm-card';
                    card.style.height = '80px';
                    const cardSurface = document.createElement('div');
                    cardSurface.className = 'today-rhythm-details__surface';
                    const cardHeader = document.createElement('header');
                    cardHeader.className = 'today-rhythm-details__header';
                    const titleGroup = document.createElement('div');
                    titleGroup.className = 'today-rhythm-details__title-group';
                    const titleCopy = document.createElement('div');
                    titleCopy.className = 'today-rhythm-details__title-copy';
                    const titleScoreRow = document.createElement('div');
                    titleScoreRow.className = 'today-rhythm-details__title-score-row';
                    const rhythmTitle = document.createElement('h3');
                    rhythmTitle.textContent = 'Take a walk';
                    titleScoreRow.append(rhythmTitle);
                    titleCopy.append(titleScoreRow);
                    titleGroup.append(titleCopy);
                    cardHeader.append(titleGroup);
                    cardSurface.append(cardHeader);
                    card.append(cardSurface);
                    return card;
                  };
                  for (const [index, [titleText, rangeText]] of groupFixtures.entries()) {
                    const group = document.createElement('section');
                    const expanded = !isAllToday || index === 0;
                    group.className = `today-plan__agenda-group${isAllToday ? ' today-plan__accordion-group' : ' today-plan__flexible-group'} today-plan__agenda-group--${expanded ? 'expanded' : 'collapsed'}`;
                    const header = document.createElement('h4');
                    header.className = `today-timeframe-header today-timeframe-header--${expanded ? 'expanded' : 'collapsed'}`;
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
                      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                      marker.classList.add('today-plan__agenda-marker', `today-plan__agenda-marker--${expanded ? 'expanded' : 'collapsed'}`);
                      marker.setAttribute('viewBox', '0 0 20 20');
                      marker.setAttribute('aria-hidden', 'true');
                      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                      circle.setAttribute('cx', '10');
                      circle.setAttribute('cy', '10');
                      circle.setAttribute('r', '9');
                      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                      path.setAttribute('d', expanded ? 'M6 10h8' : 'M6 10h8M10 6v8');
                      marker.append(circle, path);
                      disclosure.append(marker, content);
                      header.append(disclosure);
                      accordionPanel = document.createElement('div');
                      accordionPanel.id = panelId;
                      accordionPanel.className = 'today-plan__accordion-panel';
                      accordionPanel.setAttribute('role', 'region');
                      accordionPanel.setAttribute('aria-labelledby', disclosureId);
                      if (index !== 0) accordionPanel.hidden = true;
                      const panelContent = document.createElement('div');
                      panelContent.className = 'today-plan__accordion-panel-content current-plan-item-group';
                      panelContent.append(makeRhythmCard());
                      accordionPanel.append(panelContent);
                    } else {
                      header.append(content);
                    }
                    const rhythmGroup = accordionPanel ?? document.createElement('div');
                    rhythmGroup.classList.add('current-plan-item-group');
                    if (!isAllToday) rhythmGroup.append(makeRhythmCard());
                    group.append(header, rhythmGroup);
                    groupsContainer.append(group);
                  }
                }, viewName);
              }
              const snapshot = await page.evaluate(targetView => {
                const liveSurface = document.querySelector<HTMLElement>('.today-plan-section');
                const liveRail = liveSurface?.querySelector<HTMLElement>('.today-plan__agenda-rail');
                const liveRailRect = liveRail?.getBoundingClientRect();
                const liveRailStyle = liveRail ? getComputedStyle(liveRail, '::before') : null;
                const liveGroups = liveRail
                  ? [...liveRail.children].filter((child): child is HTMLElement =>
                    child instanceof HTMLElement && child.classList.contains('today-plan__agenda-group')
                  )
                  : [];
                const liveHeaders = liveGroups.map(group =>
                  group.querySelector<HTMLElement>('.today-timeframe-header')
                ).filter((item): item is HTMLElement => Boolean(item));
                const liveRailTop = liveRailRect && liveRailStyle
                  ? liveRailRect.top + Number.parseFloat(liveRailStyle.top)
                  : null;
                const liveFirstDotCenter = liveHeaders[0]
                  ? liveHeaders[0].getBoundingClientRect().top + liveHeaders[0].getBoundingClientRect().height / 2
                  : null;
                const liveLastDotCenter = liveHeaders.at(-1)
                  ? liveHeaders.at(-1)!.getBoundingClientRect().top + liveHeaders.at(-1)!.getBoundingClientRect().height / 2
                  : null;
                const surface = targetView === 'Now'
                  ? document.querySelector<HTMLElement>('.today-plan-section')
                  : document.querySelector<HTMLElement>('#timeframe-browser-fixture');
                const nowGroup = targetView === 'Now'
                  ? surface?.querySelector<HTMLElement>('.today-plan__agenda-group')
                  : null;
                if (
                  targetView === 'Now'
                  && nowGroup
                  && !nowGroup.querySelector('.today-rhythm-details-dialog--inline .today-rhythm-details__header h3')
                ) {
                  nowGroup.querySelector('.today-plan__empty-rhythms')?.remove();
                  const card = document.createElement('article');
                  card.className = 'today-rhythm-details-dialog today-rhythm-details-dialog--inline browser-test-rhythm-card';
                  const cardHeader = document.createElement('header');
                  cardHeader.className = 'today-rhythm-details__header';
                  const titleGroup = document.createElement('div');
                  titleGroup.className = 'today-rhythm-details__title-group';
                  const rhythmTitle = document.createElement('h3');
                  rhythmTitle.textContent = 'Take a walk';
                  titleGroup.append(rhythmTitle);
                  cardHeader.append(titleGroup);
                  card.append(cardHeader);
                  let itemGroup = nowGroup.querySelector<HTMLElement>('.current-plan-item-group');
                  if (!itemGroup) {
                    itemGroup = document.createElement('div');
                    itemGroup.className = 'current-plan-item-group';
                    nowGroup.append(itemGroup);
                  }
                  itemGroup.append(card);
                }
                const header = surface?.querySelector<HTMLElement>('.today-plan__agenda-group .today-timeframe-header')
                ?? surface?.querySelector<HTMLElement>('.today-timeframe-header');
                const title = header?.querySelector<HTMLElement>('.today-plan__view-heading');
                const range = header?.querySelector<HTMLElement>('.today-timeframe-header__range');
                const meta = header?.querySelector<HTMLElement>('.today-timeframe-header__meta');
                const progress = header?.querySelector<HTMLElement>('.today-timeframe-header__progress');
                const disclosure = header?.querySelector<HTMLButtonElement>('.today-timeframe-header__disclosure');
                const agendaRail = surface?.querySelector<HTMLElement>('.today-plan__agenda-rail');
                const railLineStyle = agendaRail ? getComputedStyle(agendaRail, '::before') : null;
                const tabs = surface?.querySelector<HTMLElement>('.home-plan-type-tabs');
                const headerRect = header?.getBoundingClientRect();
                const tabsRect = tabs?.getBoundingClientRect();
                const agendaRailRect = agendaRail?.getBoundingClientRect();
                const headerDotStyle = header ? getComputedStyle(header, '::before') : null;
                const marker = header?.querySelector<SVGSVGElement>('.today-plan__agenda-marker');
                const markerCircle = marker?.querySelector('circle');
                const markerPath = marker?.querySelector('path');
                const markerCircleStyle = markerCircle ? getComputedStyle(markerCircle) : null;
                const markerPathStyle = markerPath ? getComputedStyle(markerPath) : null;
                const markerRect = marker?.getBoundingClientRect();
                const disclosureRect = disclosure?.getBoundingClientRect();
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
                const content = header.querySelector<HTMLElement>('.today-timeframe-header__content');
                const contentStyle = content ? getComputedStyle(content) : null;
                const titleRect = title.getBoundingClientRect();
                const rangeRect = range.getBoundingClientRect();
                const progressRect = progress.getBoundingClientRect();
                const metaRect = meta.getBoundingClientRect();
                const groupSelector = targetView === 'Flexible'
                  ? '.today-plan__flexible-group'
                  : '.today-plan__accordion-group';
                const groups = [...(surface?.querySelectorAll<HTMLElement>(groupSelector) ?? [])];
                const results = document.querySelector<HTMLElement>('.today-plan__results');
                const nextHeader = groups[1]?.querySelector<HTMLElement>('.today-timeframe-header');
                const nextTitle = nextHeader?.querySelector<HTMLElement>('.today-plan__view-heading');
                const nextRange = nextHeader?.querySelector<HTMLElement>('.today-timeframe-header__range');
                const nextPanel = groups[0]?.querySelector<HTMLElement>('.today-plan__accordion-panel-content');
                const rhythmCard = nextPanel?.querySelector<HTMLElement>('.browser-test-rhythm-card');
                const firstGroupHeader = groups[0]?.querySelector<HTMLElement>('.today-timeframe-header');
                const collapsedGroup = groups[1];
                const collapsedHeader = collapsedGroup?.querySelector<HTMLElement>('.today-timeframe-header');
                const collapsedTitle = collapsedHeader?.querySelector<HTMLElement>('.today-plan__view-heading');
                const collapsedRange = collapsedHeader?.querySelector<HTMLElement>('.today-timeframe-header__range');
                const collapsedPanel = collapsedGroup?.querySelector<HTMLElement>('.today-plan__accordion-panel');
                const collapsedPanelWasHidden = collapsedPanel?.hidden ?? false;
                if (collapsedPanel) collapsedPanel.hidden = false;
                const collapsedCardTitle = collapsedGroup?.querySelector<HTMLElement>('.today-rhythm-details-dialog--inline .today-rhythm-details__header h3');
                const collapsedCard = collapsedCardTitle?.closest<HTMLElement>('.today-rhythm-details-dialog--inline');
                const collapsedTitleRect = collapsedTitle?.getBoundingClientRect();
                const collapsedRangeRect = collapsedRange?.getBoundingClientRect();
                const collapsedTitleStyle = collapsedTitle ? getComputedStyle(collapsedTitle) : null;
                const collapsedRangeStyle = collapsedRange ? getComputedStyle(collapsedRange) : null;
                const collapsedCardTitleRect = collapsedCardTitle?.getBoundingClientRect();
                const collapsedCardRect = collapsedCard?.getBoundingClientRect();
                if (collapsedPanel) collapsedPanel.hidden = collapsedPanelWasHidden;
                const cardTitle = targetView === 'Now'
                  ? surface?.querySelector<HTMLElement>('.today-plan__agenda-group .today-rhythm-details-dialog--inline .today-rhythm-details__header h3')
                  : groups[0]?.querySelector<HTMLElement>('.today-rhythm-details-dialog--inline .today-rhythm-details__header h3');
                const nextTitleRect = nextTitle?.getBoundingClientRect();
                const nextRangeRect = nextRange?.getBoundingClientRect();
                const cardTitleRect = cardTitle?.getBoundingClientRect();
                const card = cardTitle?.closest<HTMLElement>('.today-rhythm-details-dialog--inline');
                const cardRect = card?.getBoundingClientRect();
                const actualControls = document.querySelector<HTMLElement>('.today-plan__controls');
                const actualFirstHeader = results?.querySelector<HTMLElement>('.today-timeframe-header');
                return {
                  headerBackground: getComputedStyle(header).backgroundColor,
                  headerRadius: getComputedStyle(header).borderRadius,
                  headerDotColor: markerCircleStyle?.fill ?? getComputedStyle(header, '::before').backgroundColor,
                  railLineWidth: agendaRail ? getComputedStyle(agendaRail, '::before').width : null,
                  railLineCenter: agendaRailRect && agendaRail
                    ? agendaRailRect.left + Number.parseFloat(getComputedStyle(agendaRail, '::before').left)
                    : null,
                  tabBarLeft: tabsRect?.left ?? null,
                  agendaContentInset: agendaRail ? Number.parseFloat(getComputedStyle(agendaRail).paddingInlineStart) : null,
                  headerLeft: headerRect?.left ?? null,
                  headerDotCenter: markerRect
                    ? markerRect.left + markerRect.width / 2
                    : headerRect && agendaRail && headerDotStyle
                      ? headerRect.left
                        + Number.parseFloat(headerDotStyle.left)
                        + Number.parseFloat(headerDotStyle.width) / 2
                      : null,
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
                  marker: Boolean(marker),
                  togglePath: markerPath?.getAttribute('d') ?? null,
                  toggleWidth: markerRect?.width ?? null,
                  toggleHeight: markerRect?.height ?? null,
                  toggleFill: markerCircleStyle?.fill ?? null,
                  toggleStroke: markerPathStyle?.stroke ?? null,
                  railLineColor: railLineStyle?.backgroundColor ?? null,
                  toggleStrokeWidth: markerPathStyle?.strokeWidth ?? null,
                  titleColor: titleStyle.color,
                  disclosureHeight: disclosure?.getBoundingClientRect().height ?? null,
                  disclosureLeft: disclosureRect?.left ?? null,
                  disclosureRight: disclosureRect?.right ?? null,
                  markerLeft: markerRect?.left ?? null,
                  markerRight: markerRect?.right ?? null,
                  expanded: disclosure?.getAttribute('aria-expanded') ?? null,
                  panelId: disclosure?.getAttribute('aria-controls') ?? null,
                  groupDivider: groups[1] ? getComputedStyle(groups[1]).borderTopWidth : null,
                  groupPaddingTop: groups[1] ? getComputedStyle(groups[1]).paddingTop : null,
                  expandedCardGap: nextHeader && rhythmCard
                    ? nextHeader.getBoundingClientRect().top - rhythmCard.getBoundingClientRect().bottom
                    : null,
                  expandedHeaderCardGap: firstGroupHeader && rhythmCard
                    ? rhythmCard.getBoundingClientRect().top - firstGroupHeader.getBoundingClientRect().bottom
                    : null,
                  expandedRangeBelowTitle: rangeRect && titleRect
                    ? rangeRect.top >= titleRect.bottom - 1
                    : null,
                  titleTextInset: contentStyle ? Number.parseFloat(contentStyle.paddingInlineStart) + Number.parseFloat(titleStyle.paddingInlineStart) : null,
                  rangeTextInset: contentStyle ? Number.parseFloat(contentStyle.paddingInlineStart) + Number.parseFloat(rangeStyle.paddingInlineStart) : null,
                  cardTitleLeft: cardTitleRect?.left ?? null,
                  cardLeft: cardRect?.left ?? null,
                  headerToCardGap: headerRect && cardRect
                    ? cardRect.top - headerRect.bottom
                    : null,
                  headerTitleTextLeft: titleRect.left + Number.parseFloat(titleStyle.paddingInlineStart),
                  headerRangeTextLeft: rangeRect.left + Number.parseFloat(rangeStyle.paddingInlineStart),
                  cardContentPadding: card
                    ? Number.parseFloat(getComputedStyle(card).getPropertyValue('--rhythm-details-horizontal-padding'))
                    : null,
                  cardTextInset: cardRect && cardTitleRect ? cardTitleRect.left - cardRect.left : null,
                  collapsedTitleTextLeft: collapsedTitleRect && collapsedTitleStyle
                    ? collapsedTitleRect.left + Number.parseFloat(collapsedTitleStyle.paddingInlineStart)
                    : null,
                  collapsedCardTitleLeft: collapsedCardTitleRect?.left ?? null,
                  collapsedRangeTextLeft: collapsedRangeRect && collapsedRangeStyle
                    ? collapsedRangeRect.left + Number.parseFloat(collapsedRangeStyle.paddingInlineStart)
                    : null,
                  collapsedCardTextInset: collapsedCardRect && collapsedCardTitleRect
                    ? collapsedCardTitleRect.left - collapsedCardRect.left
                    : null,
                  collapsedRangeBelowTitle: collapsedRangeRect && collapsedTitleRect
                    ? collapsedRangeRect.top >= collapsedTitleRect.bottom - 1
                    : null,
                  collapsedTitleRangeSameLine: nextTitleRect && nextRangeRect
                    ? Math.abs((nextTitleRect.top + nextTitleRect.bottom) / 2 - (nextRangeRect.top + nextRangeRect.bottom) / 2) < 2
                    : null,
                  resultsPaddingTop: results ? getComputedStyle(results).paddingTop : null,
                  actualControlToHeader: actualControls && actualFirstHeader
                    ? actualFirstHeader.getBoundingClientRect().top - actualControls.getBoundingClientRect().bottom
                    : null,
                  documentWidth: document.documentElement.scrollWidth,
                  viewportWidth: window.innerWidth,
                  scale: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-text-scale')),
                  liveGroupCount: liveGroups.length,
                  liveRailDisplay: liveRailStyle?.display ?? null,
                  liveRailVisible: Boolean(liveRail && liveRailStyle
                    && liveRailStyle.display !== 'none'
                    && Number.parseFloat(liveRailStyle.height) > 0),
                  liveRailLeft: liveRailRect && liveRail ? liveRailRect.left + Number.parseFloat(getComputedStyle(liveRail, '::before').left) : null,
                  liveRailTop,
                  liveRailHeight: liveRailStyle ? Number.parseFloat(liveRailStyle.height) : null,
                  liveFirstDotCenter,
                  liveLastDotCenter
                };
              }, viewName);
              const expectedTitleSize = 20 * snapshot.scale * 0.65;
              const expectedRangeSize = 20 * snapshot.scale * 0.6;
              const expectedProgressSize = 20 * snapshot.scale * 0.6;
              assert.equal(snapshot.headerBackground, 'rgb(242, 243, 242)', `${viewName} ${viewportWidth}px ${textSize}`);
              assert.equal(snapshot.headerRadius, '10px', `${viewName} ${viewportWidth}px ${textSize}`);
              assert.notEqual(snapshot.tabBarLeft, null);
              if (viewName === 'Now') {
                assert.equal(snapshot.railLineWidth, null);
                assert.equal(snapshot.agendaContentInset, null);
                assert.equal(snapshot.headerDotCenter, null);
                assert.equal(snapshot.marker, false);
                assert.equal(snapshot.liveRailVisible, false);
                assert.ok(Math.abs((snapshot.headerLeft ?? 0) - (snapshot.cardLeft ?? 0)) < 1,
                  `Now must not retain an agenda rail gutter at ${viewportWidth}px / ${textSize}.`);
              } else {
                assert.equal(snapshot.railLineWidth, '1px');
                assert.ok(
                  Math.abs((snapshot.railLineCenter ?? 0) - (snapshot.tabBarLeft ?? 0) - (viewName === 'All today' ? 4 : 0)) < 0.5
                );
                assert.equal(snapshot.agendaContentInset, 20);
                assert.equal(snapshot.headerLeft, (snapshot.tabBarLeft ?? 0) + 20);
                assert.ok(Math.abs((snapshot.headerDotCenter ?? 0) - (snapshot.railLineCenter ?? 0)) < 0.5);
              }
              if (viewName === 'Flexible') {
                assert.equal(snapshot.marker, false);
                assert.equal(snapshot.headerDotColor, 'rgb(36, 107, 82)');
              }
              assert.ok(Math.abs(snapshot.titleSize - expectedTitleSize) < 0.1);
              assert.equal(snapshot.titleWeight, '600');
              assert.ok(Math.abs(snapshot.rangeSize - expectedRangeSize) < 0.1);
              assert.ok(Math.abs(snapshot.progressSize - expectedProgressSize) < 0.1);
              assert.equal(snapshot.progressBackground, 'rgb(241, 242, 242)');
              assert.equal(snapshot.progressRadius, '999px');
              assert.match(snapshot.progressText ?? '', /^\d+ of \d+$/);
              assert.ok(snapshot.progressRightGap >= 0 && snapshot.progressRightGap < 40);
              assert.ok(snapshot.titleRight <= snapshot.progressLeft);
              assert.equal(snapshot.titleTextInset, snapshot.cardTextInset);
              assert.equal(snapshot.rangeTextInset, snapshot.cardTextInset);
              assert.ok(
                Math.abs((snapshot.headerTitleTextLeft ?? 0) - (snapshot.cardTitleLeft ?? 0)) < 0.5,
                `${viewName} ${viewportWidth}px ${textSize}: header title at ${snapshot.headerTitleTextLeft}px, Rhythm title at ${snapshot.cardTitleLeft}px`
              );
              if (snapshot.expandedRangeBelowTitle === true) {
                assert.ok(
                  Math.abs((snapshot.headerRangeTextLeft ?? 0) - (snapshot.cardTitleLeft ?? 0)) < 0.5,
                  `${viewName} ${viewportWidth}px ${textSize}: header range at ${snapshot.headerRangeTextLeft}px, Rhythm title at ${snapshot.cardTitleLeft}px`
                );
              }
              assert.equal(snapshot.resultsPaddingTop, '28px');
              assert.equal(snapshot.documentWidth, snapshot.viewportWidth, `${viewName} ${viewportWidth}px ${textSize}`);
              if (viewName !== 'All today') {
                assert.equal(
                  snapshot.headerToCardGap,
                  12,
                  `${viewName} ${viewportWidth}px ${textSize}: timeframe header to first Rhythm card gap`
                );
              }
              assert.equal(snapshot.liveRailVisible, snapshot.liveGroupCount > 1);
              if (snapshot.liveGroupCount > 1) {
                assert.ok(Math.abs((snapshot.liveRailTop ?? 0) - (snapshot.liveFirstDotCenter ?? 0)) < 0.5);
                assert.ok(Math.abs(
                  (snapshot.liveRailTop ?? 0) + (snapshot.liveRailHeight ?? 0) - (snapshot.liveLastDotCenter ?? 0)
                ) < 0.5);
              }
              assert.equal(snapshot.disclosure, viewName === 'All today');
              assert.equal(snapshot.marker, viewName === 'All today');
              if (viewName === 'All today') {
                assert.equal(snapshot.togglePath, 'M6 10h8');
                assert.ok((snapshot.disclosureHeight ?? 0) >= 44);
                assert.equal(snapshot.toggleWidth, 20);
                assert.equal(snapshot.toggleHeight, 20);
                assert.equal(snapshot.toggleFill, 'rgb(36, 107, 82)');
                assert.equal(snapshot.toggleStroke, 'rgb(255, 255, 255)');
                assert.equal(snapshot.toggleStrokeWidth, '1.6px');
                assert.equal(snapshot.railLineColor, 'rgb(220, 228, 222)');
                assert.ok((snapshot.disclosureLeft ?? Infinity) <= (snapshot.markerLeft ?? -Infinity));
                assert.ok((snapshot.disclosureRight ?? -Infinity) >= (snapshot.markerRight ?? Infinity));
                assert.ok(Math.abs((snapshot.progressRightGap ?? 0)) < 0.5);
              }
              if (viewName === 'Now') assert.equal(snapshot.actualControlToHeader, 28);
              if (viewName === 'Flexible') assert.equal(snapshot.groupDivider, '0px');
              if (viewName !== 'Now') assert.equal(snapshot.groupPaddingTop, '24px');
              if (viewName === 'All today') {
                assert.ok(snapshot.panelId);
                assert.ok(snapshot.expanded === 'true' || snapshot.expanded === 'false');
                assert.equal(snapshot.groupDivider, '0px');
                assert.equal(snapshot.expandedCardGap, 24);
                assert.equal(snapshot.expandedHeaderCardGap, 12);
                assert.equal(snapshot.expandedRangeBelowTitle, true);
                assert.equal(snapshot.collapsedTitleRangeSameLine, true);
                assert.equal(snapshot.collapsedTitleTextLeft, snapshot.collapsedCardTitleLeft);
                if (snapshot.collapsedRangeBelowTitle === true) {
                  assert.equal(snapshot.collapsedRangeTextLeft, snapshot.collapsedCardTitleLeft);
                }
              }

              if (viewName === 'All today') {
                const actualGroups = page.locator(
                  '.today-plan-section .today-plan__results .today-plan__agenda-rail--all-today > .today-plan__agenda-group'
                );
                const actualGroupCount = await actualGroups.count();
                if (actualGroupCount > 1) {
                const finalDisclosure = page.locator(
                  '.today-plan-section .today-plan__results .today-plan__agenda-rail--all-today > .today-plan__agenda-group:last-child .today-timeframe-header__disclosure'
                );
                const finalMarker = finalDisclosure.locator('.today-plan__agenda-marker');
                const originalExpanded = await finalDisclosure.getAttribute('aria-expanded');
                if (originalExpanded !== 'true' && originalExpanded !== 'false') {
                  throw new Error('Cannot read the live All today group state.');
                }
                  const assertActualRailEndpoints = async () => {
                    const endpoints = await page.evaluate(() => {
                      const rail = document.querySelector<HTMLElement>(
                        '.today-plan-section .today-plan__agenda-rail--all-today'
                      );
                      if (!rail) throw new Error('Cannot find live All today agenda rail.');
                      const groups = [...rail.children].filter((child): child is HTMLElement =>
                        child instanceof HTMLElement && child.classList.contains('today-plan__agenda-group')
                      );
                      const headers = groups.map(group => group.querySelector<HTMLElement>('.today-timeframe-header'))
                        .filter((header): header is HTMLElement => Boolean(header));
                      const railStyle = getComputedStyle(rail, '::before');
                      const railRect = rail.getBoundingClientRect();
                      const first = headers[0]!.getBoundingClientRect();
                      const last = headers.at(-1)!.getBoundingClientRect();
                      return {
                        lineVisible: railStyle.display !== 'none',
                        lineTop: railRect.top + Number.parseFloat(railStyle.top),
                        lineBottom: railRect.top + Number.parseFloat(railStyle.top) + Number.parseFloat(railStyle.height),
                        firstDot: first.top + first.height / 2,
                        lastDot: last.top + last.height / 2
                      };
                    });
                    assert.equal(endpoints.lineVisible, true);
                    assert.ok(Math.abs(endpoints.lineTop - endpoints.firstDot) < 0.5);
                    assert.ok(Math.abs(endpoints.lineBottom - endpoints.lastDot) < 0.5);
                  };

                  await finalMarker.click();
                  assert.equal(
                    await finalDisclosure.getAttribute('aria-expanded'),
                    originalExpanded === 'true' ? 'false' : 'true',
                    'A mouse click on the visible circle should toggle exactly once.'
                  );
                  await assertActualRailEndpoints();
                  const markerBounds = await finalMarker.boundingBox();
                  if (!markerBounds) throw new Error('Cannot measure the live All today circle touch target.');
                  await page.touchscreen.tap(
                    markerBounds.x + markerBounds.width / 2,
                    markerBounds.y + markerBounds.height / 2
                  );
                  assert.equal(
                    await finalDisclosure.getAttribute('aria-expanded'),
                    originalExpanded,
                    'A touch on the visible circle should toggle exactly once.'
                  );
                  await assertActualRailEndpoints();
                  await finalDisclosure.focus();
                  await page.keyboard.press('Space');
                  assert.equal(
                    await finalDisclosure.getAttribute('aria-expanded'),
                    originalExpanded === 'true' ? 'false' : 'true',
                    'Keyboard activation should toggle exactly once.'
                  );
                  await page.keyboard.press('Space');
                  assert.equal(await finalDisclosure.getAttribute('aria-expanded'), originalExpanded);
                  await assertActualRailEndpoints();
                }

                await page.keyboard.press('Tab');
                const focusResult = await page.evaluate(() => {
                  const disclosure = document.querySelector<HTMLElement>(
                    '#timeframe-browser-fixture .today-timeframe-header__disclosure'
                  );
                  if (!disclosure) throw new Error('Cannot focus the timeframe disclosure.');
                  disclosure.focus();
                  const style = getComputedStyle(disclosure);
                  return {
                    focusedVisible: disclosure.matches(':focus-visible'),
                    outlineStyle: style.outlineStyle,
                    outlineWidth: style.outlineWidth
                  };
                });
                assert.equal(focusResult.focusedVisible, true);
                assert.equal(focusResult.outlineStyle, 'solid');
                assert.equal(focusResult.outlineWidth, '3px');

                const collapsedResult = await page.evaluate(() => {
                  const groups = [...document.querySelectorAll<HTMLElement>('#timeframe-browser-fixture .today-plan__accordion-group')];
                  const groupsContainer = document.querySelector<HTMLElement>(
                    '#timeframe-browser-fixture .today-plan__agenda-rail'
                  );
                  const firstGroup = groups[0];
                  const firstHeader = firstGroup?.querySelector<HTMLElement>('.today-timeframe-header');
                  const firstDisclosure = firstGroup?.querySelector<HTMLButtonElement>('.today-timeframe-header__disclosure');
                  const firstPanel = firstGroup?.querySelector<HTMLElement>('.today-plan__accordion-panel');
                  if (!groupsContainer || !firstGroup || !firstHeader || !firstDisclosure || !firstPanel) {
                    throw new Error('Cannot check collapsed timeframe group spacing.');
                  }
                  firstGroup.classList.add('today-plan__accordion-group--collapsed');
                  firstGroup.classList.remove('today-plan__agenda-group--expanded');
                  firstGroup.classList.add('today-plan__agenda-group--collapsed');
                  firstHeader.classList.add('today-timeframe-header--collapsed');
                  firstHeader.classList.remove('today-timeframe-header--expanded');
                  const marker = firstHeader.querySelector<SVGSVGElement>('.today-plan__agenda-marker');
                  const markerPath = marker?.querySelector('path');
                  marker?.classList.remove('today-plan__agenda-marker--expanded');
                  marker?.classList.add('today-plan__agenda-marker--collapsed');
                  markerPath?.setAttribute('d', 'M6 10h8M10 6v8');
                  firstDisclosure.setAttribute('aria-expanded', 'false');
                  firstPanel.hidden = true;
                  const markerRect = marker?.getBoundingClientRect();
                  return {
                    divider: getComputedStyle(groups[1]!).borderTopWidth,
                    paddingTop: getComputedStyle(groups[1]!).paddingTop,
                    dotColor: marker?.querySelector('circle') ? getComputedStyle(marker.querySelector('circle')!).fill : null,
                    symbolColor: marker?.querySelector('path') ? getComputedStyle(marker.querySelector('path')!).stroke : null,
                    railColor: getComputedStyle(groupsContainer, '::before').backgroundColor,
                    iconPath: markerPath?.getAttribute('d'),
                    dotCenter: markerRect ? markerRect.left + markerRect.width / 2 : null,
                    lineCenter: groupsContainer.getBoundingClientRect().left
                      + Number.parseFloat(getComputedStyle(groupsContainer, '::before').left),
                    headerContentInset: getComputedStyle(groupsContainer).paddingInlineStart,
                    toggleRect: markerRect?.toJSON()
                  };
                });
                assert.equal(collapsedResult.divider, '0px');
                assert.equal(collapsedResult.paddingTop, '12px');
                assert.equal(collapsedResult.dotColor, 'rgb(36, 107, 82)');
                assert.equal(collapsedResult.symbolColor, 'rgb(255, 255, 255)');
                assert.equal(collapsedResult.railColor, 'rgb(220, 228, 222)');
                assert.equal(collapsedResult.iconPath, 'M6 10h8M10 6v8');
                assert.ok(collapsedResult.dotCenter !== null
                  && Math.abs(collapsedResult.dotCenter - collapsedResult.lineCenter) < 0.5);
                assert.ok(Math.abs(collapsedResult.lineCenter - ((snapshot.tabBarLeft ?? 0) + 4)) < 0.5);
                assert.equal(collapsedResult.headerContentInset, '20px');
                assert.equal(collapsedResult.toggleRect.width, 20);
                assert.equal(collapsedResult.toggleRect.height, 20);

                const stressResult = await page.evaluate(() => {
                  const header = document.querySelector<HTMLElement>('#timeframe-browser-fixture .today-timeframe-header--collapsed');
                  const title = header?.querySelector<HTMLElement>('.today-plan__view-heading');
                  const progress = header?.querySelector<HTMLElement>('.today-timeframe-header__progress');
                  if (!header || !title || !progress) throw new Error('Cannot stress-test a missing timeframe title or progress pill.');
                  const originalTitle = title.textContent;
                  const originalProgress = progress.textContent;
                  const range = header.querySelector<HTMLElement>('.today-timeframe-header__range');
                  const originalRange = range?.textContent;
                  title.textContent = 'A deliberately long custom timeframe name for responsive layout verification';
                  progress.textContent = '123 of 123';
                  if (range) range.textContent = 'A deliberately long schedule subtitle with extended hours for responsive layout verification';
                  const titleRect = title.getBoundingClientRect();
                  const rangeRect = range?.getBoundingClientRect();
                  const headerRect = header.getBoundingClientRect();
                  const result = {
                    documentWidth: document.documentElement.scrollWidth,
                    viewportWidth: window.innerWidth,
                    titleWidth: titleRect.width,
                    rangeBelowTitle: rangeRect ? rangeRect.top >= titleRect.bottom - 1 : false,
                    rangeWithinHeader: rangeRect ? rangeRect.right <= headerRect.right - 10 : false
                  };
                  title.textContent = originalTitle;
                  progress.textContent = originalProgress;
                  if (range && originalRange) range.textContent = originalRange;
                  return result;
                });
                assert.equal(stressResult.documentWidth, stressResult.viewportWidth);
                assert.ok(stressResult.titleWidth > 0);
                assert.equal(stressResult.rangeBelowTitle, true);
                assert.equal(stressResult.rangeWithinHeader, true);
              }
            }
          }
        }

        await page.setViewportSize({ width: 1280, height: 900 });
        await page.getByRole('tab', { name: 'Now', exact: true }).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1280);

        await page.setViewportSize({ width: 375, height: 844 });
        await page.getByRole('button', { name: 'More, settings' }).click();
        await page.getByRole('button', { name: /^Settings/ }).click();
        await page.getByRole('heading', { name: 'Categories' }).waitFor();
        const categorySizeToggle = page.locator('.mobile-display-toggle');
        for (const textSize of ['small', 'medium', 'large'] as const) {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            if (await categorySizeToggle.getAttribute('data-text-size') === textSize) break;
            await categorySizeToggle.click();
          }
          assert.equal(await categorySizeToggle.getAttribute('data-text-size'), textSize);
          for (const viewportWidth of [375, 390, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 844 });
            const categorySettingsLayout = await page.evaluate(() => {
              const settings = document.querySelector<HTMLElement>('.category-settings');
              const settingsSection = settings?.closest<HTMLElement>('.settings-section');
              const list = settings?.querySelector<HTMLElement>('.category-settings__list');
              const rows = [...(settings?.querySelectorAll<HTMLElement>('.category-settings__item') ?? [])];
              if (!settings || !list || rows.length !== 6) {
                throw new Error('Category Settings must show all six availability switches.');
              }
              const rowBounds = rows.map(row => {
                const identity = row.querySelector<HTMLElement>('.category-settings__identity');
                const toggle = row.querySelector<HTMLInputElement>('input[role="switch"]');
                if (!identity || !toggle) throw new Error('A category row is missing its label or switch.');
                const identityBounds = identity.getBoundingClientRect();
                const toggleBounds = toggle.getBoundingClientRect();
                const rowRect = row.getBoundingClientRect();
                return {
                  right: rowRect.right,
                  identityRight: identityBounds.right,
                  toggleLeft: toggleBounds.left,
                  toggleWidth: toggleBounds.width,
                  toggleHeight: toggleBounds.height
                };
              });
              const description = settings.querySelector<HTMLElement>(':scope > p');
              return {
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: document.documentElement.clientWidth,
                headingVisible: settingsSection?.querySelector('h3')?.textContent?.trim() === 'Categories',
                descriptionFits: Boolean(description && description.scrollWidth <= description.clientWidth),
                rowBounds
              };
            });
            assert.equal(categorySettingsLayout.documentWidth, viewportWidth,
              `Category Settings must not overflow at ${viewportWidth}px / ${textSize}.`);
            assert.equal(categorySettingsLayout.viewportWidth, viewportWidth);
            assert.equal(categorySettingsLayout.headingVisible, true);
            assert.equal(categorySettingsLayout.descriptionFits, true);
            assert.ok(categorySettingsLayout.rowBounds.every(row =>
              row.right <= viewportWidth
              && row.identityRight < row.toggleLeft
              && row.toggleWidth === 44
              && row.toggleHeight === 26
            ), `Category labels and switches must remain separated at ${viewportWidth}px / ${textSize}.`);
          }
        }

        await page.setViewportSize({ width: 375, height: 844 });
        const areaNavigation = page.getByRole('navigation', { name: 'Areas' });
        const measureCategorySpacing = async (categoryName: 'Parenting' | 'Health & Fitness') => {
          await page.setViewportSize({ width: 1280, height: 900 });
          await areaNavigation.getByRole('button', { name: categoryName, exact: true }).click();
          await page.setViewportSize({ width: 375, height: 844 });
          const measurements = [];
          for (const textSize of ['small', 'medium', 'large'] as const) {
            for (let attempt = 0; attempt < 3; attempt += 1) {
              if (await categorySizeToggle.getAttribute('data-text-size') === textSize) break;
              await categorySizeToggle.click();
            }
            assert.equal(await categorySizeToggle.getAttribute('data-text-size'), textSize);
            const root = page.locator('main.category-page--segmented:not([hidden])');
            await root.waitFor();
            const tabs = root.locator(':scope > [role="tablist"]');
            const tabMeasurements = [];
            for (const tabName of ['Foundations', 'Today', 'Rhythms'] as const) {
              await tabs.getByRole('tab', { name: tabName, exact: true }).click();
              const measurement = await root.evaluate(element => {
                const summary = element.querySelector<HTMLElement>('.category-health-summary');
                const tablist = element.querySelector<HTMLElement>('[role="tablist"]');
                const panel = element.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])');
                const firstContent = panel?.firstElementChild as HTMLElement | null;
                if (!summary || !tablist || !panel || !firstContent) {
                  throw new Error('Segmented category page is missing its summary, tabs, or active panel content.');
                }
                const summaryRect = summary.getBoundingClientRect();
                const tabsRect = tablist.getBoundingClientRect();
                const panelRect = panel.getBoundingClientRect();
                const firstRect = firstContent.getBoundingClientRect();
                return {
                  summaryToTabs: tabsRect.top - summaryRect.bottom,
                  tabsToPanel: panelRect.top - tabsRect.bottom,
                  tabsToFirstContent: firstRect.top - tabsRect.bottom,
                  firstContentClass: firstContent.className,
                  viewportWidth: document.documentElement.clientWidth
                };
              });
              assert.equal(measurement.viewportWidth, 375);
              assert.ok(Math.abs(measurement.summaryToTabs - 12) < 0.5,
                `${categoryName} summary-to-tabs gap should be 12px at ${textSize}: ${JSON.stringify(measurement)}`);
              assert.ok(Math.abs(measurement.tabsToFirstContent - 12) < 0.5,
                `${categoryName} tabs-to-content gap should be 12px for ${tabName} at ${textSize}: ${JSON.stringify(measurement)}`);
              tabMeasurements.push({ tabName, ...measurement });
            }
            measurements.push({ textSize, tabMeasurements });
          }
          return measurements;
        };

        const parentingSpacing = await measureCategorySpacing('Parenting');
        const healthFitnessSpacing = await measureCategorySpacing('Health & Fitness');
        for (let sizeIndex = 0; sizeIndex < parentingSpacing.length; sizeIndex += 1) {
          const parentingSize = parentingSpacing[sizeIndex]!;
          const healthSize = healthFitnessSpacing[sizeIndex]!;
          assert.equal(healthSize.textSize, parentingSize.textSize);
          for (let tabIndex = 0; tabIndex < parentingSize.tabMeasurements.length; tabIndex += 1) {
            const parentingTab = parentingSize.tabMeasurements[tabIndex]!;
            const healthTab = healthSize.tabMeasurements[tabIndex]!;
            assert.equal(healthTab.tabName, parentingTab.tabName);
            assert.ok(Math.abs(healthTab.summaryToTabs - parentingTab.summaryToTabs) < 0.5,
              `Health & Fitness and Parenting summary gaps should match at ${parentingSize.textSize}.`);
            assert.ok(Math.abs(healthTab.tabsToFirstContent - parentingTab.tabsToFirstContent) < 0.5,
              `Health & Fitness and Parenting ${parentingTab.tabName} content gaps should match at ${parentingSize.textSize}.`);
          }
        }

        await page.setViewportSize({ width: 1280, height: 900 });
        const healthTabs = page.locator('.health-fitness-page [role="tablist"][aria-label="Health and Fitness"]');
        await healthTabs.getByRole('tab', { name: 'Foundations', exact: true }).click();
        await page.getByRole('button', { name: /Open Strength foundation details/ }).click();
        const strengthTabs = page.getByRole('tablist', { name: 'Strength sections' });
        const strengthSizeToggle = page.locator('.mobile-display-toggle');
        const workoutsTab = strengthTabs.getByRole('tab', { name: 'Workouts' });
        const bodyTab = strengthTabs.getByRole('tab', { name: 'Body' });
        const rhythmsTab = strengthTabs.getByRole('tab', { name: 'Rhythms' });
        const sectionTabOrder = await strengthTabs.getByRole('tab').allTextContents();
        assert.deepEqual(sectionTabOrder.map(label => label.trim()), ['Body', 'Workouts', 'Rhythms']);
        assert.equal(await workoutsTab.getAttribute('aria-selected'), 'true',
          'Strength should default to Workouts.');
        for (const textSize of ['small', 'medium', 'large'] as const) {
          await page.setViewportSize({ width: 375, height: 844 });
          for (let attempt = 0; attempt < 3; attempt += 1) {
            if (await strengthSizeToggle.getAttribute('data-text-size') === textSize) break;
            await strengthSizeToggle.click();
          }
          assert.equal(await strengthSizeToggle.getAttribute('data-text-size'), textSize);
          await workoutsTab.click();
          assert.equal(await page.getByRole('tablist', { name: 'Strength workouts' }).count(), 0);
          assert.equal(await page.getByRole('heading', { name: 'For you' }).count(), 0);
          assert.equal(await page.getByRole('heading', { name: 'My workouts' }).isVisible(), true);
          assert.equal(await page.getByText('Your routines, ready when you are.', { exact: true }).isVisible(), true);
          assert.equal(await page.getByRole('button', { name: 'Log workout' }).isVisible(), true);
          assert.equal(await page.getByRole('heading', { name: 'History' }).isVisible(), true);
          assert.equal(await page.getByText('Your completed workouts.', { exact: true }).isVisible(), true);
          assert.equal(await page.getByText('No workouts recorded yet.', { exact: true }).isVisible(), true);
          assert.equal(await page.getByRole('button', { name: 'View all' }).count(), 0);
          assert.equal(await page.getByRole('heading', { name: 'Quick log' }).count(), 0);
          for (const viewportWidth of [375, 390, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 844 });
            const firstHeadingPositions = [];
            for (const [tab, selector, headingName] of [
              [bodyTab, '#strength-panel-body > .strength-section-heading', 'Body overview'],
              [workoutsTab, '#strength-panel-workouts .strength-section-heading', 'My workouts'],
              [rhythmsTab, '#strength-panel-rhythms > .strength-rhythms-panel > .strength-section-heading', 'Linked Rhythms']
            ] as const) {
              await tab.click();
              await page.getByRole('heading', { name: headingName }).waitFor();
              const heading = page.locator(selector).first();
              const position = await heading.evaluate(element => {
                const rect = element.getBoundingClientRect();
                const tabs = element.closest('.strength-page')?.querySelector<HTMLElement>(
                  ':scope > [role="tablist"][aria-label="Strength sections"]'
                );
                if (!tabs) throw new Error('Strength section tabs are missing.');
                const tabsRect = tabs.getBoundingClientRect();
                const title = element.querySelector<HTMLElement>('.strength-section-heading__title-row');
                const actions = element.querySelector<HTMLElement>('.strength-section-heading__actions');
                const titleRect = title?.getBoundingClientRect();
                const action = actions?.querySelector<HTMLElement>('.btn');
                const actionRect = action?.getBoundingClientRect();
                const actionSharesTitleRow = Boolean(titleRect && actionRect
                  && actionRect.top < titleRect.bottom
                  && actionRect.bottom > titleRect.top);
                return {
                  left: rect.left,
                  offset: rect.top - tabsRect.bottom,
                  height: rect.height,
                  titleTop: titleRect ? titleRect.top - rect.top : null,
                  actionTop: titleRect && actionRect ? actionRect.top - titleRect.top : null,
                  actionSharesTitleRow,
                  overlap: Boolean(titleRect && actionRect
                    && titleRect.bottom > actionRect.top
                    && actionRect.bottom > titleRect.top
                    && titleRect.right > actionRect.left
                    && actionRect.right > titleRect.left)
                };
              });
              assert.ok(position.height >= 44,
                `${headingName} heading row must retain a 44px minimum at ${viewportWidth}px / ${textSize} text.`);
              assert.equal(position.overlap, false,
                `${headingName} heading and action must not overlap at ${viewportWidth}px / ${textSize} text.`);
              assert.equal(position.titleTop, 0,
                `${headingName} title should begin at the top of its shared heading row.`);
              if (position.actionSharesTitleRow) {
                assert.equal(position.actionTop, 0,
                  `${headingName} action should align with its title when sharing the row.`);
              }
              firstHeadingPositions.push(position);
            }
            const bodyHeadingPosition = firstHeadingPositions[0]!;
            for (const position of firstHeadingPositions.slice(1)) {
              assert.ok(Math.abs(position.left - bodyHeadingPosition.left) < 0.5,
                `Strength section headings should align left at ${viewportWidth}px / ${textSize} text.`);
              assert.ok(Math.abs(position.offset - bodyHeadingPosition.offset) < 0.5,
                `Strength section headings should share a tab-panel offset at ${viewportWidth}px / ${textSize} text.`);
            }
            await workoutsTab.click();
            const historyHeading = page.locator('#strength-panel-workouts .strength-history-page > .strength-section-heading');
            const historyAction = await historyHeading.evaluate(element => {
              const title = element.querySelector<HTMLElement>('.strength-section-heading__title-row');
              const button = element.querySelector<HTMLElement>('.strength-section-heading__actions .btn');
              if (!title || !button) throw new Error('History heading is missing its title or Log workout action.');
              const titleRect = title.getBoundingClientRect();
              const buttonRect = button.getBoundingClientRect();
              return {
                sharesRow: buttonRect.top < titleRect.bottom && buttonRect.bottom > titleRect.top,
                topOffset: buttonRect.top - titleRect.top,
                overlap: buttonRect.top < titleRect.bottom
                  && buttonRect.bottom > titleRect.top
                  && buttonRect.left < titleRect.right
                  && buttonRect.right > titleRect.left
              };
            });
            assert.equal(historyAction.overlap, false,
              `History Log workout action must not overlap its heading at ${viewportWidth}px / ${textSize} text.`);
            if (historyAction.sharesRow) {
              assert.equal(historyAction.topOffset, 0,
                `History Log workout should top-align with its heading at ${viewportWidth}px / ${textSize} text.`);
            }
          }
          await page.setViewportSize({ width: 375, height: 844 });
          await workoutsTab.click();
          await page.getByRole('button', { name: 'Add workout' }).click();
          const routines = page.getByRole('dialog', { name: 'Add workout' });
          assert.equal((await routines.getAttribute('class'))?.includes('dialog--phone-fullscreen'), true);
          assert.equal(await routines.getByRole('heading', { name: 'Create your own' }).isVisible(), true);
          assert.equal(await routines.getByText('Choose exercises, sets, and reps.').isVisible(), true);
          const createCardLayout = await routines.evaluate(dialog => {
            const createCard = dialog.querySelector<HTMLElement>('.strength-workout-suggestions__create');
            const copy = createCard?.querySelector<HTMLElement>(':scope > div');
            const createButton = createCard?.querySelector<HTMLButtonElement>(':scope > .btn');
            const starterButton = dialog.querySelector<HTMLButtonElement>('.strength-workout-suggestion > .btn');
            if (!createCard || !copy || !createButton || !starterButton) {
              throw new Error('Add workout browser is missing the Create action or starter customization action.');
            }
            const createStyle = getComputedStyle(createButton);
            const starterStyle = getComputedStyle(starterButton);
            const cardRect = createCard.getBoundingClientRect();
            const copyRect = copy.getBoundingClientRect();
            const buttonRect = createButton.getBoundingClientRect();
            return {
              columnCount: getComputedStyle(createCard).gridTemplateColumns.split(' ').length,
              copyRight: copyRect.right,
              buttonLeft: buttonRect.left,
              buttonRight: buttonRect.right,
              cardRight: cardRect.right,
              cardPaddingRight: Number.parseFloat(getComputedStyle(createCard).paddingRight),
              cardBackground: getComputedStyle(createCard).backgroundColor,
              createBackground: createStyle.backgroundColor,
              createBorder: createStyle.borderColor,
              createColor: createStyle.color,
              starterBorder: starterStyle.borderColor,
              createMetrics: {
                height: buttonRect.height,
                fontFamily: createStyle.fontFamily,
                fontSize: createStyle.fontSize,
                fontWeight: createStyle.fontWeight,
                lineHeight: createStyle.lineHeight,
                padding: createStyle.padding,
                borderRadius: createStyle.borderRadius
              },
              starterMetrics: {
                height: starterButton.getBoundingClientRect().height,
                fontFamily: starterStyle.fontFamily,
                fontSize: starterStyle.fontSize,
                fontWeight: starterStyle.fontWeight,
                lineHeight: starterStyle.lineHeight,
                padding: starterStyle.padding,
                borderRadius: starterStyle.borderRadius
              }
            };
          });
          assert.deepEqual(createCardLayout.createMetrics, createCardLayout.starterMetrics,
            `Create action should match starter Customize sizing and typography at ${textSize} text.`);
          assert.equal(createCardLayout.columnCount, 2);
          assert.ok(createCardLayout.buttonLeft > createCardLayout.copyRight,
            `Create action should sit beside its copy at ${textSize} text.`);
          assert.ok(createCardLayout.buttonRight <= createCardLayout.cardRight - createCardLayout.cardPaddingRight + 0.5,
            `Create action should stay inside its card at ${textSize} text.`);
          assert.equal(createCardLayout.createBackground, createCardLayout.cardBackground);
          assert.equal(createCardLayout.createBorder, createCardLayout.starterBorder);
          assert.equal(createCardLayout.createColor, createCardLayout.starterBorder);
          await routines.locator('.strength-workout-suggestion__preview summary').first().click();
          const routineLayout = await routines.evaluate(dialog => {
          const surface = dialog.querySelector<HTMLElement>('.money-goal-dialog__surface');
            const rect = dialog.getBoundingClientRect();
            if (!surface) throw new Error('Routine browser is missing its shared dialog surface.');
            return {
              viewportWidth: document.documentElement.clientWidth,
              documentWidth: document.documentElement.scrollWidth,
              dialogLeft: rect.left,
              dialogRight: rect.right,
              surfaceWidth: surface.clientWidth,
              surfaceScrollWidth: surface.scrollWidth,
              previewVisible: Boolean(dialog.querySelector('.strength-workout-suggestion__preview[open]'))
            };
          });
          assert.equal(routineLayout.documentWidth, routineLayout.viewportWidth,
            `Strength routine browser must not overflow at ${textSize} text.`);
          assert.ok(routineLayout.dialogLeft >= 0 && routineLayout.dialogRight <= routineLayout.viewportWidth);
          assert.equal(routineLayout.surfaceScrollWidth, routineLayout.surfaceWidth,
            `Strength routine content must fit at ${textSize} text.`);
          assert.equal(routineLayout.previewVisible, true);
          const customization = routines.getByRole('button', { name: 'Customize' }).first();
          await customization.click();
          const editor = page.getByRole('dialog', { name: 'Create workout' });
          assert.equal(await page.getByRole('dialog').count(), 1);
          assert.equal((await editor.getAttribute('class'))?.includes('dialog--phone-fullscreen'), true);
          await editor.getByRole('button', { name: 'Back to Add workout' }).click();
          assert.equal(await page.getByRole('dialog').count(), 1);
          await page.getByRole('dialog', { name: 'Add workout' }).getByRole('button', { name: 'Close Add workout' }).click();
          await workoutsTab.focus();
          await page.keyboard.press('Home');
          await page.waitForFunction(() => {
            const tab = document.querySelector<HTMLElement>('.strength-page [role="tablist"][aria-label="Strength sections"] [role="tab"][aria-selected="true"]');
            return tab?.textContent?.trim() === 'Body' && tab === document.activeElement;
          });
          await page.keyboard.press('End');
          await page.waitForFunction(() => {
            const tab = document.querySelector<HTMLElement>('.strength-page [role="tablist"][aria-label="Strength sections"] [role="tab"][aria-selected="true"]');
            return tab?.textContent?.trim() === 'Rhythms' && tab === document.activeElement;
          });
          const rhythmPanel = page.getByRole('tabpanel', { name: 'Rhythms' });
          await rhythmPanel.getByRole('heading', { name: /^Linked Rhythms/ }).waitFor();
          await rhythmPanel.getByRole('button', { name: 'Add Rhythm' }).waitFor();
          await rhythmPanel.getByRole('button', { name: 'Manage links' }).waitFor();
          await page.keyboard.press('Home');
          await page.waitForFunction(() => {
            const tab = document.querySelector<HTMLElement>('.strength-page [role="tablist"][aria-label="Strength sections"] [role="tab"][aria-selected="true"]');
            return tab?.textContent?.trim() === 'Body' && tab === document.activeElement;
          });
          await bodyTab.click();
          await page.getByRole('heading', { name: 'Your body, at a glance' }).waitFor();
          for (const viewportWidth of [375, 390, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 844 });
            const layout = await strengthTabs.evaluate(element => {
              const strength = element.closest<HTMLElement>('.strength-page');
              const score = strength?.querySelector<HTMLElement>(':scope > .fitness-score-summary');
              const panel = strength?.querySelector<HTMLElement>('#strength-panel-body');
              const map = panel?.querySelector<HTMLElement>('.strength-map-card');
              const heading = map?.querySelector<HTMLElement>('.strength-card-heading');
              const mapLayout = map?.querySelector<HTMLElement>('.strength-map-layout');
              if (!strength || !score || !panel || !map || !heading || !mapLayout) {
                throw new Error('Strength Body panel is missing its shared score, map card, heading, or map.');
              }
              const pageRect = strength.getBoundingClientRect();
              const scoreRect = score.getBoundingClientRect();
              const tabsRect = element.getBoundingClientRect();
              const mapRect = map.getBoundingClientRect();
              const mapLayoutRect = mapLayout.getBoundingClientRect();
              return {
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: document.documentElement.clientWidth,
                panelVisible: !panel.hidden,
                scoreWidth: scoreRect.width,
                tabsWidth: tabsRect.width,
                mapLeft: mapRect.left,
                mapRight: mapRect.right,
                pageLeft: pageRect.left,
                pageRight: pageRect.right,
                headingFits: heading.scrollWidth <= heading.clientWidth,
                mapFits: mapLayoutRect.left >= mapRect.left && mapLayoutRect.right <= mapRect.right
              };
            });
            assert.equal(layout.viewportWidth, viewportWidth);
            assert.equal(layout.documentWidth, viewportWidth,
              `Strength must not overflow at ${viewportWidth}px / ${textSize} text.`);
            assert.equal(layout.panelVisible, true);
            assert.ok(layout.scoreWidth > 0 && layout.tabsWidth > 0);
            assert.ok(layout.mapLeft >= layout.pageLeft && layout.mapRight <= layout.pageRight);
            assert.equal(layout.headingFits, true,
              `Strength Body heading must fit at ${viewportWidth}px / ${textSize} text.`);
            assert.equal(layout.mapFits, true,
              `Strength body map must fit at ${viewportWidth}px / ${textSize} text.`);
          }
        }

        await page.setViewportSize({ width: 1280, height: 900 });
        await areaNavigation.getByRole('button', { name: 'Faith' }).click();
        const faithTabs = page.getByRole('tablist', { name: 'Faith content' });
        await faithTabs.getByRole('tab', { name: 'Rhythms' }).click();

        for (const textSize of ['small', 'medium', 'large'] as const) {
          await page.setViewportSize({ width: 375, height: 844 });
          for (let attempt = 0; attempt < 3; attempt += 1) {
            if (await categorySizeToggle.getAttribute('data-text-size') === textSize) break;
            await categorySizeToggle.click();
          }
          assert.equal(await categorySizeToggle.getAttribute('data-text-size'), textSize);
          await page.getByRole('button', { name: 'Add Rhythm' }).click();
          const rhythmEditor = page.getByRole('dialog', { name: 'Add Rhythm' });
          await rhythmEditor.getByRole('button', { name: /Choose categories/ }).click();
          const categoryPicker = page.locator('.money-goal-dialog--category-picker');
          await categoryPicker.waitFor();
          const categoryRow = categoryPicker.locator('[data-picker-category-id]').first();

          await categoryRow.focus();
          await page.keyboard.press('Enter');
          await categoryPicker.getByRole('heading', { name: 'Faith' }).waitFor();
          assert.equal(await categoryPicker.locator('.rhythm-association-picker__category-detail').count(), 1);
          const detailLayout = await categoryPicker.evaluate(dialog => {
            const surface = dialog.querySelector<HTMLElement>('.money-goal-dialog__surface');
            const options = [...dialog.querySelectorAll<HTMLElement>('.rhythm-association-picker__detail-option')];
            if (!surface || options.length === 0) throw new Error('Category detail is missing its sheet or Foundation options.');
            return {
              dialogBounds: (() => {
                const rect = dialog.getBoundingClientRect();
                return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
              })(),
              surfaceBounds: (() => {
                const rect = surface.getBoundingClientRect();
                return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
              })(),
              optionHeights: options.map(option => option.getBoundingClientRect().height),
              optionGroupLabel: dialog.querySelector('[role="group"]')?.getAttribute('aria-label'),
              documentWidth: document.documentElement.scrollWidth,
              viewportWidth: document.documentElement.clientWidth,
              headingFocused: document.activeElement?.textContent?.trim() === 'Faith'
            };
          });
          assert.deepEqual(detailLayout.dialogBounds, { left: 0, top: 0, width: 375, height: 844 });
          assert.equal(detailLayout.surfaceBounds.width, 375);
          assert.ok(detailLayout.surfaceBounds.height > 0);
          assert.equal(detailLayout.documentWidth, detailLayout.viewportWidth);
          assert.ok(detailLayout.optionHeights.every(height => height >= 44));
          assert.equal(detailLayout.headingFocused, true);

          const backButton = categoryPicker.locator('.rhythm-association-picker__back');
          await backButton.focus();
          await page.keyboard.press('Enter');
          await categoryRow.waitFor();
          assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.pickerCategoryId),
            await categoryRow.getAttribute('data-picker-category-id'));

          await page.keyboard.press('Enter');
          await categoryPicker.getByRole('heading', { name: 'Faith' }).waitFor();
          const initialSheetBounds = await categoryPicker.locator('.money-goal-dialog__surface').evaluate(surface => {
            const rect = surface.getBoundingClientRect();
            return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
          });
          const categoryToggle = categoryPicker.getByRole('button', { name: /^(Add|Remove) Faith category$/ });
          if (await categoryToggle.getAttribute('aria-pressed') !== 'true') await categoryToggle.click();
          const firstPractice = categoryPicker.locator('.rhythm-association-picker__detail-option').first();
          const practiceLabel = await firstPractice.getAttribute('aria-label');
          await firstPractice.click();
          assert.equal(await firstPractice.getAttribute('aria-pressed'), 'true');
          await categoryPicker.getByRole('button', { name: 'Done', exact: true }).click();
          await categoryPicker.getByRole('heading', { name: 'Choose categories' }).waitFor();
          const listState = await categoryPicker.evaluate(dialog => {
            const surface = dialog.querySelector<HTMLElement>('.money-goal-dialog__surface');
            const categoryList = dialog.querySelector<HTMLElement>('.rhythm-association-picker__category-list');
            const rows = [...dialog.querySelectorAll<HTMLElement>('.rhythm-association-picker__category-row')];
            const row = rows[0];
            const summary = row?.querySelector<HTMLElement>('.rhythm-association-picker__category-summary');
            const indicator = row?.querySelector<HTMLElement>('.rhythm-association-picker__selection-indicator');
            if (!surface || !categoryList || !row || !summary || !indicator) {
              throw new Error('Category list is missing its selected summary or validity indicator.');
            }
            const surfaceRect = surface.getBoundingClientRect();
            return {
              surfaceBounds: {
                left: surfaceRect.left,
                top: surfaceRect.top,
                width: surfaceRect.width,
                height: surfaceRect.height
              },
              categoryCount: rows.length,
              rowHeight: row.getBoundingClientRect().height,
              summaryText: summary.textContent?.trim(),
              summaryTitle: summary.title,
              indicatorText: indicator.textContent?.trim(),
              oneCategoryPicker: document.querySelectorAll('.money-goal-dialog--category-picker').length,
              oneCategoryList: document.querySelectorAll('.rhythm-association-picker__category-list').length,
              documentWidth: document.documentElement.scrollWidth,
              viewportWidth: document.documentElement.clientWidth
            };
          });
          assert.deepEqual(listState.surfaceBounds, initialSheetBounds,
            `Category list and detail must use the same sheet dimensions at ${textSize}.`);
          assert.ok(listState.categoryCount > 0);
          assert.ok(listState.rowHeight >= 44);
          assert.ok(listState.summaryText?.length);
          assert.equal(listState.summaryTitle, practiceLabel);
          assert.equal(listState.indicatorText, '✓');
          assert.equal(listState.oneCategoryPicker, 1);
          assert.equal(listState.oneCategoryList, 1);

          for (const viewportWidth of [375, 390, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 844 });
            const phoneLayout = await categoryPicker.evaluate(dialog => {
              const rows = [...dialog.querySelectorAll<HTMLElement>('.rhythm-association-picker__category-row')];
              const summary = dialog.querySelector<HTMLElement>('.rhythm-association-picker__category-summary');
              const surface = dialog.querySelector<HTMLElement>('.money-goal-dialog__surface');
              if (!surface || rows.length === 0 || !summary) {
                throw new Error('Category picker is missing its list rows or selected summary.');
              }
              const surfaceRect = surface.getBoundingClientRect();
              return {
                viewportWidth: document.documentElement.clientWidth,
                documentWidth: document.documentElement.scrollWidth,
                surfaceLeft: surfaceRect.left,
                surfaceRight: surfaceRect.right,
                summaryWidth: summary.getBoundingClientRect().width,
                summaryScrollWidth: summary.scrollWidth,
                summaryClientWidth: summary.clientWidth,
                rowRights: rows.map(row => row.getBoundingClientRect().right)
              };
            });
            assert.equal(phoneLayout.documentWidth, viewportWidth,
              `Category picker must not overflow at ${viewportWidth}px / ${textSize}.`);
            assert.equal(phoneLayout.viewportWidth, viewportWidth);
            assert.equal(phoneLayout.surfaceLeft, 0);
            assert.equal(phoneLayout.surfaceRight, viewportWidth);
            assert.ok(phoneLayout.rowRights.every(right => right <= viewportWidth));
            assert.ok(phoneLayout.summaryWidth > 0);
            assert.ok(phoneLayout.summaryScrollWidth >= phoneLayout.summaryClientWidth);
          }

          await categoryPicker.getByRole('button', { name: 'Cancel', exact: true }).click();
          await rhythmEditor.getByRole('button', { name: 'Cancel', exact: true }).click();
          await rhythmEditor.waitFor({ state: 'detached' });
        }
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
