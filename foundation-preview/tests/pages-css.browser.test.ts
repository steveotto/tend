import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import {
  createEmptyPreviewData,
  createPreviewEnvelope,
  createSamplePreviewData,
  parsePreviewBackup
} from '../src/domain/preview-state.ts';
import { localDateString } from '../src/domain/money-goals.ts';
import { localDateTimeInZone } from '../src/domain/rhythm-completion.ts';
import { PREVIEW_ACCOUNT_STORAGE_PREFIX } from '../src/storage/preview-storage.ts';

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

async function verifyClassicSparkPalette(browser: Browser): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    const [tokens, styles] = await Promise.all([
      readFile(path.resolve(previewDirectory, '..', 'brand/tend-tokens.css'), 'utf8'),
      readFile(path.resolve(previewDirectory, '..', 'tend.css'), 'utf8')
    ]);
    await page.setContent(`
      <article class="spark-card">
        <div class="pi-main">
          <div class="plan-item-copy">
            <div class="plan-item-heading">
              <span class="spark-card__title-line"><span class="tend-type-title">Beach Dinner</span></span>
              <span class="spark-card__title-edit">
                <button id="classic-spark-edit" type="button" aria-label="Edit Beach Dinner"><svg></svg></button>
              </span>
            </div>
            <div class="plan-item-description">in Punta Cana</div>
            <div class="plan-item-meta-people">
              <span class="prayer-person"><span class="avatar init">AB</span>Avery Brooks</span>
            </div>
            <div class="plan-item-action"><button id="classic-spark-do-it" class="btn sparkbtn">Do it</button></div>
          </div>
        </div>
        <div class="dashboard-spark-footer">
          <span class="spark-card__meta-item"><svg class="plan-detail-icon"></svg>Someday</span>
        </div>
      </article>
    `);
    await page.addStyleTag({ content: tokens });
    await page.addStyleTag({ content: styles });
    await page.addStyleTag({ content: '.spark-card .plan-item-action>.btn { transition: none !important; }' });
    const colors = await page.locator('.spark-card').evaluate(card => {
      const style = (selector: string) => {
        const element = card.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Classic Spark fixture is missing ${selector}.`);
        return getComputedStyle(element);
      };
      return {
        surface: getComputedStyle(card).backgroundColor,
        border: getComputedStyle(card).borderTopColor,
        title: style('.tend-type-title').color,
        description: style('.plan-item-description').color,
        badgeSurface: style('.prayer-person').backgroundColor,
        badgeBorder: style('.prayer-person').borderTopColor,
        avatarSurface: style('.avatar.init').backgroundColor,
        avatarText: style('.avatar.init').color,
        actionSurface: style('.sparkbtn').backgroundColor,
        actionText: style('.sparkbtn').color,
        footerText: style('.dashboard-spark-footer').color
      };
    });
    assert.deepEqual(colors, {
      surface: 'rgb(254, 251, 230)',
      border: 'rgb(230, 228, 164)',
      title: 'rgb(32, 39, 35)',
      description: 'rgb(79, 78, 20)',
      badgeSurface: 'rgb(255, 255, 255)',
      badgeBorder: 'rgb(230, 228, 164)',
      avatarSurface: 'rgb(229, 242, 235)',
      avatarText: 'rgb(36, 107, 82)',
      actionSurface: 'rgb(36, 107, 82)',
      actionText: 'rgb(255, 255, 255)',
      footerText: 'rgb(79, 78, 20)'
    });
    const action = page.locator('#classic-spark-do-it');
    await action.hover();
    assert.equal(await action.evaluate(button => getComputedStyle(button).backgroundColor), 'rgb(28, 88, 68)');
    const bounds = await action.boundingBox();
    assert.ok(bounds);
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    assert.equal(await action.evaluate(button => getComputedStyle(button).backgroundColor), 'rgb(28, 88, 68)');
    await page.mouse.up();
    await page.locator('#classic-spark-edit').focus();
    await page.keyboard.press('Tab');
    const focus = await action.evaluate(button => ({
      visible: button.matches(':focus-visible'),
      outlineColor: getComputedStyle(button).outlineColor
    }));
    assert.deepEqual(focus, { visible: true, outlineColor: 'rgb(36, 107, 82)' });
  } finally {
    await page.close();
  }
}

type PreviewTextSize = 'small' | 'medium' | 'large';

async function measureHeroHeader(page: Page, selector: string) {
  const header = page.locator(selector).last();
  await header.waitFor({ state: 'visible' });
  return header.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const text = [...element.querySelectorAll<HTMLElement>('h2, p')];
    const copy = element.querySelector<HTMLElement>('.page-hero-header__copy');
    const icon = element.querySelector<HTMLElement>('.page-hero-header__icon');
    const copyRect = copy?.getBoundingClientRect();
    const iconRect = icon?.getBoundingClientRect();
    const contentBounds = [
      ...text.map(item => item.getBoundingClientRect()),
      ...(iconRect ? [iconRect] : [])
    ];
    return {
      left: rect.left + window.scrollX,
      top: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
      contentFits: contentBounds.every(bounds =>
        bounds.left >= rect.left - 1
        && bounds.right <= rect.right + 1
        && bounds.top >= rect.top - 1
        && bounds.bottom <= rect.bottom + 1
      ) && text.every(item => item.scrollWidth <= item.clientWidth + 1),
      iconBesideCopy: Boolean(
        copyRect && iconRect
        && iconRect.left >= copyRect.right - 1
        && iconRect.right <= rect.right + 1
        && iconRect.top < copyRect.bottom
        && iconRect.bottom > copyRect.top
      ),
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth
    };
  });
}

function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const srgbMatch = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    const channels = srgbMatch
      ? srgbMatch.slice(1).map(Number)
      : color.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(value => Number(value) / 255);
    assert.ok(channels && channels.length >= 3, `Expected an RGB color, got ${color}.`);
    const linearChannel = (index: number) => {
      const value = channels[index];
      if (value === undefined) throw new Error(`Missing RGB channel in ${color}.`);
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linearChannel(0) + 0.7152 * linearChannel(1) + 0.0722 * linearChannel(2);
  };
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

async function colorsRenderIdentically(page: Page, first: string, second: string): Promise<boolean> {
  return page.evaluate(({ first, second }) => {
    if (!CSS.supports('color', first) || !CSS.supports('color', second)) return false;
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas 2D is unavailable for color comparison.');
    const pixel = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const firstPixel = pixel(first);
    const secondPixel = pixel(second);
    return firstPixel.every((channel, index) => channel === secondPixel[index]);
  }, { first, second });
}

async function setPreviewTextSize(page: Page, target: PreviewTextSize): Promise<void> {
  await page.setViewportSize({ width: 375, height: 812 });
  const sizes: readonly PreviewTextSize[] = ['small', 'medium', 'large'];
  const button = page.locator('.mobile-display-toggle');
  await button.waitFor({ state: 'visible' });
  const current = await button.getAttribute('data-text-size');
  const currentIndex = sizes.indexOf(current as PreviewTextSize);
  const targetIndex = sizes.indexOf(target);
  if (currentIndex < 0) throw new Error('The preview text-size control is unavailable.');

  const clicks = (targetIndex - currentIndex + sizes.length) % sizes.length;
  for (let index = 0; index < clicks; index += 1) {
    await button.click();
    await page.waitForFunction(
      expected => document.querySelector('.mobile-display-toggle')?.getAttribute('data-text-size') === expected,
      sizes[(currentIndex + index + 1) % sizes.length]
    );
  }
}

async function verifyStrengthReviewResponsiveLayout(page: Page): Promise<void> {
  const originalViewport = page.viewportSize() ?? { width: 375, height: 812 };
  const sizeToggle = page.locator('.mobile-display-toggle');
  const initialTextSizeValue = await sizeToggle.getAttribute('data-text-size');
  if (initialTextSizeValue !== 'small' && initialTextSizeValue !== 'medium' && initialTextSizeValue !== 'large') {
    throw new Error('The preview text-size control is unavailable.');
  }
  const initialTextSize: PreviewTextSize = initialTextSizeValue;

  await page.evaluate(() => {
    const dialog = document.createElement('dialog');
    dialog.className = 'money-goal-dialog strength-guided-dialog dialog--phone-fullscreen';
    dialog.open = true;
    dialog.dataset.strengthReviewLayoutFixture = 'true';
    dialog.style.visibility = 'hidden';
    dialog.style.pointerEvents = 'none';

    const surface = document.createElement('div');
    surface.className = 'money-goal-dialog__surface';
    const body = document.createElement('div');
    body.className = 'strength-dialog-body strength-guided';
    const review = document.createElement('div');
    review.className = 'strength-guided__review';

    const metadata = document.createElement('div');
    metadata.className = 'strength-guided__metadata strength-guided__review-metadata';
    const fields: Array<[string, 'date' | 'time', string]> = [
      ['Workout date', 'date', '2026-11-20'],
      ['Start time', 'time', '23:59']
    ];
    for (const [labelText, type, value] of fields) {
      const label = document.createElement('label');
      label.className = 'strength-form-field';
      label.append(labelText);
      const input = document.createElement('input');
      input.type = type;
      input.value = value;
      label.append(input);
      metadata.append(label);
    }

    const results = document.createElement('section');
    results.className = 'strength-exercise-results';
    const heading = document.createElement('h3');
    heading.textContent = 'Dumbbell press with a deliberately long result title';
    const sets = document.createElement('ol');
    sets.className = 'strength-exercise-results__sets';
    const set = document.createElement('li');
    set.className = 'strength-exercise-results__set strength-exercise-results__set--performed';
    const setNumber = document.createElement('span');
    setNumber.className = 'strength-exercise-results__set-number';
    setNumber.textContent = 'Set 1';
    const setValue = document.createElement('span');
    setValue.className = 'strength-exercise-results__set-value';
    setValue.setAttribute('aria-label', '1,000,000 kg per dumbbell × 100 reps');
    setValue.textContent = '1,000,000 kg × 100 reps';
    const setDelta = document.createElement('span');
    setDelta.className = 'strength-exercise-results__set-delta';
    setDelta.textContent = '▲ +5 kg';
    set.append(setNumber, setValue, setDelta);
    sets.append(set);
    const volume = document.createElement('div');
    volume.className = 'strength-exercise-results__volume';
    const volumeHeading = document.createElement('strong');
    volumeHeading.className = 'strength-exercise-results__volume-heading';
    volumeHeading.textContent = 'Volume (per dumbbell)';
    const grid = document.createElement('div');
    grid.className = 'strength-exercise-results__volume-grid';
    const volumeValues: Array<[string, string, boolean]> = [
      ['Last session', '870,000 lb', false],
      ['This session', '880,000 lb', true]
    ];
    for (const [labelText, valueText, current] of volumeValues) {
      const group = document.createElement('div');
      group.className = `strength-exercise-results__volume-group${current
        ? ' strength-exercise-results__volume-group--current'
        : ''}`;
      const label = document.createElement('span');
      label.className = 'strength-exercise-results__volume-label';
      label.textContent = labelText;
      const value = document.createElement('span');
      value.className = 'strength-exercise-results__volume-value';
      value.textContent = valueText;
      group.append(label);
      if (current) {
        const currentValue = document.createElement('span');
        currentValue.className = 'strength-exercise-results__volume-current';
        currentValue.append(value);
        const delta = document.createElement('span');
        delta.className = 'strength-exercise-results__set-delta';
        delta.textContent = '▲ +10,000 lb';
        currentValue.append(delta);
        group.append(currentValue);
      } else {
        group.append(value);
      }
      grid.append(group);
    }
    volume.append(volumeHeading, grid);
    results.append(heading, sets, volume);
    review.append(metadata, results);
    body.append(review);
    surface.append(body);
    dialog.append(surface);
    document.body.append(dialog);
  });

  try {
    for (const textSize of ['small', 'medium', 'large'] as const) {
      await setPreviewTextSize(page, textSize);
      for (const width of [375, 390, 430] as const) {
        await page.setViewportSize({ width, height: 844 });
        const layout = await page.evaluate(() => {
          const dialog = document.querySelector<HTMLDialogElement>('[data-strength-review-layout-fixture]');
          const metadata = dialog?.querySelector<HTMLElement>('.strength-guided__review-metadata');
          const date = metadata?.querySelector<HTMLElement>('.strength-form-field:nth-child(1)');
          const time = metadata?.querySelector<HTMLElement>('.strength-form-field:nth-child(2)');
          const dateInput = date?.querySelector<HTMLInputElement>('input');
          const timeInput = time?.querySelector<HTMLInputElement>('input');
          const card = dialog?.querySelector<HTMLElement>('.strength-exercise-results');
          const setRow = card?.querySelector<HTMLElement>('.strength-exercise-results__set');
          const setValue = card?.querySelector<HTMLElement>('.strength-exercise-results__set-value');
          const setDelta = card?.querySelector<HTMLElement>('.strength-exercise-results__set-delta');
          const grid = card?.querySelector<HTMLElement>('.strength-exercise-results__volume-grid');
          const previous = grid?.querySelector<HTMLElement>('.strength-exercise-results__volume-group');
          const current = grid?.querySelector<HTMLElement>('.strength-exercise-results__volume-group--current');
          const delta = current?.querySelector<HTMLElement>('.strength-exercise-results__set-delta');
          if (!metadata || !date || !time || !dateInput || !timeInput || !card || !setRow || !setValue
            || !setDelta || !grid || !previous || !current || !delta) {
            throw new Error('Strength review responsive fixture is incomplete.');
          }
          const dateRect = date.getBoundingClientRect();
          const timeRect = time.getBoundingClientRect();
          const dateInputRect = dateInput.getBoundingClientRect();
          const timeInputRect = timeInput.getBoundingClientRect();
          const setRowRect = setRow.getBoundingClientRect();
          const setValueRect = setValue.getBoundingClientRect();
          const setDeltaRect = setDelta.getBoundingClientRect();
          const gridRect = grid.getBoundingClientRect();
          const previousRect = previous.getBoundingClientRect();
          const currentRect = current.getBoundingClientRect();
          const deltaRect = delta.getBoundingClientRect();
          return {
            textSize: document.querySelector('.mobile-display-toggle')?.getAttribute('data-text-size'),
            dateAndTimeSideBySide: Math.abs(dateRect.top - timeRect.top) <= 1
              && dateRect.right <= timeRect.left + 1,
            inputsFit: dateInputRect.left >= dateRect.left - 1
              && dateInputRect.right <= dateRect.right + 1
              && timeInputRect.left >= timeRect.left - 1
              && timeInputRect.right <= timeRect.right + 1
              && dateInput.scrollWidth <= dateInput.clientWidth + 1
              && timeInput.scrollWidth <= timeInput.clientWidth + 1,
            setRowFits: setRow.scrollWidth <= setRow.clientWidth + 1
              && setValue.scrollWidth <= setValue.clientWidth + 1
              && setValue.textContent === '1,000,000 kg × 100 reps'
              && setValue.getAttribute('aria-label') === '1,000,000 kg per dumbbell × 100 reps'
              && setValueRect.left >= setRowRect.left - 1
              && setValueRect.right <= setRowRect.right + 1
              && setDeltaRect.right <= setRowRect.right + 1,
            volumeFits: card.scrollWidth <= card.clientWidth + 1
              && previousRect.left >= gridRect.left - 1
              && previousRect.right <= gridRect.right + 1
              && currentRect.left > previousRect.left
              && currentRect.right <= gridRect.right + 1
              && deltaRect.left >= currentRect.left - 1
              && deltaRect.right <= currentRect.right + 1,
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth
          };
        });
        assert.equal(layout.textSize, textSize);
        assert.equal(layout.dateAndTimeSideBySide, true,
          `Workout date and start time should share a row at ${width}px / ${textSize}.`);
        assert.equal(layout.inputsFit, true,
          `Native date/time fields must fit at ${width}px / ${textSize}.`);
        assert.equal(layout.setRowFits, true,
          `Per-dumbbell set rows must remain legible without horizontal overflow at ${width}px / ${textSize}.`);
        assert.equal(layout.volumeFits, true,
          `Long volume values and deltas must wrap within the card at ${width}px / ${textSize}.`);
        assert.equal(layout.documentWidth, width);
        assert.equal(layout.viewportWidth, width);
      }
    }

    await setPreviewTextSize(page, 'large');
    await page.setViewportSize({ width: 320, height: 844 });
    const narrowLayout = await page.locator('[data-strength-review-layout-fixture] .strength-guided__review-metadata')
      .evaluate(metadata => {
        const date = metadata.querySelector<HTMLElement>('.strength-form-field:nth-child(1)');
        const time = metadata.querySelector<HTMLElement>('.strength-form-field:nth-child(2)');
        return Boolean(date && time && time.getBoundingClientRect().top > date.getBoundingClientRect().top);
      });
    assert.equal(narrowLayout, true, 'Date and time should stack at a genuinely narrow width.');
  } finally {
    await page.locator('[data-strength-review-layout-fixture]').evaluate(dialog => dialog.remove());
    await setPreviewTextSize(page, initialTextSize);
    await page.setViewportSize(originalViewport);
  }
}

async function verifyFitnessSessionResumeBannerLayout(page: Page, viewSelector: string): Promise<void> {
  const originalViewport = page.viewportSize() ?? { width: 375, height: 844 };
  const sizeToggle = page.locator('.mobile-display-toggle');
  const initialTextSize = await sizeToggle.getAttribute('data-text-size') as PreviewTextSize | null;
  assert.ok(initialTextSize === 'small' || initialTextSize === 'medium' || initialTextSize === 'large');
  const fixtureId = `fitness-session-resume-layout-${viewSelector.replace(/[^a-z]+/gi, '-')}`;

  await page.evaluate(({ selector, id }) => {
    const view = document.querySelector<HTMLElement>(selector);
    const summary = view?.querySelector<HTMLElement>('.fitness-score-summary');
    if (!view || !summary) throw new Error(`Could not find a Fitness summary in ${selector}.`);

    const banner = document.createElement('aside');
    banner.id = id;
    banner.className = 'strength-guided-banner fitness-session-resume-banner';
    banner.setAttribute('aria-label', 'Workout in progress');
    banner.innerHTML = `
      <div class="fitness-session-resume-banner__copy">
        <strong class="fitness-session-resume-banner__title">
          A long guided workout title that wraps naturally on narrow mobile screens
        </strong>
        <span class="fitness-session-resume-banner__status">Workout in progress</span>
        <span class="fitness-session-resume-banner__support">Pick up where you left off.</span>
      </div>
      <button type="button" class="btn mini fitness-session-resume-banner__action">Resume</button>
    `;
    summary.insertAdjacentElement('afterend', banner);
  }, { selector: viewSelector, id: fixtureId });

  const banner = page.locator(`#${fixtureId}`);
  const measure = () => banner.evaluate(element => {
    const copy = element.querySelector<HTMLElement>('.fitness-session-resume-banner__copy');
    const title = element.querySelector<HTMLElement>('.fitness-session-resume-banner__title');
    const action = element.querySelector<HTMLElement>('.fitness-session-resume-banner__action');
    if (!copy || !title || !action) throw new Error('The Fitness resume banner fixture is incomplete.');
    const bannerRect = element.getBoundingClientRect();
    const copyRect = copy.getBoundingClientRect();
    const actionRect = action.getBoundingClientRect();
    const lineHeight = Number.parseFloat(getComputedStyle(title).lineHeight);
    return {
      bannerRight: bannerRect.right,
      copyRight: copyRect.right,
      copyWidth: copyRect.width,
      copyBottom: copyRect.bottom,
      actionLeft: actionRect.left,
      actionTop: actionRect.top,
      actionBottom: actionRect.bottom,
      actionRight: actionRect.right,
      actionCenter: (actionRect.top + actionRect.bottom) / 2,
      copyCenter: (copyRect.top + copyRect.bottom) / 2,
      titleWraps: title.getBoundingClientRect().height > lineHeight + 1,
      textFits: [...copy.children].every(child => {
        const text = child as HTMLElement;
        return text.scrollWidth <= text.clientWidth + 1;
      }),
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth
    };
  });

  try {
    for (const textSize of ['small', 'medium', 'large'] as const) {
      await setPreviewTextSize(page, textSize);
      for (const viewportWidth of [375, 390, 430]) {
        await page.setViewportSize({ width: viewportWidth, height: 844 });
        const layout = await measure();
        assert.ok(layout.titleWraps,
          `The long session title should wrap at ${viewportWidth}px / ${textSize}.`);
        assert.ok(layout.textFits,
          `Banner copy must fit its column at ${viewportWidth}px / ${textSize}.`);
        assert.ok(layout.actionLeft >= layout.copyRight + 8,
          `Resume should stay to the right of the copy at ${viewportWidth}px / ${textSize}.`);
        assert.ok(Math.abs(layout.actionCenter - layout.copyCenter) < 1,
          `Resume should be vertically centered at ${viewportWidth}px / ${textSize}.`);
        assert.ok(layout.actionRight <= layout.bannerRight - 8);
        assert.equal(layout.viewportWidth, viewportWidth);
        assert.equal(layout.documentWidth, viewportWidth);
      }
    }

    await setPreviewTextSize(page, 'large');
    await page.setViewportSize({ width: 280, height: 844 });
    const narrowLayout = await measure();
    assert.ok(narrowLayout.actionTop >= narrowLayout.copyBottom,
      'At very narrow widths, Resume may stack beneath the text.');
    assert.ok(narrowLayout.actionRight <= narrowLayout.bannerRight - 8);
    assert.equal(narrowLayout.viewportWidth, 280);
  } finally {
    await banner.evaluate(element => element.remove());
    await setPreviewTextSize(page, initialTextSize);
    await page.setViewportSize(originalViewport);
  }
}

async function verifyGuidedSetActionSpacing(page: Page, textSize: PreviewTextSize): Promise<void> {
  const originalViewport = page.viewportSize() ?? { width: 375, height: 844 };
  const fixtureId = `guided-set-spacing-${textSize}`;
  assert.equal(await page.locator('.mobile-display-toggle').getAttribute('data-text-size'), textSize);
  await page.evaluate(id => {
    const dialog = document.createElement('dialog');
    dialog.id = id;
    dialog.className = 'money-goal-dialog strength-guided-dialog';
    dialog.setAttribute('aria-label', 'Guided set spacing verification');
    dialog.innerHTML = `
      <div class="money-goal-dialog__surface">
        <h2>Guided set spacing verification</h2>
        <div class="strength-dialog-body strength-guided">
          <section class="strength-guided__entry" aria-label="Set 1 entry">
            <div class="strength-guided__performance-references">
              <button type="button" class="strength-guided__performance"
                aria-label="Copy values from this workout's last set, Bench Press, to the current set">
                <span>This workout · Last set</span><strong>45 lb × 8</strong>
              </button>
              <div class="strength-guided__performance"><span>Last workout · Set 1</span><strong>40 lb × 8</strong></div>
            </div>
            <div class="strength-guided__inputs" role="group" aria-label="Current set values">
              <div class="strength-guided__input-module">
                <label for="${id}-weight">Weight (lb)</label>
                <input id="${id}-weight" type="number" value="45">
                <div class="strength-guided__steppers">
                  <button type="button" aria-label="Decrease weight by 5 lb">−</button>
                  <button type="button" aria-label="Increase weight by 5 lb">+</button>
                </div>
              </div>
              <div class="strength-guided__input-module">
                <label for="${id}-reps">Reps</label>
                <input id="${id}-reps" type="number" aria-label="Reps" value="8">
                <div class="strength-guided__steppers">
                  <button type="button" aria-label="Decrease reps by 1">−</button>
                  <button type="button" aria-label="Increase reps by 1">+</button>
                </div>
              </div>
            </div>
            <div class="strength-guided__actions">
              <button type="button" class="btn mini strength-guided__confirm">Log set 1</button>
              <div class="strength-guided__secondary-actions">
                <button type="button" class="btn mini ghost">Skip set</button>
                <div>
                  <button type="button" class="btn mini ghost">Next exercise</button>
                  <p class="strength-guided__up-next">Up next · Row</p>
                </div>
              </div>
            </div>
          </section>
          <div class="strength-guided__footer">
            <div class="strength-guided__footer-actions">
              <button type="button" class="btn mini ghost strength-guided__notes-button">Notes</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.append(dialog);
    dialog.showModal();
  }, fixtureId);

  try {
    const dialog = page.locator(`#${fixtureId}`);
    for (const width of [375, 390, 430] as const) {
      await page.setViewportSize({ width, height: 390 });
      const layout = await dialog.evaluate(element => {
        const inputs = element.querySelector<HTMLElement>('.strength-guided__inputs');
        const actions = element.querySelector<HTMLElement>('.strength-guided__actions');
        const confirm = element.querySelector<HTMLButtonElement>('.strength-guided__confirm');
        const scrollRegion = element.querySelector<HTMLElement>('.strength-dialog-body.strength-guided');
        const activeReference = element.querySelector<HTMLButtonElement>('button.strength-guided__performance');
        const inactiveReference = element.querySelector<HTMLElement>('div.strength-guided__performance');
        if (!inputs || !actions || !confirm || !scrollRegion || !activeReference || !inactiveReference) {
          throw new Error('Guided set spacing fixture is missing its input, action, or scroll region.');
        }
        const visualStyle = (reference: HTMLElement) => {
          const style = getComputedStyle(reference);
          const rect = reference.getBoundingClientRect();
          return {
            display: style.display,
            width: rect.width,
            height: rect.height,
            padding: style.padding,
            border: style.border,
            borderRadius: style.borderRadius,
            backgroundColor: style.backgroundColor,
            color: style.color,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            lineHeight: style.lineHeight
          };
        };
        return {
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          inputBottom: inputs.getBoundingClientRect().bottom,
          actionTop: actions.getBoundingClientRect().top,
          buttonHeight: confirm.getBoundingClientRect().height,
          targetGap: (() => {
            const buttonHeight = Number.parseFloat(getComputedStyle(confirm).minHeight);
            const textScale = Number.parseFloat(
              getComputedStyle(document.documentElement).getPropertyValue('--app-text-scale')
            );
            return Math.max(buttonHeight, Math.min(buttonHeight * textScale, buttonHeight + 8));
          })(),
          scrollHeight: scrollRegion.scrollHeight,
          clientHeight: scrollRegion.clientHeight,
          overflowY: getComputedStyle(scrollRegion).overflowY,
          actionableReference: visualStyle(activeReference),
          inactiveReference: visualStyle(inactiveReference)
        };
      });
      const gap = layout.actionTop - layout.inputBottom;
      assert.equal(layout.viewportWidth, width);
      assert.equal(layout.documentWidth, width,
        `Guided set controls must not overflow at ${width}px / ${textSize} text.`);
      assert.ok(Math.abs(gap - layout.targetGap) < 0.5,
        `Guided action gap should scale with text size at ${width}px / ${textSize} text: ${JSON.stringify({ ...layout, gap })}.`);
      assert.ok(Math.abs(gap - layout.buttonHeight) <= 10,
        `Guided action gap should remain close to the Log set button height at ${width}px / ${textSize} text: ${JSON.stringify({ ...layout, gap })}.`);
      assert.ok(layout.scrollHeight > layout.clientHeight,
        `Guided actions should remain in a scrollable document at ${width}px / ${textSize} text.`);
      assert.equal(layout.overflowY, 'auto');
      assert.deepEqual(layout.actionableReference, layout.inactiveReference,
        `Actionable and inactive performance references must retain the same appearance at ${width}px / ${textSize} text.`);
      const referenceButton = dialog.getByRole('button', {
        name: "Copy values from this workout's last set, Bench Press, to the current set"
      });
      await referenceButton.focus();
      await page.keyboard.press('Enter');
      const referenceFocus = await referenceButton.evaluate(button => {
        const style = getComputedStyle(button);
        return {
          focused: document.activeElement === button,
          visible: button.matches(':focus-visible'),
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth
        };
      });
      assert.deepEqual(referenceFocus, {
        focused: true,
        visible: true,
        outlineStyle: 'solid',
        outlineWidth: '2px'
      });

      await dialog.getByRole('button', { name: 'Decrease weight by 5 lb' }).focus();
      for (const actionName of [
        'Increase weight by 5 lb',
        'Reps',
        'Decrease reps by 1',
        'Increase reps by 1',
        'Log set 1',
        'Skip set',
        'Next exercise',
        'Notes'
      ]) {
        await page.keyboard.press('Tab');
        const focusedAction = await dialog.evaluate(element => {
          const active = document.activeElement as HTMLElement | null;
          const region = element.querySelector<HTMLElement>('.strength-dialog-body.strength-guided');
          if (!active || !region) throw new Error('Guided action focus escaped its scroll region.');
          const activeRect = active.getBoundingClientRect();
          const regionRect = region.getBoundingClientRect();
          return {
            name: active.getAttribute('aria-label') ?? active.textContent?.trim(),
            visible: activeRect.top >= regionRect.top - 1 && activeRect.bottom <= regionRect.bottom + 1,
            scrollTop: region.scrollTop
          };
        });
        assert.equal(focusedAction.name, actionName,
          `Keyboard order should reach ${actionName} at ${width}px / ${textSize} text.`);
        assert.equal(focusedAction.visible, true,
          `${actionName} should scroll into view at ${width}px / ${textSize} text.`);
      }
    }
  } finally {
    await page.locator(`#${fixtureId}`).evaluate(element => {
      const dialog = element as HTMLDialogElement;
      if (dialog.open) dialog.close();
      dialog.remove();
    });
    await page.setViewportSize(originalViewport);
  }
}

async function verifyGuidedRhythmChoiceLayout(page: Page, textSize: PreviewTextSize): Promise<void> {
  const originalViewport = page.viewportSize() ?? { width: 375, height: 844 };
  const fixtureId = `guided-rhythm-choice-${textSize}`;
  assert.equal(await page.locator('.mobile-display-toggle').getAttribute('data-text-size'), textSize);
  await page.evaluate(id => {
    const dialog = document.createElement('dialog');
    dialog.id = id;
    dialog.className = 'money-goal-dialog strength-guided-dialog';
    dialog.setAttribute('aria-label', 'Guided Rhythm choice verification');
    dialog.innerHTML = `
      <div class="money-goal-dialog__surface">
        <h2>Finish &amp; review</h2>
        <div class="strength-dialog-body strength-guided">
          <div class="strength-guided__review">
            <fieldset class="strength-rhythm-completion" aria-label="Count toward a Rhythm">
              <legend class="sr-only">Workout completion</legend>
              <label class="strength-form-field strength-rhythm-completion__field" for="${id}-rhythm">
                <span>Count toward a Rhythm</span>
                <select id="${id}-rhythm">
                  <option value="">Choose a Rhythm</option>
                  <option value="strength">Strength training</option>
                </select>
              </label>
              <label class="checkbox-tile-options__tile strength-rhythm-completion__workout-only">
                <input type="checkbox">
                <span class="strength-rhythm-completion__workout-only-copy">
                  <span>Workout only</span>
                  <small>Save without completing a Rhythm.</small>
                </span>
              </label>
            </fieldset>
            <div class="money-goal-dialog__actions">
              <button type="button" class="btn mini ghost">Return to workout</button>
              <button type="button" class="btn mini">Finish &amp; save</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.append(dialog);
    dialog.showModal();
  }, fixtureId);

  try {
    const dialog = page.locator(`#${fixtureId}`);
    const rhythmSelect = dialog.locator('select');
    const workoutOnly = dialog.locator('.strength-rhythm-completion__workout-only');
    for (const width of [375, 390, 430] as const) {
      await page.setViewportSize({ width, height: 390 });
      const layout = await dialog.evaluate(element => {
        const group = element.querySelector<HTMLElement>('.strength-rhythm-completion');
        const field = element.querySelector<HTMLElement>('.strength-rhythm-completion__field');
        const select = element.querySelector<HTMLSelectElement>('select');
        const tile = element.querySelector<HTMLElement>('.strength-rhythm-completion__workout-only');
        const tileCopy = element.querySelector<HTMLElement>('.strength-rhythm-completion__workout-only-copy');
        if (!group || !field || !select || !tile || !tileCopy) {
          throw new Error('Guided Rhythm choice fixture is missing its controls.');
        }
        return {
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          groupWidth: group.clientWidth,
          groupScrollWidth: group.scrollWidth,
          fieldWidth: field.getBoundingClientRect().width,
          selectWidth: select.getBoundingClientRect().width,
          tileWidth: tile.getBoundingClientRect().width,
          tileScrollWidth: tile.scrollWidth,
          copyWidth: tileCopy.getBoundingClientRect().width,
          selectedFontSize: getComputedStyle(select).fontSize,
          tileTextSize: getComputedStyle(tileCopy).fontSize
        };
      });
      assert.equal(layout.viewportWidth, width);
      assert.equal(layout.documentWidth, width,
        `Guided Rhythm choices must not create horizontal page overflow at ${width}px / ${textSize} text.`);
      assert.ok(layout.groupWidth > 0 && layout.groupScrollWidth <= layout.groupWidth,
        `The Rhythm choice group must fit at ${width}px / ${textSize} text.`);
      assert.equal(layout.fieldWidth, layout.groupWidth);
      assert.equal(layout.selectWidth, layout.fieldWidth);
      assert.equal(layout.tileWidth, layout.groupWidth);
      assert.ok(layout.tileScrollWidth <= layout.tileWidth,
        `Workout-only copy must wrap inside its tile at ${width}px / ${textSize} text.`);
      assert.ok(layout.copyWidth > 0);
      assert.ok(Number.parseFloat(layout.selectedFontSize) > 0);
      assert.ok(Number.parseFloat(layout.tileTextSize) > 0);

      await rhythmSelect.focus();
      assert.deepEqual(await rhythmSelect.evaluate(select => ({
        active: document.activeElement === select,
        visible: select.matches(':focus-visible'),
        outlineStyle: getComputedStyle(select).outlineStyle
      })), { active: true, visible: true, outlineStyle: 'solid' },
      `The Rhythm dropdown must retain its visible focus indicator at ${width}px / ${textSize} text.`);
      const checkbox = workoutOnly.locator('input');
      await checkbox.focus();
      assert.equal(await checkbox.evaluate(input => document.activeElement === input), true,
        `Workout only must be keyboard-focusable at ${width}px / ${textSize} text.`);
      assert.equal(await workoutOnly.evaluate(tile => getComputedStyle(tile).outlineStyle), 'solid',
        `Workout only must have a visible keyboard focus ring at ${width}px / ${textSize} text.`);
    }
  } finally {
    await page.locator(`#${fixtureId}`).evaluate(element => {
      const dialog = element as HTMLDialogElement;
      if (dialog.open) dialog.close();
      dialog.remove();
    });
    await page.setViewportSize(originalViewport);
  }
}

async function verifyToolZoneResponsiveLayout(page: Page, name: string): Promise<void> {
  const zone = page.getByRole('region', { name });
  const purposeSizes = new Map<PreviewTextSize, number>();

  for (const size of ['small', 'medium', 'large'] as const) {
    await setPreviewTextSize(page, size);
    for (const width of [375, 390, 430] as const) {
      await page.setViewportSize({ width, height: 812 });
      const metrics = await zone.evaluate(element => {
        const header = element.querySelector<HTMLElement>('.tool-zone__header');
        const icon = element.querySelector<HTMLElement>('.tool-zone__icon');
        const purpose = element.querySelector<HTMLElement>('.tool-zone__purpose');
        const intro = element.querySelector<HTMLElement>('.tool-zone__intro');
        const subtitle = element.querySelector<HTMLElement>('.tool-zone__subtitle');
        const actions = element.querySelector<HTMLElement>('.tool-zone__actions');
        const footnote = element.querySelector<HTMLElement>('.tool-zone__footnote');
        if (!header || !icon || !purpose || !intro || !subtitle || !footnote) {
          throw new Error('ToolZone is missing its expected accessible content.');
        }
        const intersects = (first: DOMRect, second: DOMRect) =>
          first.left < second.right && first.right > second.left
          && first.top < second.bottom && first.bottom > second.top;
        const zoneRect = element.getBoundingClientRect();
        const actionRect = actions?.getBoundingClientRect();
        const introRect = intro.getBoundingClientRect();
        const iconRect = icon.getBoundingClientRect();
        return {
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          zoneWidth: zoneRect.width,
          zoneRight: zoneRect.right,
          background: getComputedStyle(element).backgroundColor,
          backgroundToken: getComputedStyle(document.documentElement)
            .getPropertyValue('--tend-tool-zone-background').trim(),
          borderColor: getComputedStyle(element).borderTopColor,
          borderWidth: getComputedStyle(element).borderTopWidth,
          iconWidth: iconRect.width,
          iconHeight: iconRect.height,
          purposeColor: getComputedStyle(purpose).color,
          purposeFontSize: Number.parseFloat(getComputedStyle(purpose).fontSize),
          subtitleColor: getComputedStyle(subtitle).color,
          subtitleWidth: subtitle.clientWidth,
          subtitleScrollWidth: subtitle.scrollWidth,
          footnoteColor: getComputedStyle(footnote).color,
          footnoteWidth: footnote.clientWidth,
          footnoteScrollWidth: footnote.scrollWidth,
          actionOverlapsIntro: actionRect ? intersects(actionRect, introRect) : false,
          actionOverlapsIcon: actionRect ? intersects(actionRect, iconRect) : false,
          headerHeight: header.getBoundingClientRect().height
        };
      });

      assert.equal(metrics.viewportWidth, width);
      assert.equal(metrics.documentWidth, width,
        `ToolZone must not cause horizontal overflow at ${width}px / ${size}.`);
      assert.ok(metrics.zoneWidth > 0 && metrics.zoneRight <= width + 1);
      assert.equal(metrics.background, 'rgb(238, 242, 247)', `Unexpected ToolZone background at ${width}px / ${size}: ${JSON.stringify(metrics)}`);
      assert.equal(metrics.backgroundToken, '#EEF2F7');
      assert.equal(metrics.borderColor, 'rgb(215, 223, 233)');
      assert.equal(metrics.borderWidth, '1px');
      assert.equal(metrics.iconWidth, 22);
      assert.equal(metrics.iconHeight, 22);
      assert.equal(metrics.purposeColor, 'rgb(74, 107, 148)');
      assert.equal(metrics.subtitleColor, 'rgb(70, 89, 111)');
      assert.equal(metrics.footnoteColor, 'rgb(70, 89, 111)');
      assert.ok(metrics.subtitleWidth > 0 && metrics.subtitleScrollWidth <= metrics.subtitleWidth);
      assert.ok(metrics.footnoteWidth > 0 && metrics.footnoteScrollWidth <= metrics.footnoteWidth);
      assert.equal(metrics.actionOverlapsIntro, false,
        `ToolZone actions must wrap without overlapping copy at ${width}px / ${size}.`);
      assert.equal(metrics.actionOverlapsIcon, false);
      assert.ok(metrics.headerHeight > 0);
      purposeSizes.set(size, metrics.purposeFontSize);
    }
  }

  assert.ok(purposeSizes.get('small')! < purposeSizes.get('medium')!);
  assert.ok(purposeSizes.get('medium')! < purposeSizes.get('large')!);
}

async function verifyBodyToolPalette(
  page: Page,
  {
    settingsButtonName,
    settingsDialogName,
    settingsCloseName,
    mapName
  }: {
    settingsButtonName: string;
    settingsDialogName: string;
    settingsCloseName: string;
    mapName: string;
  }
): Promise<void> {
  const previousViewport = page.viewportSize();
  await page.setViewportSize({ width: 1280, height: 1000 });
  const zone = page.getByRole('region', { name: 'Body insights' });
  const toolbar = zone.getByRole('group', { name: 'Body map view' });
  const front = toolbar.getByRole('button', { name: 'Front' });
  const back = toolbar.getByRole('button', { name: 'Back' });
  const controlColors = async (control: typeof front) => control.evaluate(button => {
    const style = getComputedStyle(button);
    return {
      background: style.backgroundColor,
      border: style.borderColor,
      color: style.color
    };
  });

  const selectedControlColors = await controlColors(front);
  assert.deepEqual(selectedControlColors, {
    background: 'rgb(227, 235, 244)',
    border: 'rgb(74, 107, 148)',
    color: 'rgb(74, 107, 148)'
  });
  assert.ok(contrastRatio(selectedControlColors.color, selectedControlColors.background) >= 4.5,
    'Selected blue control text must meet WCAG AA contrast against its actual background.');
  assert.deepEqual(await controlColors(back), {
    background: 'rgba(0, 0, 0, 0)',
    border: 'rgb(215, 223, 233)',
    color: 'rgb(70, 89, 111)'
  });

  await back.hover();
  assert.deepEqual(await controlColors(back), {
    background: 'rgb(227, 235, 244)',
    border: 'rgb(74, 107, 148)',
    color: 'rgb(74, 107, 148)'
  });
  await front.focus();
  await page.keyboard.press('Tab');
  assert.equal(await back.evaluate(button => button === document.activeElement), true);
  const controlFocus = await back.evaluate(button => {
    const style = getComputedStyle(button);
    return { width: style.outlineWidth, color: style.outlineColor };
  });
  assert.deepEqual(controlFocus, { width: '2px', color: 'rgb(74, 107, 148)' });

  const map = zone.getByRole('group', { name: mapName });
  const selectedPath = map.locator('.strength-body-muscle[aria-pressed="true"]').first();
  const selectedRow = zone.locator('.strength-muscle-row[aria-pressed="true"]').first();
  assert.equal(await selectedPath.getAttribute('fill'), 'var(--score-neutral)');
  const selectedPathStyle = await selectedPath.evaluate(path => {
    const style = getComputedStyle(path);
    return { fill: style.fill, stroke: style.stroke, strokeWidth: style.strokeWidth };
  });
  assert.deepEqual(selectedPathStyle, {
    fill: 'rgb(74, 107, 148)',
    stroke: 'rgb(47, 74, 110)',
    strokeWidth: '2px'
  });

  const silhouettePath = zone.locator('.strength-body-svg > g[aria-hidden="true"] path').first();
  const silhouetteStyle = await silhouettePath.evaluate(path => {
    const style = getComputedStyle(path);
    return { fill: style.fill, stroke: style.stroke };
  });
  assert.deepEqual(silhouetteStyle, {
    fill: 'rgb(215, 224, 238)',
    stroke: 'rgb(179, 194, 217)'
  });

  const unselectedPath = map.locator('.strength-body-muscle[aria-pressed="false"]').first();
  const scoredFill = await unselectedPath.evaluate(path => {
    const originalFill = path.getAttribute('fill');
    path.setAttribute('fill', 'var(--score-green)');
    const fill = getComputedStyle(path).fill;
    if (originalFill === null) path.removeAttribute('fill');
    else path.setAttribute('fill', originalFill);
    return fill;
  });
  assert.equal(scoredFill, 'rgb(18, 183, 106)',
    'Selection styling must preserve a scored muscle fill.');

  const selectedRowStyle = await selectedRow.evaluate(row => {
    const style = getComputedStyle(row);
    return { background: style.backgroundColor, border: style.borderColor };
  });
  assert.deepEqual(selectedRowStyle, {
    background: 'rgb(227, 235, 244)',
    border: 'rgb(215, 223, 233)'
  });
  const unavailableStatus = zone.locator('.strength-muscle-row__status--unavailable').first();
  assert.equal(await unavailableStatus.evaluate(status => getComputedStyle(status).backgroundColor),
    'rgb(115, 128, 120)');

  await unselectedPath.scrollIntoViewIfNeeded();
  const hoverPoint = await unselectedPath.evaluate(element => {
    const path = element as SVGPathElement;
    const svg = path.ownerSVGElement;
    if (!svg) throw new Error('Body map region must belong to an SVG.');
    const bounds = path.getBBox();
    for (let row = 1; row < 10; row += 1) {
      for (let column = 1; column < 10; column += 1) {
        const point = svg.createSVGPoint();
        point.x = bounds.x + bounds.width * column / 10;
        point.y = bounds.y + bounds.height * row / 10;
        if (path.isPointInFill(point)) {
          const matrix = path.getScreenCTM();
          if (!matrix) throw new Error('Body map region has no screen transform.');
          const screenPoint = point.matrixTransform(matrix);
          return { x: screenPoint.x, y: screenPoint.y };
        }
      }
    }
    throw new Error('Could not find a hit point inside the body map region.');
  });
  await page.mouse.move(hoverPoint.x, hoverPoint.y);
  assert.equal(await unselectedPath.evaluate(path => getComputedStyle(path).stroke),
    'rgb(74, 107, 148)');

  const unselectedRow = zone.locator('.strength-muscle-row[aria-pressed="false"]').first();
  await unselectedRow.hover();
  assert.equal(await unselectedRow.evaluate(row => getComputedStyle(row).backgroundColor),
    'rgb(227, 235, 244)');
  await back.click();
  assert.equal(await back.getAttribute('aria-pressed'), 'true');
  assert.equal(await controlColors(back).then(style => style.color), 'rgb(74, 107, 148)');
  await front.click();
  assert.equal(await front.getAttribute('aria-pressed'), 'true');

  await back.focus();
  let selectedRowFocused = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await selectedRow.evaluate(row => row === document.activeElement)) {
      selectedRowFocused = true;
      break;
    }
    await page.keyboard.press('Tab');
  }
  assert.equal(selectedRowFocused, true, 'Keyboard tab order should reach the selected muscle row.');
  const rowFocus = await selectedRow.evaluate(row => {
    const style = getComputedStyle(row);
    return { width: style.outlineWidth, color: style.outlineColor };
  });
  assert.deepEqual(rowFocus, { width: '2px', color: 'rgb(74, 107, 148)' });

  const settings = zone.getByRole('button', { name: settingsButtonName });
  await settings.hover();
  const settingsHover = await settings.evaluate(button => {
    const style = getComputedStyle(button);
    return { background: style.backgroundColor, border: style.borderColor, color: style.color };
  });
  assert.deepEqual(settingsHover, {
    background: 'rgb(227, 235, 244)',
    border: 'rgb(74, 107, 148)',
    color: 'rgb(74, 107, 148)'
  });
  await settings.click();
  await page.getByRole('dialog', { name: settingsDialogName }).waitFor();
  assert.equal(await settings.getAttribute('aria-expanded'), 'true');
  const settingsOpen = await settings.evaluate(button => {
    const style = getComputedStyle(button);
    return { background: style.backgroundColor, border: style.borderColor, color: style.color };
  });
  assert.deepEqual(settingsOpen, {
    background: 'rgb(227, 235, 244)',
    border: 'rgb(74, 107, 148)',
    color: 'rgb(74, 107, 148)'
  });
  await page.getByRole('button', { name: settingsCloseName }).click();
  assert.equal(await settings.getAttribute('aria-expanded'), 'false');

  const logAction = zone.getByRole('button', { name: /^Log / }).first();
  if (await logAction.count()) {
    assert.deepEqual(await logAction.evaluate(button => {
      const style = getComputedStyle(button);
      return { background: style.backgroundColor, border: style.borderColor, color: style.color };
    }), {
      background: 'rgba(0, 0, 0, 0)',
      border: 'rgb(74, 107, 148)',
      color: 'rgb(74, 107, 148)'
    });
  }

  if (previousViewport) await page.setViewportSize(previousViewport);
}

async function verifyFinanceGoalToolPalette(page: Page): Promise<void> {
  const zone = page.getByRole('region', { name: 'Progress tracker' });
  const addButton = zone.locator('.tool-zone__actions .btn').first();
  assert.deepEqual(await addButton.evaluate(button => {
    const style = getComputedStyle(button);
    return { background: style.backgroundColor, border: style.borderColor, color: style.color };
  }), {
    background: 'rgba(0, 0, 0, 0)',
    border: 'rgb(74, 107, 148)',
    color: 'rgb(74, 107, 148)'
  });

  const progressTrack = zone.locator('.goal-progress__track').first();
  const progressFill = progressTrack.locator(':scope > span');
  await progressFill.waitFor({ state: 'visible' });
  const progressColors = await progressTrack.evaluate(track => ({
    background: getComputedStyle(track).backgroundColor,
    fill: getComputedStyle(track.querySelector(':scope > span')!).backgroundColor
  }));
  assert.deepEqual(progressColors, {
    background: 'rgb(227, 235, 244)',
    fill: 'rgb(74, 107, 148)'
  });

  const goalCard = zone.locator('.goal-card').first();
  assert.equal(await goalCard.evaluate(card => getComputedStyle(card).borderColor),
    'rgb(215, 223, 233)');
  assert.equal(await zone.locator(
    '.goal-card__support, .finance-goal-details__support, .finance-goal-rhythm-links'
  ).count(), 0);
  const goalTitle = (await goalCard.getByRole('heading').innerText()).trim();
  assert.ok(goalTitle, 'The progress tracker should show a titled goal.');
  const checkInButton = goalCard.getByRole('button', { name: 'Check in' });
  const detailsButton = goalCard.getByRole('button', { name: `View details for ${goalTitle}` });
  assert.equal(await checkInButton.isVisible(), true);
  assert.equal(await detailsButton.isVisible(), true);
  await checkInButton.focus();
  await page.keyboard.press('Tab');
  assert.equal(await detailsButton.evaluate(button => button === document.activeElement), true);
  assert.equal(await detailsButton.evaluate(button => getComputedStyle(button).color),
    'rgb(74, 107, 148)');
  assert.equal(await detailsButton.evaluate(button => getComputedStyle(button).outlineColor),
    'rgb(74, 107, 148)');
  assert.equal(await detailsButton.evaluate(button => getComputedStyle(button).outlineWidth), '2px');

  const typeBadge = zone.locator('.goal-card__type').first();
  const badgeColors = await typeBadge.evaluate(badge => {
    const style = getComputedStyle(badge);
    return {
      background: style.backgroundColor,
      border: style.borderColor,
      color: style.color
    };
  });
  assert.deepEqual(badgeColors, {
    background: 'rgb(227, 235, 244)',
    border: 'rgb(215, 223, 233)',
    color: 'rgb(74, 107, 148)'
  });
}

async function verifyFinanceGoalDetailsPalette(page: Page, goalTitle: string): Promise<void> {
  const details = page.getByRole('dialog', { name: goalTitle });
  const palette = await details.evaluate(dialog => {
    const zone = dialog.querySelector<HTMLElement>('.finance-goal-details__tool-zone');
    const progressTrack = zone?.querySelector<HTMLElement>('.goal-progress__track');
    const progressFill = progressTrack?.querySelector<HTMLElement>(':scope > span');
    const timeline = zone?.querySelector<HTMLElement>('.goal-timeline');
    const plannedLine = timeline?.querySelector<SVGLineElement>('.goal-timeline__planned');
    const actualPoint = timeline?.querySelector<SVGCircleElement>('.goal-timeline__actual');
    const checkIns = zone?.querySelector<HTMLElement>('.goal-check-ins');
    const correctionHistory = zone?.querySelector<HTMLElement>('.goal-correction-history');
    const primaryAction = zone?.querySelector<HTMLElement>('.goal-footer .btn:not(.ghost)');
    const card = zone?.querySelector<HTMLElement>('.goal-card');
    if (!zone || !timeline || !plannedLine || !checkIns || !primaryAction || !card) {
      throw new Error('Finance goal insights is missing its expected progress, chart, history, or actions.');
    }
    return {
      zoneBackground: getComputedStyle(zone).backgroundColor,
      zoneBorder: getComputedStyle(zone).borderTopColor,
      goalCardBorderStyle: getComputedStyle(card).borderTopStyle,
      progressTrack: progressTrack ? getComputedStyle(progressTrack).backgroundColor : null,
      progressFill: progressFill ? getComputedStyle(progressFill).backgroundColor : null,
      timelineBackground: getComputedStyle(timeline).backgroundColor,
      timelineBorder: getComputedStyle(timeline).borderTopColor,
      plannedLine: getComputedStyle(plannedLine).stroke,
      actualPointFill: actualPoint ? getComputedStyle(actualPoint).fill : null,
      actualPointStroke: actualPoint ? getComputedStyle(actualPoint).stroke : null,
      observedLegendBorder: getComputedStyle(timeline.querySelector('.goal-timeline__legend i.is-observed')!).borderTopColor,
      checkInsBackground: getComputedStyle(checkIns).backgroundColor,
      checkInsBorder: getComputedStyle(checkIns).borderTopColor,
      correctionHistory: correctionHistory
        ? {
            background: getComputedStyle(correctionHistory).backgroundColor,
            border: getComputedStyle(correctionHistory).borderTopColor
          }
        : null,
      primaryActionBackground: getComputedStyle(primaryAction).backgroundColor,
      primaryActionColor: getComputedStyle(primaryAction).color,
      isWholeModalWrapped: dialog.querySelector('.money-goal-dialog__surface > .tool-zone') !== null,
      legacyRhythmUiCount: dialog.querySelectorAll(
        '.goal-card__support, .finance-goal-details__support, .finance-goal-rhythm-links'
      ).length
    };
  });
  assert.deepEqual(palette, {
    zoneBackground: 'rgb(238, 242, 247)',
    zoneBorder: 'rgb(215, 223, 233)',
    goalCardBorderStyle: 'none',
    progressTrack: palette.progressTrack === null ? null : 'rgb(227, 235, 244)',
    progressFill: palette.progressFill === null ? null : 'rgb(74, 107, 148)',
    timelineBackground: 'rgb(227, 235, 244)',
    timelineBorder: 'rgb(215, 223, 233)',
    plannedLine: 'rgb(74, 107, 148)',
    actualPointFill: palette.actualPointFill === null ? null : 'rgb(227, 235, 244)',
    actualPointStroke: palette.actualPointStroke === null ? null : 'rgb(74, 107, 148)',
    observedLegendBorder: 'rgb(74, 107, 148)',
    checkInsBackground: 'rgb(227, 235, 244)',
    checkInsBorder: 'rgb(215, 223, 233)',
    correctionHistory: palette.correctionHistory
      ? { background: 'rgb(227, 235, 244)', border: 'rgb(215, 223, 233)' }
      : null,
    primaryActionBackground: 'rgb(74, 107, 148)',
    primaryActionColor: 'rgb(255, 255, 255)',
    isWholeModalWrapped: false,
    legacyRhythmUiCount: 0
  });
  assert.equal(await details.getByRole('button', { name: /supporting Rhythm/i }).count(), 0);
  assert.equal(await details.getByText(/Supporting Rhythms/i).count(), 0);
  const correctionLink = details.locator('.goal-check-ins .goal-text-button').first();
  const focusTarget = await correctionLink.count()
    ? correctionLink
    : details.locator('.goal-footer .btn:not(.ghost)');
  await details.getByRole('button', { name: 'Close goal details' }).focus();
  let focusTargetReached = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.keyboard.press('Tab');
    if (await focusTarget.evaluate(button => button === document.activeElement)) {
      focusTargetReached = true;
      break;
    }
  }
  assert.equal(focusTargetReached, true, 'Keyboard focus should reach the goal action inside the modal.');
  if (await correctionLink.count()) {
    assert.equal(await correctionLink.evaluate(button => getComputedStyle(button).color), 'rgb(74, 107, 148)');
    assert.equal(await correctionLink.evaluate(button => getComputedStyle(button).outlineColor), 'rgb(74, 107, 148)');
  } else {
    assert.equal(await focusTarget.evaluate(button => getComputedStyle(button).outlineColor), 'rgb(74, 107, 148)');
  }
  assert.equal(await details.getByRole('button', { name: 'Close goal details' }).isVisible(), true);
}

async function verifyFinanceCheckInPalette(page: Page, viewportWidth: number): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Record balance check-in' });
  const palette = await dialog.evaluate(element => {
    const zone = element.querySelector<HTMLElement>('.finance-check-in-tool-zone');
    const purpose = zone?.querySelector<HTMLElement>('.tool-zone__purpose');
    const primaryAction = zone?.querySelector<HTMLElement>('.money-goal-dialog__actions .btn:not(.ghost)');
    const scrollRegion = element.querySelector<HTMLElement>('.money-goal-dialog__scroll-region');
    const close = element.querySelector<HTMLElement>('.money-goal-dialog__close');
    if (!zone || !purpose || !primaryAction || !scrollRegion || !close) {
      throw new Error('Finance check-in is missing its shared blue zone, actions, or dialog controls.');
    }
    scrollRegion.focus();
    const dialogRect = element.getBoundingClientRect();
    const closeStyle = getComputedStyle(close);
    return {
      zoneBackground: getComputedStyle(zone).backgroundColor,
      zoneBorder: getComputedStyle(zone).borderTopColor,
      purposeColor: getComputedStyle(purpose).color,
      actionBackground: getComputedStyle(primaryAction).backgroundColor,
      actionColor: getComputedStyle(primaryAction).color,
      scrollRegionOutline: getComputedStyle(scrollRegion).outlineStyle,
      position: getComputedStyle(element).position,
      width: dialogRect.width,
      height: dialogRect.height,
      closePosition: closeStyle.position,
      closeTop: closeStyle.top,
      closeRight: closeStyle.right
    };
  });
  assert.deepEqual(palette, {
    zoneBackground: 'rgb(238, 242, 247)',
    zoneBorder: 'rgb(215, 223, 233)',
    purposeColor: 'rgb(74, 107, 148)',
    actionBackground: 'rgb(74, 107, 148)',
    actionColor: 'rgb(255, 255, 255)',
    scrollRegionOutline: 'none',
    position: 'fixed',
    width: viewportWidth,
    height: 844,
    closePosition: 'fixed',
    closeTop: '8px',
    closeRight: '12px'
  });
  assert.equal(await dialog.getByRole('button', { name: 'Close balance check-in' }).isVisible(), true);
}

async function verifyCardioActivityDialogLayout(page: Page, viewportWidth: number): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Log activity' });
  const layout = await dialog.evaluate(element => {
    const form = element.querySelector<HTMLElement>('.cardio-form');
    const date = element.querySelector<HTMLInputElement>('#cardio-activity-date');
    const duration = element.querySelector<HTMLElement>('.cardio-duration__fields');
    const pace = element.querySelector<HTMLElement>('.cardio-pace');
    const actions = element.querySelector<HTMLElement>('.cardio-form__actions');
    if (!form || !date || !duration || !pace || !actions) {
      throw new Error('The activity form is missing type, duration, pace, date, or action controls.');
    }
    const dialogRect = element.getBoundingClientRect();
    const formRect = form.getBoundingClientRect();
    const durationRect = duration.getBoundingClientRect();
    const actionRect = actions.getBoundingClientRect();
    const inputBounds = [...form.querySelectorAll<HTMLElement>('input, select, textarea')]
      .map(input => input.getBoundingClientRect());
    const actionButtons = [...actions.querySelectorAll<HTMLButtonElement>('button')].map(button => {
      const rect = button.getBoundingClientRect();
      return { x: rect.x, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    const gridColumns = getComputedStyle(duration).gridTemplateColumns.trim().split(/\s+/).length;
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      dialog: { x: dialogRect.x, y: dialogRect.y, width: dialogRect.width, height: dialogRect.height },
      formWidth: formRect.width,
      formScrollWidth: form.scrollWidth,
      dateType: date.type,
      durationColumns: gridColumns,
      durationFieldsFit: durationRect.left >= formRect.left - 1
        && durationRect.right <= formRect.right + 1,
      inputsFit: inputBounds.every(rect => rect.left >= formRect.left - 1 && rect.right <= formRect.right + 1),
      pace: pace.querySelector('span')?.textContent?.trim(),
      actions: {
        left: actionRect.left,
        right: actionRect.right,
        bottomPadding: Number.parseFloat(getComputedStyle(actions).paddingBottom),
        buttons: actionButtons
      }
    };
  });
  assert.equal(layout.viewportWidth, viewportWidth);
  assert.equal(layout.documentWidth, viewportWidth);
  assert.deepEqual(layout.dialog, { x: 0, y: 0, width: viewportWidth, height: 844 });
  assert.ok(layout.formWidth > 0);
  assert.ok(layout.formScrollWidth <= layout.formWidth + 1);
  assert.equal(layout.dateType, 'date');
  assert.equal(layout.durationColumns, 3);
  assert.equal(layout.durationFieldsFit, true);
  assert.equal(layout.inputsFit, true);
  assert.equal(layout.pace, '—');
  assert.ok(layout.actions.left >= 0 && layout.actions.right <= viewportWidth);
  assert.ok(layout.actions.bottomPadding >= 12);
  assert.equal(layout.actions.buttons.length, 2);
  assert.ok(layout.actions.buttons.every(button => button.x >= 0 && button.right <= viewportWidth));
}

async function verifyWeightEntryDialogLayout(page: Page, viewportWidth: number): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Add weigh-in' });
  const layout = await dialog.evaluate(element => {
    const form = element.querySelector<HTMLElement>('.weight-form');
    const date = element.querySelector<HTMLInputElement>('#weight-entry-date');
    const actions = form?.querySelector<HTMLElement>('.profile-editor-actions');
    const numeric = form?.querySelector<HTMLElement>('.numeric-control');
    if (!form || !date || !actions || !numeric) {
      throw new Error('The weigh-in form is missing its date, weight, or action controls.');
    }
    const dialogRect = element.getBoundingClientRect();
    const formRect = form.getBoundingClientRect();
    const dateRect = date.getBoundingClientRect();
    const numericRect = numeric.getBoundingClientRect();
    const actionsRect = actions.getBoundingClientRect();
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      dialog: { x: dialogRect.x, y: dialogRect.y, width: dialogRect.width, height: dialogRect.height },
      formWidth: formRect.width,
      formScrollWidth: form.scrollWidth,
      dateType: date.type,
      dateFits: dateRect.left >= formRect.left - 1 && dateRect.right <= formRect.right + 1,
      numericFits: numericRect.left >= formRect.left - 1 && numericRect.right <= formRect.right + 1,
      actions: {
        left: actionsRect.left,
        right: actionsRect.right,
        bottomPadding: Number.parseFloat(getComputedStyle(actions).paddingBottom),
        buttons: [...actions.querySelectorAll<HTMLButtonElement>('button')].map(button => {
          const rect = button.getBoundingClientRect();
          return { x: rect.x, right: rect.right };
        })
      }
    };
  });
  assert.equal(layout.viewportWidth, viewportWidth);
  assert.equal(layout.documentWidth, viewportWidth);
  assert.deepEqual(layout.dialog, { x: 0, y: 0, width: viewportWidth, height: 844 });
  assert.ok(layout.formWidth > 0);
  assert.ok(layout.formScrollWidth <= layout.formWidth + 1);
  assert.equal(layout.dateType, 'date');
  assert.equal(layout.dateFits, true);
  assert.equal(layout.numericFits, true);
  assert.ok(layout.actions.left >= 0 && layout.actions.right <= viewportWidth);
  assert.ok(layout.actions.bottomPadding >= 12);
  assert.equal(layout.actions.buttons.length, 2);
  assert.ok(layout.actions.buttons.every(button => button.x >= 0 && button.right <= viewportWidth));
}

async function verifyFitnessLogDialogLayout(
  page: Page,
  {
    dialogName,
    closeButtonName,
    dateLabel,
    saveLabel,
    hasMinutes,
    optionLabels
  }: {
    dialogName: string;
    closeButtonName: string;
    dateLabel: string;
    saveLabel: string;
    hasMinutes: boolean;
    optionLabels?: readonly string[];
  }
): Promise<void> {
  const previousViewport = page.viewportSize();
  let browserRhythmCreated = false;
  for (const size of ['small', 'medium', 'large'] as const) {
    await setPreviewTextSize(page, size);
    for (const width of [375, 390, 430] as const) {
      await page.setViewportSize({ width, height: 812 });
      await page.getByRole('button', { name: saveLabel === 'Save stretch' ? 'Log stretch' : 'Log workout' }).click();
      const dialog = page.getByRole('dialog', { name: dialogName });
      await dialog.waitFor({ state: 'visible' });
      const date = dialog.getByLabel(dateLabel);
      if (saveLabel === 'Save workout' && !browserRhythmCreated) {
        await dialog.getByRole('button', { name: 'Create a Rhythm' }).click();
        const rhythmEditor = page.getByRole('dialog', { name: 'Add Rhythm' });
        await rhythmEditor.getByLabel('Title').fill('Browser CSS Strength Rhythm');
        await rhythmEditor.getByRole('button', { name: 'Save' }).click();
        await rhythmEditor.waitFor({ state: 'hidden' });

        const rhythmSelect = dialog.getByLabel('Link to a Rhythm (optional)');
        assert.equal(await rhythmSelect.inputValue(), '');
        await rhythmSelect.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        assert.deepEqual(await rhythmSelect.evaluate(select => ({
          active: document.activeElement === select,
          focusVisible: select.matches(':focus-visible')
        })), { active: true, focusVisible: true });
        await rhythmSelect.selectOption({ label: 'Browser CSS Strength Rhythm' });
        await dialog.getByText('Also records a completion for Browser CSS Strength Rhythm.').waitFor();
        await rhythmSelect.selectOption({ label: 'Don’t link to a Rhythm' });
        assert.equal(await rhythmSelect.inputValue(), '');
        await dialog.getByText('Saved to workout history. Won’t contribute to Strength Health.').waitFor();
        browserRhythmCreated = true;
      }
      const metrics = await dialog.evaluate(element => {
        const scroll = element.querySelector<HTMLElement>('.money-goal-dialog__scroll-region');
        const header = element.querySelector<HTMLElement>('.money-goal-dialog__persistent-header');
        const dateInput = element.querySelector<HTMLInputElement>('input[type="date"]');
        const tiles = element.querySelector<HTMLElement>('.checkbox-tile-options');
        const optional = element.querySelector<HTMLElement>('.fitness-log-form__optional');
        const minuteInput = element.querySelector<HTMLInputElement>('input[type="number"]');
        if (!scroll || !header || !dateInput || !tiles) {
          throw new Error('Fitness log dialog is missing its shared scroll form structure.');
        }
        const rect = element.getBoundingClientRect();
        const dateRect = dateInput.getBoundingClientRect();
        const scrollRect = scroll.getBoundingClientRect();
        const close = element.querySelector<HTMLButtonElement>('.money-goal-dialog__close');
        const closeRect = close?.getBoundingClientRect();
        const gridColumns = getComputedStyle(tiles).gridTemplateColumns.trim().split(/\s+/).length;
        const dateStyle = getComputedStyle(dateInput);
        const optionalStyle = optional ? getComputedStyle(optional) : null;
        const minuteStyle = minuteInput ? getComputedStyle(minuteInput) : null;
        return {
          className: element.className,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
          documentWidth: document.documentElement.scrollWidth,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          scrollHeight: scroll.scrollHeight,
          scrollClientHeight: scroll.clientHeight,
          scrollPaddingLeft: getComputedStyle(scroll).paddingLeft,
          headerTop: header.getBoundingClientRect().top,
          closeRect: closeRect && { top: closeRect.top, bottom: closeRect.bottom },
          dateStyle: {
            height: dateRect.height,
            borderRadius: dateStyle.borderTopLeftRadius,
            fontSize: dateStyle.fontSize,
            outlineWidth: dateStyle.outlineWidth,
            outlineOffset: dateStyle.outlineOffset,
            leftClearance: dateRect.left - scrollRect.left,
            rightClearance: scrollRect.right - dateRect.right
          },
          gridColumns,
          optionCount: tiles.querySelectorAll('input[type="checkbox"]').length,
          optionLabels: [...tiles.querySelectorAll('label')].map(label => label.textContent?.trim()),
          optional: optionalStyle && {
            whiteSpace: optionalStyle.whiteSpace,
            fontWeight: optionalStyle.fontWeight
          },
          minutes: minuteInput && {
            value: minuteInput.value,
            min: minuteInput.min,
            max: minuteInput.max,
            step: minuteInput.step,
            height: minuteInput.getBoundingClientRect().height,
            borderRadius: minuteStyle?.borderTopLeftRadius,
            fontSize: minuteStyle?.fontSize
          },
        };
      });

      assert.ok(metrics.className.includes('dialog--phone-fullscreen'));
      assert.ok(metrics.className.includes('money-goal-dialog--scrollable-body'));
      assert.ok(metrics.className.includes('money-goal-dialog--fitness-log'));
      assert.equal(metrics.viewportWidth, width);
      assert.equal(metrics.documentWidth, width, `Fitness log must not cause horizontal overflow at ${width}px / ${size}.`);
      assert.deepEqual(metrics.rect, { x: 0, y: 0, width, height: 812 });
      assert.equal(metrics.scrollPaddingLeft, '5px');
      assert.equal(metrics.headerTop >= 0, true);
      assert.ok(metrics.closeRect && metrics.closeRect.top >= 0 && metrics.closeRect.bottom <= 812);
      assert.ok(metrics.optionCount > 0);
      await dialog.getByRole('button', { name: closeButtonName }).waitFor({ state: 'visible' });
      if (saveLabel === 'Save workout') {
        const rhythmSelect = dialog.getByLabel('Link to a Rhythm (optional)');
        const rhythmBounds = await rhythmSelect.boundingBox();
        assert.ok(rhythmBounds && rhythmBounds.x >= 0 && rhythmBounds.x + rhythmBounds.width <= width,
          `Rhythm dropdown must fit at ${width}px / ${size}.`);
      }
      if (optionLabels) {
        assert.equal(metrics.optionCount, optionLabels.length);
        assert.deepEqual(metrics.optionLabels, optionLabels);
      }
      const expectedGridColumns = width === 430 && size === 'small' ? 2 : 1;
      assert.equal(metrics.gridColumns, expectedGridColumns,
        `Checkbox tiles should adapt at ${width}px / ${size}.`);

      await date.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      const focusMetrics = await date.evaluate(input => {
        const region = input.closest('.money-goal-dialog__scroll-region');
        if (!region) throw new Error('Fitness log date input is outside the scroll region.');
        const style = getComputedStyle(input);
        const inputRect = input.getBoundingClientRect();
        const regionRect = region.getBoundingClientRect();
        const outlineClearance = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
        return {
          active: document.activeElement === input,
          visibleFocus: input.matches(':focus-visible'),
          outlineWidth: style.outlineWidth,
          outlineOffset: style.outlineOffset,
          leftClearance: inputRect.left - regionRect.left,
          rightClearance: regionRect.right - inputRect.right,
          outlineClearance
        };
      });
      assert.equal(focusMetrics.active, true);
      assert.equal(focusMetrics.visibleFocus, true);
      assert.equal(focusMetrics.outlineWidth, '2px');
      assert.equal(focusMetrics.outlineOffset, '-2px');
      assert.ok(focusMetrics.leftClearance >= focusMetrics.outlineClearance,
        `Date focus outline is clipped at the left edge: ${JSON.stringify(focusMetrics)}`);
      assert.ok(focusMetrics.rightClearance >= focusMetrics.outlineClearance,
        `Date focus outline is clipped at the right edge: ${JSON.stringify(focusMetrics)}`);

      if (hasMinutes) {
        assert.deepEqual(metrics.optional, { whiteSpace: 'nowrap', fontWeight: '400' });
        assert.deepEqual(metrics.minutes, {
          value: '',
          min: '1',
          max: '1440',
          step: '1',
          height: metrics.dateStyle.height,
          borderRadius: '10px',
          fontSize: metrics.dateStyle.fontSize
        });
      }

      await page.setViewportSize({ width, height: 420 });
      const reducedViewport = await dialog.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const region = element.querySelector<HTMLElement>('.money-goal-dialog__scroll-region')!;
        return {
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          scrollHeight: region.scrollHeight,
          scrollClientHeight: region.clientHeight,
          close: element.querySelector<HTMLButtonElement>('.money-goal-dialog__close')!.getBoundingClientRect()
        };
      });
      assert.deepEqual(reducedViewport.rect, { x: 0, y: 0, width, height: 420 });
      assert.ok(reducedViewport.scrollHeight > reducedViewport.scrollClientHeight);
      assert.ok(reducedViewport.close.top >= 0 && reducedViewport.close.bottom <= 420);
      const scrollRegion = dialog.locator('.money-goal-dialog__scroll-region');
      await scrollRegion.focus();
      await page.keyboard.press('End');
      const keyboardScroll = await scrollRegion.evaluate(element => ({
        top: element.scrollTop,
        maximum: element.scrollHeight - element.clientHeight
      }));
      assert.ok(keyboardScroll.maximum > 0);
      assert.ok(keyboardScroll.top >= keyboardScroll.maximum - 1);
      await scrollRegion.evaluate(element => { element.scrollTop = element.scrollHeight; });
      for (const label of [saveLabel, 'Cancel']) {
        const action = dialog.getByRole('button', { name: label });
        const actionRect = await action.boundingBox();
        assert.ok(actionRect && actionRect.y >= 0 && actionRect.y + actionRect.height <= 420,
          `${label} must be reachable in the reduced viewport at ${width}px / ${size}.`);
      }
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await dialog.waitFor({ state: 'hidden' });
    }
  }
  if (previousViewport) await page.setViewportSize(previousViewport);
}

async function verifyFoundationAlignmentAndDialogScrolling(browser: Browser, baseUrl: string) {
  const previewData = createEmptyPreviewData();
  const today = localDateString(new Date());
  const personId = 'layout-long-person';
  const sparkPersonId = 'layout-spark-person';
  const recentConnectionDate = new Date();
  recentConnectionDate.setDate(recentConnectionDate.getDate() - 7);
  const recentConnection = localDateString(recentConnectionDate);
  previewData.people = [{
    id: personId,
    displayName: 'Alexandria-Brooks-Williams-ExtremelyLong Synthetic Person'
  }, {
    id: sparkPersonId,
    displayName: 'Jordan-Example-With-A-Deliberately-Long-Synthetic-Name'
  }];
  previewData.peopleGroups = previewData.peopleGroups.map(group => ({
    ...group,
    memberIds: group.id === 'marriage' ? [personId] : []
  }));
  previewData.personDetails = [{
    personId,
    relationshipLabel: 'A very long synthetic relationship that wraps at narrow widths',
    birthday: { monthDay: '01-01', year: new Date().getFullYear() - 47 }
  }];
  previewData.friendships.connections = [{
    id: 'synthetic-recent-person-connection',
    type: 'time-together',
    date: recentConnection,
    time: '14:45',
    notes: 'Spent time together and talked about a meaningful family event during the long walk.',
    participantIds: [personId]
  }];
  previewData.personSparks = [{
    id: 'layout-long-spark',
    ownerId: personId,
    title: 'Plan a deliberately long one-off Spark title that wraps naturally at mobile sizes',
    description: 'A long but optional description that should wrap inside the pale yellow card without pushing its controls beyond the card or viewport.',
    sharedWith: [sparkPersonId],
    archived: false,
    completed: false,
    completionHistory: []
  }, {
    id: 'layout-completed-spark',
    ownerId: personId,
    title: 'Remember the completed one-off Spark with a deliberately long title',
    sharedWith: [],
    archived: false,
    completed: true,
    completionHistory: [{
      id: 'layout-completed-spark-event',
      source: 'legacy',
      date: today,
      completedAt: `${today}T18:00:00.000Z`,
      legacyEventId: 'layout-completed-spark-event'
    }]
  }];
  const startedAt = `${today}T12:00:00.000Z`;
  const finishedAt = `${today}T12:45:00.000Z`;
  const confirmedAt = `${today}T12:15:00.000Z`;
  previewData.strength.workouts = [{
    id: 'synthetic-long-history',
    date: today,
    muscleIds: ['biceps', 'triceps'],
    workoutName: 'Synthetic long history workout',
    notes: 'Final synthetic note marker. '.repeat(12),
    startedAt,
    finishedAt,
    timeZone: 'UTC',
    supersetGroups: [],
    exercises: Array.from({ length: 18 }, (_, index) => ({
      id: `synthetic-history-exercise-${index + 1}`,
      name: `Synthetic exercise ${String(index + 1).padStart(2, '0')}`,
      muscleIds: [index % 2 === 0 ? 'biceps' as const : 'triceps' as const],
      equipment: 'Dumbbells',
      restDurationSeconds: 60,
      sets: [{
        id: `synthetic-history-set-${index + 1}`,
        measurement: { kind: 'reps' as const },
        targetReps: 10,
        status: 'performed' as const,
        actualReps: 10,
        confirmedAt
      }]
    }))
  }];
  const cardioWeightDate = new Date(`${today}T12:00:00`);
  cardioWeightDate.setDate(cardioWeightDate.getDate() - 5);
  const longRunDate = new Date(`${today}T12:00:00`);
  longRunDate.setDate(longRunDate.getDate() - 2);
  const previousRunDate = new Date(`${today}T12:00:00`);
  previousRunDate.setDate(previousRunDate.getDate() - 1);
  const similarRunDate = new Date(`${today}T12:00:00`);
  similarRunDate.setDate(similarRunDate.getDate() - 3);
  previewData.weight.weighIns = [{
    id: 'synthetic-cardio-weight',
    date: localDateString(cardioWeightDate),
    weightKg: 70
  }];
  previewData.cardio.runs = [
    {
      id: 'synthetic-similar-run',
      date: localDateString(similarRunDate),
      distance: 6,
      distanceUnit: 'mi',
      durationSeconds: 60 * 60
    },
    {
      id: 'synthetic-previous-run',
      date: localDateString(previousRunDate),
      distance: 3,
      distanceUnit: 'mi',
      durationSeconds: 30 * 60
    },
    {
      id: 'synthetic-long-run',
      date: localDateString(longRunDate),
      distance: 1234.56,
      distanceUnit: 'mi',
      durationSeconds: 7 * 24 * 60 * 60
    },
    {
      id: 'synthetic-cardio-run',
      date: today,
      distance: 6.2,
      distanceUnit: 'mi',
      durationSeconds: 49 * 60 + 36
    }
  ];
  const envelope = createPreviewEnvelope(previewData);
  const validation = parsePreviewBackup(JSON.stringify(envelope), today);
  if (!validation.valid) {
    throw new Error(`Synthetic Foundation browser fixture is invalid: ${validation.message}`);
  }

  const userId = 'c0000000-0000-4000-8000-000000000003';
  const storageKey = `${PREVIEW_ACCOUNT_STORAGE_PREFIX}:${userId}`;
  const context = await browser.newContext({
    viewport: { width: 375, height: 844 },
    hasTouch: true
  });
  await context.addInitScript(({ key, value }) => {
    const session = {
      user: { id: 'c0000000-0000-4000-8000-000000000003', email: 'browser-test@example.test' }
    };
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
    window.localStorage.setItem(key, value);
  }, {
    key: storageKey,
    value: JSON.stringify(envelope)
  });
  const page = await context.newPage();
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === baseUrl) return route.continue();
    return route.abort();
  });
  await page.goto(`${baseUrl}/app-preview.html?identity=dashboard`);
  await page.locator('.home-dashboard').waitFor();
  await page.getByRole('button', { name: 'Health & Fitness' }).click();
  await page.getByRole('tab', { name: 'Foundations' }).click();

  const foundations = [
    {
      name: 'Strength',
      tablist: 'Strength sections',
      tabs: ['Body', 'Workouts', 'Rhythms'],
      panels: ['strength-panel-body', 'strength-panel-workouts', 'strength-panel-rhythms']
    },
    {
      name: 'Cardio',
      tablist: 'Cardio Foundation sections',
      tabs: ['Insights', 'Activities', 'Rhythms'],
      panels: ['cardio-panel-progress', 'cardio-panel-activities', 'cardio-panel-rhythms']
    },
    {
      name: 'Weight',
      tablist: 'Weight Foundation sections',
      tabs: ['Progress', 'Weigh-Ins', 'Rhythms'],
      panels: ['weight-panel-progress', 'weight-panel-measurements', 'weight-panel-rhythms']
    },
    {
      name: 'Flexibility',
      tablist: 'Flexibility sections',
      tabs: ['Body', 'Routines', 'Rhythms'],
      panels: ['flexibility-panel-body', 'flexibility-panel-routines', 'flexibility-panel-rhythms']
    }
  ] as const;

  for (const textSize of ['small', 'medium', 'large'] as const) {
    await setPreviewTextSize(page, textSize);
    if (textSize !== 'small') {
      await page.getByRole('button', { name: 'All Foundations' }).click();
    }
    for (const [foundationIndex, foundation] of foundations.entries()) {
      if (foundationIndex > 0) {
        await page.getByRole('button', { name: 'All Foundations' }).click();
      }
      await page.getByRole('button', {
        name: `Open ${foundation.name} foundation details`
      }).click();
      const tabs = page.getByRole('tablist', { name: foundation.tablist });

      for (let tabIndex = 0; tabIndex < foundation.tabs.length; tabIndex += 1) {
        const tabName = foundation.tabs[tabIndex]!;
        await tabs.getByRole('tab', { name: tabName, exact: true }).click();
        const panel = page.locator(`#${foundation.panels[tabIndex]}`);

        for (const viewportWidth of [375, 390, 430]) {
          await page.setViewportSize({ width: viewportWidth, height: 844 });
          const layout = await panel.evaluate((element, tablistName) => {
            const activePanel = element as HTMLElement;
            const detail = activePanel.closest<HTMLElement>('.health-fitness-progress__detail');
            const header = detail?.querySelector<HTMLElement>('.foundation-detail-header');
            const health = detail?.querySelector<HTMLElement>('.foundation-health-card');
            const tablist = detail?.querySelector<HTMLElement>(
              `[role="tablist"][aria-label="${tablistName}"]`
            );
            if (!detail || !header || !health || !tablist || activePanel.hidden) {
              throw new Error('The active Foundation needs a visible header, Health card, tablist, and panel.');
            }
            const bounds = (node: Element) => {
              const rect = node.getBoundingClientRect();
              return { left: rect.left, right: rect.right, width: rect.width };
            };
            return {
              viewportWidth: document.documentElement.clientWidth,
              documentWidth: document.documentElement.scrollWidth,
              header: bounds(header),
              health: bounds(health),
              tabs: bounds(tablist),
              content: [...activePanel.children]
                .filter(child => !child.hasAttribute('hidden') && getComputedStyle(child).display !== 'none')
                .map(child => ({ className: child.className, ...bounds(child) }))
            };
          }, foundation.tablist);
          const label = `${foundation.name} ${tabName} at ${viewportWidth}px / ${textSize} text`;
          assert.equal(layout.viewportWidth, viewportWidth, `${label} viewport width`);
          assert.equal(layout.documentWidth, viewportWidth, `${label} must not overflow horizontally`);
          assert.ok(layout.content.length > 0, `${label} must render a top-level content container`);
          for (const [name, bounds] of [
            ['Health card', layout.health],
            ['segmented tabs', layout.tabs],
            ...layout.content.map((entry, index) => [`content ${index + 1} (${entry.className})`, entry] as const)
          ] as const) {
            assert.ok(Math.abs(bounds.left - layout.header.left) <= 1,
              `${label} ${name} left edge ${bounds.left} must align with header ${layout.header.left}.`);
            assert.ok(Math.abs(bounds.right - layout.header.right) <= 1,
              `${label} ${name} right edge ${bounds.right} must align with header ${layout.header.right}.`);
          }
        }
      }
    }
  }

  await setPreviewTextSize(page, 'small');
  await page.setViewportSize({ width: 375, height: 390 });
  await page.getByRole('button', { name: 'All Foundations' }).click();
  await page.getByRole('button', { name: 'Open Strength foundation details' }).click();
  const strengthTabs = page.getByRole('tablist', { name: 'Strength sections' });
  await strengthTabs.getByRole('tab', { name: 'Workouts' }).click();
  const historyRegion = page.getByRole('region', { name: 'History' });
  const historyOpener = historyRegion.getByRole('button', {
    name: /View Synthetic long history workout/
  });
  await historyOpener.waitFor();
  await historyOpener.scrollIntoViewIfNeeded();
  const beforeOpen = await page.evaluate(() => {
    const root = document.scrollingElement;
    if (!root || root.scrollHeight <= root.clientHeight) {
      throw new Error('The synthetic Strength page must be scrollable before opening History.');
    }
    root.scrollTop = Math.min(Math.max(root.scrollTop, 120), root.scrollHeight - root.clientHeight);
    return {
      scrollTop: root.scrollTop,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyOverflow: document.body.style.overflow
    };
  });
  await historyOpener.click();
  const historyDialog = page.getByRole('dialog', { name: 'Synthetic long history workout' });
  await historyDialog.waitFor();
  const openingFocus = await historyDialog.evaluate(dialog => {
    const title = dialog.querySelector<HTMLElement>('.money-goal-dialog__heading > h2');
    const header = dialog.querySelector<HTMLElement>('.money-goal-dialog__persistent-header');
    const activeElement = document.activeElement;
    if (!title || !header) throw new Error('History must retain its shared dialog heading and header.');
    return {
      titleFocused: activeElement === title,
      inputFocused: activeElement instanceof HTMLInputElement,
      headingOutline: getComputedStyle(title).outlineStyle,
      headerOutline: getComputedStyle(header).outlineStyle,
      dialogLabelledBy: dialog.getAttribute('aria-labelledby'),
      scrollRegion: dialog.querySelector<HTMLElement>('.money-goal-dialog__scroll-region') !== null
    };
  });
  assert.equal(openingFocus.titleFocused, true, 'History should initially focus its announced static title.');
  assert.equal(openingFocus.inputFocused, false);
  assert.equal(openingFocus.headingOutline, 'none', 'Pointer opening must not outline the static History heading.');
  assert.equal(openingFocus.headerOutline, 'none', 'Pointer opening must not outline the History header.');
  assert.equal(openingFocus.dialogLabelledBy, 'strength-history-detail-title');
  assert.equal(openingFocus.scrollRegion, true);
  const scrollRegion = historyDialog.getByRole('region', { name: 'Synthetic long history workout content' });
  const initialScroll = await scrollRegion.evaluate(element => ({
    top: element.scrollTop,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
    touchAction: getComputedStyle(element).touchAction,
    webkitOverflowScrolling: getComputedStyle(element).getPropertyValue('-webkit-overflow-scrolling')
  }));
  assert.equal(initialScroll.top, 0);
  assert.ok(initialScroll.clientHeight > 0, 'The History scroll region must retain a visible height.');
  assert.equal(initialScroll.overflowY, 'auto');
  assert.equal(initialScroll.touchAction, 'pan-y');
  assert.ok(initialScroll.scrollHeight > initialScroll.clientHeight,
    'The long History details must have a bounded, scrollable content region.');

  const scrollBounds = await scrollRegion.boundingBox();
  if (!scrollBounds) throw new Error('The History scroll region has no browser geometry.');
  await scrollRegion.evaluate(element => {
    element.addEventListener('wheel', () => {
      element.dataset.wheelReceived = 'true';
    }, { once: true });
  });
  await scrollRegion.focus();
  await page.mouse.move(
    scrollBounds.x + scrollBounds.width / 2,
    scrollBounds.y + scrollBounds.height / 2
  );
  await page.mouse.wheel(0, 800);
  await page.waitForFunction(() => (
    document.querySelector<HTMLElement>('.money-goal-dialog__scroll-region')?.scrollTop ?? 0
  ) > 0);
  const wheelState = await scrollRegion.evaluate(element => ({
    top: element.scrollTop,
    wheelReceived: element.dataset.wheelReceived === 'true'
  }));
  const wheelScrollTop = wheelState.top;
  assert.ok(wheelScrollTop > 0,
    'Wheel/trackpad scrolling must move the History content region.');
  assert.equal(wheelState.wheelReceived, true);

  await scrollRegion.focus();
  await page.keyboard.press('End');
  await page.waitForFunction(() => {
    const region = document.querySelector<HTMLElement>('.money-goal-dialog__scroll-region');
    return region !== null && region.scrollTop >= region.scrollHeight - region.clientHeight;
  });
  const finalContent = await scrollRegion.evaluate(region => {
    const lastAction = region.querySelector<HTMLElement>('.money-goal-dialog__actions button:last-child');
    const notes = region.querySelector<HTMLElement>('.strength-history-detail__notes');
    if (!lastAction || !notes) throw new Error('History is missing its final actions or synthetic note.');
    const regionRect = region.getBoundingClientRect();
    const actionRect = lastAction.getBoundingClientRect();
    return {
      atBottom: region.scrollTop >= region.scrollHeight - region.clientHeight,
      regionFocused: document.activeElement === region,
      regionFocusVisible: region.matches(':focus-visible'),
      finalActionVisible: actionRect.top >= regionRect.top && actionRect.bottom <= regionRect.bottom,
      noteText: notes.textContent
    };
  });
  assert.equal(finalContent.atBottom, true, 'End must reach the final History content.');
  assert.equal(finalContent.regionFocused, true, 'The scroll region must receive keyboard input.');
  assert.equal(finalContent.regionFocusVisible, true, 'The keyboard-scrollable region must keep visible keyboard focus.');
  assert.equal(finalContent.finalActionVisible, true, 'The final History action must be reachable inside the scroll viewport.');
  assert.match(finalContent.noteText ?? '', /Final synthetic note marker/);

  await page.keyboard.press('Home');
  await page.waitForFunction(() => (
    document.querySelector<HTMLElement>('.money-goal-dialog__scroll-region')?.scrollTop ?? -1
  ) === 0);
  const visibleExerciseNames = new Set<string>();
  const collectVisibleExercises = async () => scrollRegion.evaluate(region => {
    const regionRect = region.getBoundingClientRect();
    return [...region.querySelectorAll<HTMLElement>('.strength-exercise-results-list > section')]
      .filter(section => {
        const heading = section.querySelector<HTMLElement>('h3');
        if (!heading) return false;
        const bounds = heading.getBoundingClientRect();
        return bounds.top >= regionRect.top && bounds.bottom <= regionRect.bottom;
      })
      .map(section => section.querySelector<HTMLElement>('h3')?.textContent?.trim() ?? '');
  });
  for (let step = 0; step < 40; step += 1) {
    for (const name of await collectVisibleExercises()) visibleExerciseNames.add(name);
    const position = await scrollRegion.evaluate(region => ({
      top: region.scrollTop,
      bottom: region.scrollTop >= region.scrollHeight - region.clientHeight
    }));
    if (position.bottom) break;
    await page.keyboard.press('PageDown');
    await page.waitForFunction(previousTop => {
      const region = document.querySelector<HTMLElement>('.money-goal-dialog__scroll-region');
      return region !== null && (
        region.scrollTop > previousTop ||
        region.scrollTop >= region.scrollHeight - region.clientHeight
      );
    }, position.top);
  }
  for (let index = 1; index <= 18; index += 1) {
    const exerciseName = `Synthetic exercise ${String(index).padStart(2, '0')}`;
    assert.ok(visibleExerciseNames.has(exerciseName),
      `Keyboard scrolling must make ${exerciseName} visible.`);
  }
  assert.ok(visibleExerciseNames.has('Synthetic exercise 18'),
    'Keyboard scrolling must reach the final exercise.');

  await page.keyboard.press('Home');
  await page.waitForFunction(() => (
    document.querySelector<HTMLElement>('.money-goal-dialog__scroll-region')?.scrollTop ?? -1
  ) === 0);
  const touchSession = await context.newCDPSession(page);
  const touchX = Math.round(scrollBounds.x + scrollBounds.width / 2);
  const touchStartY = Math.round(scrollBounds.y + scrollBounds.height - 36);
  await touchSession.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: touchX, y: touchStartY, id: 1 }]
  });
  await touchSession.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: touchX, y: touchStartY - 140, id: 1 }]
  });
  await touchSession.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: []
  });
  await page.waitForFunction(() => (
    document.querySelector<HTMLElement>('.money-goal-dialog__scroll-region')?.scrollTop ?? 0
  ) > 0);
  const touchScrollTop = await scrollRegion.evaluate(region => region.scrollTop);
  assert.ok(touchScrollTop > 0, 'Touch scrolling must move the History content region.');
  await touchSession.detach();

  await historyDialog.locator('.money-goal-dialog__heading > h2').focus();
  await page.keyboard.press('Tab');
  const closeFocus = await historyDialog.getByRole('button', { name: 'Close workout details' }).evaluate(button => ({
    active: document.activeElement === button,
    focusVisible: button.matches(':focus-visible'),
    outlineStyle: getComputedStyle(button).outlineStyle
  }));
  assert.equal(closeFocus.active, true, 'Keyboard focus should advance from the title to Close.');
  assert.equal(closeFocus.focusVisible, true);
  assert.equal(closeFocus.outlineStyle, 'solid');
  await page.keyboard.press('Escape');
  await historyDialog.waitFor({ state: 'detached' });
  await page.waitForFunction(() =>
    document.activeElement?.getAttribute('aria-label')?.startsWith('View Synthetic long history workout')
  );

  await historyOpener.click();
  const reopenedHistory = page.getByRole('dialog', { name: 'Synthetic long history workout' });
  await reopenedHistory.waitFor();
  const editButton = reopenedHistory.getByRole('button', { name: 'Edit', exact: true });
  await editButton.click();
  const editWorkoutDialog = page.getByRole('dialog', { name: 'Edit workout log' });
  await editWorkoutDialog.waitFor();
  await reopenedHistory.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.body.style.position), 'fixed',
    'Opening the editor must keep page scrolling locked.');
  await editWorkoutDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await editWorkoutDialog.waitFor({ state: 'detached' });
  await page.waitForFunction(() =>
    document.activeElement?.getAttribute('aria-label')?.startsWith('View Synthetic long history workout')
  );
  const afterClose = await page.evaluate(() => ({
    scrollTop: document.scrollingElement?.scrollTop ?? null,
    bodyPosition: document.body.style.position,
    bodyTop: document.body.style.top,
    bodyOverflow: document.body.style.overflow
  }));
  assert.equal(afterClose.scrollTop, beforeOpen.scrollTop,
    'Canceling Edit must restore the page scroll position.');
  assert.equal(afterClose.bodyPosition, beforeOpen.bodyPosition);
  assert.equal(afterClose.bodyTop, beforeOpen.bodyTop);
  assert.equal(afterClose.bodyOverflow, beforeOpen.bodyOverflow);

  await historyOpener.click();
  const historyAfterEditCancel = page.getByRole('dialog', { name: 'Synthetic long history workout' });
  await historyAfterEditCancel.waitFor();
  await historyAfterEditCancel.getByRole('button', { name: 'Close workout details' }).click();
  await historyAfterEditCancel.waitFor({ state: 'detached' });
  await page.waitForFunction(() =>
    document.activeElement?.getAttribute('aria-label')?.startsWith('View Synthetic long history workout')
  );
  const afterCloseHistory = await page.evaluate(() => ({
    scrollTop: document.scrollingElement?.scrollTop ?? null,
    bodyPosition: document.body.style.position,
    bodyTop: document.body.style.top,
    bodyOverflow: document.body.style.overflow
  }));
  assert.equal(afterCloseHistory.scrollTop, beforeOpen.scrollTop,
    'Closing History must restore the page scroll position.');
  assert.equal(afterCloseHistory.bodyPosition, beforeOpen.bodyPosition);
  assert.equal(afterCloseHistory.bodyTop, beforeOpen.bodyTop);
  assert.equal(afterCloseHistory.bodyOverflow, beforeOpen.bodyOverflow);

  await historyOpener.click();
  const reopenedAgain = page.getByRole('dialog', { name: 'Synthetic long history workout' });
  await reopenedAgain.waitFor();
  await reopenedAgain.getByRole('button', { name: 'Close workout details' }).click();
  await reopenedAgain.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.scrollingElement?.scrollTop ?? null), beforeOpen.scrollTop,
    'History must reopen and close without losing the restored page position.');

  await page.getByRole('button', { name: 'All Foundations' }).click();
  await page.getByRole('button', { name: 'Open Cardio foundation details' }).click();
  const cardioTabs = page.getByRole('tablist', { name: 'Cardio Foundation sections' });
  await cardioTabs.getByRole('tab', { name: 'Activities' }).click();
  const activityCard = page.locator('#cardio-panel-activities .cardio-history-card');
  const activityHistoryButton = activityCard.locator('.cardio-history-list .cardio-activity-row').first();

  async function verifyActivityDialog(isEdit: boolean) {
    const dialogName = isEdit ? 'Edit run' : 'Log activity';
    const dialog = page.getByRole('dialog', { name: dialogName });
    if (!isEdit) {
      await page.getByRole('button', { name: 'Add activity' }).click();
    } else {
      await activityHistoryButton.click();
      const details = page.getByRole('dialog', { name: 'Run details' });
      await details.getByRole('button', { name: 'Edit activity' }).click();
    }
    await dialog.waitFor();
    const initialFocus = await dialog.evaluate(element => {
      const title = element.querySelector<HTMLElement>('#cardio-activity-title');
      const date = element.querySelector<HTMLInputElement>('#cardio-activity-date');
      return {
        titleFocused: document.activeElement === title,
        dateFocused: document.activeElement === date,
        activeTag: document.activeElement?.tagName ?? null
      };
    });
    assert.equal(initialFocus.titleFocused, true, `${dialogName} should initially focus its static title.`);
    assert.equal(initialFocus.dateFocused, false, `${dialogName} must not focus or open the date picker.`);
    const fieldNames = ['Distance (miles)', 'Hours', 'Minutes', 'Seconds'] as const;
    const fields = fieldNames.map(name => dialog.getByRole('spinbutton', { name }));
    const originalBorderColors = await Promise.all(fields.map(field =>
      field.evaluate(input => getComputedStyle(input).borderTopColor)
    ));
    const originalFieldBounds = await Promise.all(fields.map(field => field.boundingBox()));
    for (const [index, field] of fields.entries()) {
      await field.click();
      const pointerStyle = await field.evaluate(input => ({
        focusVisible: input.matches(':focus-visible'),
        outlineStyle: getComputedStyle(input).outlineStyle,
        boxShadow: getComputedStyle(input).boxShadow
      }));
      assert.equal(pointerStyle.outlineStyle, 'none', `${dialogName} pointer focus should not add an outer ring.`);
      assert.ok(pointerStyle.boxShadow === 'none' || pointerStyle.boxShadow.includes('inset'),
        `${dialogName} pointer focus must not add an outer box shadow.`);
      const currentBounds = await field.boundingBox();
      const originalBounds = originalFieldBounds[index];
      assert.ok(currentBounds && originalBounds
        && Math.abs(currentBounds.width - originalBounds.width) <= 0.5
        && Math.abs(currentBounds.height - originalBounds.height) <= 0.5,
      `${dialogName} pointer focus should not change field dimensions.`);
    }

    await dialog.getByRole('button', { name: 'Close activity form' }).focus();
    const typeField = dialog.getByRole('combobox', { name: 'Activity type' });
    const dateField = dialog.locator('#cardio-activity-date');
    await page.keyboard.press('Tab');
    assert.equal(await typeField.evaluate(input => document.activeElement === input),
      true, `${dialogName} keyboard order should reach Activity type after Close.`);
    await page.keyboard.press('Tab');
    assert.equal(await dateField.evaluate(input => document.activeElement === input),
      true, `${dialogName} keyboard order should reach the date field after Close.`);
    for (const [index, field] of fields.entries()) {
      let isActive = await field.evaluate(input => document.activeElement === input);
      for (let tabCount = 0; tabCount < 12 && !isActive; tabCount += 1) {
        await page.keyboard.press('Tab');
        isActive = await field.evaluate(input => document.activeElement === input);
      }
      const keyboardStyle = await field.evaluate(input => ({
        active: document.activeElement === input,
        visible: input.matches(':focus-visible'),
        outlineStyle: getComputedStyle(input).outlineStyle,
        outlineWidth: getComputedStyle(input).outlineWidth,
        borderColor: getComputedStyle(input).borderTopColor,
        activeDescription: document.activeElement instanceof HTMLElement
          ? `${document.activeElement.tagName}#${document.activeElement.id}.${document.activeElement.className} type=${document.activeElement.getAttribute('type') ?? ''}`
          : null
      }));
      assert.equal(keyboardStyle.active, true,
        `${dialogName} keyboard order should reach ${fieldNames[index]}; focused ${keyboardStyle.activeDescription}.`);
      assert.equal(keyboardStyle.visible, true);
      assert.equal(keyboardStyle.outlineStyle, 'none', `${dialogName} should not add an outer ring for keyboard focus.`);
      assert.notEqual(keyboardStyle.borderColor, originalBorderColors[index],
        `${dialogName} keyboard focus should visibly change the existing ${fieldNames[index]} border.`);
    }
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
  }

  for (const textSize of ['small', 'medium', 'large'] as const) {
    await setPreviewTextSize(page, textSize);
    for (const viewportWidth of [375, 390, 430]) {
      await page.setViewportSize({ width: viewportWidth, height: 844 });
      await verifyActivityDialog(false);
      await verifyActivityDialog(true);
    }
  }

  for (const textSize of ['small', 'medium', 'large'] as const) {
    await setPreviewTextSize(page, textSize);
    for (const viewportWidth of [320, 375, 390, 430]) {
      await page.setViewportSize({ width: viewportWidth, height: 844 });
      const layout = await activityCard.evaluate(card => {
        const rows = [...card.querySelectorAll<HTMLElement>('.cardio-history-list > li')];
        if (rows.length === 0) throw new Error('Cardio history must render at least one run.');
        const layouts = rows.map(row => {
          const button = row.querySelector<HTMLButtonElement>('.cardio-activity-row');
          const main = button?.querySelector<HTMLElement>('.cardio-activity-row__main');
          const metadata = button?.querySelector<HTMLElement>('.cardio-activity-row__metadata');
          const distance = main?.querySelector<HTMLElement>('strong');
          const chevron = button?.querySelector<HTMLElement>('.cardio-activity-row__chevron');
          const pace = button?.querySelector<HTMLElement>('.cardio-activity-row__pace-cardio-chip');
          const divider = getComputedStyle(row, '::before');
          if (!button || !main || !metadata || !distance || !chevron) {
            throw new Error('Cardio history must use a compact, accessible run-details button.');
          }
          const paceBounds = pace?.getBoundingClientRect();
          const paceStyle = pace ? getComputedStyle(pace) : null;
          return {
            rowWidth: row.clientWidth,
            buttonWidth: button.clientWidth,
            mainWidth: main.clientWidth,
            mainScrollWidth: main.scrollWidth,
            metadataWidth: metadata.clientWidth,
            metadataScrollWidth: metadata.scrollWidth,
            distanceWordBreak: getComputedStyle(distance).wordBreak,
            chevronLeft: chevron.getBoundingClientRect().left,
            chevronRight: chevron.getBoundingClientRect().right,
            iconWidth: button.querySelector<HTMLElement>('.cardio-activity-row__type-icon')?.getBoundingClientRect().width,
            iconHeight: button.querySelector<HTMLElement>('.cardio-activity-row__type-icon')?.getBoundingClientRect().height,
            iconSvgWidth: button.querySelector<HTMLElement>('.cardio-activity-row__type-icon svg')?.getBoundingClientRect().width,
            iconSvgHeight: button.querySelector<HTMLElement>('.cardio-activity-row__type-icon svg')?.getBoundingClientRect().height,
            mainRight: main.getBoundingClientRect().right,
            paceText: pace?.textContent?.trim() ?? null,
            paceRight: paceBounds?.right,
            paceWhiteSpace: paceStyle?.whiteSpace,
            paceBackground: paceStyle?.backgroundColor,
            paceColor: paceStyle?.color,
            rowRadius: getComputedStyle(button).borderRadius,
            rowBorderTopWidth: getComputedStyle(button).borderTopWidth,
            dividerWidth: divider.width,
            dividerHeight: divider.height,
            dividerRadius: divider.borderRadius,
            dividerBackground: divider.backgroundColor,
            accessibleName: button.getAttribute('aria-label'),
            nestedButtons: button.querySelectorAll('button').length,
            text: button.textContent ?? ''
          };
        });
        return {
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          cardWidth: card.clientWidth,
          rows: layouts
        };
      });
      const label = `Cardio history at ${viewportWidth}px / ${textSize} text`;
      assert.equal(layout.viewportWidth, viewportWidth, `${label} viewport`);
      assert.equal(layout.documentWidth, viewportWidth, `${label} must not create page overflow`);
      assert.ok(layout.cardWidth <= viewportWidth);
      for (const [index, row] of layout.rows.entries()) {
        assert.ok(row.rowWidth <= layout.cardWidth + 1, `${label} row ${index + 1} must fit the card.`);
        assert.ok(row.buttonWidth > 0 && row.buttonWidth <= row.rowWidth + 1,
          `${label} row ${index + 1} button must remain inside its list item.`);
        assert.ok(row.mainWidth > 0 && row.mainScrollWidth <= row.mainWidth + 1,
          `${label} row ${index + 1} details must remain within their column.`);
        assert.ok(row.metadataWidth > 0 && row.metadataScrollWidth <= row.metadataWidth + 1,
          `${label} row ${index + 1} date and available performance text must fit.`);
        assert.equal(row.distanceWordBreak, 'normal',
          `${label} row ${index + 1} distance should not break in the middle of a word.`);
        assert.ok(row.mainRight <= row.chevronLeft,
          `${label} row ${index + 1} chevron must not overlap its content.`);
        assert.equal(row.rowRadius, '12px',
          `${label} row ${index + 1} should use the shared 12px row radius.`);
        assert.equal(row.rowBorderTopWidth, '0px',
          `${label} row ${index + 1} should not own a curved border divider.`);
        if (index > 0) {
          assert.equal(row.dividerHeight, '1px',
            `${label} row ${index + 1} divider should remain one thin pixel.`);
          assert.equal(row.dividerRadius, '0px',
            `${label} row ${index + 1} divider should have square ends.`);
          assert.notEqual(row.dividerBackground, 'rgba(0, 0, 0, 0)',
            `${label} row ${index + 1} divider should be visible.`);
        }
        if (row.paceText) {
          assert.equal(row.paceWhiteSpace, 'nowrap',
            `${label} row ${index + 1} pace unit should remain intact.`);
          assert.equal(row.paceBackground, 'rgba(0, 0, 0, 0)',
            `${label} row ${index + 1} pace indicator should have no pill background.`);
          if (row.paceText.includes('▼')) {
            assert.equal(row.paceColor, 'rgb(34, 197, 94)',
              `${label} row ${index + 1} faster pace should use Bright green.`);
          } else if (row.paceText.includes('▲')) {
            assert.equal(row.paceColor, 'rgb(239, 68, 68)',
              `${label} row ${index + 1} slower pace should use Bright red.`);
          }
          assert.ok(row.paceRight && row.paceRight <= row.chevronLeft,
            `${label} row ${index + 1} pace indicator should stay separated from the chevron.`);
        }
        assert.ok(row.iconWidth && row.iconWidth <= 40 && row.iconHeight && row.iconHeight <= 40,
          `${label} row ${index + 1} activity icon must remain bounded.`);
        assert.ok(row.iconSvgWidth && row.iconSvgWidth <= 22 && row.iconSvgHeight && row.iconSvgHeight <= 22,
          `${label} row ${index + 1} activity icon SVG must remain bounded.`);
        assert.equal(row.nestedButtons, 0, `${label} row ${index + 1} must not nest buttons.`);
        assert.match(row.accessibleName ?? '', /^Open (?:run|walk) details/);
      }

      const historyRow = activityCard.locator('.cardio-activity-row').first();
      await historyRow.hover();
      const hoverLayout = await historyRow.evaluate(element => ({
        background: getComputedStyle(element).backgroundColor,
        radius: getComputedStyle(element).borderRadius
      }));
      assert.notEqual(hoverLayout.background, 'rgba(0, 0, 0, 0)',
        `${label} row hover should use a contained background.`);
      assert.equal(hoverLayout.radius, '12px',
        `${label} row hover should retain rounded geometry.`);
      await historyRow.focus();
      const focusLayout = await historyRow.evaluate(element => ({
        outlineStyle: getComputedStyle(element).outlineStyle,
        outlineWidth: getComputedStyle(element).outlineWidth,
        radius: getComputedStyle(element).borderRadius
      }));
      assert.equal(focusLayout.outlineStyle, 'solid',
        `${label} row keyboard focus should remain visible.`);
      assert.equal(focusLayout.outlineWidth, '2px',
        `${label} row keyboard focus should use a 2px outline.`);
      assert.equal(focusLayout.radius, '12px',
        `${label} row keyboard focus should retain rounded geometry.`);

      const allActivitiesLayout = await page.locator('.cardio-all-activities-summary').evaluate(element => {
        const metrics = [...element.querySelectorAll<HTMLElement>('.cardio-activity-summary__metric')];
        const headings = [...element.querySelectorAll<HTMLElement>('dt')];
        const values = [...element.querySelectorAll<HTMLElement>('dd')];
        const heading = element.querySelector<HTMLElement>('.cardio-activity-summary__heading');
        const headingTitle = heading?.querySelector<HTMLElement>('h2');
        const metricsContainer = element.querySelector<HTMLElement>('.cardio-activity-summary__metrics');
        const explanation = element.querySelector<HTMLElement>('.cardio-activity-summary__explanation');
        return {
          subtitle: element.querySelector<HTMLElement>('.cardio-activity-summary__heading p')?.textContent?.trim(),
          cardPadding: getComputedStyle(element).padding,
          headingMarginBottom: heading ? getComputedStyle(heading).marginBottom : null,
          headingFontSize: headingTitle ? getComputedStyle(headingTitle).fontSize : null,
          explanationText: explanation?.textContent?.trim() ?? null,
          explanationFontSize: explanation ? getComputedStyle(explanation).fontSize : null,
          explanationMarginTop: explanation ? getComputedStyle(explanation).marginTop : null,
          metricCount: metrics.length,
          metricColumns: metricsContainer ? getComputedStyle(metricsContainer).gridTemplateColumns : null,
          metricWidth: metrics[0]?.getBoundingClientRect().width,
          metricHeights: metrics.map(metric => metric.getBoundingClientRect().height),
          headingAlignments: headings.map(heading => getComputedStyle(heading).textAlign),
          valueAlignments: values.map(value => getComputedStyle(value).textAlign),
          dividers: metrics.slice(1).map(metric => getComputedStyle(metric, '::before').height),
          dividerHeights: metrics.slice(1).map(metric => {
            const pseudo = getComputedStyle(metric, '::before');
            return pseudo.height;
          }),
          documentWidth: document.documentElement.scrollWidth
        };
      });
      assert.equal(allActivitiesLayout.subtitle, 'All-time totals.', `${label} All Activities subtitle`);
      assert.equal(allActivitiesLayout.cardPadding, '12px', `${label} All Activities should reduce outer padding.`);
      assert.equal(allActivitiesLayout.headingMarginBottom, '6px', `${label} All Activities should reduce header-to-metrics gap.`);
      const textScale = textSize === 'small' ? 1 : textSize === 'medium' ? 1.125 : 1.25;
      assert.equal(allActivitiesLayout.headingFontSize, `${20 * textScale}px`,
        `${label} All Activities should preserve the shared 20px heading.`);
      if (allActivitiesLayout.explanationText) {
        assert.equal(allActivitiesLayout.explanationFontSize, `${10 * textScale}px`,
          `${label} All Activities partial calorie text should remain smaller.`);
        assert.equal(allActivitiesLayout.explanationMarginTop, '4px',
          `${label} All Activities partial calorie text should stay close to the metrics.`);
        assert.match(allActivitiesLayout.explanationText, /^Calories available for \d+ of \d+ activities$/,
          `${label} All Activities partial calorie text should show its actual counts.`);
      }
      assert.equal(allActivitiesLayout.metricCount, 3, `${label} All Activities should keep three equal columns.`);
      assert.ok(allActivitiesLayout.metricWidth && allActivitiesLayout.metricWidth > 0);
      assert.ok(allActivitiesLayout.metricHeights.every(height => Math.abs(height - allActivitiesLayout.metricHeights[0]!) < 0.5),
        `${label} All Activities metric columns should keep equal heights.`);
      assert.ok(allActivitiesLayout.headingAlignments.every(alignment => alignment === 'center'),
        `${label} All Activities labels should be centered.`);
      assert.ok(allActivitiesLayout.valueAlignments.every(alignment => alignment === 'center'),
        `${label} All Activities values should be centered.`);
      assert.ok(allActivitiesLayout.dividers.every(width => width !== '0px'),
        `${label} All Activities should keep subtle dividers.`);
      assert.equal(allActivitiesLayout.documentWidth, viewportWidth);

      const latestLayout = await page.locator('.cardio-latest-activity').evaluate(element => {
        const metrics = [...element.querySelectorAll<HTMLElement>('.cardio-activity-performance__metrics > div')];
        const comparison = element.querySelector<HTMLElement>('.cardio-activity-comparison');
        const deltas = comparison
          ? [...comparison.querySelectorAll<HTMLElement>('.cardio-activity-comparison__delta')]
          : [];
        if (deltas.length === 3) {
          const sampleValues = [
            null,
            { text: '+289', unit: 'kcal' },
            { text: '+2.2', unit: 'mi' }
          ] as const;
          deltas.forEach((delta, index) => {
            const sample = sampleValues[index];
            if (!sample) return;
            const strong = delta.querySelector<HTMLElement>('dd strong');
            if (!strong) return;
            const caret = document.createElement('span');
            caret.className = 'cardio-activity-comparison__delta-caret';
            caret.setAttribute('aria-hidden', 'true');
            caret.textContent = '▲';
            const text = document.createElement('span');
            text.className = 'cardio-activity-comparison__delta-text';
            text.textContent = sample.text;
            const unit = document.createElement('span');
            unit.className = 'cardio-activity-comparison__delta-unit';
            unit.textContent = sample.unit;
            strong.replaceChildren(caret, document.createTextNode(' '), text,
              document.createTextNode(' '), unit);
          });
        }
        const deltaLayout = comparison
          ? [...comparison.querySelectorAll<HTMLElement>('.cardio-activity-comparison__delta')].map(delta => {
              const dt = delta.querySelector<HTMLElement>('dt');
              const dd = delta.querySelector<HTMLElement>('dd');
              const strong = delta.querySelector<HTMLElement>('dd strong');
              const icon = delta.querySelector<HTMLElement>('.cardio-activity-comparison__delta-icon');
              const caret = strong?.querySelector<HTMLElement>('.cardio-activity-comparison__delta-caret');
              const text = strong?.querySelector<HTMLElement>('.cardio-activity-comparison__delta-text');
              const unit = strong?.querySelector<HTMLElement>('.cardio-activity-comparison__delta-unit');
              const dtRect = dt?.getBoundingClientRect();
              const ddRect = dd?.getBoundingClientRect();
              const iconRect = icon?.getBoundingClientRect();
              const strongRect = strong?.getBoundingClientRect();
              const deltaRect = delta.getBoundingClientRect();
              return {
                background: getComputedStyle(delta).backgroundColor,
                height: delta.getBoundingClientRect().height,
                strongFontSize: strong ? getComputedStyle(strong).fontSize : null,
                strongColor: strong ? getComputedStyle(strong).color : null,
                strongClass: strong?.className ?? null,
                caretFontSize: caret ? getComputedStyle(caret).fontSize : null,
                textFontSize: text ? getComputedStyle(text).fontSize : null,
                unitFontSize: unit ? getComputedStyle(unit).fontSize : null,
                caretText: caret?.textContent?.trim() ?? null,
                valueText: text?.textContent?.trim() ?? null,
                unitText: unit?.textContent?.trim() ?? null,
                strongFits: !!strongRect
                  && strongRect.left >= deltaRect.left - 1
                  && strongRect.right <= deltaRect.right + 1,
                iconAndLabel: !!dtRect && !!iconRect
                  && Math.abs(iconRect.top - dtRect.top) < 2
                  && iconRect.left < dtRect.right,
                valueBelowLabel: !!dtRect && !!ddRect && ddRect.top >= dtRect.bottom - 1
              };
            })
          : [];
        const icons = metrics.map(metric => {
          const icon = metric.querySelector<HTMLElement>('.cardio-activity-performance__icon');
          const dt = metric.querySelector<HTMLElement>('dt');
          const dd = metric.querySelector<HTMLElement>('dd');
          const iconBounds = icon?.getBoundingClientRect();
          const dtBounds = dt?.getBoundingClientRect();
          const ddBounds = dd?.getBoundingClientRect();
          return {
            width: iconBounds?.width,
            height: iconBounds?.height,
            svgWidth: icon?.querySelector('svg')?.getBoundingClientRect().width,
            svgHeight: icon?.querySelector('svg')?.getBoundingClientRect().height,
            labelBelowIcon: !!iconBounds && !!dtBounds && dtBounds.top >= iconBounds.bottom,
            valueBelowLabel: !!dtBounds && !!ddBounds && ddBounds.top >= dtBounds.bottom
          };
        });
        return {
          metricCount: metrics.length,
          metricColumns: getComputedStyle(metrics[0]?.parentElement ?? element).gridTemplateColumns,
          comparisonBackground: comparison ? getComputedStyle(comparison).backgroundColor : null,
          comparisonRadius: comparison ? getComputedStyle(comparison).borderRadius : null,
          comparisonPadding: comparison ? getComputedStyle(comparison).padding : null,
          comparisonBorder: comparison ? getComputedStyle(comparison).borderTopWidth : null,
          deltaCount: deltas.length,
          deltaColumns: comparison ? getComputedStyle(comparison.querySelector('.cardio-activity-comparison__deltas') as Element).gridTemplateColumns : null,
          deltaLayout,
          icons
        };
      });
      assert.equal(latestLayout.metricCount, 3, `${label} should keep three metric columns.`);
      assert.equal(latestLayout.deltaCount, 3, `${label} should keep three comparison areas.`);
      assert.equal(latestLayout.comparisonBackground, 'rgba(0, 0, 0, 0)',
        `${label} comparison outer surface should remain transparent.`);
      assert.equal(latestLayout.comparisonRadius, '0px',
        `${label} comparison outer surface should not use rounded corners.`);
      assert.equal(latestLayout.comparisonPadding, '10px 0px 0px',
        `${label} comparison outer surface should not use inset card padding.`);
      const expectedDeltaColumns =
        textSize === 'large' || viewportWidth <= 360 || (textSize === 'medium' && viewportWidth <= 399)
          ? 1
          : 3;
      const deltaColumnCount = latestLayout.deltaColumns
        ?.trim().split(/\s+/).filter(Boolean).length ?? 0;
      assert.equal(deltaColumnCount, expectedDeltaColumns,
        `${label} comparison should use ${expectedDeltaColumns} direct column(s).`);
      for (const icon of latestLayout.icons) {
        assert.ok(icon.width && icon.width <= 24 && icon.height && icon.height <= 24,
          `${label} metric icon wrapper should stay bounded.`);
        assert.ok(icon.svgWidth && icon.svgWidth <= 24 && icon.svgHeight && icon.svgHeight <= 24,
          `${label} metric SVG should stay bounded.`);
        assert.equal(icon.labelBelowIcon, true, `${label} label should sit below its icon.`);
        assert.equal(icon.valueBelowLabel, true, `${label} value should sit below its label.`);
      }
      if (latestLayout.deltaLayout.length === 3) {
        for (const tile of latestLayout.deltaLayout) {
          assert.equal(tile.iconAndLabel, true, `${label} tile icon and label should share one row.`);
          assert.equal(tile.valueBelowLabel, true, `${label} tile value should sit below its label.`);
          assert.equal(tile.strongFits, true, `${label} tile delta, caret, and unit should stay together.`);
          assert.notEqual(tile.background, 'rgba(0, 0, 0, 0)', `${label} comparison tile should be shaded.`);
          const textScale = textSize === 'small' ? 1 : textSize === 'medium' ? 1.125 : 1.25;
          assert.equal(tile.strongFontSize, `${18 * textScale}px`,
            `${label} tile middle-row delta text should remain 18px at standard size.`);
          assert.equal(tile.caretFontSize, `${12 * textScale}px`,
            `${label} tile caret should remain 12px at standard size.`);
          assert.equal(tile.unitFontSize, `${13 * textScale}px`,
            `${label} tile unit should remain 13px at standard size.`);
          assert.equal(tile.textFontSize, `${18 * textScale}px`,
            `${label} tile numeric text should remain 18px at standard size.`);
          if (tile.strongClass?.includes('--positive')) {
            assert.equal(tile.strongColor, 'rgb(34, 197, 94)',
              `${label} positive tile should use Bright green.`);
            if (tile.valueText === '+289') {
              assert.equal(tile.unitText, 'kcal',
                `${label} ▲ +289 kcal must remain a single contained delta.`);
            } else if (tile.valueText === '+2.2') {
              assert.equal(tile.unitText, 'mi',
                `${label} ▲ +2.2 mi must remain a single contained delta.`);
            }
          } else if (tile.strongClass?.includes('--negative')) {
            assert.equal(tile.strongColor, 'rgb(239, 68, 68)',
              `${label} negative tile should use Bright red.`);
          }
        }
        assert.ok(latestLayout.deltaLayout.every(tile =>
          Math.abs(tile.height - latestLayout.deltaLayout[0]!.height) < 0.5
        ), `${label} comparison tiles should have equal heights.`);
      }
    }
  }

  await page.getByRole('button', { name: 'Add activity' }).click();
  const calorieDialog = page.getByRole('dialog', { name: 'Log activity' });
  await calorieDialog.getByRole('combobox', { name: 'Activity type' }).selectOption('run');
  const calorieInfo = calorieDialog.locator('.cardio-calorie-estimate__help summary');
  await calorieDialog.getByRole('spinbutton', { name: 'Seconds' }).focus();
  await page.keyboard.press('Tab');
  const infoFocus = await calorieInfo.evaluate(element => ({
    focused: document.activeElement === element,
    visible: element.matches(':focus-visible'),
    outlineStyle: getComputedStyle(element).outlineStyle,
    outlineWidth: getComputedStyle(element).outlineWidth
  }));
  assert.deepEqual(infoFocus, {
    focused: true,
    visible: true,
    outlineStyle: 'solid',
    outlineWidth: '2px'
  }, 'Estimated-calorie information must have a visible keyboard-focus indicator.');
  await page.keyboard.press('Enter');
  await calorieDialog.getByText(/rough gross-energy estimate, not active calories/).waitFor();
  await calorieDialog.getByRole('button', { name: 'Cancel' }).click();
  await calorieDialog.waitFor({ state: 'detached' });

  await page.setViewportSize({ width: 375, height: 844 });
  await setPreviewTextSize(page, 'large');
  await page.getByRole('button', { name: 'Add activity' }).click();
  const markerRunDialog = page.getByRole('dialog', { name: 'Log activity' });
  await markerRunDialog.getByRole('combobox', { name: 'Activity type' }).selectOption('run');
  await markerRunDialog.getByLabel('Distance (miles)').fill('1.23');
  await markerRunDialog.getByLabel('Notes (optional)')
    .fill('Synthetic run detail note. '.repeat(35));
  await markerRunDialog.getByRole('button', { name: 'Save activity' }).click();
  await markerRunDialog.waitFor({ state: 'detached' });
  await cardioTabs.getByRole('tab', { name: 'Insights' }).click();
  const runMarker = page.locator('.cardio-week-day.is-today .cardio-week-day__marker');
  await runMarker.scrollIntoViewIfNeeded();
  const markerDetails = await runMarker.evaluate(button => {
    const tooltip = button.nextElementSibling;
    const zone = button.closest('.tool-zone');
    const accent = zone?.querySelector<HTMLElement>('.tool-zone__purpose');
    return {
      label: button.getAttribute('aria-label'),
      describedBy: button.getAttribute('aria-describedby'),
      markerColor: getComputedStyle(button).color,
      accentColor: accent ? getComputedStyle(accent).color : null,
      tooltipText: tooltip?.textContent,
      tooltipInitiallyHidden: tooltip ? getComputedStyle(tooltip).display === 'none' : false
    };
  });
  assert.match(markerDetails.label ?? '', /View 2 activities.*1\.23 mile run/);
  assert.ok(markerDetails.describedBy);
  assert.equal(markerDetails.markerColor, markerDetails.accentColor,
    'Logged-run markers use the existing Insights blue.');
  assert.ok(markerDetails.tooltipText?.includes('1.23 mile run'));
  assert.equal(markerDetails.tooltipInitiallyHidden, true);
  await runMarker.hover();
  assert.equal(await runMarker.evaluate(button =>
    getComputedStyle(button.nextElementSibling as HTMLElement).display), 'block');
  await page.mouse.move(0, 0);
  await runMarker.focus();
  assert.equal(await runMarker.evaluate(button => document.activeElement === button), true);
  assert.equal(await runMarker.evaluate(button =>
    getComputedStyle(button.nextElementSibling as HTMLElement).display), 'block');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  const markerFocus = await runMarker.evaluate(button => {
    const strip = button.closest<HTMLElement>('.cardio-week-strip');
    const bounds = button.getBoundingClientRect();
    const style = getComputedStyle(button);
    if (!strip) throw new Error('Cardio run marker needs its weekly calendar.');
    return {
      active: document.activeElement === button,
      visible: button.matches(':focus-visible'),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      right: bounds.right,
      viewportWidth: document.documentElement.clientWidth,
      stripOverflow: getComputedStyle(strip).overflow
    };
  });
  assert.equal(markerFocus.active, true);
  assert.equal(markerFocus.visible, true);
  assert.equal(markerFocus.outlineStyle, 'solid');
  assert.equal(markerFocus.outlineWidth, '2px');
  assert.ok(markerFocus.right <= markerFocus.viewportWidth);
  assert.equal(markerFocus.stripOverflow, 'visible');

  const beforeDetailsScroll = await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0);
  await runMarker.click();
  const runPopover = page.getByRole('dialog', { name: /Activities on/ });
  const popoverBounds = await runPopover.boundingBox();
  assert.ok(popoverBounds);
  assert.ok(popoverBounds!.x >= 0 && popoverBounds!.y >= 0);
  assert.ok(popoverBounds!.x + popoverBounds!.width <= 376,
    `Popover right edge ${popoverBounds!.x + popoverBounds!.width} should stay within the mobile viewport.`);
  assert.ok(popoverBounds!.y + popoverBounds!.height <= 845,
    `Popover bottom edge ${popoverBounds!.y + popoverBounds!.height} should stay within the mobile viewport.`);
  assert.equal(await runPopover.getByText('1.23 mile run').isVisible(), true);
  await runPopover.getByRole('button', { name: /Details for 1.23 mile run/ }).click();
  assert.equal(await cardioTabs.getByRole('tab', { name: 'Activities' }).getAttribute('aria-selected'), 'true');
  const runDetailsDialog = page.getByRole('dialog', { name: 'Run details' });
  const detailLayout = await runDetailsDialog.evaluate(dialog => {
    const bounds = dialog.getBoundingClientRect();
    const scrollRegion = dialog.querySelector<HTMLElement>('.money-goal-dialog__scroll-region');
    const close = dialog.querySelector<HTMLElement>('.money-goal-dialog__close');
    if (!scrollRegion || !close) throw new Error('Run details needs a scroll region and top close control.');
    const before = scrollRegion.scrollTop;
    scrollRegion.scrollTop = scrollRegion.scrollHeight;
    return {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
      viewportHeight: document.documentElement.clientHeight,
      overflowY: getComputedStyle(scrollRegion).overflowY,
      scrollHeight: scrollRegion.scrollHeight,
      clientHeight: scrollRegion.clientHeight,
      scrollTop: scrollRegion.scrollTop,
      initialScrollTop: before,
      closeTop: close.getBoundingClientRect().top
    };
  });
  assert.deepEqual({
    left: detailLayout.left,
    top: detailLayout.top,
    width: detailLayout.width,
    height: detailLayout.height,
    overflowY: detailLayout.overflowY
  }, {
    left: 0,
    top: 0,
    width: 375,
    height: detailLayout.viewportHeight,
    overflowY: 'auto'
  });
  assert.ok(detailLayout.scrollHeight > detailLayout.clientHeight);
  assert.ok(detailLayout.scrollTop > detailLayout.initialScrollTop,
    'Run details content should scroll inside the full-screen dialog.');
  assert.ok(detailLayout.closeTop >= 0 && detailLayout.closeTop < 80,
    'The Close control stays in the persistent top-right header.');
  assert.equal(await runDetailsDialog.getByText('1.23 miles').isVisible(), true);
  assert.equal(await runDetailsDialog.getByText('Not recorded').isVisible(), true);
  await runDetailsDialog.getByRole('button', { name: 'Close run details' }).click();
  await runDetailsDialog.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0), beforeDetailsScroll,
    'Closing run details restores the page scroll position.');
  assert.match(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''),
    /Open (?:latest )?run details for 1\.23 miles/);

  await page.getByRole('button', { name: 'People', exact: true }).click();
  const peopleCard = page.locator('.people-view__list .people-card').first();
  const peopleCardButton = peopleCard.locator('.people-card__open');
  await peopleCardButton.waitFor();
  assert.equal(await peopleCardButton.getAttribute('aria-label'),
    'Open profile for Alexandria-Brooks-Williams-ExtremelyLong Synthetic Person');
  assert.equal(await peopleCard.locator('.people-card__name').textContent(),
    'Alexandria-Brooks-Williams-ExtremelyLong');
  assert.equal(await peopleCard.locator('.people-card__relationship').textContent(),
    'A very long synthetic relationship that wraps at narrow widths');
  assert.equal(await peopleCard.locator('.people-card__classification').textContent(), 'Marriage');
  assert.equal(await peopleCard.locator('.people-card__connection-label').textContent(), 'Connected');
  assert.equal(await peopleCard.locator('.people-card__connection-time').textContent(), '1 wk ago');
  assert.equal(await peopleCard.locator('.people-card__age').textContent(), 'Age 47');
  assert.equal(await peopleCard.locator('.people-card__age').count(), 1);
  assert.ok(await peopleCard.locator('.person-badge-avatar').count() > 0,
    'People cards retain the initials fallback when there is no saved photo.');

  for (const textSize of ['small', 'medium', 'large'] as const) {
    await setPreviewTextSize(page, textSize);
    for (const viewportWidth of [375, 390, 430]) {
      await page.setViewportSize({ width: viewportWidth, height: 844 });
      const layout = await peopleCard.evaluate(card => {
        const button = card.querySelector<HTMLElement>('.people-card__open');
        const score = card.querySelector<HTMLElement>('.people-card__score');
        const connection = card.querySelector<HTMLElement>('.people-card__connection-detail');
        const age = card.querySelector<HTMLElement>('.people-card__age');
        const footer = card.querySelector<HTMLElement>('.people-card__birthday-footer');
        const birthdayIcon = card.querySelector<HTMLElement>('.people-card__birthday svg');
        const classification = card.querySelector<HTMLElement>('.people-card__classifications');
        const name = card.querySelector<HTMLElement>('.people-card__name');
        const relationship = card.querySelector<HTMLElement>('.people-card__relationship');
        const avatar = card.querySelector<HTMLElement>('.person-badge-avatar');
        if (!button || !score || !connection || !age || !footer || !birthdayIcon
          || !classification || !name || !relationship || !avatar) {
          throw new Error('The synthetic People card is missing required content.');
        }
        const rect = (element: Element) => {
          const bounds = element.getBoundingClientRect();
          return {
            left: bounds.left,
            right: bounds.right,
            top: bounds.top,
            bottom: bounds.bottom
          };
        };
        const style = getComputedStyle(button);
        const buttonBounds = rect(button);
        return {
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          contentLeft: buttonBounds.left + Number.parseFloat(style.paddingLeft),
          contentRight: buttonBounds.right - Number.parseFloat(style.paddingRight),
          score: rect(score),
          connection: rect(connection),
          age: rect(age),
          footer: rect(footer),
          birthdayIcon: rect(birthdayIcon),
          classification: rect(classification),
          name: rect(name),
          relationship: rect(relationship),
          avatar: rect(avatar)
        };
      });
      const label = `People card at ${viewportWidth}px / ${textSize} text`;
      assert.equal(layout.viewportWidth, viewportWidth, `${label} viewport width`);
      assert.equal(layout.documentWidth, viewportWidth, `${label} must not overflow horizontally`);
      for (const [name, right] of [
        ['Health score', layout.score.right],
        ['Connected badge', layout.connection.right],
        ['Age', layout.age.right],
        ['divider', layout.footer.right]
      ] as const) {
        assert.ok(Math.abs(right - layout.contentRight) <= 1,
          `${label} ${name} right edge ${right} must align to shared content edge ${layout.contentRight}.`);
      }
      for (const [name, left] of [
        ['category badge group', layout.classification.left],
        ['birthday icon', layout.birthdayIcon.left],
        ['divider', layout.footer.left]
      ] as const) {
        assert.ok(Math.abs(left - layout.contentLeft) <= 1,
          `${label} ${name} left edge ${left} must align to shared content edge ${layout.contentLeft}.`);
      }
      assert.ok(layout.avatar.left < layout.name.left && layout.avatar.right < layout.name.left,
        `${label} photo should sit to the left of the name.`);
      assert.ok(layout.relationship.top >= layout.name.bottom,
        `${label} relationship should sit below the name.`);
    }
  }

await peopleCardButton.click();
await page.getByRole('tab', { name: 'Connections' }).click();
const sparkCard = page.locator('.person-spark-card').first();
const completedSparkCard = page.locator('.person-spark-card').nth(1);
await sparkCard.waitFor({ state: 'visible' });
await completedSparkCard.waitFor({ state: 'visible' });
assert.equal(await sparkCard.locator('.person-spark-card__title').textContent(),
  'Plan a deliberately long one-off Spark title that wraps naturally at mobile sizes');
assert.equal(await sparkCard.locator('.person-spark-card__people .person-badge-visual').count(), 2);
assert.equal((await sparkCard.locator('.person-spark-card__footer').innerText()).trim(), 'Someday');
assert.equal(await sparkCard.locator('.person-spark-card__description').count(), 1);
assert.equal(await completedSparkCard.locator('.person-spark-card__description').count(), 0);
assert.equal(await sparkCard.getByRole('button', { name: /Actions for/ }).count(), 0);
for (const textSize of ['small', 'medium', 'large'] as const) {
  await setPreviewTextSize(page, textSize);
  for (const viewportWidth of [375, 390, 430]) {
    await page.setViewportSize({ width: viewportWidth, height: 844 });
    const layout = await sparkCard.evaluate(card => {
      const element = card as HTMLElement;
      const rect = (selector: string) => {
        const target = element.querySelector<HTMLElement>(selector);
        if (!target) throw new Error(`Missing Spark layout element: ${selector}`);
        const bounds = target.getBoundingClientRect();
        return {
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          bottom: bounds.bottom,
          width: bounds.width,
          height: bounds.height,
          scrollWidth: target.scrollWidth,
          clientWidth: target.clientWidth
        };
      };
      const bounds = element.getBoundingClientRect();
      const body = rect('.person-spark-card__body');
      const people = rect('.person-spark-card__people');
      const action = rect('.person-spark-card__do-it');
      const edit = rect('.person-spark-card__edit');
      return {
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        card: {
          left: bounds.left,
          right: bounds.right,
          width: bounds.width,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth
        },
        background: getComputedStyle(element).backgroundColor,
        borderColor: getComputedStyle(element).borderTopColor,
        actionColor: getComputedStyle(element.querySelector('.person-spark-card__do-it')!).color,
        actionBackground: getComputedStyle(element.querySelector('.person-spark-card__do-it')!).backgroundColor,
        titleColor: getComputedStyle(element.querySelector('.person-spark-card__title')!).color,
        descriptionColor: getComputedStyle(element.querySelector('.person-spark-card__description')!).color,
        title: rect('.person-spark-card__title'),
        description: rect('.person-spark-card__description'),
        body,
        people,
        action,
        edit,
        footer: rect('.person-spark-card__footer'),
        cardRadius: getComputedStyle(element).borderRadius,
        cardPadding: getComputedStyle(element).padding,
        titleFontSize: getComputedStyle(element.querySelector('.person-spark-card__title')!).fontSize,
        footerColor: getComputedStyle(element.querySelector('.person-spark-card__footer')!).color,
        sparkleFill: getComputedStyle(element.querySelector('.person-spark-card__footer-label svg')!).fill,
        sparkleStroke: getComputedStyle(element.querySelector('.person-spark-card__footer-label svg')!).stroke,
        sparkleStrokeWidth: getComputedStyle(element.querySelector('.person-spark-card__footer-label svg')!).strokeWidth,
        editColor: getComputedStyle(element.querySelector('.person-spark-card__edit')!).color,
        editBackground: getComputedStyle(element.querySelector('.person-spark-card__edit')!).backgroundColor,
        editBorderWidth: getComputedStyle(element.querySelector('.person-spark-card__edit')!).borderTopWidth,
        badgeBackground: getComputedStyle(element.querySelector('.rhythm-person-badge')!).backgroundColor,
        badgeBorderWidth: getComputedStyle(element.querySelector('.rhythm-person-badge')!).borderTopWidth,
        badgeColor: getComputedStyle(element.querySelector('.rhythm-person-badge')!).color,
        badgeVisualBackground: getComputedStyle(element.querySelector('.person-badge-visual')!).backgroundColor,
        badgeVisualBorderColor: getComputedStyle(element.querySelector('.person-badge-visual')!).borderTopColor,
        avatarBackground: getComputedStyle(element.querySelector('.person-badge-avatar')!).backgroundColor,
        avatarColor: getComputedStyle(element.querySelector('.person-badge-avatar')!).color
      };
    });
    const label = `Spark card at ${viewportWidth}px / ${textSize} text`;
    assert.equal(layout.viewportWidth, viewportWidth, `${label} viewport`);
    assert.equal(layout.documentWidth, viewportWidth, `${label} must not overflow the page`);
    assert.equal(layout.background, 'rgb(254, 251, 230)', `${label} must use the approved pale-yellow surface`);
    assert.equal(layout.borderColor, 'rgb(230, 228, 164)', `${label} must use the approved pale-yellow border`);
    assert.equal(layout.cardRadius, '15px');
    assert.equal(layout.cardPadding, '11px 14px');
    assert.equal(layout.titleFontSize, textSize === 'small' ? '19px' : textSize === 'medium' ? '21.375px' : '23.75px');
    assert.equal(layout.titleColor, 'rgb(32, 39, 35)');
    assert.equal(layout.descriptionColor, 'rgb(79, 78, 20)');
    assert.equal(layout.footerColor, 'rgb(79, 78, 20)');
    assert.equal(layout.sparkleFill, 'rgb(227, 168, 28)');
    assert.equal(layout.sparkleStroke, 'rgb(138, 98, 0)');
    assert.equal(layout.sparkleStrokeWidth, '1.5px');
    assert.equal(layout.editColor, 'rgb(79, 78, 20)');
    assert.equal(layout.editBackground, 'rgba(0, 0, 0, 0)');
    assert.equal(layout.editBorderWidth, '0px');
    assert.equal(layout.badgeBackground, 'rgb(255, 255, 255)');
    assert.equal(layout.badgeBorderWidth, '0px', `${label} must not double-outline People badges.`);
    assert.equal(layout.badgeColor, 'rgb(0, 0, 0)');
    assert.equal(layout.badgeVisualBackground, 'rgb(255, 255, 255)');
    assert.equal(layout.badgeVisualBorderColor, 'rgb(230, 228, 164)');
    assert.equal(layout.avatarBackground, 'rgb(229, 242, 235)');
    assert.equal(layout.avatarColor, 'rgb(36, 107, 82)');
    assert.ok(contrastRatio(layout.actionColor, layout.actionBackground) >= 4.5,
      `${label} action text contrast must meet 4.5:1.`);
    assert.equal(layout.actionColor, 'rgb(255, 255, 255)');
    assert.equal(layout.actionBackground, 'rgb(36, 107, 82)');
    assert.equal(layout.edit.width, 44);
    assert.equal(layout.edit.height, 44);
    assert.ok(layout.card.scrollWidth <= layout.card.clientWidth + 1,
      `${label} card content must not overflow its border.`);
    for (const [name, bounds] of [
      ['title', layout.title],
      ['description', layout.description],
      ['footer', layout.footer],
      ['edit control', layout.edit]
    ] as const) {
      assert.ok(bounds.left >= layout.card.left && bounds.right <= layout.card.right,
        `${label} ${name} must remain inside the card.`);
      assert.ok(bounds.scrollWidth <= bounds.clientWidth + 1,
        `${label} ${name} must wrap without clipping.`);
    }
    assert.ok(layout.body.top >= layout.description.bottom - 1,
      `${label} people and action body should follow the description.`);
    assert.ok(layout.action.right <= layout.body.right + 1,
      `${label} Do it action should align to the right of its body.`);
    const peopleAndActionOverlap = layout.people.left < layout.action.right
      && layout.people.right > layout.action.left
      && layout.people.top < layout.action.bottom
      && layout.people.bottom > layout.action.top;
    assert.equal(peopleAndActionOverlap, false,
      `${label} associated people badges and Do it action must wrap without overlap.`);
    assert.ok(layout.title.right < layout.edit.left,
      `${label} title and quiet edit control must not overlap.`);

    const completedLayout = await completedSparkCard.evaluate(card => {
      const element = card as HTMLElement;
      const title = element.querySelector<HTMLElement>('.person-spark-card__title');
      const footer = element.querySelector<HTMLElement>('.person-spark-card__footer');
      if (!title || !footer) throw new Error('Completed Spark is missing its shared card layout.');
      return {
        cardWidth: element.clientWidth,
        cardScrollWidth: element.scrollWidth,
        titleFits: title.scrollWidth <= title.clientWidth + 1,
        footerFits: footer.scrollWidth <= footer.clientWidth + 1,
        hasEdit: element.querySelector('.person-spark-card__edit') !== null,
        hasDoIt: element.querySelector('.person-spark-card__do-it') !== null
      };
    });
    assert.ok(completedLayout.cardScrollWidth <= completedLayout.cardWidth + 1,
      `${label} completed Spark should not overflow its card.`);
    assert.ok(completedLayout.titleFits && completedLayout.footerFits,
      `${label} completed Spark title and completion footer should wrap without clipping.`);
    assert.equal(completedLayout.hasEdit, true);
    assert.equal(completedLayout.hasDoIt, false);
  }
}

const sparkEdit = sparkCard.getByRole('button', {
  name: 'Edit Plan a deliberately long one-off Spark title that wraps naturally at mobile sizes'
});
const addSpark = page.getByRole('button', { name: '+ Add Spark' });
const addSparkStyle = await addSpark.evaluate(button => ({
  background: getComputedStyle(button).backgroundColor,
  color: getComputedStyle(button).color,
  borderColor: getComputedStyle(button).borderTopColor,
  height: getComputedStyle(button).minHeight
}));
assert.equal(addSparkStyle.background, 'rgb(255, 255, 255)');
assert.equal(addSparkStyle.color, 'rgb(36, 107, 82)');
assert.equal(addSparkStyle.borderColor, 'rgb(36, 107, 82)');
assert.equal(addSparkStyle.height, '42px');
assert.ok(contrastRatio(addSparkStyle.color, addSparkStyle.background) >= 4.5,
  'Add Spark text contrast must meet 4.5:1.');
await addSpark.hover();
const addSparkHoverBackground = await addSpark.evaluate(button => getComputedStyle(button).backgroundColor);
assert.equal(await colorsRenderIdentically(page, addSparkHoverBackground, 'rgb(233, 240, 238)'), true,
  'Add Spark hover should render the approved pale-teal surface.');
const disabledAddStyles = await addSpark.evaluate(button => {
  const control = button as HTMLButtonElement;
  control.disabled = true;
  const styles = { opacity: getComputedStyle(control).opacity, cursor: getComputedStyle(control).cursor };
  control.disabled = false;
  return styles;
});
assert.deepEqual(disabledAddStyles, { opacity: '0.55', cursor: 'not-allowed' });
const addBounds = await addSpark.boundingBox();
assert.ok(addBounds);
await page.mouse.move(addBounds.x + addBounds.width / 2, addBounds.y + addBounds.height / 2);
await page.mouse.down();
const addSparkPressedBackground = await addSpark.evaluate(button => getComputedStyle(button).backgroundColor);
assert.equal(await colorsRenderIdentically(page, addSparkPressedBackground, 'rgb(216, 228, 224)'), true,
  'Add Spark pressed state should render the approved teal surface.');
await page.mouse.up();
const addSparkDialog = page.getByRole('dialog', { name: 'Add Spark' });
await addSparkDialog.getByRole('button', { name: 'Cancel' }).click();
await sparkEdit.click();
const sparkDetails = page.getByRole('dialog', { name: 'Spark details' });
await sparkDetails.getByRole('textbox', { name: 'Title' }).waitFor();
await sparkDetails.getByRole('button', { name: 'Cancel' }).click();
assert.equal(await sparkEdit.evaluate(element => document.activeElement === element),
  true, 'Closing Spark editing should return focus to its pencil control.');
await sparkEdit.focus();
await page.keyboard.press('Tab');
await page.keyboard.press('Shift+Tab');
const sparkEditFocus = await sparkEdit.evaluate(element => ({
  visible: element.matches(':focus-visible'),
  outlineStyle: getComputedStyle(element).outlineStyle,
  outlineWidth: getComputedStyle(element).outlineWidth,
  outlineColor: getComputedStyle(element).outlineColor
}));
assert.deepEqual(sparkEditFocus, {
  visible: true,
  outlineStyle: 'solid',
  outlineWidth: '2px',
  outlineColor: 'rgb(36, 107, 82)'
});
const doItButton = sparkCard.getByRole('button', { name: 'Do it' });
await doItButton.hover();
assert.equal(await doItButton.evaluate(button => getComputedStyle(button).backgroundColor), 'rgb(28, 88, 68)');
await doItButton.focus();
await page.keyboard.press('Tab');
await page.keyboard.press('Shift+Tab');
assert.deepEqual(await doItButton.evaluate(button => ({
  visible: button.matches(':focus-visible'),
  outlineColor: getComputedStyle(button).outlineColor
})), { visible: true, outlineColor: 'rgb(36, 107, 82)' });
const disabledDoItStyles = await doItButton.evaluate(button => {
  const control = button as HTMLButtonElement;
  control.disabled = true;
  const styles = { opacity: getComputedStyle(control).opacity, cursor: getComputedStyle(control).cursor };
  control.disabled = false;
  return styles;
});
assert.deepEqual(disabledDoItStyles, { opacity: '0.55', cursor: 'not-allowed' });
const doItBounds = await doItButton.boundingBox();
assert.ok(doItBounds);
await page.mouse.move(doItBounds.x + doItBounds.width / 2, doItBounds.y + doItBounds.height / 2);
await page.mouse.down();
assert.equal(await doItButton.evaluate(button => getComputedStyle(button).backgroundColor), 'rgb(28, 88, 68)');
await page.mouse.up();
const sparkConnectionDialog = page.getByRole('dialog', { name: 'Log a connection for this Spark' });
await sparkConnectionDialog.getByRole('button', { name: 'Cancel' }).click();
assert.equal(await doItButton.evaluate(element => document.activeElement === element),
  true, 'Cancelling Do it should return focus to the primary action.');
await context.close();
}

async function main() {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'tend-pages-css-'));
  const catalogOutputDirectory = await mkdtemp(path.join(os.tmpdir(), 'tend-catalog-css-'));
  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let previewServer: ReturnType<typeof spawn> | undefined;
  const catalogPort = await availablePort();
  const catalogUrl = `http://127.0.0.1:${catalogPort}`;
  const catalogServer = createServer(async (request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url ?? '/', catalogUrl).pathname);
    const filePath = path.resolve(catalogOutputDirectory, `.${requestPath}`);
    if (!filePath.startsWith(`${catalogOutputDirectory}${path.sep}`)) {
      response.writeHead(404).end();
      return;
    }
    try {
      const contents = await readFile(filePath);
      const contentType = filePath.endsWith('.html')
        ? 'text/html'
        : filePath.endsWith('.js') ? 'text/javascript'
          : filePath.endsWith('.css') ? 'text/css'
            : 'application/octet-stream';
      response.writeHead(200, { 'content-type': contentType }).end(contents);
    } catch {
      response.writeHead(404).end();
    }
  });
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
    await verifyClassicSparkPalette(browser);

    await run(process.execPath, [
      viteCli,
      'build',
      '--outDir',
      catalogOutputDirectory,
      '--emptyOutDir'
    ], { cwd: previewDirectory, env: process.env });
    await new Promise<void>((resolve, reject) => {
      catalogServer.once('error', reject);
      catalogServer.listen(catalogPort, '127.0.0.1', resolve);
    });

    for (const identity of ['signed-out', 'dashboard'] as const) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        hasTouch: identity === 'dashboard'
      });
      await context.addInitScript((initialIdentity: string) => {
        const session = initialIdentity === 'dashboard'
          ? { user: { id: 'c0000000-0000-4000-8000-000000000003', email: 'browser-test@example.test' } }
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
      const tokenStylesheetResponses: number[] = [];
      page.on('response', response => {
        if (new URL(response.url()).pathname === '/brand/tend-tokens.css') {
          tokenStylesheetResponses.push(response.status());
        }
      });
      await page.route('**/tend.css', async route => {
        classicCssRequests.push(route.request().url());
        await route.abort();
      });
      await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.route('https://fonts.gstatic.com/**', route => route.abort());
      await page.goto(`${baseUrl}/app-preview.html?identity=${identity}`);
      await page.waitForFunction(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--tend-tool-zone-background').trim() === '#EEF2F7'
      );
      assert.deepEqual(tokenStylesheetResponses, [200],
        'The production artifact must load the shared ToolZone token stylesheet.');

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
        const initialTextSize = await page.locator('.mobile-display-toggle').getAttribute('data-text-size');
        if (initialTextSize !== 'small' && initialTextSize !== 'medium' && initialTextSize !== 'large') {
          throw new Error('The preview has no recognized text-size preference.');
        }

        await page.getByRole('button', { name: 'Health & Fitness' }).click();
        await page.getByRole('tab', { name: 'Foundations' }).click();
        await page.getByRole('button', { name: /Open Strength foundation details/ }).click();
        await page.getByRole('region', { name: 'Body insights' }).waitFor({ state: 'visible' });
        await verifyStrengthReviewResponsiveLayout(page);
        await verifyFitnessSessionResumeBannerLayout(page, '.strength-page');
        await verifyToolZoneResponsiveLayout(page, 'Body insights');
        await verifyBodyToolPalette(page, {
          settingsButtonName: 'Strength settings',
          settingsDialogName: 'Strength settings',
          settingsCloseName: 'Close Strength settings',
          mapName: 'Front muscle training status map'
        });
        await page.getByRole('tab', { name: 'Workouts' }).click();
        await verifyFitnessLogDialogLayout(page, {
          dialogName: 'Log workout',
          closeButtonName: 'Close workout log',
          dateLabel: 'Workout date',
          saveLabel: 'Save workout',
          hasMinutes: false
        });
        await page.getByRole('tab', { name: 'Body' }).click();

        await page.getByRole('button', { name: 'All Foundations' }).click();
        await page.getByRole('button', { name: /Open Flexibility foundation details/ }).click();
        await page.getByRole('region', { name: 'Body insights' }).waitFor({ state: 'visible' });
        await verifyFitnessSessionResumeBannerLayout(page, '.flexibility-view');
        await verifyToolZoneResponsiveLayout(page, 'Body insights');
        await verifyBodyToolPalette(page, {
          settingsButtonName: 'Stretch interval settings',
          settingsDialogName: 'Stretch intervals',
          settingsCloseName: 'Close stretch intervals',
          mapName: 'Front Stretch schedule stretching map'
        });
        await page.getByRole('tab', { name: 'Routines' }).click();
        await verifyFitnessLogDialogLayout(page, {
          dialogName: 'Log a stretch',
          closeButtonName: 'Close stretch session',
          dateLabel: 'Date',
          saveLabel: 'Save stretch',
          hasMinutes: true,
          optionLabels: [
            'Hamstrings', 'Calves', 'Glutes', 'Abs', 'Hip flexors',
            'Quads', 'Chest', 'Shoulders', 'Back', 'Neck'
          ]
        });
        await page.getByRole('tab', { name: 'Body' }).click();

        await page.getByRole('button', { name: 'All Foundations' }).click();
        await page.getByRole('button', { name: 'Home' }).click();
        await page.getByRole('button', { name: 'Finances' }).click();
        await page.getByRole('tab', { name: 'Goals' }).click();
        await page.getByRole('region', { name: 'Progress tracker' }).waitFor({ state: 'visible' });
        await verifyToolZoneResponsiveLayout(page, 'Progress tracker');
        await page.getByRole('button', { name: 'Home' }).click();
        await setPreviewTextSize(page, initialTextSize);

        await page.route('https://geocoding-api.open-meteo.com/**', route => route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [{
              id: 1,
              name: 'Springfield',
              admin1: 'Oregon',
              country: 'United States',
              country_code: 'US',
              latitude: 44.05,
              longitude: -123.02
            }]
          })
        }));
        await page.route('https://api.open-meteo.com/**', route => {
          const currentTime = new Date();
          currentTime.setUTCMinutes(0, 0, 0);
          const timestamp = currentTime.toISOString().slice(0, 16);
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              timezone: 'GMT',
              utc_offset_seconds: 0,
              current: { time: timestamp, temperature_2m: 42, weather_code: 3, is_day: 1 },
              hourly: {
                time: [timestamp],
                temperature_2m: [42],
                weather_code: [3],
                is_day: [1]
              }
            })
          });
        });
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

        await page.getByRole('button', { name: 'More, settings' }).click();
        await page.getByRole('button', { name: /Settings/ }).click();
        await page.getByRole('button', { name: /Weather/ }).click();
        await page.getByRole('button', { name: 'Choose city' }).click();
        await page.getByRole('searchbox', { name: 'City or postal code' }).fill('Springfield');
        await page.getByRole('button', { name: 'Search', exact: true }).click();
        const forecastResponse = page.waitForResponse(response =>
          response.url().startsWith('https://api.open-meteo.com/')
        );
        await page.getByRole('button', { name: /Springfield/ }).click();
        await forecastResponse;
        await page.getByRole('button', { name: 'Today', exact: true }).click();
        await page.locator('.today-plan__title-weather').waitFor();

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
              const appHeader = document.querySelector<HTMLElement>('.apphead');
              const mobileSearch = document.querySelector<HTMLButtonElement>('.mobile-head-button:not(.mobile-display-toggle)');
              const sizeToggle = document.querySelector<HTMLButtonElement>('.mobile-display-toggle');
              const brandTagline = document.querySelector<HTMLElement>('.brand-tagline');
              const homeDashboard = document.querySelector<HTMLElement>('.home-dashboard');
              const dashboardGreeting = homeDashboard?.querySelector<HTMLElement>(':scope > .sectiontitle.dashboard-greeting');
              const greetingHeading = dashboardGreeting?.querySelector<HTMLElement>('h2');
              const overallHealthCard = homeDashboard?.querySelector<HTMLElement>(':scope > .overall-card');
              const stickyNav = document.querySelector<HTMLElement>('.sticky-nav');
              const areaNavigation = document.querySelector<HTMLElement>('.nav-row-areas');
              const utilitySearch = document.querySelector<HTMLElement>('.utility-search');
              const menuGrid = document.querySelector<HTMLElement>('.home-dashboard .today-category-menu');
              const firstMenuArea = document.querySelector<HTMLElement>('.home-dashboard .today-category-menu .menu-area');
              const calendarSection = document.querySelector<HTMLElement>('.today-calendar-section');
              const calendarHeadingRow = document.querySelector<HTMLElement>('.calendar-heading-row');
              const calendarHeading = document.querySelector<HTMLElement>('.calendar-heading-row h2');
              const prayerHeading = document.querySelector<HTMLElement>('.today-prayer-section > .sectiontitle h2');
              const todayTitleRow = document.querySelector<HTMLElement>('.today-plan__title-row');
              const todayTitleMain = todayTitleRow?.querySelector<HTMLElement>('.today-plan__title-main');
              const todayHeading = todayTitleMain?.querySelector<HTMLElement>('.today-plan__heading');
              const todayWeather = todayTitleMain?.querySelector<HTMLElement>('.today-plan__title-weather');
              const todayWeatherImage = todayWeather?.querySelector<HTMLElement>('[role="img"]');
              const todayWeatherCompact = todayWeather?.querySelector<HTMLElement>('.today-weather--compact');
              const todayWeatherIcon = todayWeatherCompact?.querySelector<SVGSVGElement>('svg');
              const todayProgress = todayTitleRow?.querySelector<HTMLElement>('.today-plan__title-progress');
              const timeframeWeather = document.querySelector<HTMLElement>('.today-timeframe-header .today-plan__weather');
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
              if (!headerActions || !appHeader || !mobileSearch || !sizeToggle || !brandTagline
                || !homeDashboard || !dashboardGreeting || !greetingHeading || !overallHealthCard || !stickyNav
                || !areaNavigation || !utilitySearch || !menuGrid || !firstMenuArea || !currentTool
                || !calendarSection || !calendarHeadingRow || !calendarHeading || !prayerHeading
                || !calendarRange || !calendarRangeLabel || !todayTitleRow || !todayTitleMain
                || !todayHeading || !todayWeather || !todayWeatherImage || !todayWeatherCompact
                || !todayWeatherIcon || !todayProgress) {
                throw new Error('Dashboard is missing an expected mobile shell or Health category element.');
              }
              if (dashboardGreeting.nextElementSibling !== overallHealthCard) {
                throw new Error('Overall Health must follow the plain greeting in normal page flow.');
              }
              const searchStyle = getComputedStyle(mobileSearch);
              const toggleStyle = getComputedStyle(sizeToggle);
              const toolStyle = getComputedStyle(currentTool);
              const appHeaderRect = appHeader.getBoundingClientRect();
              const homeRect = homeDashboard.getBoundingClientRect();
              const greetingRect = dashboardGreeting.getBoundingClientRect();
              const headingStyle = getComputedStyle(greetingHeading);
              const greetingStyle = getComputedStyle(dashboardGreeting);
              const healthCardRect = overallHealthCard.getBoundingClientRect();
              const healthCardStyle = getComputedStyle(overallHealthCard);
              const pageStyle = getComputedStyle(document.body);
              const gridStyle = getComputedStyle(menuGrid);
              const gridRect = menuGrid.getBoundingClientRect();
              const areaRect = firstMenuArea.getBoundingClientRect();
              const titleMainRect = todayTitleMain.getBoundingClientRect();
              const weatherRect = todayWeather.getBoundingClientRect();
              const compactWeatherRect = todayWeatherCompact.getBoundingClientRect();
              const weatherIconRect = todayWeatherIcon.getBoundingClientRect();
              const temperature = todayWeatherCompact.querySelector<HTMLElement>('.today-weather__reading strong');
              if (!temperature) throw new Error('Compact weather is missing its temperature.');
              const temperatureRect = temperature.getBoundingClientRect();
              const progressRect = todayProgress.getBoundingClientRect();
              const titleMainStyle = getComputedStyle(todayTitleMain);
              const weatherStyle = getComputedStyle(todayWeather);
              const compactWeatherStyle = getComputedStyle(todayWeatherCompact);
              const weatherIconStyle = getComputedStyle(todayWeatherIcon);
              const condition = todayWeather.querySelector<HTMLElement>('.today-weather__reading > span');
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
                homeLayout: {
                  heroAbsent: document.querySelector('.today-dawn-hero') === null,
                  supportingSentenceAbsent: dashboardGreeting.querySelector('.dashboard-greeting__subline') === null,
                  left: homeRect.left,
                  right: homeRect.right,
                  greetingLeft: greetingRect.left,
                  greetingRight: greetingRect.right,
                  greetingText: greetingHeading.textContent?.trim() ?? '',
                  greetingTopGap: greetingRect.top - appHeaderRect.bottom,
                  greetingMargin: greetingStyle.margin,
                  greetingPadding: greetingStyle.padding,
                  headingFontWeight: headingStyle.fontWeight,
                  headingHorizontalOverflow: greetingHeading.scrollWidth - greetingHeading.clientWidth,
                  headingVerticalOverflow: greetingHeading.scrollHeight - greetingHeading.clientHeight,
                  cardTopGap: healthCardRect.top - greetingRect.bottom,
                  cardPadding: healthCardStyle.padding,
                  cardRadius: [
                    healthCardStyle.borderTopLeftRadius,
                    healthCardStyle.borderTopRightRadius,
                    healthCardStyle.borderBottomRightRadius,
                    healthCardStyle.borderBottomLeftRadius
                  ],
                  cardBackground: healthCardStyle.backgroundColor,
                  cardBackdropFilter: healthCardStyle.backdropFilter,
                  scoreMeter: overallHealthCard.querySelector('[role="meter"]') !== null,
                  pageBackground: pageStyle.backgroundColor,
                  pageBackgroundImage: pageStyle.backgroundImage,
                  mainBackgroundImage: getComputedStyle(homeDashboard).backgroundImage,
                  categoryMenuContained: overallHealthCard.contains(menuGrid),
                  separateCategoryShellAbsent: document.querySelector('.today-category-menu-shell') === null
                },
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
                todayWeather: {
                  heading: todayHeading.textContent?.trim(),
                  accessibleName: todayWeatherImage.getAttribute('aria-label'),
                  conditionClass: condition?.className,
                  weatherCount: document.querySelectorAll('.today-plan__title-weather').length,
                  timeframeWeather: Boolean(timeframeWeather),
                  titleMainDisplay: titleMainStyle.display,
                  titleMainAlignItems: titleMainStyle.alignItems,
                  weatherDisplay: weatherStyle.display,
                  weatherAlignItems: weatherStyle.alignItems,
                  weatherMinHeight: weatherStyle.minHeight,
                  compactWeatherDisplay: compactWeatherStyle.display,
                  compactWeatherAlignItems: compactWeatherStyle.alignItems,
                  weatherIconAlignSelf: weatherIconStyle.alignSelf,
                  compactWeatherHeight: compactWeatherRect.height,
                  iconTemperatureCenterDelta: Math.abs(
                    weatherIconRect.top + weatherIconRect.height / 2
                    - temperatureRect.top - temperatureRect.height / 2
                  ),
                  titleRight: titleMainRect.right,
                  weatherRight: weatherRect.right,
                  progressLeft: progressRect.left,
                  progressRight: progressRect.right,
                  rowRight: todayTitleRow.getBoundingClientRect().right,
                  overlapsProgress: titleMainRect.left < progressRect.right
                    && titleMainRect.right > progressRect.left
                    && titleMainRect.top < progressRect.bottom
                    && titleMainRect.bottom > progressRect.top
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
            assert.equal(phoneStyles.homeLayout.heroAbsent, true);
            assert.equal(phoneStyles.homeLayout.supportingSentenceAbsent, true);
            assert.ok(phoneStyles.homeLayout.left >= 12);
            assert.ok(phoneStyles.homeLayout.right <= viewportWidth - 12);
            assert.equal(phoneStyles.homeLayout.greetingLeft, phoneStyles.homeLayout.left);
            assert.equal(phoneStyles.homeLayout.greetingRight, phoneStyles.homeLayout.right);
            assert.match(phoneStyles.homeLayout.greetingText, /^Good (morning|afternoon|evening)$/);
            assert.ok(phoneStyles.homeLayout.greetingTopGap >= 24);
            assert.equal(phoneStyles.homeLayout.greetingMargin, '32px 0px 12px');
            assert.equal(phoneStyles.homeLayout.greetingPadding, '0px');
            assert.equal(phoneStyles.homeLayout.headingFontWeight, '600');
            assert.ok(phoneStyles.homeLayout.headingHorizontalOverflow <= 1,
              `Greeting must fit the normal page width at ${viewportWidth}px / ${expected.size}.`);
            assert.ok(phoneStyles.homeLayout.headingVerticalOverflow <= 1,
              `Greeting must not be clipped at ${viewportWidth}px / ${expected.size}.`);
            assert.ok(phoneStyles.homeLayout.cardTopGap >= 8 && phoneStyles.homeLayout.cardTopGap <= 16,
              `Overall Health must follow the greeting with normal spacing at ${viewportWidth}px / ${expected.size}.`);
            assert.equal(phoneStyles.homeLayout.cardPadding, '24px');
            assert.deepEqual(phoneStyles.homeLayout.cardRadius, ['20px', '20px', '20px', '20px']);
            assert.equal(phoneStyles.homeLayout.cardBackground, 'rgb(255, 255, 255)');
            assert.equal(phoneStyles.homeLayout.cardBackdropFilter, 'none');
            assert.equal(phoneStyles.homeLayout.scoreMeter, true);
            assert.equal(phoneStyles.homeLayout.pageBackground, 'rgb(247, 249, 247)');
            assert.equal(phoneStyles.homeLayout.pageBackgroundImage, 'none');
            assert.equal(phoneStyles.homeLayout.mainBackgroundImage, 'none');
            assert.equal(phoneStyles.homeLayout.categoryMenuContained, true);
            assert.equal(phoneStyles.homeLayout.separateCategoryShellAbsent, true);
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
            assert.equal(phoneStyles.todayWeather.heading, 'Today');
            assert.equal(phoneStyles.todayWeather.accessibleName, 'Current conditions: Cloudy, 42 degrees');
            assert.equal(phoneStyles.todayWeather.conditionClass, 'visually-hidden');
            assert.equal(phoneStyles.todayWeather.weatherCount, 1);
            assert.equal(phoneStyles.todayWeather.timeframeWeather, false);
            assert.equal(phoneStyles.todayWeather.titleMainDisplay, 'flex');
            assert.equal(phoneStyles.todayWeather.titleMainAlignItems, 'baseline');
            assert.equal(phoneStyles.todayWeather.weatherDisplay, 'flex');
            assert.equal(phoneStyles.todayWeather.weatherAlignItems, 'baseline');
            assert.equal(phoneStyles.todayWeather.weatherMinHeight, '28px');
            assert.equal(phoneStyles.todayWeather.compactWeatherDisplay, 'grid');
            assert.equal(phoneStyles.todayWeather.compactWeatherAlignItems, 'baseline');
            assert.equal(phoneStyles.todayWeather.weatherIconAlignSelf, 'center');
            assert.ok(phoneStyles.todayWeather.iconTemperatureCenterDelta <= 1,
              `The weather icon should center against the temperature line at ${viewportWidth}px / ${expected.size}.`);
            assert.ok(phoneStyles.todayWeather.weatherRight <= phoneStyles.todayWeather.progressLeft
              || !phoneStyles.todayWeather.overlapsProgress,
              `Today weather and tended controls must wrap without overlapping at ${viewportWidth}px / ${expected.size}.`);
            assert.ok(phoneStyles.todayWeather.progressRight <= phoneStyles.todayWeather.rowRight + 1,
              `The tended control must remain in the title row at ${viewportWidth}px / ${expected.size}.`);
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

          await page.setViewportSize({ width: 375, height: 812 });
          await page.getByRole('button', { name: 'More, settings' }).click();
          assert.equal(await page.getByText('Make Tend your own.', { exact: true }).count(), 1);
          const moreStatus = page.locator('.preview-account-sync');
          await moreStatus.waitFor({ state: 'visible' });
          for (const viewportWidth of [375, 390, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 812 });
            const moreLayout = await page.evaluate(() => {
              const page = document.querySelector<HTMLElement>('.settings-page');
              const status = document.querySelector<HTMLElement>('.preview-account-sync');
              const settings = document.querySelector<HTMLElement>('.settings-page__more-options .settings-link');
              if (!page || !status || !settings) throw new Error('More is missing its account save status or Settings navigation.');
              return {
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: document.documentElement.clientWidth,
                status: status.getBoundingClientRect().toJSON(),
                settings: settings.getBoundingClientRect().toJSON(),
                accountRows: document.querySelectorAll('.preview-account-sync__account').length
              };
            });
            assert.equal(moreLayout.documentWidth, viewportWidth,
              `More must not overflow at ${viewportWidth}px / ${expected.size}.`);
            assert.equal(moreLayout.viewportWidth, viewportWidth);
            assert.ok(moreLayout.status.width > 0 && moreLayout.settings.width > 0);
            assert.equal(moreLayout.accountRows, 1,
              'The signed-in account should appear once in the Save & sync status.');
          }
          await page.getByRole('button', { name: 'Settings', exact: true }).click();
          await page.setViewportSize({ width: 375, height: 812 });
          const directoryLayout = await page.evaluate(() => {
            const directory = document.querySelector<HTMLElement>('.settings-page__directory');
            if (!directory) throw new Error('Settings directory is missing.');
            const sections = [...directory.querySelectorAll<HTMLElement>('.settings-section')];
            const rows = [...directory.querySelectorAll<HTMLElement>('.settings-link')];
            return {
              documentWidth: document.documentElement.scrollWidth,
              viewportWidth: document.documentElement.clientWidth,
              headings: sections.map(section => section.querySelector('h3')?.textContent?.trim()),
              sectionStyles: sections.map(section => {
                const style = getComputedStyle(section);
                return { border: style.borderTopWidth, background: style.backgroundColor, shadow: style.boxShadow };
              }),
              rows: rows.map(row => {
                const rect = row.getBoundingClientRect();
                return {
                  left: rect.left,
                  right: rect.right,
                  height: rect.height,
                  icon: row.querySelector<HTMLElement>('.settings-link__icon')?.getBoundingClientRect().width ?? 0
                };
              })
            };
          });
          assert.deepEqual(directoryLayout.headings, ['Personalize', 'Connections', 'Your data']);
          assert.equal(directoryLayout.documentWidth, 375);
          assert.equal(directoryLayout.viewportWidth, 375);
          assert.ok(directoryLayout.sectionStyles.every(style =>
            style.border === '0px' && style.background === 'rgba(0, 0, 0, 0)' && style.shadow === 'none'
          ), 'Settings section headings should sit directly on the page background.');
          assert.ok(directoryLayout.rows.every(row =>
            row.left >= 0 && row.right <= 375 && row.height >= 68 && row.icon >= 34
          ), 'Settings rows and icon tiles must fit the phone viewport.');
          await page.getByRole('button', { name: 'Time blocks' }).click();
          const sleepLayout = await page.evaluate(() => {
            const sleep = document.querySelector<HTMLElement>('.time-block-settings__sleep');
            const input = sleep?.querySelector<HTMLInputElement>('input[type="time"]');
            const explanation = sleep?.querySelector<HTMLElement>('.time-block-settings__sleep-range');
            if (!sleep || !input || !explanation) {
              throw new Error('Time block Settings is missing the Sleep boundary field or explanation.');
            }
            const inputRect = input.getBoundingClientRect();
            const explanationRect = explanation.getBoundingClientRect();
            return {
              inputTop: inputRect.top,
              inputBottom: inputRect.bottom,
              explanationTop: explanationRect.top,
              explanationBottom: explanationRect.bottom,
              explanationLeft: explanationRect.left,
              sleepRight: sleep.getBoundingClientRect().right,
              documentWidth: document.documentElement.scrollWidth,
              viewportWidth: document.documentElement.clientWidth
            };
          });
          assert.ok(sleepLayout.explanationTop >= sleepLayout.inputBottom,
            `Sleep explanation must stack below its field at ${expected.size} text size: ${JSON.stringify(sleepLayout)}.`);
          assert.ok(sleepLayout.explanationLeft >= 0);
          assert.ok(sleepLayout.explanationBottom > sleepLayout.explanationTop);
          assert.ok(sleepLayout.sleepRight <= 375);
          assert.equal(sleepLayout.documentWidth, sleepLayout.viewportWidth);
          await page.getByRole('button', { name: '‹ Settings' }).click();
          await page.getByRole('button', { name: 'Backup & recovery' }).click();
          for (const viewportWidth of [375, 390, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 812 });
            const recoveryLayout = await page.evaluate(() => {
              const rows = [...document.querySelectorAll<HTMLElement>('.preview-backup-import--recovery .preview-backup-import__row')];
              if (rows.length < 2) throw new Error('Synthetic Backup & recovery must show export and import actions.');
              return {
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: document.documentElement.clientWidth,
                rows: rows.map(row => {
                  const rect = row.getBoundingClientRect();
                  return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
                })
              };
            });
            assert.equal(recoveryLayout.documentWidth, viewportWidth,
              `Backup & recovery must not overflow at ${viewportWidth}px / ${expected.size}.`);
            assert.equal(recoveryLayout.viewportWidth, viewportWidth);
            assert.ok(recoveryLayout.rows.every(row =>
              row.left >= 0 && row.right <= viewportWidth && row.width > 0 && row.height > 0
            ));
          }
          const backgroundScrollY = await page.evaluate(() => {
            const sentinel = document.createElement('div');
            sentinel.id = 'synthetic-background-scroll-sentinel';
            sentinel.style.height = '2400px';
            sentinel.style.pointerEvents = 'none';
            sentinel.style.visibility = 'hidden';
            sentinel.setAttribute('aria-hidden', 'true');
            document.body.append(sentinel);
            const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            window.scrollTo(0, Math.min(180, maximum));
            return window.scrollY;
          });
          assert.ok(backgroundScrollY > 0, 'The recovery fixture should have a scrollable background to restore.');
          await page.getByText('Advanced recovery').click();
          await page.getByRole('button', { name: /Account recovery/ }).click();
          const recoveryDialog = page.getByRole('dialog', { name: 'Account recovery' });
          await recoveryDialog.waitFor();
          await page.evaluate(() => {
            const region = document.querySelector<HTMLElement>('.preview-account-backup-dialog .money-goal-dialog__scroll-region');
            if (!region) throw new Error('Account recovery is missing its scrollable content region.');
            const diagnostic = document.createElement('p');
            diagnostic.className = 'preview-account-backup__error';
            diagnostic.setAttribute('role', 'alert');
            diagnostic.textContent = `Synthetic long recovery diagnostic: ${'saved source remains unchanged. '.repeat(120)}`;
            region.append(diagnostic);
          });
          for (const viewportWidth of [375, 390, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 812 });
            const recoveryModal = await page.evaluate(() => {
              const dialog = document.querySelector<HTMLElement>('.preview-account-backup-dialog');
              const surface = dialog?.querySelector<HTMLElement>('.money-goal-dialog__surface');
              const header = dialog?.querySelector<HTMLElement>('.money-goal-dialog__persistent-header');
              const close = dialog?.querySelector<HTMLButtonElement>('.money-goal-dialog__close');
              const region = dialog?.querySelector<HTMLElement>('.money-goal-dialog__scroll-region');
              if (!dialog || !surface || !header || !close || !region) {
                throw new Error('Account recovery is missing its persistent close header or scroll region.');
              }
              const dialogRect = dialog.getBoundingClientRect();
              const headerRect = header.getBoundingClientRect();
              const closeRect = close.getBoundingClientRect();
              const regionRect = region.getBoundingClientRect();
              const surfaceStyle = getComputedStyle(surface);
              const regionStyle = getComputedStyle(region);
              const dialogStyle = getComputedStyle(dialog);
              region.scrollTop = region.scrollHeight;
              return {
                hasScrollableLayout: dialog.classList.contains('money-goal-dialog--scrollable-body'),
                dialogOverflow: dialogStyle.overflow,
                surfaceDisplay: surfaceStyle.display,
                surfaceOverflow: surfaceStyle.overflow,
                viewportWidth: window.innerWidth,
                documentWidth: document.documentElement.scrollWidth,
                dialogWidth: dialogRect.width,
                dialogHeight: dialogRect.height,
                dialogBottom: dialogRect.bottom,
                dialogBackground: dialogStyle.backgroundColor,
                headerTop: headerRect.top,
                closeTop: closeRect.top,
                closeBottom: closeRect.bottom,
                closeWidth: closeRect.width,
                closeHeight: closeRect.height,
                regionTop: regionRect.top,
                regionBottom: regionRect.bottom,
                regionOverflowY: regionStyle.overflowY,
                regionOverscroll: regionStyle.overscrollBehaviorY,
                touchAction: regionStyle.touchAction,
                regionClientHeight: region.clientHeight,
                regionScrollHeight: region.scrollHeight,
                regionScrollTop: region.scrollTop,
                surfacePadding: surfaceStyle.padding,
                bodyPosition: document.body.style.position,
                bodyOverflow: document.body.style.overflow,
                closeInHeader: header.contains(close)
              };
            });
            assert.equal(recoveryModal.viewportWidth, viewportWidth);
            assert.equal(recoveryModal.documentWidth, viewportWidth,
              `Account recovery must not cause horizontal overflow at ${viewportWidth}px / ${expected.size}.`);
            assert.ok(recoveryModal.dialogWidth > 0 && recoveryModal.dialogHeight > 0);
            assert.notEqual(recoveryModal.dialogBackground, 'rgba(0, 0, 0, 0)',
              'The modal surface must be opaque over the underlying page.');
            assert.equal(recoveryModal.hasScrollableLayout, true);
            assert.equal(recoveryModal.dialogOverflow, 'hidden');
            assert.equal(recoveryModal.surfaceDisplay, 'flex');
            assert.equal(recoveryModal.surfaceOverflow, 'hidden');
            assert.equal(recoveryModal.closeInHeader, true);
            assert.ok(recoveryModal.closeTop >= 0 && recoveryModal.closeBottom <= 812);
            assert.deepEqual([recoveryModal.closeWidth, recoveryModal.closeHeight], [44, 44]);
            assert.ok(recoveryModal.regionTop > recoveryModal.headerTop);
            assert.ok(recoveryModal.regionBottom <= recoveryModal.dialogBottom);
            assert.equal(recoveryModal.regionOverflowY, 'auto');
            assert.equal(recoveryModal.regionOverscroll, 'contain');
            assert.equal(recoveryModal.touchAction, 'pan-y');
            assert.ok(recoveryModal.regionClientHeight > 0);
            assert.ok(recoveryModal.regionScrollHeight > recoveryModal.regionClientHeight);
            assert.ok(recoveryModal.regionScrollTop > 0);
            assert.equal(recoveryModal.bodyPosition, 'fixed');
            assert.equal(recoveryModal.bodyOverflow, 'hidden');
            assert.match(recoveryModal.surfacePadding, /18px/);
            assert.match(recoveryModal.surfacePadding, /12px/);
          }
          await page.setViewportSize({ width: 667, height: 375 });
          await page.evaluate(() => {
            const region = document.querySelector<HTMLElement>('.preview-account-backup-dialog .money-goal-dialog__scroll-region');
            const close = document.querySelector<HTMLButtonElement>('.preview-account-backup-dialog .money-goal-dialog__close');
            if (!region || !close) throw new Error('Account recovery controls disappeared in landscape.');
            region.scrollTop = 0;
            close.focus();
          });
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() =>
            document.activeElement === document.querySelector('.preview-account-backup-dialog .money-goal-dialog__scroll-region')
          ), true, 'Keyboard users should be able to focus the independently scrollable region.');
          const keyboardScrollBefore = await page.locator('.preview-account-backup-dialog .money-goal-dialog__scroll-region')
            .evaluate(element => ({ top: element.scrollTop, height: element.clientHeight, total: element.scrollHeight }));
          await page.keyboard.press('PageDown');
          const keyboardScrollAfter = await page.locator('.preview-account-backup-dialog .money-goal-dialog__scroll-region')
            .evaluate(element => ({ top: element.scrollTop, height: element.clientHeight, total: element.scrollHeight }));
          assert.ok(keyboardScrollAfter.top > keyboardScrollBefore.top,
            `The scroll region should respond to keyboard scrolling in landscape: ${JSON.stringify({ keyboardScrollBefore, keyboardScrollAfter })}.`);
          const landscapeModal = await page.evaluate(() => {
            const dialog = document.querySelector<HTMLElement>('.preview-account-backup-dialog');
            const close = dialog?.querySelector<HTMLButtonElement>('.money-goal-dialog__close');
            const region = dialog?.querySelector<HTMLElement>('.money-goal-dialog__scroll-region');
            if (!dialog || !close || !region) throw new Error('Account recovery is incomplete in landscape.');
            const closeRect = close.getBoundingClientRect();
            return {
              viewportWidth: window.innerWidth,
              viewportHeight: window.innerHeight,
              documentWidth: document.documentElement.scrollWidth,
              dialogWidth: dialog.getBoundingClientRect().width,
              dialogHeight: dialog.getBoundingClientRect().height,
              closeBottom: closeRect.bottom,
              regionBottom: region.getBoundingClientRect().bottom
            };
          });
          assert.equal(landscapeModal.viewportWidth, 667);
          assert.equal(landscapeModal.viewportHeight, 375);
          assert.equal(landscapeModal.documentWidth, 667);
          assert.equal(landscapeModal.dialogWidth, 667);
          assert.equal(landscapeModal.dialogHeight, 375);
          assert.ok(landscapeModal.closeBottom <= 375);
          assert.ok(landscapeModal.regionBottom <= 375);
          await page.getByRole('button', { name: 'Close Account recovery' }).click();
          assert.equal(await page.evaluate(() =>
            document.activeElement?.classList.contains('preview-account-backup__entry') ?? false
          ), true, 'Closing Account recovery should restore focus to its opener.');
          assert.notEqual(await page.evaluate(() => document.body.style.position), 'fixed');
          assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
          assert.equal(await page.evaluate(() => window.scrollY), backgroundScrollY,
            'Closing Account recovery should restore the background scroll position.');
          await page.evaluate(() => {
            document.getElementById('synthetic-background-scroll-sentinel')?.remove();
            window.scrollTo(0, 0);
          });
          await page.getByRole('button', { name: '‹ Settings' }).click();
          await page.getByRole('button', { name: '‹ More' }).click();
          for (const viewportWidth of [375, 390, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 812 });
            const syncLayout = await page.evaluate(() => {
              const section = document.querySelector<HTMLElement>('.preview-account-sync');
              const notice = section?.querySelector<HTMLElement>('.preview-account-sync__status');
              const rect = section?.getBoundingClientRect();
              if (!section || !notice || !rect) throw new Error('More is missing its visible Save & sync status.');
              return {
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: document.documentElement.clientWidth,
                sectionLeft: rect.left,
                sectionRight: rect.right,
                noticeWidth: notice.getBoundingClientRect().width,
                noticeHeight: notice.getBoundingClientRect().height,
                nestedCards: section.querySelectorAll('.card').length
              };
            });
            assert.equal(syncLayout.documentWidth, viewportWidth,
              `Save & sync must not overflow at ${viewportWidth}px / ${expected.size}.`);
            assert.equal(syncLayout.viewportWidth, viewportWidth);
            assert.ok(syncLayout.sectionLeft >= 0 && syncLayout.sectionRight <= viewportWidth);
            assert.ok(syncLayout.noticeWidth > 0 && syncLayout.noticeHeight > 0);
            assert.equal(syncLayout.nestedCards, 0);
          }
          assert.equal(await page.getByRole('button', { name: 'Preview data tools' }).count(), 0,
            'Synthetic-only tools must not appear in the signed-in production interface.');
          await page.getByRole('button', { name: 'Today', exact: true }).click();
          await page.setViewportSize({ width: 1280, height: 900 });

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
        await page.locator('.focus-dialog').waitFor();
        const focusMobileLayout = await page.locator('.focus-dialog').evaluate(dialog => {
          const rect = dialog.getBoundingClientRect();
          const close = dialog.querySelector<HTMLButtonElement>('.focus-close');
          const closeRect = close?.getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
            borderRadius: getComputedStyle(dialog).borderRadius,
            overflowY: getComputedStyle(dialog).overflowY,
            closeLabel: close?.getAttribute('aria-label'),
            closeWidth: closeRect?.width,
            closeHeight: closeRect?.height
          };
        });
        assert.deepEqual(focusMobileLayout, {
          width: 375,
          height: 812,
          borderRadius: '0px',
          overflowY: 'auto',
          closeLabel: 'Close Focus',
          closeWidth: 44,
          closeHeight: 44
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
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.querySelector('.focus-dialog') === null);
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
        await page.locator('.focus-dialog').waitFor();
        const focusDesktopLayout = await page.locator('.focus-dialog').evaluate(dialog => {
          const rect = dialog.getBoundingClientRect();
          return {
            width: rect.width,
            maxWidth: getComputedStyle(dialog).maxWidth,
            borderRadius: getComputedStyle(dialog).borderRadius,
            overflowY: getComputedStyle(dialog).overflowY
          };
        });
        assert.deepEqual(focusDesktopLayout, {
          width: 520,
          maxWidth: '520px',
          borderRadius: '24px',
          overflowY: 'auto'
        });

        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.querySelector('.focus-dialog') === null);
        await page.locator('.utility-primary-button').filter({ hasText: 'Today' }).click();
        await page.locator('.home-dashboard .today-category-menu .menu-area')
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
                  await page.keyboard.press('Enter');
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
        await page.getByRole('button', { name: 'Categories', exact: true }).click();
        await page.getByRole('heading', { name: 'Categories' }).waitFor();
        await page.getByRole('button', { name: /Health & Fitness.*Show Foundations/ }).click();
        const categorySizeToggle = page.locator('.mobile-display-toggle');
        for (const textSize of ['small', 'medium', 'large'] as const) {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            if (await categorySizeToggle.getAttribute('data-text-size') === textSize) break;
            await categorySizeToggle.click();
          }
          assert.equal(await categorySizeToggle.getAttribute('data-text-size'), textSize);
          for (const viewportWidth of [320, 375, 390, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 844 });
            const categorySettingsLayout = await page.evaluate(() => {
              const settings = document.querySelector<HTMLElement>('.category-settings');
              const settingsSection = settings?.closest<HTMLElement>('.settings-section');
              const list = settings?.querySelector<HTMLElement>('.category-settings__list');
              const rows = [...(settings?.querySelectorAll<HTMLElement>('.category-settings__item') ?? [])];
              const childRows = [...(settings?.querySelectorAll<HTMLElement>(
                '.category-settings__children:not([hidden]) .category-settings__child'
              ) ?? [])];
              if (!settings || !list || rows.length !== 6) {
                throw new Error('Category Settings must show all six availability switches.');
              }
              if (childRows.length !== 4) {
                throw new Error('Expanding Health & Fitness must reveal all four child-area switches.');
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
              const childBounds = childRows.map(row => {
                const identity = row.querySelector<HTMLElement>('.category-settings__child-identity');
                const toggle = row.querySelector<HTMLInputElement>('input[role="switch"]');
                const rowRect = row.getBoundingClientRect();
                const identityRect = identity?.getBoundingClientRect();
                const toggleRect = toggle?.getBoundingClientRect();
                if (!identityRect || !toggleRect) throw new Error('A child-area row is missing its label or switch.');
                return {
                  right: rowRect.right,
                  identityRight: identityRect.right,
                  toggleLeft: toggleRect.left,
                  toggleWidth: toggleRect.width,
                  toggleHeight: toggleRect.height
                };
              });
              return {
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: document.documentElement.clientWidth,
                headingVisible: settingsSection?.querySelector('h3')?.textContent?.trim() === 'Categories',
                descriptionFits: Boolean(description && description.scrollWidth <= description.clientWidth),
                rowBounds,
                childBounds
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
            assert.ok(categorySettingsLayout.childBounds.every(row =>
              row.right <= viewportWidth
              && row.identityRight < row.toggleLeft
              && row.toggleWidth === 44
              && row.toggleHeight === 26
            ), `Child-area labels and switches must remain separated at ${viewportWidth}px / ${textSize}.`);
          }
        }

        await page.getByRole('button', { name: '‹ Settings' }).click();
        await page.getByRole('button', { name: 'Prayer', exact: true }).click();
        await page.getByRole('heading', { name: 'Prayer', exact: true }).waitFor();
        const prayerSwitch = page.getByRole('switch', { name: 'Prayer' });
        assert.equal(await prayerSwitch.isChecked(), true, 'Prayer must be enabled by default for an existing account.');
        assert.equal(
          await page.locator('.prayer-settings__description').textContent(),
          'Show prayer features and include Prayer in Person Health.'
        );
        for (const textSize of ['small', 'medium', 'large'] as const) {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            if (await categorySizeToggle.getAttribute('data-text-size') === textSize) break;
            await categorySizeToggle.click();
          }
          assert.equal(await categorySizeToggle.getAttribute('data-text-size'), textSize);
          for (const viewportWidth of [375, 390, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 844 });
            const prayerSettingsLayout = await page.evaluate(() => {
              const settings = document.querySelector<HTMLElement>('.prayer-settings');
              const row = settings?.querySelector<HTMLElement>('.prayer-settings__row');
              const copy = settings?.querySelector<HTMLElement>('.prayer-settings__copy');
              const description = settings?.querySelector<HTMLElement>('.prayer-settings__description');
              const toggle = settings?.querySelector<HTMLInputElement>('input[role="switch"]');
              if (!settings || !row || !copy || !description || !toggle) {
                throw new Error('Prayer Settings must render its description and accessible switch.');
              }
              const rowBounds = row.getBoundingClientRect();
              const copyBounds = copy.getBoundingClientRect();
              const descriptionBounds = description.getBoundingClientRect();
              const toggleBounds = toggle.getBoundingClientRect();
              return {
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: document.documentElement.clientWidth,
                rowRight: rowBounds.right,
                copyRight: copyBounds.right,
                toggleLeft: toggleBounds.left,
                toggleWidth: toggleBounds.width,
                toggleHeight: toggleBounds.height,
                descriptionFits: description.scrollWidth <= description.clientWidth,
                descriptionVisible: descriptionBounds.width > 0 && descriptionBounds.height > 0
              };
            });
            const personHealthLayouts = await page.evaluate(() => {
              const settings = document.querySelector<HTMLElement>('.prayer-settings');
              if (!settings) throw new Error('Prayer Settings is missing its responsive layout host.');
              return [2, 3].map(count => {
                const fixture = document.createElement('div');
                fixture.className = 'person-health-component-scores-container';
                fixture.dataset.count = String(count);
                fixture.setAttribute('aria-hidden', 'true');
                fixture.style.width = '100%';
                const group = document.createElement('div');
                group.className = 'person-health-component-scores';
                group.dataset.count = String(count);
                const areas = count === 2
                  ? [{ label: 'Rhythms', score: '72' }, { label: 'Connections', score: '—' }]
                  : [
                      { label: 'Rhythms', score: '72' },
                      { label: 'Connections', score: '—' },
                      { label: 'Prayer', score: '0' }
                    ];
                for (const { label, score } of areas) {
                  const item = document.createElement('div');
                  item.className = 'person-health-component-score';
                  const badge = document.createElement('span');
                  badge.className = 'category-health-badge person-health-component-score__badge';
                  badge.textContent = score;
                  const labelElement = document.createElement('span');
                  labelElement.className = 'person-health-component-score__label';
                  labelElement.textContent = label;
                  item.append(badge, labelElement);
                  group.append(item);
                }
                fixture.append(group);
                settings.append(fixture);
                const tracks = getComputedStyle(group).gridTemplateColumns.match(/[\d.]+px/g) ?? [];
                const items = [...group.querySelectorAll<HTMLElement>('.person-health-component-score')]
                  .map(item => {
                    const badge = item.querySelector<HTMLElement>('.person-health-component-score__badge');
                    const label = item.querySelector<HTMLElement>('.person-health-component-score__label');
                    if (!badge || !label) throw new Error('A Person Health item is missing its badge or label.');
                    const itemRect = item.getBoundingClientRect();
                    const badgeRect = badge.getBoundingClientRect();
                    const labelRect = label.getBoundingClientRect();
                    const textRange = document.createRange();
                    textRange.selectNodeContents(label);
                    const textLineTops = new Set(
                      [...textRange.getClientRects()].map(rect => Math.round(rect.top))
                    );
                    const stackStyle = getComputedStyle(group).gridTemplateColumns.split(' ').length === 1;
                    return {
                      gap: Number.parseFloat(getComputedStyle(item).rowGap),
                      verticalSeparation: labelRect.top - badgeRect.bottom,
                      badgeCenterOffset: Math.abs(
                        badgeRect.left + badgeRect.width / 2 - (itemRect.left + itemRect.width / 2)
                      ),
                      labelCenterOffset: Math.abs(
                        labelRect.left + labelRect.width / 2 - (itemRect.left + itemRect.width / 2)
                      ),
                      labelHeight: labelRect.height,
                      labelClientWidth: label.clientWidth,
                      labelScrollWidth: label.scrollWidth,
                      labelText: label.textContent?.trim(),
                      labelWhiteSpace: getComputedStyle(label).whiteSpace,
                      labelWordBreak: getComputedStyle(label).wordBreak,
                      labelOverflowWrap: getComputedStyle(label).overflowWrap,
                      textLineCount: textLineTops.size,
                      stacked: stackStyle,
                      labelLeft: labelRect.left <= itemRect.left + 3,
                      badgeRight: badgeRect.right >= itemRect.right - 3,
                      rowAligned: Math.abs(labelRect.top - badgeRect.top) <= 6
                    };
                  });
                const result = {
                  count,
                  tracks: tracks.map(Number.parseFloat),
                  dividers: [...group.children].map(element => getComputedStyle(element).borderLeftWidth),
                  separators: [...group.children].map(element => getComputedStyle(element).borderTopWidth),
                  items,
                  width: fixture.getBoundingClientRect().width
                };
                fixture.remove();
                return result;
              });
            });
            assert.equal(prayerSettingsLayout.documentWidth, viewportWidth,
              `Prayer Settings must not overflow at ${viewportWidth}px / ${textSize}.`);
            assert.equal(prayerSettingsLayout.viewportWidth, viewportWidth);
            assert.ok(prayerSettingsLayout.rowRight <= viewportWidth);
            assert.ok(prayerSettingsLayout.copyRight < prayerSettingsLayout.toggleLeft);
            assert.equal(prayerSettingsLayout.toggleWidth, 44);
            assert.equal(prayerSettingsLayout.toggleHeight, 26);
            assert.equal(prayerSettingsLayout.descriptionFits, true);
            assert.equal(prayerSettingsLayout.descriptionVisible, true);
            for (const layout of personHealthLayouts) {
              assert.ok(layout.width <= viewportWidth);
              const stacked = layout.items.every(item => item.stacked);
              if (stacked) {
                assert.equal(layout.tracks.length, 1);
                assert.deepEqual(layout.dividers, Array.from({ length: layout.count }, () => '0px'),
                  `Stacked divider layout at ${viewportWidth}px / ${textSize}: ${JSON.stringify(layout)}`);
                assert.deepEqual(layout.separators, Array.from({ length: layout.count }, () => '1px'),
                  `Stacked separator layout at ${viewportWidth}px / ${textSize}: ${JSON.stringify(layout)}`);
                assert.ok(layout.items.every(item =>
                  item.labelLeft
                  && item.badgeRight
                  && item.rowAligned
                  && item.labelHeight > 0
                  && item.labelScrollWidth <= item.labelClientWidth + 1
                  && item.labelWhiteSpace === 'nowrap'
                  && item.labelWordBreak === 'normal'
                  && item.labelOverflowWrap === 'normal'
                  && item.textLineCount === 1
                  && item.labelText !== 'Connections\n'
                ), `Person Health labels and badges must remain in stacked rows at ${viewportWidth}px / ${textSize}: ${JSON.stringify(layout.items)}`);
              } else {
                assert.equal(layout.tracks.length, layout.count);
                assert.ok(layout.tracks.every(track => Math.abs(track - layout.tracks[0]!) < 1),
                  `Person Health must retain equal ${layout.count}-column tracks at ${viewportWidth}px / ${textSize}.`);
                assert.deepEqual(layout.dividers, ['0px', ...Array.from({ length: layout.count - 1 }, () => '1px')],
                  `Column divider layout at ${viewportWidth}px / ${textSize}: ${JSON.stringify(layout)}`);
                assert.ok(layout.items.every(item =>
                  Math.abs(item.gap - 8) < 0.5
                  && item.verticalSeparation >= 7.5
                  && item.badgeCenterOffset < 1
                  && item.labelCenterOffset < 1
                  && item.labelHeight > 0
                  && item.labelScrollWidth <= item.labelClientWidth + 1
                  && item.labelWhiteSpace === 'nowrap'
                  && item.labelWordBreak === 'normal'
                  && item.labelOverflowWrap === 'normal'
                  && item.textLineCount === 1
                  && item.labelText !== 'Connections\n'
                ), `Person Health badges and labels must stack and stay centered at ${viewportWidth}px / ${textSize}.`);
              }
            }
          }
        }
        await page.getByRole('button', { name: '‹ Settings' }).click();
        await page.getByRole('button', { name: 'Categories', exact: true }).click();
        await page.getByRole('heading', { name: 'Categories', exact: true }).waitFor();

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
            if (categoryName === 'Health & Fitness') {
              const measureToggle = root.locator(
                '.category-health-summary .health-score-breakdown__measure-toggle'
              );
              assert.equal(await measureToggle.count(), 1);
              for (const viewportWidth of [375, 390, 430]) {
                await page.setViewportSize({ width: viewportWidth, height: 844 });
                const collapsedLayout = await root.evaluate(element => {
                  const card = element.querySelector<HTMLElement>('.category-health-summary');
                  const button = card?.querySelector<HTMLButtonElement>('.health-score-breakdown__measure-toggle');
                  const panel = button ? document.getElementById(button.getAttribute('aria-controls') ?? '') : null;
                  const heading = button?.closest('.health-score-breakdown__title')?.querySelector('h3');
                  const titleGroup = heading?.querySelector('.health-score-breakdown__title-end');
                  const titleText = titleGroup && [...titleGroup.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
                  if (!button || !panel || !card || !heading || !titleText) {
                    throw new Error('Category Health summary is missing its measure disclosure.');
                  }
                  const titleRange = document.createRange();
                  titleRange.selectNodeContents(titleText);
                  const titleRects = [...titleRange.getClientRects()];
                  const titleEnd = titleRects.at(-1);
                  if (!titleEnd) throw new Error('Category Health heading has no rendered text.');
                  const buttonRect = button.getBoundingClientRect();
                  const cardRect = card.getBoundingClientRect();
                  const buttonStyle = getComputedStyle(button);
                  const icon = button.querySelector('svg');
                  if (!icon) throw new Error('Category Health disclosure is missing its chevron.');
                  const iconStyle = getComputedStyle(icon);
                  const toggleRule = [...document.styleSheets]
                    .filter(sheet => !sheet.href || new URL(sheet.href).origin === location.origin)
                    .flatMap(sheet => [...sheet.cssRules])
                    .find(rule => rule instanceof CSSStyleRule
                      && rule.selectorText === '.health-score-breakdown__measure-toggle');
                  if (!(toggleRule instanceof CSSStyleRule)) {
                    throw new Error('Category Health disclosure styling rule is missing.');
                  }
                  return {
                    expanded: button.getAttribute('aria-expanded'),
                    hidden: panel.hidden,
                    panelDisplay: getComputedStyle(panel).display,
                    panelHeight: panel.getBoundingClientRect().height,
                    buttonWidth: buttonRect.width,
                    buttonHeight: buttonRect.height,
                    titleButtonGap: buttonRect.left - titleEnd.right,
                    buttonCenterOffset: Math.abs(
                      buttonRect.top + buttonRect.height / 2 - (titleEnd.top + titleEnd.height / 2)
                    ),
                    border: toggleRule.style.border,
                    borderRadius: buttonStyle.borderTopLeftRadius,
                    backgroundColor: buttonStyle.backgroundColor,
                    borderColor: buttonStyle.borderTopColor,
                    cursor: buttonStyle.cursor,
                    flexGrow: buttonStyle.flexGrow,
                    flexShrink: buttonStyle.flexShrink,
                    iconWidth: iconStyle.width,
                    iconHeight: iconStyle.height,
                    iconFill: iconStyle.fill,
                    iconStroke: iconStyle.stroke,
                    iconStrokeWidth: iconStyle.strokeWidth,
                    iconStrokeLinecap: iconStyle.strokeLinecap,
                    iconTransform: iconStyle.transform,
                    buttonTransitionDuration: buttonStyle.transitionDuration,
                    buttonTransitionTimingFunction: buttonStyle.transitionTimingFunction,
                    iconTransitionDuration: iconStyle.transitionDuration,
                    iconTransitionTimingFunction: iconStyle.transitionTimingFunction,
                    buttonInsideCard: buttonRect.right <= cardRect.right + 1,
                    viewportWidth: document.documentElement.clientWidth,
                    documentWidth: document.documentElement.scrollWidth
                  };
                });
                assert.equal(collapsedLayout.expanded, 'false');
                assert.equal(collapsedLayout.hidden, true);
                assert.equal(collapsedLayout.panelDisplay, 'none');
                assert.equal(collapsedLayout.panelHeight, 0);
                assert.deepEqual([collapsedLayout.buttonWidth, collapsedLayout.buttonHeight], [26, 26]);
                assert.equal(collapsedLayout.titleButtonGap, 10);
                assert.ok(collapsedLayout.buttonCenterOffset <= 1,
                  `Category Health disclosure should align with the title line at ${viewportWidth}px / ${textSize}: ${JSON.stringify(collapsedLayout)}.`);
                assert.equal(collapsedLayout.border, '1.5px solid var(--tend-line)');
                assert.equal(collapsedLayout.borderRadius, '50%');
                assert.equal(collapsedLayout.backgroundColor, 'rgb(255, 255, 255)');
                assert.equal(collapsedLayout.borderColor, 'rgb(220, 228, 222)');
                assert.equal(collapsedLayout.cursor, 'pointer');
                assert.equal(collapsedLayout.flexGrow, '0');
                assert.equal(collapsedLayout.flexShrink, '0');
                assert.deepEqual([collapsedLayout.iconWidth, collapsedLayout.iconHeight], ['12px', '12px']);
                assert.equal(collapsedLayout.iconFill, 'none');
                assert.equal(collapsedLayout.iconStroke, 'rgb(94, 107, 99)');
                assert.equal(collapsedLayout.iconStrokeWidth, '2px');
                assert.equal(collapsedLayout.iconStrokeLinecap, 'round');
                assert.equal(collapsedLayout.iconTransform, 'none');
                assert.equal(collapsedLayout.buttonTransitionDuration, '0.2s, 0.2s');
                assert.equal(collapsedLayout.buttonTransitionTimingFunction, 'ease, ease');
                assert.equal(collapsedLayout.iconTransitionDuration, '0.2s');
                assert.equal(collapsedLayout.iconTransitionTimingFunction, 'ease');
                assert.equal(collapsedLayout.buttonInsideCard, true);
                assert.equal(collapsedLayout.viewportWidth, viewportWidth);
                assert.equal(collapsedLayout.documentWidth, viewportWidth);

                await measureToggle.focus();
                await page.keyboard.press('Enter');
                await page.waitForTimeout(220);
                const expandedLayout = await root.evaluate(element => {
                  const button = element.querySelector<HTMLElement>('.category-health-summary')
                    ?.querySelector<HTMLButtonElement>('.health-score-breakdown__measure-toggle');
                  const panel = button ? document.getElementById(button.getAttribute('aria-controls') ?? '') : null;
                  const icon = button?.querySelector('svg');
                  if (!button || !panel || !icon) throw new Error('Category Health disclosure target disappeared.');
                  const buttonStyle = getComputedStyle(button);
                  const iconStyle = getComputedStyle(icon);
                  const captions = [...panel.querySelectorAll<HTMLElement>('.health-score-measures__caption')]
                    .map(caption => {
                      const range = document.createRange();
                      range.selectNodeContents(caption);
                      const textRects = [...range.getClientRects()];
                      const rect = caption.getBoundingClientRect();
                      return {
                        text: caption.textContent?.trim(),
                        left: rect.left,
                        right: rect.right,
                        width: caption.clientWidth,
                        scrollWidth: caption.scrollWidth,
                        textRects: textRects.map(textRect => ({
                          left: textRect.left,
                          right: textRect.right
                        }))
                      };
                    });
                  return {
                    expanded: button.getAttribute('aria-expanded'),
                    hidden: panel.hidden,
                    captions: panel.querySelectorAll('.health-score-measures__caption').length,
                    captionLayout: captions,
                    backgroundColor: buttonStyle.backgroundColor,
                    borderColor: buttonStyle.borderTopColor,
                    iconStroke: iconStyle.stroke,
                    iconTransform: iconStyle.transform,
                    viewportWidth: document.documentElement.clientWidth,
                    documentWidth: document.documentElement.scrollWidth
                  };
                });
                assert.equal(expandedLayout.expanded, 'true');
                assert.equal(expandedLayout.hidden, false);
                assert.equal(expandedLayout.captions, 2);
                assert.deepEqual(expandedLayout.captionLayout.map(caption => caption.text), [
                  'Follow-through over time',
                  'How up to date you are'
                ]);
                assert.ok(expandedLayout.captionLayout.every(caption =>
                  caption.left >= 0
                  && caption.right <= viewportWidth
                  && caption.scrollWidth <= caption.width
                  && caption.textRects.length >= 1
                  && caption.textRects.every(rect => rect.left >= 0 && rect.right <= viewportWidth)
                ), `Health measure captions should wrap naturally without clipping at ${viewportWidth}px / ${textSize}: ${JSON.stringify(expandedLayout.captionLayout)}.`);
                assert.equal(expandedLayout.backgroundColor, 'rgb(36, 107, 82)');
                assert.equal(expandedLayout.borderColor, 'rgb(36, 107, 82)');
                assert.equal(expandedLayout.iconStroke, 'rgb(255, 255, 255)');
                assert.match(expandedLayout.iconTransform, /matrix\(-1, 0, 0, -1/);
                assert.equal(expandedLayout.viewportWidth, viewportWidth);
                assert.equal(expandedLayout.documentWidth, viewportWidth);
                assert.equal(await measureToggle.evaluate(button => getComputedStyle(button).outlineStyle), 'solid');
                await page.keyboard.press('Enter');
                await page.waitForTimeout(220);
                assert.equal(await measureToggle.getAttribute('aria-expanded'), 'false');
                await page.setViewportSize({ width: 375, height: 844 });
              }
            }
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
        assert.equal(await bodyTab.getAttribute('aria-selected'), 'true',
          'Strength should default to Body.');
        await page.evaluate(() => {
          const section = document.querySelector<HTMLElement>(
            '#strength-panel-workouts [aria-labelledby="saved-workouts-heading"]'
          );
          if (!section) throw new Error('Saved workout section is missing.');
          let list = section.querySelector<HTMLElement>('.strength-template-list');
          if (!list) {
            list = document.createElement('div');
            list.className = 'strength-template-list';
            const history = section.parentElement?.querySelector('.strength-history-page');
            section.parentElement?.insertBefore(list, history ?? null);
          }
          const card = document.createElement('article');
          card.className = 'strength-template';
          card.dataset.layoutTest = 'true';
          const content = document.createElement('div');
          content.className = 'strength-template__content';
          const title = document.createElement('h3');
          title.textContent = 'A saved workout title that wraps naturally on narrow phones';
          const groups = document.createElement('p');
          groups.textContent = 'Chest · Back · Biceps · Triceps · Shoulders · Abs · Quads · Hamstrings · Calves';
          const summary = document.createElement('p');
          summary.className = 'strength-template__exercise-summary';
          summary.textContent = '5 exercises · 18 planned sets';
          content.append(title, groups, summary);

          const menu = document.createElement('details');
          menu.className = 'strength-template__menu';
          const menuButton = document.createElement('summary');
          menuButton.setAttribute('aria-label', 'Actions for responsive workout sample');
          menuButton.textContent = '⋯';
          menu.append(menuButton);

          const actions = document.createElement('div');
          actions.className = 'strength-template__actions';
          const workout = document.createElement('button');
          workout.type = 'button';
          workout.className = 'btn mini';
          workout.textContent = 'Workout';
          actions.append(workout);
          card.append(content, menu, actions);
          list.append(card);
        });
        for (const textSize of ['small', 'medium', 'large'] as const) {
          await page.setViewportSize({ width: 375, height: 844 });
          for (let attempt = 0; attempt < 3; attempt += 1) {
            if (await strengthSizeToggle.getAttribute('data-text-size') === textSize) break;
            await strengthSizeToggle.click();
          }
          assert.equal(await strengthSizeToggle.getAttribute('data-text-size'), textSize);
          await bodyTab.click();
          const strengthMeasureToggle = page.getByRole('button', {
            name: /^(?:Show|Hide) Strength Health Consistency and On Track breakdown$/
          });
          for (const viewportWidth of [375, 390, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 844 });
            const collapsedLayout = await strengthMeasureToggle.evaluate(button => {
              const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
              const card = button.closest<HTMLElement>('.fitness-score-summary');
              const title = button.closest('.health-score-breakdown__title')?.querySelector('h3');
              const titleGroup = title?.querySelector('.health-score-breakdown__title-end');
              const titleText = titleGroup && [...titleGroup.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
              if (!panel || !card || !title || !titleText) {
                throw new Error('Strength Health summary is missing its disclosure target.');
              }
              const titleRange = document.createRange();
              titleRange.selectNodeContents(titleText);
              const titleRects = [...titleRange.getClientRects()];
              const titleEnd = titleRects.at(-1);
              if (!titleEnd) throw new Error('Strength Health heading has no rendered text.');
              const buttonRect = button.getBoundingClientRect();
              const cardRect = card.getBoundingClientRect();
              return {
                expanded: button.getAttribute('aria-expanded'),
                hidden: panel.hidden,
                panelHeight: panel.getBoundingClientRect().height,
                buttonWidth: buttonRect.width,
                buttonHeight: buttonRect.height,
                titleButtonGap: buttonRect.left - titleEnd.right,
                buttonInsideCard: buttonRect.right <= cardRect.right + 1,
                viewportWidth: document.documentElement.clientWidth,
                documentWidth: document.documentElement.scrollWidth
              };
            });
            assert.equal(collapsedLayout.expanded, 'false');
            assert.equal(collapsedLayout.hidden, true);
            assert.equal(collapsedLayout.panelHeight, 0);
            assert.deepEqual([collapsedLayout.buttonWidth, collapsedLayout.buttonHeight], [26, 26]);
            assert.equal(collapsedLayout.titleButtonGap, 10,
              `Strength disclosure must keep a 10px title gap at ${viewportWidth}px / ${textSize}.`);
            assert.equal(collapsedLayout.buttonInsideCard, true);
            assert.equal(collapsedLayout.viewportWidth, viewportWidth);
            assert.equal(collapsedLayout.documentWidth, viewportWidth);
            await strengthMeasureToggle.focus();
            await page.keyboard.press('Enter');
            assert.equal(await strengthMeasureToggle.getAttribute('aria-expanded'), 'true');
            assert.equal(await strengthMeasureToggle.evaluate(button =>
              getComputedStyle(button).outlineStyle), 'solid');
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewportWidth);
            await page.keyboard.press('Enter');
            assert.equal(await strengthMeasureToggle.getAttribute('aria-expanded'), 'false');
          }
          await page.setViewportSize({ width: 390, height: 390 });
          await bodyTab.click();
          await page.getByRole('button', { name: 'Show Strength Health scoring details' }).click();
          const strengthHealthDialog = page.getByRole('dialog', { name: 'Strength Health details' });
          assert.equal((await strengthHealthDialog.getAttribute('class'))?.includes('dialog--phone-fullscreen'), true);
          await strengthHealthDialog.getByRole('button', { name: 'How this Strength Foundation was scored' }).click();
          const strengthHealthLayout = await strengthHealthDialog.evaluate(dialog => {
            const scrollBody = dialog.querySelector<HTMLElement>('.health-score-details-dialog__body');
            const close = dialog.querySelector<HTMLElement>('.money-goal-dialog__close');
            if (!scrollBody || !close) throw new Error('Strength Health details are missing their scroll body or Close control.');
            return {
              overflowY: getComputedStyle(scrollBody).overflowY,
              scrollHeight: scrollBody.scrollHeight,
              clientHeight: scrollBody.clientHeight,
              closeVisible: close.getBoundingClientRect().height > 0
                && close.getBoundingClientRect().top >= dialog.getBoundingClientRect().top
            };
          });
          assert.equal(strengthHealthLayout.overflowY, 'auto');
          assert.ok(strengthHealthLayout.scrollHeight > strengthHealthLayout.clientHeight,
            `Strength Health details must scroll at Large/Small/Medium text with a short viewport.`);
          assert.equal(strengthHealthLayout.closeVisible, true);
          await strengthHealthDialog.locator('.health-score-details-dialog__body').evaluate(element => {
            element.scrollTop = element.scrollHeight;
          });
          await strengthHealthDialog.getByRole('button', { name: 'Close Health details' }).click();
          await page.waitForFunction(() =>
            document.activeElement?.getAttribute('aria-label') === 'Show Strength Health scoring details'
          );
          if (textSize === 'small') {
            await page.setViewportSize({ width: 812, height: 375 });
            await bodyTab.click();
            await page.getByRole('button', { name: 'Show Strength Health scoring details' }).click();
            const landscapeHealth = page.getByRole('dialog', { name: 'Strength Health details' });
            const landscapeHealthBounds = await landscapeHealth.evaluate(dialog => {
              const rect = dialog.getBoundingClientRect();
              return {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                viewportWidth: document.documentElement.clientWidth,
                viewportHeight: document.documentElement.clientHeight
              };
            });
            assert.equal(landscapeHealthBounds.left, 0);
            assert.equal(landscapeHealthBounds.top, 0);
            assert.equal(landscapeHealthBounds.width, landscapeHealthBounds.viewportWidth);
            assert.equal(landscapeHealthBounds.height, landscapeHealthBounds.viewportHeight);
            await landscapeHealth.getByRole('button', { name: 'Close Health details' }).click();
          }
          await page.setViewportSize({ width: 375, height: 844 });
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
                const insights = element.closest<HTMLElement>('#strength-panel-body')
                  ?.querySelector<HTMLElement>('.strength-map-card');
                const insightsRect = insights?.getBoundingClientRect();
                const subtitle = element.querySelector<HTMLElement>('.strength-section-heading__subtitle');
                const action = actions?.querySelector<HTMLElement>('.btn');
                const actionRect = action?.getBoundingClientRect();
                const actionSharesTitleRow = Boolean(titleRect && actionRect
                  && actionRect.top < titleRect.bottom
                  && actionRect.bottom > titleRect.top);
                return {
                  left: rect.left,
                  offset: rect.top - tabsRect.bottom,
                  height: rect.height,
                  titleHeight: titleRect?.height ?? null,
                  titleTop: titleRect ? titleRect.top - rect.top : null,
                  headingToInsightsGap: titleRect && insightsRect ? insightsRect.top - titleRect.bottom : null,
                  subtitleTop: subtitle ? subtitle.getBoundingClientRect().top - rect.top : null,
                  actionTop: titleRect && actionRect ? actionRect.top - titleRect.top : null,
                  actionSharesTitleRow,
                  overlap: Boolean(titleRect && actionRect
                    && titleRect.bottom > actionRect.top
                    && actionRect.bottom > titleRect.top
                    && titleRect.right > actionRect.left
                    && actionRect.right > titleRect.left)
                };
              });
              if (headingName === 'Body overview') {
                assert.equal(position.height, position.titleHeight,
                  `Body overview should not reserve the removed Training status row at ${viewportWidth}px / ${textSize} text.`);
              } else {
                assert.ok(position.height >= 44,
                  `${headingName} heading row must retain a 44px minimum at ${viewportWidth}px / ${textSize} text.`);
              }
              assert.equal(position.overlap, false,
                `${headingName} heading and action must not overlap at ${viewportWidth}px / ${textSize} text.`);
              assert.equal(position.titleTop, 0,
                `${headingName} title should begin at the top of its shared heading row.`);
              if (position.actionSharesTitleRow) {
                assert.equal(position.actionTop, 0,
                  `${headingName} action should align with its title when sharing the row.`);
              }
              if (headingName === 'Body overview') {
                assert.equal(position.subtitleTop, null,
                  `Body overview should not reserve space for a Training status subtitle at ${viewportWidth}px / ${textSize} text.`);
                assert.ok(position.headingToInsightsGap !== null
                  && position.headingToInsightsGap >= 16
                  && position.headingToInsightsGap <= 24,
                `Body insights should follow the Body overview title by 16–24px at ${viewportWidth}px / ${textSize} text.`);
              }
              firstHeadingPositions.push(position);
            }
            assert.ok(firstHeadingPositions[0]!.offset >= 16,
              `Strength panels need breathing room below the tabs at ${viewportWidth}px / ${textSize} text.`);
            const bodyHeadingPosition = firstHeadingPositions[0]!;
            for (const position of firstHeadingPositions.slice(1)) {
              assert.ok(Math.abs(position.left - bodyHeadingPosition.left) < 0.5,
                `Strength section headings should align left at ${viewportWidth}px / ${textSize} text.`);
              assert.ok(Math.abs(position.offset - bodyHeadingPosition.offset) < 0.5,
                `Strength section headings should share a tab-panel offset at ${viewportWidth}px / ${textSize} text.`);
            }
            const rhythmHeaderLayout = await rhythmsTab.evaluate(tab => {
              const panel = document.querySelector<HTMLElement>('#strength-panel-rhythms');
              const header = panel?.querySelector<HTMLElement>('.strength-section-heading');
              const actions = header?.querySelector<HTMLElement>('.strength-section-heading__actions');
              const manage = actions?.querySelector<HTMLElement>('button[aria-haspopup="dialog"]');
              const add = actions?.querySelector<HTMLElement>('.btn:not(.ghost)');
              const badge = header?.querySelector<HTMLElement>('.strength-linked-rhythms-count');
              const subtitle = header?.querySelector<HTMLElement>('.strength-section-heading__subtitle');
              const panelRect = panel?.getBoundingClientRect();
              const manageRect = manage?.getBoundingClientRect();
              const addRect = add?.getBoundingClientRect();
              const badgeRect = badge?.getBoundingClientRect();
              return {
                selected: tab.getAttribute('aria-selected'),
                subtitle: subtitle?.textContent?.trim(),
                manageLeft: manageRect?.left ?? null,
                addRight: addRect?.right ?? null,
                panelLeft: panelRect?.left ?? null,
                panelRight: panelRect?.right ?? null,
                badgeWidth: badgeRect?.width ?? 0,
                badgeHeight: badgeRect?.height ?? 0
              };
            });
            assert.equal(rhythmHeaderLayout.selected, 'true');
            assert.equal(rhythmHeaderLayout.subtitle, 'Your routines for building strength.');
            assert.ok(rhythmHeaderLayout.manageLeft !== null && rhythmHeaderLayout.manageLeft <= rhythmHeaderLayout.panelLeft! + 1);
            assert.ok(rhythmHeaderLayout.addRight !== null && rhythmHeaderLayout.addRight <= rhythmHeaderLayout.panelRight! + 1);
            assert.ok(rhythmHeaderLayout.badgeWidth > 0 && rhythmHeaderLayout.badgeHeight > 0);
            await workoutsTab.click();
            const savedWorkoutLayout = await page.locator(
              '#strength-panel-workouts .strength-template[data-layout-test="true"]'
            ).evaluate(card => {
              const content = card.querySelector<HTMLElement>('.strength-template__content');
              const title = content?.querySelector<HTMLElement>('h3');
              const description = content?.querySelector<HTMLElement>('p');
              const menu = card.querySelector<HTMLElement>('.strength-template__menu > summary');
              const action = card.querySelector<HTMLButtonElement>('.strength-template__actions .btn');
              if (!content || !title || !description || !menu || !action) {
                throw new Error('Saved workout layout fixture is missing its title, summary, menu, or action.');
              }
              const cardRect = card.getBoundingClientRect();
              const contentRect = content.getBoundingClientRect();
              const titleRect = title.getBoundingClientRect();
              const descriptionRect = description.getBoundingClientRect();
              const menuRect = menu.getBoundingClientRect();
              const actionRect = action.getBoundingClientRect();
              const overlaps = (a: DOMRect, b: DOMRect) =>
                a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
              return {
                cardRight: cardRect.right,
                cardLeft: cardRect.left,
                contentRight: contentRect.right,
                contentLeft: contentRect.left,
                titleLeft: titleRect.left,
                titleWidth: title.clientWidth,
                titleScrollWidth: title.scrollWidth,
                descriptionLeft: descriptionRect.left,
                menuRight: menuRect.right,
                menuBottom: menuRect.bottom,
                actionRight: actionRect.right,
                actionTop: actionRect.top,
                actionHeight: actionRect.height,
                contentOverlapsAction: overlaps(contentRect, actionRect),
                viewportWidth: document.documentElement.clientWidth,
                documentWidth: document.documentElement.scrollWidth
              };
            });
            assert.equal(savedWorkoutLayout.viewportWidth, viewportWidth);
            assert.equal(savedWorkoutLayout.documentWidth, viewportWidth,
              `Saved workout card must not overflow at ${viewportWidth}px / ${textSize} text.`);
            assert.ok(savedWorkoutLayout.cardLeft >= 0 && savedWorkoutLayout.cardRight <= viewportWidth);
            assert.ok(savedWorkoutLayout.titleWidth > 0
              && savedWorkoutLayout.titleScrollWidth <= savedWorkoutLayout.titleWidth,
            `Saved workout title must wrap inside its column at ${viewportWidth}px / ${textSize} text.`);
            assert.equal(savedWorkoutLayout.descriptionLeft, savedWorkoutLayout.titleLeft,
              `Saved workout title and muscle groups must remain left-aligned at ${viewportWidth}px / ${textSize} text.`);
            assert.ok(Math.abs(savedWorkoutLayout.menuRight - savedWorkoutLayout.actionRight) <= 1,
              `Workout must align beneath the menu at ${viewportWidth}px / ${textSize} text.`);
            assert.ok(savedWorkoutLayout.actionTop >= savedWorkoutLayout.menuBottom,
              `Workout must stay below the menu at ${viewportWidth}px / ${textSize} text.`);
            assert.ok(savedWorkoutLayout.actionHeight >= 40);
            assert.equal(savedWorkoutLayout.contentOverlapsAction, false,
              `Workout action must not overlap long card content at ${viewportWidth}px / ${textSize} text.`);
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
          const originalBodyStyles = await page.evaluate(() => ({
            position: document.body.style.position,
            top: document.body.style.top,
            width: document.body.style.width,
            overflow: document.body.style.overflow,
            paddingRight: document.body.style.paddingRight
          }));
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
          assert.equal(
            await colorsRenderIdentically(page, createCardLayout.createBorder, createCardLayout.starterBorder),
            true,
            'Create border and starter border should render the same color.'
          );
          assert.equal(
            await colorsRenderIdentically(page, createCardLayout.createColor, createCardLayout.starterBorder),
            true,
            'Create text and starter border should render the same color.'
          );
          const p90xCard = routines.locator('.strength-workout-suggestion').filter({ hasText: 'P90X Ab Ripper' });
          await p90xCard.locator('.strength-workout-suggestion__preview summary').click();
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
          const customization = p90xCard.getByRole('button', { name: 'Customize' });
          await customization.click();
          const editor = page.getByRole('dialog', { name: 'Create workout' });
          assert.equal(await page.getByRole('dialog').count(), 1);
          assert.equal((await editor.getAttribute('class'))?.includes('dialog--phone-fullscreen'), true);
          const workoutEditorForm = editor.locator('form.strength-workout-editor');
          const exerciseStructure = await editor.evaluate(dialog => {
            const form = dialog.querySelector<HTMLFormElement>('form.strength-workout-editor');
            const items = [...(form?.querySelectorAll<HTMLElement>('.strength-exercises__item') ?? [])];
            const twoSetItems = items.filter(item =>
              item.querySelector('.strength-exercises__meta')?.textContent?.includes('2 ×')
            );
            if (!form) throw new Error('P90X customization is missing its shared workout editor form.');
            return {
              exerciseCount: items.length,
              twoSetExerciseCount: twoSetItems.length,
              scrollHeight: form.scrollHeight,
              clientHeight: form.clientHeight,
              overflowY: getComputedStyle(form).overflowY,
              overscrollBehavior: getComputedStyle(form).overscrollBehaviorY,
              bodyPosition: document.body.style.position,
              bodyOverflow: document.body.style.overflow
            };
          });
          assert.equal(exerciseStructure.exerciseCount, 11);
          assert.equal(exerciseStructure.twoSetExerciseCount, 2);
          assert.ok(exerciseStructure.scrollHeight > exerciseStructure.clientHeight,
            `P90X editor must have a bounded scroll area at ${textSize} text.`);
          assert.equal(exerciseStructure.overflowY, 'auto');
          assert.equal(exerciseStructure.overscrollBehavior, 'contain');
          assert.equal(exerciseStructure.bodyPosition, 'fixed');
          assert.equal(exerciseStructure.bodyOverflow, 'hidden');

          const touchSession = await context.newCDPSession(page);
          for (const viewportWidth of [375, 390, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 844 });
            await workoutEditorForm.evaluate(form => { form.scrollTop = 0; });
            const bounds = await workoutEditorForm.boundingBox();
            if (!bounds) throw new Error('P90X workout editor scroll region is not visible.');
            await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            await page.mouse.wheel(0, 700);
            await page.waitForFunction(() =>
              (document.querySelector<HTMLFormElement>('.money-goal-dialog--strength-workout-editor form.strength-workout-editor')
                ?.scrollTop ?? 0) > 0
            );
            const wheelScrollTop = await workoutEditorForm.evaluate(form => form.scrollTop);
            assert.ok(wheelScrollTop > 0,
              `P90X editor should respond to mouse-wheel scrolling at ${viewportWidth}px / ${textSize} text.`);

            await workoutEditorForm.evaluate(form => { form.scrollTop = 0; });
            const touchTarget = await editor.locator('.strength-exercises__heading h3').boundingBox();
            if (!touchTarget) throw new Error('P90X exercise heading is not visible for touch-scroll testing.');
            const touchX = Math.round(touchTarget.x + Math.min(touchTarget.width / 2, 80));
            const touchY = Math.round(touchTarget.y + touchTarget.height / 2);
            await touchSession.send('Input.dispatchTouchEvent', {
              type: 'touchStart',
              touchPoints: [{ x: touchX, y: touchY, id: 1 }]
            });
            await touchSession.send('Input.dispatchTouchEvent', {
              type: 'touchMove',
              touchPoints: [{ x: touchX, y: touchY - 240, id: 1 }]
            });
            await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await page.waitForFunction(() =>
              (document.querySelector<HTMLFormElement>('.money-goal-dialog--strength-workout-editor form.strength-workout-editor')
                ?.scrollTop ?? 0) > 0
            );
            const touchScrollTop = await workoutEditorForm.evaluate(form => form.scrollTop);
            assert.ok(touchScrollTop > 0,
              `P90X editor should respond to touch scrolling at ${viewportWidth}px / ${textSize} text.`);
          }

          await page.setViewportSize({ width: 375, height: 844 });
          await workoutEditorForm.evaluate(form => { form.scrollTop = 0; });
          await editor.getByRole('textbox', { name: 'Workout name' }).focus();
          const saveButton = editor.getByRole('button', { name: 'Save workout' });
          let saveReachedByKeyboard = false;
          for (let tab = 0; tab < 100; tab += 1) {
            await page.keyboard.press('Tab');
            if (await saveButton.evaluate(button => document.activeElement === button)) {
              saveReachedByKeyboard = true;
              break;
            }
          }
          assert.equal(saveReachedByKeyboard, true, 'Keyboard tab navigation should reach Save workout.');
          assert.ok(await workoutEditorForm.evaluate(form => form.scrollTop > 0),
            `Keyboard navigation should scroll the P90X editor at ${textSize} text.`);
          await page.keyboard.press('Tab');
          assert.equal(
            await editor.getByRole('button', { name: 'Cancel' }).evaluate(button => document.activeElement === button),
            true,
            'Keyboard tab navigation should reach Cancel.'
          );
          await page.setViewportSize({ width: 844, height: 390 });
          const landscapeScroll = await editor.evaluate(dialog => ({
            scrollHeight: dialog.scrollHeight,
            clientHeight: dialog.clientHeight,
            overflowY: getComputedStyle(dialog).overflowY
          }));
          assert.ok(landscapeScroll.scrollHeight > landscapeScroll.clientHeight,
            `P90X editor should fit a scrollable landscape viewport at ${textSize} text.`);
          assert.equal(landscapeScroll.overflowY, 'auto');
          await page.setViewportSize({ width: 375, height: 390 });
          const shortViewport = await workoutEditorForm.evaluate(form => ({
            scrollHeight: form.scrollHeight,
            clientHeight: form.clientHeight,
            overflowY: getComputedStyle(form).overflowY
          }));
          assert.ok(shortViewport.clientHeight > 0 && shortViewport.scrollHeight > shortViewport.clientHeight,
            `P90X editor should retain a scroll region in a short keyboard-like viewport at ${textSize} text.`);
          assert.equal(shortViewport.overflowY, 'auto');
          await touchSession.detach();
          await editor.getByRole('button', { name: 'Back to Add workout' }).click();
          assert.equal(await page.getByRole('dialog').count(), 1);
          await page.getByRole('dialog', { name: 'Add workout' }).getByRole('button', { name: 'Close Add workout' }).click();
          const restoredBodyStyles = await page.evaluate(() => ({
            position: document.body.style.position,
            top: document.body.style.top,
            width: document.body.style.width,
            overflow: document.body.style.overflow,
            paddingRight: document.body.style.paddingRight
          }));
          assert.deepEqual(restoredBodyStyles, originalBodyStyles,
            'Closing the workout editor should restore background scroll styles.');
          await verifyGuidedSetActionSpacing(page, textSize);
          await verifyGuidedRhythmChoiceLayout(page, textSize);
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
          await page.getByRole('region', { name: 'Body insights' }).waitFor();
          for (const viewportWidth of [375, 390, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 844 });
            const layout = await strengthTabs.evaluate(element => {
              const strength = element.closest<HTMLElement>('.strength-page');
              const score = strength?.querySelector<HTMLElement>(':scope > .fitness-score-summary');
              const panel = strength?.querySelector<HTMLElement>('#strength-panel-body');
              const map = panel?.querySelector<HTMLElement>('.strength-map-card');
              const heading = map?.querySelector<HTMLElement>('.tool-zone__purpose');
              const mapLayout = map?.querySelector<HTMLElement>('.strength-map-layout');
              if (!strength || !score || !panel || !map || !heading || !mapLayout) {
                throw new Error('Strength Body panel is missing its shared score, insights zone, or map.');
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
              `Strength Body insights title must fit at ${viewportWidth}px / ${textSize} text.`);
            assert.equal(layout.mapFits, true,
              `Strength body map must fit at ${viewportWidth}px / ${textSize} text.`);
          }
        }

        await page.setViewportSize({ width: 1280, height: 900 });
        await page.getByRole('button', { name: /All Foundations/ }).click();
        await page.getByRole('button', { name: /Open Flexibility foundation details/ }).click();
        const flexibilityTabs = page.getByRole('tablist', { name: 'Flexibility sections' });
        const flexibilityBodyTab = flexibilityTabs.getByRole('tab', { name: 'Body' });
        const flexibilityRoutinesTab = flexibilityTabs.getByRole('tab', { name: 'Routines' });
        const flexibilityRhythmsTab = flexibilityTabs.getByRole('tab', { name: 'Rhythms' });
        assert.equal(await flexibilityBodyTab.getAttribute('aria-selected'), 'true',
          'Flexibility should default to Body when opened.');
        for (const textSize of ['small', 'medium', 'large'] as const) {
          await page.setViewportSize({ width: 375, height: 844 });
          for (let attempt = 0; attempt < 3; attempt += 1) {
            if (await categorySizeToggle.getAttribute('data-text-size') === textSize) break;
            await categorySizeToggle.click();
          }
          assert.equal(await categorySizeToggle.getAttribute('data-text-size'), textSize);
          for (const viewportWidth of [375, 390, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 844 });
            await flexibilityBodyTab.click();
            await page.getByRole('region', { name: 'Body insights' }).waitFor();
            assert.equal(
              await page.locator('#flexibility-panel-body').getByRole('button', { name: 'Log Shoulders' }).count(),
              0,
              'The selected-region log action must stay out of Flexibility Body.'
            );
            const bodyLayout = await page.locator('#flexibility-panel-body').evaluate(panel => {
              const map = panel.querySelector<HTMLElement>('.flexibility-map-card');
              const heading = map?.querySelector<HTMLElement>('.tool-zone__purpose');
              const mapLayout = map?.querySelector<HTMLElement>('.strength-map-layout');
              const tabs = document.querySelector<HTMLElement>('.flexibility-view > [role="tablist"]');
              if (!heading || !map || !mapLayout || !tabs) {
                throw new Error('Flexibility Body is missing its insights zone, shared map layout, or section tabs.');
              }
              const mapRect = map.getBoundingClientRect();
              const tabsRect = tabs.getBoundingClientRect();
              const mapLayoutRect = mapLayout.getBoundingClientRect();
              return {
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: document.documentElement.clientWidth,
                headingFits: heading.scrollWidth <= heading.clientWidth,
                headingOffset: mapRect.top - tabsRect.bottom,
                mapFits: mapLayoutRect.left >= mapRect.left && mapLayoutRect.right <= mapRect.right
              };
            });
            assert.equal(bodyLayout.documentWidth, viewportWidth,
              `Flexibility Body must not overflow at ${viewportWidth}px / ${textSize} text.`);
            assert.equal(bodyLayout.viewportWidth, viewportWidth);
            assert.equal(bodyLayout.headingFits, true);
            assert.ok(bodyLayout.headingOffset >= 16,
              `Flexibility Body insights need breathing room below the tabs at ${viewportWidth}px / ${textSize} text.`);
            assert.equal(bodyLayout.mapFits, true);

            await flexibilityRoutinesTab.click();
            const routinesPanel = page.locator('#flexibility-panel-routines');
            await routinesPanel.getByRole('heading', { name: 'My routines' }).waitFor();
            assert.equal(await routinesPanel.getByText('Your stretches, ready when you are.', { exact: true }).isVisible(), true);
            assert.equal(await routinesPanel.getByRole('button', { name: 'Add routine' }).isVisible(), true);
            assert.equal(await routinesPanel.getByRole('heading', { name: 'History' }).isVisible(), true);
            assert.equal(await routinesPanel.getByText('Your completed stretches.', { exact: true }).isVisible(), true);
            assert.equal(await routinesPanel.getByRole('button', { name: 'Log stretch' }).isVisible(), true);
            assert.equal(await routinesPanel.getByText('No stretches logged yet.', { exact: true }).isVisible(), true);
            assert.equal(await routinesPanel.getByText('No routines saved yet. Add a suggested routine or create your own.', { exact: true }).isVisible(), true);
            const routineHeadings = await routinesPanel.locator('.strength-section-heading').evaluateAll(headings => {
              const tabsRect = document.querySelector<HTMLElement>(
                '.flexibility-view > [role="tablist"]'
              )!.getBoundingClientRect();
              return headings.map(element => {
                const heading = element as HTMLElement;
                const title = heading.querySelector<HTMLElement>('.strength-section-heading__title-row');
                const action = heading.querySelector<HTMLElement>('.strength-section-heading__actions .btn');
                const titleRect = title?.getBoundingClientRect();
                const actionRect = action?.getBoundingClientRect();
                return {
                  offset: heading.getBoundingClientRect().top - tabsRect.bottom,
                  overlap: Boolean(titleRect && actionRect
                    && titleRect.top < actionRect.bottom
                    && actionRect.top < titleRect.bottom
                    && titleRect.left < actionRect.right
                    && actionRect.left < titleRect.right)
                };
              });
            });
            assert.equal(routineHeadings.length, 2);
            assert.equal(routineHeadings[0]!.overlap, false,
              `Flexibility routine actions must not overlap headings at ${viewportWidth}px / ${textSize} text.`);
            assert.equal(routineHeadings[1]!.overlap, false,
              `Flexibility history actions must not overlap headings at ${viewportWidth}px / ${textSize} text.`);
            assert.ok(routineHeadings[0]!.offset >= 16,
              `Flexibility Routines needs breathing room below the tabs at ${viewportWidth}px / ${textSize} text.`);
            assert.ok(Math.abs(routineHeadings[0]!.offset - bodyLayout.headingOffset) < 0.5,
              `Flexibility Body and Routines should share a tab-panel offset at ${viewportWidth}px / ${textSize} text.`);
            const routineSpacing = await routinesPanel.locator('.flexibility-routine-collection').evaluate(collection => {
              const sections = collection.querySelectorAll<HTMLElement>(':scope > .strength-workout-section');
              if (sections.length !== 2) throw new Error('Flexibility Routines and History must remain separate sections.');
              return {
                rowGap: getComputedStyle(collection).rowGap,
                sectionGap: sections[1]!.getBoundingClientRect().top - sections[0]!.getBoundingClientRect().bottom
              };
            });
            assert.equal(routineSpacing.rowGap, '18px',
              'Flexibility must reuse Strength’s section gap for both empty and populated routine content.');
            assert.ok(routineSpacing.sectionGap >= 17,
              `Flexibility History must be separated from My routines at ${viewportWidth}px / ${textSize} text.`);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewportWidth,
              `Flexibility Routines must not overflow at ${viewportWidth}px / ${textSize} text.`);

            const logButton = routinesPanel.getByRole('button', { name: 'Log stretch' });
            await logButton.click();
            const stretchLogDialog = page.getByRole('dialog', { name: 'Log a stretch' });
            const shouldersCheckbox = stretchLogDialog.getByRole('checkbox', { name: 'Shoulders' });
            if (!await shouldersCheckbox.isChecked()) await shouldersCheckbox.check();
            const modalLayout = await stretchLogDialog.evaluate(dialog => {
              const scrollRegion = dialog.querySelector<HTMLElement>('.money-goal-dialog__scroll-region');
              const close = dialog.querySelector<HTMLElement>('.money-goal-dialog__close');
              const date = dialog.querySelector<HTMLInputElement>('#flexibility-log-date');
              const minutes = dialog.querySelector<HTMLInputElement>('#flexibility-log-minutes');
              const notes = dialog.querySelector<HTMLTextAreaElement>('#flexibility-log-notes');
              const actions = dialog.querySelector<HTMLElement>('.money-goal-dialog__actions');
              const save = dialog.querySelector<HTMLButtonElement>('button[type="submit"]');
              const tiles = [...dialog.querySelectorAll<HTMLElement>('.checkbox-tile-options__tile')];
              const checkbox = dialog.querySelector<HTMLInputElement>('.checkbox-tile-options__tile input');
              if (!scrollRegion || !close || !date || !minutes || !notes || !actions || !save || !checkbox
                || tiles.length === 0) {
                throw new Error('Stretch logging is missing its shared dialog, fields, or selection tiles.');
              }
              const dialogRect = dialog.getBoundingClientRect();
              const closeRect = close.getBoundingClientRect();
              const scrollRect = scrollRegion.getBoundingClientRect();
              return {
                dialogBounds: {
                  left: dialogRect.left,
                  top: dialogRect.top,
                  width: dialogRect.width,
                  height: dialogRect.height
                },
                viewportWidth: document.documentElement.clientWidth,
                viewportHeight: document.documentElement.clientHeight,
                documentWidth: document.documentElement.scrollWidth,
                scrollOverflowY: getComputedStyle(scrollRegion).overflowY,
                scrollHeight: scrollRegion.scrollHeight,
                scrollClientHeight: scrollRegion.clientHeight,
                closeHeight: closeRect.height,
                closeInsideViewport: closeRect.top >= 0 && closeRect.bottom <= document.documentElement.clientHeight,
                dateHeight: date.getBoundingClientRect().height,
                minutesHeight: minutes.getBoundingClientRect().height,
                notesHeight: notes.getBoundingClientRect().height,
                actionBounds: (() => {
                  const rect = actions.getBoundingClientRect();
                  return { top: rect.top, bottom: rect.bottom };
                })(),
                scrollBounds: { top: scrollRect.top, bottom: scrollRect.bottom },
                saveEnabled: !save.disabled,
                tileHeights: tiles.map(tile => tile.getBoundingClientRect().height),
                checkboxSize: (() => {
                  const rect = checkbox.getBoundingClientRect();
                  return { width: rect.width, height: rect.height };
                })()
              };
            });
            assert.equal((await stretchLogDialog.getAttribute('class'))?.includes('dialog--phone-fullscreen'), true);
            assert.equal((await stretchLogDialog.getAttribute('class'))?.includes('money-goal-dialog--scrollable-body'), true);
            assert.deepEqual(modalLayout.dialogBounds, {
              left: 0,
              top: 0,
              width: viewportWidth,
              height: 844
            });
            assert.equal(modalLayout.viewportWidth, viewportWidth);
            assert.equal(modalLayout.viewportHeight, 844);
            assert.equal(modalLayout.documentWidth, viewportWidth,
              `Stretch logging must not overflow at ${viewportWidth}px / ${textSize} text.`);
            assert.equal(modalLayout.scrollOverflowY, 'auto');
            assert.ok(modalLayout.closeHeight >= 44 && modalLayout.closeInsideViewport);
            assert.ok(modalLayout.dateHeight >= 44 && modalLayout.minutesHeight >= 44);
            assert.ok(modalLayout.notesHeight >= 72);
            assert.ok(modalLayout.saveEnabled);
            assert.ok(modalLayout.tileHeights.every(height => height >= 44));
            assert.deepEqual(modalLayout.checkboxSize, { width: 18, height: 18 });

            const scrollRegion = stretchLogDialog.getByRole('region', { name: 'Log a stretch content' });
            if (modalLayout.scrollHeight > modalLayout.scrollClientHeight) {
              await scrollRegion.focus();
              await page.keyboard.press('End');
              await page.waitForFunction(() =>
                (document.querySelector<HTMLElement>('.money-goal-dialog__scroll-region')?.scrollTop ?? 0) > 0
              );
              const endScroll = await stretchLogDialog.evaluate(dialog => {
                const region = dialog.querySelector<HTMLElement>('.money-goal-dialog__scroll-region');
                const actions = dialog.querySelector<HTMLElement>('.money-goal-dialog__actions');
                if (!region || !actions) throw new Error('Stretch logging lost its independent scroll region or actions.');
                const regionRect = region.getBoundingClientRect();
                const actionsRect = actions.getBoundingClientRect();
                return {
                  scrollTop: region.scrollTop,
                  regionBounds: { top: regionRect.top, bottom: regionRect.bottom },
                  actionBounds: { top: actionsRect.top, bottom: actionsRect.bottom },
                  actionsVisible: actionsRect.top >= regionRect.top - 1 && actionsRect.bottom <= regionRect.bottom + 1
                };
              });
              assert.ok(endScroll.scrollTop > 0);
              assert.equal(endScroll.actionsVisible, true,
                `Keyboard End should reveal Save and Cancel inside the independently scrolling content: ${JSON.stringify(endScroll)}.`);
              await page.keyboard.press('Home');
              await page.waitForFunction(() =>
                (document.querySelector<HTMLElement>('.money-goal-dialog__scroll-region')?.scrollTop ?? -1) === 0
              );
            } else {
              assert.ok(
                modalLayout.actionBounds.top >= modalLayout.scrollBounds.top - 1
                  && modalLayout.actionBounds.bottom <= modalLayout.scrollBounds.bottom + 1,
                `Stretch dialog actions should remain visible when the content fits without scrolling: ${JSON.stringify(modalLayout)}.`
              );
            }
            await stretchLogDialog.getByRole('button', { name: 'Close stretch session' }).click();
            assert.equal(await logButton.evaluate(button => document.activeElement === button), true,
              'Closing stretch logging should return focus to the Routines Log stretch action.');

            await flexibilityRhythmsTab.click();
            const rhythmPanel = page.locator('#flexibility-panel-rhythms');
            await rhythmPanel.getByRole('heading', { name: /^Linked Rhythms/ }).waitFor();
            assert.equal(await rhythmPanel.getByText('Your routines for building flexibility.', { exact: true }).isVisible(), true);
            assert.equal(await rhythmPanel.getByRole('button', { name: 'Manage links' }).isVisible(), true);
            assert.equal(await rhythmPanel.getByRole('button', { name: 'Add Rhythm' }).isVisible(), true);
            assert.equal(await rhythmPanel.getByText('No Rhythms are linked to Flexibility yet.', { exact: true }).isVisible(), true);
            const rhythmHeading = await rhythmPanel.locator('.strength-section-heading').evaluate(element => {
              const heading = element as HTMLElement;
              const tabsRect = document.querySelector<HTMLElement>(
                '.flexibility-view > [role="tablist"]'
              )!.getBoundingClientRect();
              const title = heading.querySelector<HTMLElement>('.strength-section-heading__title-row');
              const actions = heading.querySelector<HTMLElement>('.strength-section-heading__actions');
              const titleRect = title?.getBoundingClientRect();
              const actionsRect = actions?.getBoundingClientRect();
              return {
                overlap: Boolean(titleRect && actionsRect
                  && titleRect.top < actionsRect.bottom
                  && actionsRect.top < titleRect.bottom
                  && titleRect.left < actionsRect.right
                  && actionsRect.left < titleRect.right),
                offset: heading.getBoundingClientRect().top - tabsRect.bottom,
                badgeSize: heading.querySelector<HTMLElement>('.strength-linked-rhythms-count')?.getBoundingClientRect().width ?? 0
              };
            });
            assert.equal(rhythmHeading.overlap, false,
              `Flexibility Rhythm actions must not overlap headings at ${viewportWidth}px / ${textSize} text.`);
            assert.ok(rhythmHeading.badgeSize > 0);
            assert.ok(Math.abs(rhythmHeading.offset - bodyLayout.headingOffset) < 0.5,
              `Flexibility Body and Rhythms should share a tab-panel offset at ${viewportWidth}px / ${textSize} text.`);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewportWidth,
              `Flexibility Rhythms must not overflow at ${viewportWidth}px / ${textSize} text.`);

            await flexibilityBodyTab.click();
            await page.getByRole('button', { name: 'Stretch interval settings' }).click();
            const intervalDialog = page.getByRole('dialog', { name: 'Stretch intervals' });
            assert.equal((await intervalDialog.getAttribute('class'))?.includes('dialog--phone-fullscreen'), true);
            const intervalLayout = await intervalDialog.evaluate(dialog => {
              const body = dialog.querySelector<HTMLElement>('.flexibility-settings-dialog__body');
              const surface = dialog.querySelector<HTMLElement>('.money-goal-dialog__surface');
              const row = dialog.querySelector<HTMLElement>('.flexibility-settings__row');
              const region = row?.querySelector<HTMLElement>(':scope > span');
              const field = row?.querySelector<HTMLElement>('.flexibility-settings__field');
              const trigger = dialog.querySelector<HTMLElement>('.flexibility-settings__select-trigger');
              if (!body || !surface || !region || !field || !trigger) {
                throw new Error('Stretch intervals are missing their scroll body or standard field layout.');
              }
              const regionRect = region.getBoundingClientRect();
              const fieldRect = field.getBoundingClientRect();
              const triggerRect = trigger.getBoundingClientRect();
              return {
                overflowY: getComputedStyle(body).overflowY,
                bodyHeight: body.clientHeight,
                dialogWidth: dialog.getBoundingClientRect().width,
                surfaceWidth: surface.getBoundingClientRect().width,
                documentWidth: document.documentElement.scrollWidth,
                regionRight: regionRect.right,
                fieldLeft: fieldRect.left,
                triggerHeight: triggerRect.height
              };
            });
            assert.equal(intervalLayout.overflowY, 'auto');
            assert.ok(intervalLayout.bodyHeight > 0);
            assert.ok(intervalLayout.dialogWidth <= viewportWidth);
            assert.ok(intervalLayout.surfaceWidth <= viewportWidth);
            assert.equal(intervalLayout.documentWidth, viewportWidth,
              `Stretch intervals must not overflow at ${viewportWidth}px / ${textSize} text.`);
            assert.ok(intervalLayout.fieldLeft >= intervalLayout.regionRight - 1);
            assert.ok(intervalLayout.triggerHeight >= 44);
            if (textSize === 'small' && viewportWidth === 375) {
              const shoulders = intervalDialog.getByRole('combobox', { name: 'Shoulders stretch interval' });
              const savedShoulderInterval = (await shoulders.textContent())?.trim();
              await shoulders.click();
              await intervalDialog.getByRole('listbox', { name: 'Shoulders stretch interval' }).waitFor();
              const anchored = await intervalDialog.evaluate(dialog => {
                const menuElement = dialog.querySelector<HTMLElement>('[role="listbox"]');
                const trigger = dialog.querySelector<HTMLElement>(
                  '.flexibility-settings__select-trigger[aria-label="Shoulders stretch interval"]'
                );
                if (!menuElement || !trigger) throw new Error('Interval choices are missing their anchored trigger or menu.');
                const menu = menuElement.getBoundingClientRect();
                const field = trigger.getBoundingClientRect();
                return {
                  left: menu.left,
                  right: menu.right,
                  top: menu.top,
                  bottom: menu.bottom,
                  fieldLeft: field.left,
                  fieldRight: field.right,
                  viewportWidth: document.documentElement.clientWidth,
                  viewportHeight: document.documentElement.clientHeight
                };
              });
              assert.equal(anchored.left, anchored.fieldLeft);
              assert.equal(anchored.right, anchored.fieldRight);
              assert.ok(anchored.top >= 0 && anchored.bottom <= anchored.viewportHeight);
              await page.keyboard.press('Home');
              await page.keyboard.press('Enter');
              assert.equal((await shoulders.textContent())?.trim(), 'Every 1 day');
              await intervalDialog.getByRole('button', { name: 'Cancel' }).click();
              await page.getByRole('button', { name: 'Stretch interval settings' }).click();
              const reopenedShoulders = page.getByRole('dialog', { name: 'Stretch intervals' })
                .getByRole('combobox', { name: 'Shoulders stretch interval' });
              assert.equal((await reopenedShoulders.textContent())?.trim(), savedShoulderInterval);
              await page.getByRole('dialog', { name: 'Stretch intervals' })
                .getByRole('button', { name: 'Cancel' }).click();
            } else {
              await intervalDialog.getByRole('button', { name: 'Cancel' }).click();
            }
          }
        }

        await page.setViewportSize({ width: 375, height: 844 });
        await flexibilityRoutinesTab.click();
        await page.getByRole('button', { name: 'Add routine' }).click();
        const flexibilityLibrary = page.getByRole('dialog', { name: 'Add routine' });
        await flexibilityLibrary.getByRole('button', { name: 'Customize' }).first().click();
        const flexibilityRoutineEditor = page.getByRole('dialog', { name: 'Preview routine' });
        await flexibilityRoutineEditor.getByRole('button', { name: 'Add to Saved' }).click();
        await page.getByRole('heading', { name: 'Daily Stretch' }).waitFor();
        const populatedRoutineSpacing = await page.locator('#flexibility-panel-routines .flexibility-routine-collection')
          .evaluate(collection => {
            const sections = collection.querySelectorAll<HTMLElement>(':scope > .strength-workout-section');
            if (collection.querySelector('.strength-template-list')?.children.length === 0 || sections.length !== 2) {
              throw new Error('A saved Flexibility routine and its History section must render together.');
            }
            return {
              rowGap: getComputedStyle(collection).rowGap,
              sectionGap: sections[1]!.getBoundingClientRect().top - sections[0]!.getBoundingClientRect().bottom
            };
          });
        assert.equal(populatedRoutineSpacing.rowGap, '18px');
        assert.ok(populatedRoutineSpacing.sectionGap >= 17);

        await page.locator('#flexibility-panel-routines')
          .getByRole('button', { name: 'Log stretch' }).click();
        const historyLog = page.getByRole('dialog', { name: 'Log a stretch' });
        const neckCheckbox = historyLog.getByRole('checkbox', { name: 'Neck' });
        if (!await neckCheckbox.isChecked()) await neckCheckbox.check();
        await historyLog.locator('#flexibility-log-minutes').fill('5');
        await historyLog.getByRole('textbox', { name: 'Notes (optional)' }).fill('Synthetic history note');
        await historyLog.getByRole('button', { name: 'Save stretch' }).click();
        const unlinkedSaveDialog = page.getByRole('dialog', { name: 'Save without a Rhythm?' });
        if (await unlinkedSaveDialog.count()) {
          await unlinkedSaveDialog.getByRole('button', { name: 'Save stretch only' }).click();
        }
        const manualHistoryCard = page.locator('.flexibility-history__item').first();
        await manualHistoryCard.waitFor();
        assert.equal(await manualHistoryCard.getByRole('heading', { name: 'Manual Stretch', level: 3 }).isVisible(), true);
        assert.equal(await manualHistoryCard.getByText('Synthetic history note', { exact: true }).isVisible(), true);
        for (const textSize of ['small', 'medium', 'large'] as const) {
          await setPreviewTextSize(page, textSize);
          for (const viewportWidth of [375, 390, 430] as const) {
            await page.setViewportSize({ width: viewportWidth, height: 844 });
            const layout = await manualHistoryCard.evaluate(card => {
              const title = card.querySelector<HTMLElement>('.flexibility-history__title');
              const details = card.querySelector<HTMLElement>('.flexibility-history__details');
              const note = card.querySelector<HTMLElement>('.flexibility-history__note');
              const actions = card.querySelector<HTMLElement>('.flexibility-history__actions');
              const buttons = [...(actions?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
              if (!title || !details || !note || !actions || buttons.length !== 2) {
                throw new Error('Manual Stretch history is missing its title, details, note, or paired actions.');
              }
              const rect = (element: HTMLElement) => {
                const bounds = element.getBoundingClientRect();
                return { top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right };
              };
              return {
                titleText: title.textContent?.trim(),
                details: details.textContent?.trim(),
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: document.documentElement.clientWidth,
                cardRight: card.getBoundingClientRect().right,
                titleBounds: rect(title),
                detailsBounds: rect(details),
                note: rect(note),
                actions: rect(actions),
                actionDirection: getComputedStyle(actions).flexDirection,
                actionGap: getComputedStyle(actions).columnGap,
                buttonBounds: buttons.map(rect),
                detailsFits: details.scrollWidth <= details.clientWidth,
                noteFits: note.scrollWidth <= note.clientWidth
              };
            });
            assert.equal(layout.viewportWidth, viewportWidth);
            assert.equal(layout.documentWidth, viewportWidth,
              `Manual Stretch history must not overflow at ${viewportWidth}px / ${textSize} text.`);
            assert.ok(layout.cardRight <= viewportWidth + 1);
            assert.equal(layout.titleText, 'Manual Stretch');
            assert.match(layout.details ?? '', /5 min/);
            assert.doesNotMatch(layout.details ?? '', /T\d{2}:\d{2}/,
              'Manual Stretch history must not invent a time.');
            assert.equal(layout.actionDirection, 'row');
            assert.equal(layout.actionGap, '8px');
            assert.equal(Math.abs(layout.buttonBounds[0]!.top - layout.buttonBounds[1]!.top) < 1, true,
              `Edit and Delete should remain side by side at ${viewportWidth}px / ${textSize} text.`);
            assert.ok(layout.detailsBounds.top >= layout.titleBounds.bottom);
            assert.ok(layout.note.top >= layout.detailsBounds.bottom);
            assert.ok(layout.actions.top >= layout.note.bottom);
            assert.equal(layout.detailsFits, true);
            assert.equal(layout.noteFits, true);
          }
        }

        await page.setViewportSize({ width: 812, height: 375 });
        await flexibilityBodyTab.click();
        await page.getByRole('button', { name: 'Stretch interval settings' }).click();
        const landscapeIntervals = page.getByRole('dialog', { name: 'Stretch intervals' });
        const landscapeBounds = await landscapeIntervals.evaluate(dialog => {
          const rect = dialog.getBoundingClientRect();
          const body = dialog.querySelector<HTMLElement>('.flexibility-settings-dialog__body');
          const close = dialog.querySelector<HTMLElement>('.money-goal-dialog__close');
          if (!body || !close) throw new Error('Landscape interval editor is missing its scroll body or Close control.');
          return {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            viewportWidth: document.documentElement.clientWidth,
            viewportHeight: document.documentElement.clientHeight,
            bodyOverflowY: getComputedStyle(body).overflowY,
            closeHeight: close.getBoundingClientRect().height
          };
        });
        assert.equal(landscapeBounds.left, 0);
        assert.equal(landscapeBounds.top, 0);
        assert.equal(landscapeBounds.width, landscapeBounds.viewportWidth);
        assert.equal(landscapeBounds.height, landscapeBounds.viewportHeight);
        assert.equal(landscapeBounds.bodyOverflowY, 'auto');
        assert.ok(landscapeBounds.closeHeight > 0);
        await landscapeIntervals.getByRole('button', { name: 'Cancel' }).click();

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

        await page.setViewportSize({ width: 1280, height: 900 });
        await areaNavigation.getByRole('button', { name: 'Health & Fitness' }).click();
        const cardioWeightFoundations = [
          {
            name: 'Cardio',
            tablist: 'Cardio Foundation sections',
            tabs: ['Insights', 'Activities', 'Rhythms'],
            panels: ['cardio-panel-progress', 'cardio-panel-activities', 'cardio-panel-rhythms'],
            gear: 'Cardio tracking settings',
            dialog: 'Cardio goals',
            emptyActivity: 'No activity has been logged yet.',
            emptyRhythms: 'No Rhythms are linked to Cardio yet.',
            card: '.cardio-progress-card',
            toolZone: 'Activity insights'
          },
          {
            name: 'Weight',
            tablist: 'Weight Foundation sections',
            tabs: ['Progress', 'Weigh-Ins', 'Rhythms'],
            panels: ['weight-panel-progress', 'weight-panel-measurements', 'weight-panel-rhythms'],
            gear: 'Weight tracking settings',
            dialog: 'Weight goals',
            emptyActivity: 'No valid weigh-ins to show.',
            emptyRhythms: 'No Rhythms are linked to Weight yet.',
            card: '.weight-progress-card',
            toolZone: 'Weight insights'
          }
        ] as const;

        let cardioGoalsConfigured = false;
        for (const [foundationIndex, foundation] of cardioWeightFoundations.entries()) {
          if (foundationIndex > 0) {
            await page.getByRole('button', { name: /All Foundations/ }).click();
          }
          await page.getByRole('button', {
            name: `Open ${foundation.name} foundation details`
          }).click();
          const tabs = page.getByRole('tablist', { name: foundation.tablist });
          await tabs.getByRole('tab', { name: foundation.name === 'Cardio' ? 'Insights' : 'Progress', exact: true }).click();
          await verifyToolZoneResponsiveLayout(page, foundation.toolZone);
          const toolZonePlacement = await page.evaluate(({ tablistName, zoneName }) => {
            const tablist = document.querySelector<HTMLElement>(
              `[role="tablist"][aria-label="${tablistName}"]`
            );
            const zone = [...document.querySelectorAll<HTMLElement>('.tool-zone')]
              .find(element => element.querySelector('.tool-zone__purpose')?.textContent?.trim() === zoneName);
            const summary = document.querySelector<HTMLElement>('.foundation-health-card');
            if (!tablist || !zone || !summary) {
              throw new Error('Cardio or Weight progress must keep Health and tabs outside ToolZone.');
            }
            return {
              tabsOutsideZone: !zone.contains(tablist),
              healthOutsideZone: !zone.contains(summary)
            };
          }, { tablistName: foundation.tablist, zoneName: foundation.toolZone });
          assert.deepEqual(toolZonePlacement, {
            tabsOutsideZone: true,
            healthOutsideZone: true
          });

          for (const textSize of ['small', 'medium', 'large'] as const) {
            await page.setViewportSize({ width: 375, height: 844 });
            for (let attempt = 0; attempt < 3; attempt += 1) {
              if (await categorySizeToggle.getAttribute('data-text-size') === textSize) break;
              await categorySizeToggle.click();
            }
            assert.equal(await categorySizeToggle.getAttribute('data-text-size'), textSize);

            for (const viewportWidth of [375, 390, 430]) {
              await page.setViewportSize({ width: viewportWidth, height: 844 });
              for (let tabIndex = 0; tabIndex < foundation.tabs.length; tabIndex += 1) {
                const tabName = foundation.tabs[tabIndex]!;
                const tab = tabs.getByRole('tab', { name: tabName, exact: true });
                await tab.click();
                const panel = page.locator(`#${foundation.panels[tabIndex]}`);
                const panelLayout = await panel.evaluate((element, { tablistName, tabName, foundationName }) => {
                  const panelElement = element as HTMLElement;
                  const tablist = document.querySelector<HTMLElement>(
                    `[role="tablist"][aria-label="${tablistName}"]`
                  );
                  const zone = panelElement.querySelector<HTMLElement>('.tool-zone');
                  const heading = panelElement.querySelector<HTMLElement>('.strength-section-heading');
                  const isProgress = tabName === 'Insights' || tabName === 'Progress';
                  const root = isProgress ? zone : heading;
                  const title = isProgress
                    ? zone?.querySelector<HTMLElement>('.tool-zone__intro')
                    : heading?.querySelector<HTMLElement>('.strength-section-heading__title-row');
                  const actions = isProgress
                    ? foundationName === 'Cardio'
                      ? zone?.querySelector<HTMLElement>('.tool-zone__actions')
                      : zone?.querySelector<HTMLElement>('.tool-zone__actions')
                    : heading?.querySelector<HTMLElement>('.strength-section-heading__actions');
                  const card = panelElement.querySelector<HTMLElement>(
                    '.cardio-progress-card, .weight-progress-card, .cardio-history-card, .weight-history-card'
                  );
                  if (!tablist || !root || !title || !actions) {
                    throw new Error('Cardio or Weight Foundation panel is missing its shared heading or ToolZone.');
                  }
                  const panelRect = panelElement.getBoundingClientRect();
                  const tablistRect = tablist.getBoundingClientRect();
                  const headingRect = root.getBoundingClientRect();
                  const titleRect = title.getBoundingClientRect();
                  const actionsRect = actions.getBoundingClientRect();
                  return {
                    viewportWidth: document.documentElement.clientWidth,
                    documentWidth: document.documentElement.scrollWidth,
                    tabSelected: tablist.querySelector('[aria-selected="true"]')?.textContent?.trim(),
                    panelVisible: !panelElement.hidden,
                    panelRole: panelElement.getAttribute('role'),
                    headingOffset: headingRect.top - tablistRect.bottom,
                    headingRight: headingRect.right,
                    panelRight: panelRect.right,
                    titleActionsOverlap: titleRect.left < actionsRect.right
                      && titleRect.right > actionsRect.left
                      && titleRect.top < actionsRect.bottom
                      && titleRect.bottom > actionsRect.top,
                    cardPadding: card ? getComputedStyle(card).padding : null,
                    actionHeights: [...actions.querySelectorAll<HTMLElement>('button')]
                      .map(button => button.getBoundingClientRect().height)
                  };
                }, {
                  tablistName: foundation.tablist,
                  tabName,
                  foundationName: foundation.name
                });
                assert.equal(panelLayout.viewportWidth, viewportWidth);
                assert.equal(panelLayout.documentWidth, viewportWidth,
                  `${foundation.name} ${tabName} must not overflow at ${viewportWidth}px / ${textSize} text.`);
                assert.equal(panelLayout.tabSelected, tabName);
                assert.equal(panelLayout.panelVisible, true);
                assert.equal(panelLayout.panelRole, 'tabpanel');
                assert.ok(panelLayout.headingOffset >= 16,
                  `${foundation.name} ${tabName} needs consistent space below the tabs.`);
                assert.ok(panelLayout.headingRight <= panelLayout.panelRight + 1);
                assert.equal(panelLayout.titleActionsOverlap, false,
                  `${foundation.name} ${tabName} title and actions must not overlap at ${viewportWidth}px / ${textSize} text.`);
                assert.ok(panelLayout.actionHeights.length > 0);
                assert.ok(panelLayout.actionHeights.every(height => height >= 44),
                  `${foundation.name} ${tabName} actions must retain touch targets.`);
                if ((foundation.name === 'Cardio' && tabName === 'Activities')
                  || (foundation.name === 'Weight' && tabName === 'Weigh-Ins')) {
                  const sectionSpacing = await panel.evaluate((element, isCardio) => {
                    const heading = element.querySelector<HTMLElement>('.strength-section-heading');
                    const historyCard = element.querySelector<HTMLElement>(
                      isCardio
                        ? '.cardio-all-activities-summary'
                        : '.weight-history-card'
                    );
                    if (!heading || !historyCard) {
                      throw new Error('A Foundation panel is missing its shared heading or card.');
                    }
                    return {
                      sharedSpacing: element.classList.contains('strength-workout-section'),
                      rowGap: getComputedStyle(element).rowGap,
                      headingToCard: historyCard.getBoundingClientRect().top - heading.getBoundingClientRect().bottom
                    };
                  }, foundation.name === 'Cardio');
                  assert.equal(sectionSpacing.sharedSpacing, true);
                  assert.equal(sectionSpacing.rowGap, '12px');
                  assert.ok(Math.abs(sectionSpacing.headingToCard - 12) < 0.5,
                    `${foundation.name} ${tabName} content should have the same section gap as Strength Add at ${viewportWidth}px / ${textSize} text.`);
                }
                if (tabName === 'Insights' || tabName === 'Progress') {
                  if (foundation.name === 'Cardio') {
                    assert.ok(Number.parseFloat(panelLayout.cardPadding ?? '0') >= 16,
                      `${foundation.name} chart card must keep comfortable padding.`);
                  }
                  assert.equal(await page.getByRole('button', { name: foundation.gear }).isVisible(), true);
                  if (foundation.name === 'Cardio') {
                    const summaryLayout = await panel.evaluate(element => {
                      const summary = element.querySelector<HTMLElement>('.cardio-weekly-summary');
                      const summaryMetrics = [...(summary?.querySelectorAll<HTMLElement>(
                        '.cardio-activity-summary__metric'
                      ) ?? [])];
                      const measures = element.querySelector<HTMLElement>('.cardio-measures');
                      const measureCards = [...(measures?.querySelectorAll<HTMLElement>(
                        '.cardio-measure'
                      ) ?? [])];
                      const calendar = element.querySelector<HTMLElement>('.cardio-progress-card');
                      const weekHeading = calendar?.querySelector<HTMLElement>('#cardio-progress-title');
                      const weekdays = weekHeading?.nextElementSibling;
                      const gear = element.querySelector<HTMLElement>(
                        '[aria-label="Cardio tracking settings"]'
                      );
                      if (!summary || !calendar || !weekHeading || !(weekdays instanceof HTMLElement) || !gear) {
                        throw new Error('Cardio Progress needs its weekly summary, date heading, and goal settings.');
                      }
                      const summaryStyle = getComputedStyle(summary);
                      const metricRects = summaryMetrics.map(metric => {
                        const rect = metric.getBoundingClientRect();
                        return { top: rect.top, left: rect.left, width: rect.width, right: rect.right };
                      });
                      const metricAlignments = summaryMetrics.map(metric => {
                        const rect = metric.getBoundingClientRect();
                        const icon = metric.querySelector<HTMLElement>('.cardio-activity-summary__icon');
                        const label = metric.querySelector<HTMLElement>('dt');
                        const value = metric.querySelector<HTMLElement>('.cardio-activity-summary__value');
                        const unit = metric.querySelector<HTMLElement>('.cardio-activity-summary__unit');
                        const number = value?.querySelector<HTMLElement>('strong');
                        const definition = metric.querySelector<HTMLElement>('dd');
                        const center = rect.left + rect.width / 2;
                        const centerOf = (element: HTMLElement | null) => element
                          ? element.getBoundingClientRect().left + element.getBoundingClientRect().width / 2
                          : null;
                        return {
                          iconCenter: centerOf(icon),
                          labelCenter: centerOf(label),
                          valueCenter: centerOf(value),
                          cardCenter: center,
                          cardTop: rect.top,
                          cardBottom: rect.bottom,
                          iconTop: icon?.getBoundingClientRect().top ?? null,
                          definitionBottom: definition?.getBoundingClientRect().bottom ?? null,
                          unitText: unit?.textContent?.trim() ?? null,
                          numberText: number?.textContent?.trim() ?? null,
                          unitFontSize: unit ? getComputedStyle(unit).fontSize : null,
                          numberFontSize: number ? getComputedStyle(number).fontSize : null
                        };
                      });
                      return {
                        summaryBottom: summary.getBoundingClientRect().bottom,
                        measuresTop: measures?.getBoundingClientRect().top ?? null,
                        calendarTop: calendar.getBoundingClientRect().top,
                        summaryWidth: summary.clientWidth,
                        summaryScrollWidth: summary.scrollWidth,
                        metricCount: summaryMetrics.length,
                        metricsFit: summaryMetrics.every(metric => metric.scrollWidth <= metric.clientWidth + 1),
                        summaryHasCard: summary.classList.contains('card'),
                        summaryBorderWidth: summaryStyle.borderWidth,
                        metricRects,
                        measureCards: measureCards.map(card => {
                          const rect = card.getBoundingClientRect();
                          const ring = card.querySelector<HTMLElement>('.cardio-measure__ring');
                          const copy = card.querySelector<HTMLElement>('.cardio-measure__copy');
                          const badge = card.querySelector<HTMLElement>('.cardio-measure__badge');
                          const progress = card.querySelector<HTMLElement>('.cardio-measure__progress');
                          const ringRect = ring?.getBoundingClientRect();
                          const copyRect = copy?.getBoundingClientRect();
                          return {
                            label: ring?.getAttribute('aria-label') ?? '',
                            top: rect.top,
                            left: rect.left,
                            right: rect.right,
                            width: rect.width,
                            height: rect.height,
                            ringRight: ringRect?.right ?? null,
                            copyLeft: copyRect?.left ?? null,
                            copyWidth: copyRect?.width ?? null,
                            badgeText: badge?.textContent?.trim() ?? null,
                            progressWidth: progress?.getBoundingClientRect().width ?? null,
                            cardScrollWidth: card.scrollWidth,
                            cardClientWidth: card.clientWidth
                          };
                        }),
                        metricAlignments,
                        rangeHeading: weekHeading.textContent?.trim() ?? '',
                        weekdayHeading: weekdays.textContent?.trim() ?? '',
                        gearInsideCalendar: calendar.contains(gear)
                      };
                    });
                    assert.equal(summaryLayout.metricCount, 3);
                    assert.equal(summaryLayout.summaryHasCard, false,
                      'This week must not retain an outer card.');
                    assert.equal(summaryLayout.summaryBorderWidth, '0px');
                    const shouldStackWeekly =
                      viewportWidth <= 360
                      || textSize === 'large';
                    assert.equal(
                      new Set(summaryLayout.metricRects.map(rect => rect.top)).size,
                      shouldStackWeekly ? summaryLayout.metricCount : 1,
                      `Weekly metric cards should remain three siblings or stack deliberately at ${viewportWidth}px / ${textSize} text.`
                    );
                    if (summaryLayout.metricRects.length > 0) {
                      assert.ok(summaryLayout.metricRects.every(rect => rect.left >= 0 && rect.right <= viewportWidth),
                        'Weekly metric cards must not overflow the viewport.');
                    }
                    assert.ok(summaryLayout.summaryBottom < summaryLayout.calendarTop,
                      'This week should precede the calendar and its settings control.');
                    if (summaryLayout.measuresTop !== null) {
                      assert.ok(summaryLayout.summaryBottom <= summaryLayout.measuresTop,
                        `Weekly goal cards should appear below This week totals at ${viewportWidth}px / ${textSize} text.`);
                      assert.ok(summaryLayout.measuresTop < summaryLayout.calendarTop,
                        `Weekly goal cards should appear above the standalone calendar at ${viewportWidth}px / ${textSize} text.`);
                    }
                    if (cardioGoalsConfigured) {
                      assert.deepEqual(
                        summaryLayout.measureCards.map(card => card.label),
                        ['Weekly distance', 'Number of runs'],
                        `Weekly goal cards should preserve distance-first order at ${viewportWidth}px / ${textSize} text.`
                      );
                      for (const card of summaryLayout.measureCards) {
                        assert.equal(card.badgeText, 'This week');
                        assert.ok(card.left >= 0 && card.right <= viewportWidth,
                          `Weekly goal card ${card.label} must not overflow the viewport.`);
                        assert.ok(card.cardScrollWidth <= card.cardClientWidth + 1,
                          `Weekly goal card ${card.label} must fit at ${viewportWidth}px / ${textSize} text.`);
                        assert.ok(card.progressWidth !== null && card.progressWidth > 0,
                          `Weekly goal card ${card.label} should render a horizontal progress bar.`);
                        if (textSize !== 'large') {
                          assert.ok(card.ringRight !== null && card.copyLeft !== null && card.ringRight < card.copyLeft,
                            `Weekly goal card ${card.label} should keep ring-left, copy-right geometry at ${viewportWidth}px / ${textSize} text.`);
                        }
                      }
                    }
                    assert.ok(summaryLayout.summaryScrollWidth <= summaryLayout.summaryWidth + 1);
                    assert.equal(summaryLayout.metricsFit, true,
                      `Weekly metric cards must fit at ${viewportWidth}px / ${textSize} text.`);
                    for (const alignment of summaryLayout.metricAlignments) {
                      for (const center of [alignment.iconCenter, alignment.labelCenter, alignment.valueCenter]) {
                        assert.ok(center !== null
                          && Math.abs(center - alignment.cardCenter) <= 2,
                          `Weekly metric icon, label, and value must stay centered at ${viewportWidth}px / ${textSize} text.`);
                      }
                      if (alignment.iconTop !== null && alignment.definitionBottom !== null) {
                        const topSpace = alignment.iconTop - alignment.cardTop;
                        const bottomSpace = alignment.cardBottom - alignment.definitionBottom;
                        assert.ok(Math.abs(topSpace - bottomSpace) <= 3,
                          `Weekly metric stack should be vertically balanced at ${viewportWidth}px / ${textSize} text.`);
                      }
                    }
                    const calorieAlignment = summaryLayout.metricAlignments.find(alignment =>
                      alignment.unitText === 'kcal');
                    if (calorieAlignment?.unitFontSize && calorieAlignment.numberFontSize) {
                      const unitSize = Number.parseFloat(calorieAlignment.unitFontSize);
                      const numberSize = Number.parseFloat(calorieAlignment.numberFontSize);
                      assert.ok(unitSize / numberSize >= 0.58 && unitSize / numberSize <= 0.68,
                        `Kcal unit should be roughly 60–65% of the calorie number at ${viewportWidth}px / ${textSize} text.`);
                    }
                    assert.match(summaryLayout.rangeHeading, / – /);
                    assert.equal(summaryLayout.weekdayHeading, 'Monday – Sunday');
                    assert.equal(summaryLayout.gearInsideCalendar, false);

                    const todayHighlight = await panel.evaluate(element => {
                      const day = element.querySelector<HTMLElement>('.cardio-week-day.is-today');
                      const zone = element.querySelector<HTMLElement>('.tool-zone');
                      const purpose = zone?.querySelector<HTMLElement>('.tool-zone__purpose');
                      const weekday = day?.querySelector<HTMLElement>(':scope > span:first-child');
                      const date = day?.querySelector<HTMLElement>(':scope > small');
                      const today = day?.querySelector<HTMLElement>('.cardio-week-day__today');
                      const activity = day?.querySelector<HTMLElement>(
                        '.cardio-week-day__marker, .cardio-week-day__marker-placeholder'
                      );
                      if (!day || !zone || !purpose || !weekday || !date || !today || !activity) {
                        throw new Error('Cardio Activity insights needs a complete current-day highlight.');
                      }
                      const dayRect = day.getBoundingClientRect();
                      const dayCenter = dayRect.left + dayRect.width / 2;
                      const textCenters = [weekday, date, today].map(element => {
                        const rect = element.getBoundingClientRect();
                        return rect.left + rect.width / 2;
                      });
                      const meters = [...zone.querySelectorAll<HTMLElement>('.cardio-measure__ring')];
                      return {
                        dayBackground: getComputedStyle(day).backgroundColor,
                        zoneBackground: getComputedStyle(zone).backgroundColor,
                        dayBorder: getComputedStyle(day).borderTopColor,
                        zoneBorder: getComputedStyle(zone).borderTopColor,
                        weekdayColor: getComputedStyle(weekday).color,
                        dateColor: getComputedStyle(date).color,
                        todayColor: getComputedStyle(today).color,
                        accentColor: getComputedStyle(purpose).color,
                        activityColor: getComputedStyle(activity).color,
                        hasRunMarker: activity.classList.contains('cardio-week-day__marker'),
                        centeringOffsets: textCenters.map(center => center - dayCenter),
                        centered: textCenters.every(center => Math.abs(center - dayCenter) <= 1),
                        meterLabels: meters.map(meter => meter.getAttribute('aria-label')),
                        meterVisuals: meters.map(meter => ({
                          backgroundImage: getComputedStyle(meter).backgroundImage,
                          progress: getComputedStyle(meter).getPropertyValue('--cardio-gauge-progress').trim()
                        }))
                      };
                    });
                    assert.equal(todayHighlight.dayBackground, todayHighlight.zoneBackground);
                    assert.equal(todayHighlight.dayBorder, todayHighlight.zoneBorder);
                    assert.equal(todayHighlight.weekdayColor, todayHighlight.accentColor);
                    assert.equal(todayHighlight.dateColor, todayHighlight.accentColor);
                    assert.equal(todayHighlight.todayColor, todayHighlight.accentColor);
                    if (todayHighlight.hasRunMarker) {
                      assert.equal(todayHighlight.activityColor, todayHighlight.accentColor,
                        'Run markers use the existing Insights blue.');
                    }
                    assert.equal(todayHighlight.centered, true,
                      `The Today day, date, and label should be centered at ${viewportWidth}px / ${textSize} text: ${todayHighlight.centeringOffsets.join(', ')}px.`);
                    if (cardioGoalsConfigured) {
                      assert.deepEqual(todayHighlight.meterLabels, ['Weekly distance', 'Number of runs']);
                      assert.equal(todayHighlight.meterVisuals.length, 2);
                      for (const visual of todayHighlight.meterVisuals) {
                        assert.match(visual.backgroundImage, /conic-gradient/);
                        assert.match(visual.backgroundImage, /rgb\(38, 139, 210\)/);
                        assert.notEqual(visual.progress, '');
                      }
                    }
                  } else {
                    const calculationLink = panel.locator('.weight-calculation-info summary');
                    const baseStyle = await panel.evaluate(element => {
                      const summary = element.querySelector<HTMLElement>('.weight-calculation-info summary');
                      const zone = element.querySelector<HTMLElement>('.tool-zone');
                      const purpose = zone?.querySelector<HTMLElement>('.tool-zone__purpose');
                      const icon = zone?.querySelector<HTMLElement>('.tool-zone__icon');
                      if (!summary || !zone || !purpose || !icon) {
                        throw new Error('Weight insights needs its calculation disclosure and shared ToolZone.');
                      }
                      return {
                        color: getComputedStyle(summary).color,
                        accentColor: getComputedStyle(purpose).color,
                        secondaryColor: getComputedStyle(icon).borderTopColor
                      };
                    });
                    assert.equal(baseStyle.color, baseStyle.accentColor);
                    await calculationLink.hover();
                    assert.equal(await calculationLink.evaluate(summary => getComputedStyle(summary).color),
                      baseStyle.secondaryColor);
                    await calculationLink.evaluate(() => {
                      const summary = document.querySelector<HTMLElement>(
                        '.weight-calculation-info summary'
                      );
                      if (!summary) throw new Error('Weight estimate disclosure is unavailable.');
                      const focusable = [...document.querySelectorAll<HTMLElement>(
                        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
                      )].filter((element): element is HTMLElement => element instanceof HTMLElement
                        && element.getClientRects().length > 0
                        && !element.closest('[hidden]'));
                      const targetIndex = focusable.indexOf(summary);
                      const previous = focusable[targetIndex - 1];
                      if (targetIndex < 1 || !previous) {
                        throw new Error('Weight estimate disclosure needs a preceding keyboard focus target.');
                      }
                      previous.focus();
                    });
                    await page.keyboard.press('Tab');
                    const keyboardFocus = await calculationLink.evaluate(summary => ({
                      active: document.activeElement === summary,
                      visible: summary.matches(':focus-visible'),
                      outlineWidth: getComputedStyle(summary).outlineWidth,
                      outlineStyle: getComputedStyle(summary).outlineStyle,
                      outlineColor: getComputedStyle(summary).outlineColor,
                      expectedColor: getComputedStyle(summary.closest('.tool-zone')!
                        .querySelector('.tool-zone__icon')!).borderTopColor
                    }));
                    assert.equal(keyboardFocus.active, true);
                    assert.equal(keyboardFocus.visible, true);
                    assert.equal(keyboardFocus.outlineWidth, '2px');
                    assert.equal(keyboardFocus.outlineStyle, 'solid');
                    assert.equal(keyboardFocus.outlineColor, keyboardFocus.expectedColor);
                  }
                  if (viewportWidth === 375) {
                    await page.getByRole('button', { name: foundation.gear }).click();
                    const settings = page.getByRole('dialog', { name: foundation.dialog });
                    const settingsLayout = await settings.evaluate(dialog => {
                      const rect = dialog.getBoundingClientRect();
                      const scroll = dialog.querySelector<HTMLElement>('.fitness-goals-scroll');
                      if (!scroll) throw new Error('Foundation tracking settings need a scrollable form body.');
                      return {
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                        viewportWidth: document.documentElement.clientWidth,
                        viewportHeight: document.documentElement.clientHeight,
                        overflowY: getComputedStyle(scroll).overflowY,
                        documentWidth: document.documentElement.scrollWidth
                      };
                    });
                    assert.deepEqual(settingsLayout, {
                      left: 0,
                      top: 0,
                      width: 375,
                      height: 844,
                      viewportWidth: 375,
                      viewportHeight: 844,
                      overflowY: 'auto',
                      documentWidth: 375
                    });
                    assert.equal(await settings.getByRole('button', { name: 'Save goals' }).isVisible(), true);
                    const firstInput = settings.locator('input').first();
                    await firstInput.focus();
                    await page.keyboard.press('Tab');
                    await page.keyboard.press('Shift+Tab');
                    const fieldFocus = await firstInput.evaluate(input => {
                      const region = input.closest<HTMLElement>('.fitness-goals-scroll');
                      if (!region) throw new Error('Foundation settings input needs a scroll region.');
                      const style = getComputedStyle(input);
                      const rect = input.getBoundingClientRect();
                      const regionRect = region.getBoundingClientRect();
                      const clearance = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
                      return {
                        active: document.activeElement === input,
                        visible: input.matches(':focus-visible'),
                        outlineWidth: style.outlineWidth,
                        outlineOffset: style.outlineOffset,
                        leftClearance: rect.left - regionRect.left,
                        rightClearance: regionRect.right - rect.right,
                        requiredClearance: clearance
                      };
                    });
                    assert.equal(fieldFocus.active, true);
                    assert.equal(fieldFocus.visible, true);
                    assert.ok(fieldFocus.leftClearance >= fieldFocus.requiredClearance);
                    assert.ok(fieldFocus.rightClearance >= fieldFocus.requiredClearance);

                    const numericInput = settings.locator('.numeric-control__input').first();
                    await numericInput.focus();
                    const numericFocus = await numericInput.evaluate(input => {
                      const control = input.closest<HTMLElement>('.numeric-control');
                      const region = input.closest<HTMLElement>('.fitness-goals-scroll');
                      if (!control || !region) throw new Error('Foundation numeric input needs its shared control and scroll region.');
                      const style = getComputedStyle(control);
                      const rect = control.getBoundingClientRect();
                      const regionRect = region.getBoundingClientRect();
                      const clearance = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
                      return {
                        active: document.activeElement === input,
                        overflow: style.overflow,
                        outlineWidth: style.outlineWidth,
                        outlineOffset: style.outlineOffset,
                        borderColor: style.borderColor,
                        boxShadow: style.boxShadow,
                        leftClearance: rect.left - regionRect.left,
                        rightClearance: regionRect.right - rect.right,
                        requiredClearance: clearance,
                        outlineStyle: style.outlineStyle
                      };
                    });
                    assert.equal(numericFocus.active, true);
                    assert.equal(numericFocus.overflow, 'visible');
                    assert.equal(numericFocus.outlineStyle, 'none');
                    assert.equal(numericFocus.outlineOffset, '0px');
                    assert.equal(numericFocus.boxShadow, 'none');
                    assert.notEqual(numericFocus.borderColor, 'rgb(220, 228, 221)');
                    assert.ok(numericFocus.leftClearance >= numericFocus.requiredClearance);
                    assert.ok(numericFocus.rightClearance >= numericFocus.requiredClearance);
                    if (foundation.name === 'Cardio' && !cardioGoalsConfigured) {
                      await settings.getByRole('spinbutton', { name: 'Runs per week' }).fill('3');
                      await settings.getByRole('spinbutton', { name: 'Miles per week' }).fill('12');
                      await settings.getByRole('button', { name: 'Save goals' }).click();
                      cardioGoalsConfigured = true;
                    } else {
                      await settings.getByRole('button', { name: 'Cancel' }).click();
                    }
                    await page.waitForFunction(label =>
                      document.activeElement?.getAttribute('aria-label') === label, foundation.gear);
                  }
                } else if (tabName === 'Activities' || tabName === 'Weigh-Ins') {
                  assert.equal(await panel.getByText(foundation.emptyActivity, { exact: true }).isVisible(), true);
                  if (foundation.name === 'Cardio') {
                    const runDivider = await panel.evaluate(element => {
                      const card = element.querySelector<HTMLElement>('.cardio-history-card');
                      if (!card) throw new Error('Cardio Activities needs its activity-history card.');
                      const list = document.createElement('ol');
                      list.className = 'cardio-history-list';
                      const row = document.createElement('li');
                      list.append(row);
                      card.append(list);
                      const borderWidth = getComputedStyle(row).borderTopWidth;
                      list.remove();
                      return borderWidth;
                    });
                    assert.equal(runDivider, '0px',
                      'Activity-history rows should not use an internal top divider.');
                    await panel.getByRole('button', { name: 'Add activity' }).click();
                    const activityDialog = page.getByRole('dialog', { name: 'Log activity' });
                    const activityHeading = activityDialog.getByRole('heading', { name: 'Log activity' });
                    assert.equal(await activityHeading.evaluate(heading => heading === document.activeElement), true);
                    assert.equal(await activityDialog.getByLabel('Activity date')
                      .evaluate(input => input === document.activeElement), false);
                    await verifyCardioActivityDialogLayout(page, viewportWidth);
                    await activityDialog.getByRole('button', { name: 'Cancel' }).click();
                  } else {
                    await panel.getByRole('button', { name: 'Add weigh-in' }).last().click();
                    const weighInDialog = page.getByRole('dialog', { name: 'Add weigh-in' });
                    const weighInHeading = weighInDialog.getByRole('heading', { name: 'Add weigh-in' });
                    assert.equal(await weighInHeading.evaluate(heading => heading === document.activeElement), true);
                    assert.equal(await weighInDialog.getByLabel('Date')
                      .evaluate(input => input === document.activeElement), false);
                    await verifyWeightEntryDialogLayout(page, viewportWidth);
                    await weighInDialog.getByRole('button', { name: 'Cancel' }).click();
                  }
                } else {
                  assert.equal(await panel.getByText(foundation.emptyRhythms, { exact: true }).isVisible(), true);
                }
              }

            }
          }
        }

        const categoryHeaderGeometry = new Map<string, { left: number; top: number; width: number; height: number }>();
        const verifyHeaderPair = async ({
          area,
          openDetail,
          backLabel,
          prepare
        }: {
          area: string;
          openDetail: string;
          backLabel: string;
          prepare?: () => Promise<void>;
        }) => {
          await page.setViewportSize({ width: 1280, height: 900 });
          await areaNavigation.getByRole('button', { name: area, exact: true }).click();
          const categoryHeader = '.category-header--hero:visible';
          for (const textSize of ['small', 'medium', 'large'] as const) {
            await setPreviewTextSize(page, textSize);
            for (const width of [375, 390, 430, 1280] as const) {
              await page.setViewportSize({ width, height: 900 });
              await page.locator(categoryHeader).waitFor({ state: 'visible' });
              await prepare?.();
              const categoryGeometry = await measureHeroHeader(page, categoryHeader);
              const geometryKey = `${width}/${textSize}`;
              const referenceCategory = categoryHeaderGeometry.get(geometryKey);
              if (referenceCategory) {
                for (const key of ['left', 'top', 'width', 'height'] as const) {
                  assert.ok(
                    Math.abs(referenceCategory[key] - categoryGeometry[key]) <= 1,
                    `Category headers must match ${key} across ${area} at ${width}px / ${textSize}.`
                  );
                }
              } else {
                categoryHeaderGeometry.set(geometryKey, {
                  left: categoryGeometry.left,
                  top: categoryGeometry.top,
                  width: categoryGeometry.width,
                  height: categoryGeometry.height
                });
              }
              const openDetailButton = page.getByRole('button', { name: openDetail });
              await openDetailButton.evaluate(button =>
                button.scrollIntoView({ block: 'center', behavior: 'instant' })
              );
              await openDetailButton.click();
              const foundationGeometry = await measureHeroHeader(page, '.foundation-detail-header--hero:visible');
              for (const key of ['left', 'top', 'width', 'height'] as const) {
                assert.ok(
                  Math.abs(categoryGeometry[key] - foundationGeometry[key]) <= 1,
                  `${area} category and detail headers must match ${key} at ${width}px / ${textSize}: `
                    + `${categoryGeometry[key]} vs ${foundationGeometry[key]}.`
                );
              }
              for (const geometry of [categoryGeometry, foundationGeometry]) {
                assert.equal(geometry.documentWidth, width);
                assert.equal(geometry.viewportWidth, width);
                assert.equal(geometry.contentFits, true,
                  `${area} header text and icon must fit at ${width}px / ${textSize}.`);
                assert.equal(geometry.iconBesideCopy, true,
                  `${area} icon must sit beside its header copy at ${width}px / ${textSize}.`);
                const compactHeightLimit = width <= 640
                  ? textSize === 'large' ? 220 : 180
                  : textSize === 'large' ? 150 : 132;
                assert.ok(
                  geometry.height <= compactHeightLimit,
                  `${area} header should stay compact at ${width}px / ${textSize}: `
                    + `${geometry.height}px > ${compactHeightLimit}px.`
                );
              }
              await page.getByRole('button', { name: backLabel, exact: true }).click();
              await page.locator(categoryHeader).waitFor({ state: 'visible' });
            }
          }
        };

        const verifyCategoryOnly = async (area: string) => {
          await page.setViewportSize({ width: 1280, height: 900 });
          await areaNavigation.getByRole('button', { name: area, exact: true }).click();
          for (const textSize of ['small', 'medium', 'large'] as const) {
            await setPreviewTextSize(page, textSize);
            for (const width of [375, 390, 430, 1280] as const) {
              await page.setViewportSize({ width, height: 900 });
              const geometry = await measureHeroHeader(page, '.category-header--hero:visible');
              const reference = categoryHeaderGeometry.get(`${width}/${textSize}`);
              assert.ok(reference, `A Category header reference is needed for ${width}px / ${textSize}.`);
              for (const key of ['left', 'top', 'width', 'height'] as const) {
                assert.ok(
                  Math.abs(reference[key] - geometry[key]) <= 1,
                  `${area} Category header must match ${key} at ${width}px / ${textSize}.`
                );
              }
              assert.equal(geometry.documentWidth, width);
              assert.equal(geometry.contentFits, true);
              assert.equal(geometry.iconBesideCopy, true);
              const compactHeightLimit = width <= 640
                ? textSize === 'large' ? 220 : 180
                : textSize === 'large' ? 150 : 132;
              assert.ok(
                geometry.height <= compactHeightLimit,
                `${area} Category header should stay compact at ${width}px / ${textSize}: `
                  + `${geometry.height}px > ${compactHeightLimit}px.`
              );
            }
          }
        };

        const activeFoundationBack = page.getByRole('button', { name: 'All Foundations', exact: true });
        if (await activeFoundationBack.count()) await activeFoundationBack.click();
        await verifyHeaderPair({
          area: 'Health & Fitness',
          openDetail: 'Open Strength foundation details',
          backLabel: 'All Foundations',
          prepare: async () => {
            await page.getByRole('tab', { name: 'Foundations', exact: true }).click();
          }
        });
        await verifyHeaderPair({
          area: 'Marriage',
          openDetail: 'Open Partnership foundation details',
          backLabel: 'All Foundations',
          prepare: async () => {
            await page.getByRole('tab', { name: 'Foundations', exact: true }).click();
          }
        });
        await verifyHeaderPair({
          area: 'Faith',
          openDetail: 'Open Sabbath practice details',
          backLabel: 'All Practices',
          prepare: async () => {
            await page.getByRole('tab', { name: 'Practices', exact: true }).click();
          }
        });
        await verifyHeaderPair({
          area: 'Finances',
          openDetail: 'Open Saving & Reserves',
          backLabel: 'Back to Finance Foundations',
          prepare: async () => {
            await page.getByRole('tab', { name: 'Foundations', exact: true }).click();
          }
        });
        await verifyCategoryOnly('Friendships');
      }

      if (identity === 'dashboard') {
        await page.setViewportSize({ width: 375, height: 812 });
        const categorySizeToggle = page.locator('.mobile-display-toggle');
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (await categorySizeToggle.getAttribute('data-text-size') === 'small') break;
          await categorySizeToggle.click();
        }
        assert.equal(await categorySizeToggle.getAttribute('data-text-size'), 'small');
        const areaNavigation = page.getByRole('navigation', { name: 'Areas' });
        await page.setViewportSize({ width: 1280, height: 900 });
        await areaNavigation.getByRole('button', { name: 'Marriage', exact: true }).click();
        const categoryHero = page.locator('.marriage-page .category-header--hero:visible').last();
        await categoryHero.waitFor();
        const categoryHome = page.getByRole('button', { name: 'Home', exact: true });
        await categoryHome.waitFor();
        assert.equal(await categoryHome.evaluate(button =>
          button.parentElement?.classList.contains('category-header-stack')
        ), true);
        assert.equal(await categoryHome.evaluate(button =>
          button.nextElementSibling?.classList.contains('category-header--hero')
        ), true);
        const categoryHeroStyle = await categoryHero.evaluate(element => {
          const title = element.querySelector<HTMLElement>('h2');
          const icon = element.querySelector<HTMLElement>('.page-hero-header__icon');
          if (!title || !icon) throw new Error('Category hero is missing its title or icon.');
          const headerStyle = getComputedStyle(element);
          const titleStyle = getComputedStyle(title);
          const subtitleStyle = getComputedStyle(element.querySelector('p')!);
          const iconStyle = getComputedStyle(icon);
          return {
            background: headerStyle.backgroundImage,
            borderRadius: headerStyle.borderRadius,
            padding: headerStyle.padding,
            titleFontSize: titleStyle.fontSize,
            titleFontWeight: titleStyle.fontWeight,
            titleColor: titleStyle.color,
            subtitleColor: subtitleStyle.color,
            subtitleMaxWidth: subtitleStyle.maxWidth,
            iconColor: iconStyle.color,
            iconWidth: iconStyle.width,
            iconHeight: iconStyle.height,
            iconHiddenFromAccessibility: icon.getAttribute('aria-hidden')
          };
        });
        assert.match(categoryHeroStyle.background, /linear-gradient/);
        assert.equal(categoryHeroStyle.borderRadius, '20px');
        assert.equal(categoryHeroStyle.padding, '20px 22px');
        assert.equal(categoryHeroStyle.titleFontSize, '26px');
        assert.equal(categoryHeroStyle.titleFontWeight, '800');
        assert.equal(categoryHeroStyle.titleColor, 'rgb(255, 255, 255)');
        assert.equal(categoryHeroStyle.subtitleColor, 'rgb(216, 230, 222)');
        assert.equal(categoryHeroStyle.subtitleMaxWidth, '100%');
        assert.equal(categoryHeroStyle.iconColor, 'rgb(255, 255, 255)');
        assert.equal(categoryHeroStyle.iconWidth, '44px');
        assert.equal(categoryHeroStyle.iconHeight, '44px');
        assert.equal(categoryHeroStyle.iconHiddenFromAccessibility, 'true');
        await page.setViewportSize({ width: 375, height: 844 });
        for (const textSize of ['small', 'medium', 'large']) {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            if (await categorySizeToggle.getAttribute('data-text-size') === textSize) break;
            await categorySizeToggle.click();
          }
          const homeStyle = await categoryHome.evaluate(button => {
            const style = getComputedStyle(button);
            const scale = Number.parseFloat(
              getComputedStyle(document.documentElement).getPropertyValue('--app-text-scale')
            ) || 1;
            const rect = button.getBoundingClientRect();
            return {
              minHeight: style.minHeight,
              height: rect.height,
              gap: style.gap,
              fontSize: style.fontSize,
              scale,
              documentWidth: document.documentElement.scrollWidth,
              viewportWidth: document.documentElement.clientWidth
            };
          });
          assert.equal(homeStyle.minHeight, '44px');
          assert.ok(homeStyle.height >= 44);
          assert.equal(homeStyle.gap, '10px');
          assert.ok(Math.abs(Number.parseFloat(homeStyle.fontSize) - 14 * homeStyle.scale) < 0.1);
          assert.equal(homeStyle.documentWidth, 375);
          assert.equal(homeStyle.viewportWidth, 375);
        }
        const categoryIconSpacing = await categoryHero.evaluate(element => {
          const title = element.querySelector<HTMLElement>('h2');
          const icon = element.querySelector<HTMLElement>('.page-hero-header__icon');
          if (!title || !icon) throw new Error('Category hero is incomplete.');
          const titleRect = title.getBoundingClientRect();
          const iconRect = icon.getBoundingClientRect();
          return {
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
            titleRight: titleRect.right,
            iconLeft: iconRect.left,
            iconDisplay: getComputedStyle(icon).display
          };
        });
        assert.equal(categoryIconSpacing.documentWidth, 375);
        assert.equal(categoryIconSpacing.viewportWidth, 375);
        assert.ok(categoryIconSpacing.titleRight <= categoryIconSpacing.iconLeft);
        assert.equal(categoryIconSpacing.iconDisplay, 'grid');
        await page.setViewportSize({ width: 1280, height: 900 });
        await categoryHome.click();
        const todayNavigation = page.getByRole('navigation', { name: 'Tools and navigation' })
          .getByRole('button', { name: 'Today' });
        assert.equal(await todayNavigation.getAttribute('aria-current'), 'page');
        await areaNavigation.getByRole('button', { name: 'Marriage', exact: true }).click();
        await categoryHero.waitFor();
        await page.setViewportSize({ width: 359, height: 844 });
        assert.equal(await categoryHero.locator('.page-hero-header__icon').evaluate(
          element => getComputedStyle(element).display
        ), 'grid');
        const narrowCategoryGeometry = await measureHeroHeader(
          page,
          '.marriage-page .category-header--hero:visible'
        );
        assert.equal(narrowCategoryGeometry.contentFits, true);
        assert.equal(narrowCategoryGeometry.iconBesideCopy, true);
        assert.equal(narrowCategoryGeometry.documentWidth, 359);

        await page.setViewportSize({ width: 1280, height: 900 });
        await areaNavigation.getByRole('button', { name: 'Health & Fitness', exact: true }).click();
        await page.getByRole('button', { name: 'Home', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Open Strength foundation details' }).click();
        assert.equal(await page.getByRole('button', { name: 'Home', exact: true }).count(), 0);
        const foundationHero = page.locator('.foundation-detail-header--hero')
          .filter({ hasText: 'Your training, workouts, and muscle balance.' });
        await foundationHero.waitFor();
        const foundationHeroStyle = await foundationHero.evaluate(element => {
          const title = element.querySelector<HTMLElement>('h2');
          const icon = element.querySelector<HTMLElement>('.page-hero-header__icon');
          if (!title || !icon) throw new Error('Foundation hero is missing its title or icon.');
          const subtitle = element.querySelector<HTMLElement>('p');
          if (!subtitle) throw new Error('Foundation hero is missing its description.');
          const circles = [...element.querySelectorAll<HTMLElement>('.foundation-detail-header__circle')];
          return {
            background: getComputedStyle(element).backgroundImage,
            borderColor: getComputedStyle(element).borderTopColor,
            borderRadius: getComputedStyle(element).borderRadius,
            padding: getComputedStyle(element).padding,
            textScale: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-text-scale')) || 1,
            titleFontSize: getComputedStyle(title).fontSize,
            titleFontWeight: getComputedStyle(title).fontWeight,
            titleColor: getComputedStyle(title).color,
            subtitleFontSize: getComputedStyle(subtitle).fontSize,
            subtitleLineHeight: getComputedStyle(subtitle).lineHeight,
            subtitleColor: getComputedStyle(subtitle).color,
            iconBackground: getComputedStyle(icon).backgroundColor,
            iconColor: getComputedStyle(icon).color,
            iconWidth: getComputedStyle(icon).width,
            iconHeight: getComputedStyle(icon).height,
            iconHiddenFromAccessibility: icon.getAttribute('aria-hidden'),
            circlesHiddenFromAccessibility: element.querySelector('.foundation-detail-header__circles')?.getAttribute('aria-hidden'),
            circlesLayer: getComputedStyle(element.querySelector<HTMLElement>('.foundation-detail-header__circles')!).zIndex,
            copyLayer: getComputedStyle(element.querySelector<HTMLElement>('.foundation-detail-header__copy')!).zIndex,
            circles: circles.map(circle => ({
              position: getComputedStyle(circle).position,
              top: getComputedStyle(circle).top,
              right: getComputedStyle(circle).right,
              bottom: getComputedStyle(circle).bottom,
              left: getComputedStyle(circle).left,
              width: getComputedStyle(circle).width,
              height: getComputedStyle(circle).height,
              pointerEvents: getComputedStyle(circle).pointerEvents,
              zIndex: getComputedStyle(circle).zIndex,
              background: getComputedStyle(circle).backgroundColor
            }))
          };
        });
        assert.ok(foundationHeroStyle.background.includes('rgb(220, 232, 222)'));
        assert.ok(foundationHeroStyle.background.includes('rgb(207, 224, 212)'));
        assert.equal(foundationHeroStyle.borderColor, 'rgb(220, 228, 222)');
        assert.equal(foundationHeroStyle.borderRadius, '20px');
        assert.equal(foundationHeroStyle.padding, '20px 22px');
        assert.ok(Math.abs(Number.parseFloat(foundationHeroStyle.titleFontSize) - 26 * foundationHeroStyle.textScale) < 0.1);
        assert.equal(foundationHeroStyle.titleFontWeight, '800');
        assert.equal(foundationHeroStyle.titleColor, 'rgb(36, 107, 82)');
        assert.ok(Math.abs(Number.parseFloat(foundationHeroStyle.subtitleFontSize) - 14 * foundationHeroStyle.textScale) < 0.1);
        assert.ok(Math.abs(Number.parseFloat(foundationHeroStyle.subtitleLineHeight) - 21 * foundationHeroStyle.textScale) < 0.1);
        assert.equal(foundationHeroStyle.subtitleColor, 'rgb(74, 95, 84)');
        assert.equal(foundationHeroStyle.iconBackground, 'rgb(36, 107, 82)');
        assert.equal(foundationHeroStyle.iconColor, 'rgb(255, 255, 255)');
        assert.equal(foundationHeroStyle.iconWidth, '44px');
        assert.equal(foundationHeroStyle.iconHeight, '44px');
        assert.equal(foundationHeroStyle.iconHiddenFromAccessibility, 'true');
        assert.equal(foundationHeroStyle.circlesHiddenFromAccessibility, 'true');
        assert.equal(foundationHeroStyle.circlesLayer, '0');
        assert.equal(foundationHeroStyle.copyLayer, '1');
        const [topRightCircle, bottomRightCircle, bottomLeftCircle] = foundationHeroStyle.circles;
        assert.equal(foundationHeroStyle.circles.length, 3);
        assert.deepEqual(foundationHeroStyle.circles.map(({ position, width, height, pointerEvents, background }) => ({
          position,
          width,
          height,
          pointerEvents,
          background
        })), [
          {
            position: 'absolute',
            width: '150px',
            height: '150px',
            pointerEvents: 'none',
            background: 'rgba(28, 88, 68, 0.08)'
          },
          {
            position: 'absolute',
            width: '110px',
            height: '110px',
            pointerEvents: 'none',
            background: 'rgba(28, 88, 68, 0.08)'
          },
          {
            position: 'absolute',
            width: '90px',
            height: '90px',
            pointerEvents: 'none',
            background: 'rgba(28, 88, 68, 0.08)'
          }
        ]);
        assert.equal(topRightCircle?.top, '-40px');
        assert.equal(topRightCircle?.right, '-40px');
        assert.equal(bottomRightCircle?.right, '20px');
        assert.equal(bottomRightCircle?.bottom, '-55px');
        assert.equal(bottomLeftCircle?.bottom, '-40px');
        assert.equal(bottomLeftCircle?.left, '-30px');
        assert.equal(await page.locator('.health-fitness-page .category-header--hero').count(), 0);
        const foundationBack = page.getByRole('button', { name: 'All Foundations' });
        assert.ok((await foundationBack.getAttribute('class'))?.includes('tend-back-button--plain'));
        const foundationBackStyle = await foundationBack.evaluate(button => {
          const style = getComputedStyle(button);
          const icon = button.querySelector('svg');
          if (!icon) throw new Error('The Foundation back link needs a chevron.');
          const iconStyle = getComputedStyle(icon);
          return {
            borderWidth: style.borderTopWidth,
            background: style.backgroundColor,
            fontSize: style.fontSize,
            textScale: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-text-scale')) || 1,
            gap: style.gap,
            minHeight: style.minHeight,
            marginBottom: style.marginBottom,
            stackGap: button.parentElement ? getComputedStyle(button.parentElement).gap : null,
            iconWidth: iconStyle.width,
            iconHeight: iconStyle.height,
            iconStroke: iconStyle.stroke
          };
        });
        assert.equal(foundationBackStyle.borderWidth, '0px');
        assert.equal(foundationBackStyle.background, 'rgba(0, 0, 0, 0)');
        assert.ok(Math.abs(Number.parseFloat(foundationBackStyle.fontSize) - 14 * foundationBackStyle.textScale) < 0.1);
        assert.equal(foundationBackStyle.gap, '10px');
        assert.equal(foundationBackStyle.minHeight, '44px');
        assert.equal(foundationBackStyle.marginBottom, '0px');
        assert.equal(foundationBackStyle.stackGap, '10px');
        assert.equal(foundationBackStyle.iconWidth, '12px');
        assert.equal(foundationBackStyle.iconHeight, '12px');
        assert.equal(foundationBackStyle.iconStroke, 'rgb(36, 107, 82)');
        await page.setViewportSize({ width: 359, height: 844 });
        assert.equal(await foundationHero.locator('.page-hero-header__icon').evaluate(
          element => getComputedStyle(element).display
        ), 'grid');
        const foundationSizeToggle = page.locator('.mobile-display-toggle');
        for (const textSize of ['small', 'medium', 'large'] as const) {
          await page.setViewportSize({ width: 375, height: 844 });
          for (let attempt = 0; attempt < 3; attempt += 1) {
            if (await foundationSizeToggle.getAttribute('data-text-size') === textSize) break;
            await foundationSizeToggle.click();
          }
          assert.equal(await foundationSizeToggle.getAttribute('data-text-size'), textSize);
          for (const viewportWidth of [320, 375, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 844 });
            const heroLayout = await foundationHero.evaluate(element => {
              const copy = element.querySelector<HTMLElement>('.foundation-detail-header__copy');
              const icon = element.querySelector<HTMLElement>('.page-hero-header__icon');
              if (!copy || !icon) throw new Error('Foundation hero copy and icon are required.');
              const copyStyle = getComputedStyle(copy);
              return {
                copyContentRight: copy.getBoundingClientRect().right - Number.parseFloat(copyStyle.paddingRight),
                iconLeft: icon.getBoundingClientRect().left,
                iconDisplay: getComputedStyle(icon).display,
                copyPaddingRight: copyStyle.paddingRight,
                heroRight: element.getBoundingClientRect().right,
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: document.documentElement.clientWidth
              };
            });
            assert.equal(heroLayout.viewportWidth, viewportWidth);
            if (viewportWidth >= 375) assert.equal(heroLayout.documentWidth, viewportWidth);
            assert.ok(heroLayout.heroRight <= viewportWidth);
            assert.equal(heroLayout.iconDisplay, 'grid');
            assert.equal(heroLayout.copyPaddingRight, '0px');
            assert.ok(heroLayout.copyContentRight < heroLayout.iconLeft,
              `Foundation hero copy must not overlap its icon at ${viewportWidth}px / ${textSize}.`);
            const geometry = await measureHeroHeader(page, '.foundation-detail-header--hero:visible');
            assert.equal(geometry.contentFits, true);
            assert.equal(geometry.iconBesideCopy, true);
            if (viewportWidth >= 375) assert.equal(geometry.documentWidth, viewportWidth);
          }
        }
      }

      if (identity === 'dashboard') {
        await page.setViewportSize({ width: 375, height: 844 });
        await page.getByRole('button', { name: 'More, settings' }).click();
        await page.getByRole('button', { name: /^Settings/ }).click();
        await page.getByRole('button', { name: 'Categories', exact: true }).click();
        const financeSwitch = page.getByRole('switch', { name: 'Finances', exact: true });
        if (!(await financeSwitch.isChecked())) await financeSwitch.click();
        const financePage = page.locator('main.finance-page');
        const financeTabs = financePage.getByRole('tablist', { name: 'Finances' });
        let browserGoalCreated = false;

        for (const [sizeIndex, textSize] of ['small', 'medium', 'large'].entries()) {
          if (sizeIndex > 0) {
            await page.setViewportSize({ width: 375, height: 844 });
            await page.getByRole('button', { name: 'More, settings' }).click();
            await page.getByRole('button', { name: /^Settings/ }).click();
            await page.getByRole('button', { name: 'Categories', exact: true }).click();
          }
          const financeSizeToggle = page.locator('.mobile-display-toggle');
          for (let attempt = 0; attempt < 3; attempt += 1) {
            if (await financeSizeToggle.getAttribute('data-text-size') === textSize) break;
            await financeSizeToggle.click();
          }
          assert.equal(await financeSizeToggle.getAttribute('data-text-size'), textSize);
          await page.setViewportSize({ width: 1280, height: 900 });
          await page.getByRole('navigation', { name: 'Areas' })
            .getByRole('button', { name: 'Finances', exact: true })
            .click();
          await page.getByRole('heading', { name: 'Finances' }).waitFor();
          for (const viewportWidth of [375, 390, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 844 });
            const layout = await financePage.evaluate(element => {
              const tablist = element.querySelector<HTMLElement>('[role="tablist"]');
              const panel = element.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])');
              const content = panel?.firstElementChild as HTMLElement | null;
              const hero = element.querySelector<HTMLElement>('.page-hero-header-stack');
              const healthCard = element.querySelector<HTMLElement>('.category-health-summary');
              if (!tablist || !panel || !content || !hero || !healthCard) {
                throw new Error('Finance must expose a tablist and one visible panel.');
              }
              const heroRect = hero.getBoundingClientRect();
              const healthRect = healthCard.getBoundingClientRect();
              const tabsRect = tablist.getBoundingClientRect();
              const panelRect = panel.getBoundingClientRect();
              const contentRect = content.getBoundingClientRect();
              return {
                viewportWidth: document.documentElement.clientWidth,
                documentWidth: document.documentElement.scrollWidth,
                summaryAndTabs: Math.round(tabsRect.top - element.querySelector('.category-health-summary')!.getBoundingClientRect().bottom),
                tabsToContent: Math.round(contentRect.top - tabsRect.bottom),
                panelVisible: panelRect.width > 0 && panelRect.height > 0,
                heroLeft: heroRect.left,
                heroRight: heroRect.right,
                healthLeft: healthRect.left,
                healthRight: healthRect.right,
                tabsLeft: tabsRect.left,
                tabsRight: tabsRect.right
              };
            });
            assert.equal(layout.viewportWidth, viewportWidth);
            assert.equal(layout.documentWidth, viewportWidth,
              `Finance must not overflow at ${viewportWidth}px / ${textSize}.`);
            assert.ok(Math.abs(layout.summaryAndTabs - 12) <= 1,
              `Finance Health and tabs should use the shared 12px gap at ${viewportWidth}px / ${textSize}.`);
            assert.ok(Math.abs(layout.tabsToContent - 12) <= 1,
              `Finance tabs and content should use the shared 12px gap at ${viewportWidth}px / ${textSize}.`);
            assert.equal(layout.panelVisible, true);
            assert.ok(Math.abs(layout.heroLeft - layout.healthLeft) <= 1
              && Math.abs(layout.heroRight - layout.healthRight) <= 1,
            `Finance content should align with its header card at ${viewportWidth}px / ${textSize}.`);
            assert.ok(Math.abs(layout.tabsLeft - layout.healthLeft) <= 1
              && Math.abs(layout.tabsRight - layout.healthRight) <= 1,
            `Finance tabs should match the Health card width at ${viewportWidth}px / ${textSize}.`);

            for (const tabName of ['Foundations', 'Goals', 'Rhythms'] as const) {
              await financeTabs.getByRole('tab', { name: tabName, exact: true }).click();
              const panel = financePage.getByRole('tabpanel', { name: tabName });
              assert.equal(await panel.isVisible(), true);
              assert.equal(await financePage.getByRole('button', { name: 'Home' }).isVisible(), true);
              assert.equal(await financePage.getByRole('button', { name: 'Back to Today' }).count(), 0);
              if (tabName === 'Foundations') {
                assert.equal(await panel.getByRole('heading', { name: 'Overview', exact: true }).count(), 0);
                assert.equal(await panel.getByRole('heading', { name: 'Foundations', exact: true }).count(), 0);
                assert.equal(await panel.locator('.marriage-foundation-list').count(), 1);
                assert.equal(await panel.locator('.finance-preview-note').count(), 0);
                assert.equal(await panel.locator('.finance-overview__grid').count(), 0);
                assert.equal(await panel.locator('.finance-overview').count(), 0);
                assert.equal(await panel.locator('.marriage-foundation-list > *').count(), 5);
              } else if (tabName === 'Goals') {
                assert.equal(await panel.getByRole('heading', { name: 'Progress tracker' }).isVisible(), true);
                assert.equal(await panel.getByRole('button', { name: '+ Add' }).first().isVisible(), true);
                assert.equal(await panel.getByText(/Balances are manually tracked values, not bank balances or a complete financial picture/).isVisible(), true);
                if (!browserGoalCreated
                  && await panel.getByRole('button', { name: /^View details for / }).count() === 0) {
                  await panel.getByRole('button', { name: '+ Add' }).first().click();
                  const library = page.getByRole('dialog', { name: 'Add a goal' });
                  await library.getByRole('button', { name: 'Create', exact: true }).click();
                  const editor = page.getByRole('dialog', { name: 'Create goal' });
                  await editor.getByLabel('Title').fill('Browser review goal');
                  await editor.getByLabel('Starting balance').fill('1000');
                  await editor.getByLabel('Starting date').fill('2026-10-01');
                  await editor.getByLabel('Target balance').fill('5000');
                  await editor.getByLabel('Target date').fill('2027-06-30');
                  await editor.getByRole('button', { name: 'Add goal' }).click();
                  await panel.getByRole('button', { name: 'View details for Browser review goal' }).waitFor();
                  browserGoalCreated = true;
                }
                const checkInTrigger = panel.getByRole('button', { name: 'Check in' }).first();
                await checkInTrigger.click();
                const checkInDialog = page.getByRole('dialog', { name: 'Record balance check-in' });
                const checkInHeading = checkInDialog.getByRole('heading', { name: 'Record balance check-in' });
                assert.equal(await checkInHeading.evaluate(heading => heading === document.activeElement), true);
                await page.keyboard.press('Tab');
                const closeCheckIn = checkInDialog.getByRole('button', { name: 'Close balance check-in' });
                assert.equal(await closeCheckIn.evaluate(button => button === document.activeElement), true);
                assert.equal(await closeCheckIn.evaluate(button => getComputedStyle(button).outlineStyle), 'solid');
                await verifyFinanceCheckInPalette(page, viewportWidth);
                await checkInDialog.getByRole('button', { name: 'Cancel' }).click();
                assert.equal(await checkInTrigger.evaluate(button => button === document.activeElement), true);

                const detailsTrigger = panel.getByRole('button', { name: /^View details for / }).first();
                const detailsLabel = await detailsTrigger.getAttribute('aria-label');
                assert.ok(detailsLabel);
                const detailTitle = detailsLabel.replace('View details for ', '');
                const pageBodyStyles = await page.evaluate(() => ({
                  overflow: document.body.style.overflow,
                  position: document.body.style.position,
                  top: document.body.style.top
                }));
                await detailsTrigger.click();
                const details = page.getByRole('dialog', { name: detailTitle });
                await verifyFinanceGoalDetailsPalette(page, detailTitle);
                const detailCard = details.getByRole('article', { name: detailTitle });
                if (await detailCard.getByRole('button', { name: 'Correct' }).count() === 0) {
                  await detailCard.getByRole('button', { name: 'Record check-in' }).click();
                  const recordCheckIn = page.getByRole('dialog', { name: 'Record balance check-in' });
                  await recordCheckIn.getByLabel('Effective date').fill('2026-10-18');
                  await recordCheckIn.getByLabel('Current balance').fill('1250');
                  await recordCheckIn.getByRole('button', { name: 'Save check-in' }).click();
                  await detailCard.getByRole('button', { name: 'Correct' }).first().waitFor();
                  await verifyFinanceGoalDetailsPalette(page, detailTitle);
                }
                const detailsGeometry = await details.evaluate(dialog => {
                  const surface = dialog.querySelector<HTMLElement>('.money-goal-dialog__surface');
                  if (!surface) throw new Error('Goal details need a scrollable surface.');
                  surface.scrollTop = surface.scrollHeight;
                  const rect = dialog.getBoundingClientRect();
                  return {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    viewportWidth: document.documentElement.clientWidth,
                    viewportHeight: document.documentElement.clientHeight,
                    overflowY: getComputedStyle(surface).overflowY,
                    scrollable: surface.scrollHeight > surface.clientHeight,
                    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
                  };
                });
                assert.deepEqual(detailsGeometry, {
                  left: 0,
                  top: 0,
                  width: viewportWidth,
                  height: 844,
                  viewportWidth,
                  viewportHeight: 844,
                  overflowY: 'auto',
                  scrollable: true,
                  horizontalOverflow: false
                });
                assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
                assert.equal(await details.getByRole('heading', { name: 'Recorded check-ins' }).isVisible(), true);
                assert.equal(await details.getByRole('button', { name: 'Close goal details' }).isVisible(), true);

                await page.setViewportSize({ width: viewportWidth, height: 400 });
                await details.getByRole('button', { name: 'Correct' }).first().click();
                const correction = page.getByRole('dialog', { name: 'Correct balance check-in' });
                const correctionDate = correction.getByLabel('Effective date');
                const dateField = await correctionDate.evaluate(input => ({
                  type: (input as HTMLInputElement).type,
                  value: (input as HTMLInputElement).value,
                  min: (input as HTMLInputElement).min,
                  max: (input as HTMLInputElement).max,
                  readOnly: (input as HTMLInputElement).readOnly
                }));
                assert.equal(dateField.type, 'date');
                assert.equal(dateField.value, '2026-10-18');
                assert.equal(dateField.min, '2026-10-01');
                assert.ok(dateField.max);
                assert.equal(dateField.readOnly, false);
                await correctionDate.fill('2026-10-19');
                assert.equal(await correctionDate.inputValue(), '2026-10-19');
                const correctionLayout = await correction.evaluate(dialog => {
                  const rect = dialog.getBoundingClientRect();
                  const scrollRegion = dialog.querySelector<HTMLElement>('.money-goal-dialog__scroll-region');
                  if (!scrollRegion) throw new Error('The correction form needs a scrollable body.');
                  const scrollStyle = getComputedStyle(scrollRegion);
                  scrollRegion.scrollTop = scrollRegion.scrollHeight;
                  return {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    viewportWidth: document.documentElement.clientWidth,
                    viewportHeight: document.documentElement.clientHeight,
                    overflowY: scrollStyle.overflowY,
                    scrollable: scrollRegion.scrollHeight > scrollRegion.clientHeight,
                    scrollTop: scrollRegion.scrollTop,
                    documentWidth: document.documentElement.scrollWidth
                  };
                });
                const { scrollTop, ...correctionBounds } = correctionLayout;
                assert.deepEqual(correctionBounds, {
                  left: 0,
                  top: 0,
                  width: viewportWidth,
                  height: 400,
                  viewportWidth,
                  viewportHeight: 400,
                  overflowY: 'auto',
                  scrollable: true,
                  documentWidth: viewportWidth
                });
                assert.ok(scrollTop > 0);
                const cancelCorrection = correction.getByRole('button', { name: 'Cancel' });
                await cancelCorrection.scrollIntoViewIfNeeded();
                assert.equal(await cancelCorrection.isVisible(), true);
                await cancelCorrection.click();
                await page.setViewportSize({ width: viewportWidth, height: 844 });

                await details.getByRole('button', { name: 'Close goal details' }).click();
                await page.waitForFunction(label =>
                  document.activeElement?.getAttribute('aria-label') === label, detailsLabel);
                assert.deepEqual(await page.evaluate(() => ({
                  overflow: document.body.style.overflow,
                  position: document.body.style.position,
                  top: document.body.style.top
                })), pageBodyStyles);
                await verifyFinanceGoalToolPalette(page);
              } else {
                assert.equal(await panel.getByRole('heading', { name: 'Your Rhythms' }).isVisible(), true);
                assert.equal(await panel.getByRole('button', { name: 'Add Rhythm' }).isVisible(), true);
                assert.equal(await panel.getByRole('button', { name: 'Suggestions' }).isDisabled(), false);
              }
            }

            await financeTabs.getByRole('tab', { name: 'Foundations', exact: true }).click();
            await financePage.getByRole('tabpanel', { name: 'Foundations' })
              .getByRole('button', { name: 'Open Saving & Reserves' }).click();
            const foundationDetail = financePage.locator('.finance-foundation-detail');
            await foundationDetail.getByRole('heading', { name: 'Saving & Reserves' }).waitFor();
            assert.equal(await financePage.locator('.category-header--hero').count(), 0);
            const financeBack = foundationDetail.getByRole('button', { name: 'Back to Finance Foundations' });
            assert.ok((await financeBack.getAttribute('class'))?.includes('tend-back-button--plain'));
            assert.equal(await foundationDetail.locator('.category-health-summary').isVisible(), true);
            assert.equal(await foundationDetail.getByRole('heading', { name: /Linked Rhythms/ }).isVisible(), true);
            const foundationLayout = await foundationDetail.evaluate(element => ({
              documentWidth: document.documentElement.scrollWidth,
              viewportWidth: document.documentElement.clientWidth,
              detailWidth: Math.round(element.getBoundingClientRect().width)
            }));
            assert.equal(foundationLayout.viewportWidth, viewportWidth);
            assert.equal(foundationLayout.documentWidth, viewportWidth,
              `Finance Foundation detail must not overflow at ${viewportWidth}px / ${textSize}.`);
            assert.ok(foundationLayout.detailWidth <= viewportWidth);
            await financeBack.click();
            assert.equal(await financePage.locator('.category-header--hero').count(), 1);
          }
        }

        await page.setViewportSize({ width: 375, height: 844 });
        const foundationsTab = financeTabs.getByRole('tab', { name: 'Foundations', exact: true });
        const goalsTab = financeTabs.getByRole('tab', { name: 'Goals', exact: true });
        const rhythmsTab = financeTabs.getByRole('tab', { name: 'Rhythms', exact: true });
        await foundationsTab.focus();
        await page.keyboard.press('ArrowRight');
        assert.equal(await goalsTab.getAttribute('aria-selected'), 'true');
        assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.id), await goalsTab.getAttribute('id'));
        await page.keyboard.press('End');
        assert.equal(await rhythmsTab.getAttribute('aria-selected'), 'true');
        await page.keyboard.press('ArrowRight');
        assert.equal(await foundationsTab.getAttribute('aria-selected'), 'true');
        await page.keyboard.press('Home');
        assert.equal(await foundationsTab.getAttribute('aria-selected'), 'true');

        await goalsTab.click();
        const addGoal = page.getByRole('button', { name: '+ Add', exact: true }).first();
        const originalBodyStyles = await page.evaluate(() => ({
          overflow: document.body.style.overflow,
          position: document.body.style.position,
          top: document.body.style.top
        }));
        await addGoal.click();
        const library = page.getByRole('dialog', { name: 'Add a goal' });
        const libraryGeometry = await library.evaluate(dialog => {
          const rect = dialog.getBoundingClientRect();
          const surface = dialog.querySelector<HTMLElement>('.money-goal-dialog__surface');
          if (!surface) throw new Error('The Finance library needs a scrollable surface.');
          return {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            overflowY: getComputedStyle(surface).overflowY,
            className: dialog.className,
            position: getComputedStyle(dialog).position,
            classicCss: [...document.styleSheets].some(sheet => sheet.href?.endsWith('/tend.css'))
          };
        });
        assert.deepEqual(libraryGeometry, {
          left: 0,
          top: 0,
          width: 375,
          height: 844,
          overflowY: 'auto',
          className: 'money-goal-dialog finance-goal-fullscreen-dialog dialog--phone-fullscreen',
          position: 'fixed',
          classicCss: false
        });
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
        await library.getByRole('button', { name: 'Create', exact: true }).click();
        const editor = page.getByRole('dialog', { name: 'Create goal' });
        const editorGeometry = await editor.evaluate(async dialog => {
          const surface = dialog.querySelector<HTMLElement>('.money-goal-dialog__surface');
          const actions = dialog.querySelector<HTMLElement>('.money-goal-dialog__actions');
          if (!surface || !actions) throw new Error('The Finance goal editor needs a scrollable body and actions.');
          surface.scrollTop = surface.scrollHeight;
          await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
          const surfaceRect = surface.getBoundingClientRect();
          const actionsRect = actions.getBoundingClientRect();
          return {
            width: dialog.getBoundingClientRect().width,
            height: dialog.getBoundingClientRect().height,
            overflowY: getComputedStyle(surface).overflowY,
            actionTop: actionsRect.top,
            actionBottom: actionsRect.bottom,
            surfaceTop: surfaceRect.top,
            surfaceBottom: surfaceRect.bottom,
            horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
          };
        });
        assert.equal(editorGeometry.width, 375);
        assert.equal(editorGeometry.height, 844);
        assert.equal(editorGeometry.overflowY, 'auto');
        assert.ok(editorGeometry.actionTop >= editorGeometry.surfaceTop - 1);
        assert.ok(editorGeometry.actionBottom <= editorGeometry.surfaceBottom + 1);
        assert.equal(editorGeometry.horizontalOverflow, false);
        assert.equal(await editor.getByRole('button', { name: 'Add goal' }).isVisible(), true);
        assert.equal(await editor.getByRole('button', { name: 'Cancel' }).isVisible(), true);
        await editor.getByRole('button', { name: 'Cancel' }).click();
        await page.waitForFunction(() => document.activeElement?.textContent?.trim() === '+ Add');
        assert.deepEqual(await page.evaluate(() => ({
          overflow: document.body.style.overflow,
          position: document.body.style.position,
          top: document.body.style.top
        })), originalBodyStyles);
      }

      if (identity === 'dashboard') {
        const searchFixture = createEmptyPreviewData();
        const searchPersonId = 'browser-search-person-avery';
        searchFixture.people = [{ id: searchPersonId, displayName: 'Avery Synthetic Person' }];
        searchFixture.savedRhythms = Array.from({ length: 12 }, (_, index) => ({
          id: `user-rhythm-00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          title: `Avery synthetic rhythm ${index + 1} with a deliberately long title for wrapping`,
          description: 'Synthetic secondary metadata for the production Search layout check.',
          cadence: 'Daily',
          timeLabel: 'Anytime',
          automation: 'manual' as const,
          status: 'Not confirmed' as const,
          personIds: [searchPersonId],
          categoryIds: ['faith'] as const
        }));
        const searchAccountId = 'c0000000-0000-4000-8000-000000000003';
        const searchStorageKey = `${PREVIEW_ACCOUNT_STORAGE_PREFIX}:${searchAccountId}`;
        await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), {
          key: searchStorageKey,
          value: JSON.stringify(createPreviewEnvelope(searchFixture))
        });
        await page.reload();
        await page.locator('.mobile-head-button[aria-label="Open search"]').waitFor();

        const searchToggle = page.locator('.mobile-head-button[aria-label="Open search"]');
        for (const textSize of ['small', 'medium', 'large'] as const) {
          await page.evaluate(size => {
            document.documentElement.dataset.mobileTextSize = size === 'small'
              ? 'normal'
              : size === 'medium' ? 'large' : 'larger';
            document.documentElement.dataset.mobileTextSizeLevel = size === 'large' ? 'larger' : size;
          }, textSize);
          for (const viewportWidth of [375, 390, 430]) {
            await page.setViewportSize({ width: viewportWidth, height: 844 });
            await searchToggle.click();
            const dialog = page.getByRole('dialog', { name: 'Search Tend' });
            const input = dialog.getByRole('combobox', { name: 'Search Tend' });
            const close = dialog.getByRole('button', { name: 'Close search' });
            await input.fill('Avery');
            if (await dialog.getByRole('option').count() === 0) {
              const debugState = await page.evaluate(key => ({
                bodyText: document.body.innerText.slice(0, 1200),
                storedFixture: window.localStorage.getItem(key) !== null,
                resultText: document.querySelector('.utility-search-results')?.textContent ?? null
              }), searchStorageKey);
              throw new Error(`Synthetic Search fixture was not loaded: ${JSON.stringify(debugState)}`);
            }
            await dialog.getByRole('option').first().waitFor();

            const populatedLayout = await dialog.evaluate(element => {
              const toolbar = element.querySelector<HTMLElement>('.utility-search-toolbar');
              const field = element.querySelector<HTMLElement>('.utility-search-field');
              const closeButton = element.querySelector<HTMLElement>('.utility-search-close');
              const results = element.querySelector<HTMLElement>('.utility-search-results');
              const input = field?.querySelector<HTMLInputElement>('input');
              const liveStatus = element.querySelector<HTMLElement>('.sr-only');
              if (!toolbar || !field || !closeButton || !results || !input || !liveStatus) {
                throw new Error('Search must render its toolbar and results region.');
              }
              const bounds = (node: HTMLElement) => {
                const rect = node.getBoundingClientRect();
                return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
              };
              return {
                viewportWidth: document.documentElement.clientWidth,
                viewportHeight: document.documentElement.clientHeight,
                documentWidth: document.documentElement.scrollWidth,
                position: getComputedStyle(element).position,
                background: getComputedStyle(element).backgroundColor,
                bodyOverflow: getComputedStyle(document.body).overflow,
                fieldFontSize: getComputedStyle(input).fontSize,
                searchAppearance: getComputedStyle(input).getPropertyValue('appearance'),
                customClearCount: field.querySelectorAll('.utility-search-clear').length,
                liveStatusPosition: getComputedStyle(liveStatus).position,
                liveStatusWidth: getComputedStyle(liveStatus).width,
                liveStatusHeight: getComputedStyle(liveStatus).height,
                liveStatusOverflow: getComputedStyle(liveStatus).overflow,
                resultOverflow: getComputedStyle(results).overflowY,
                resultBackground: getComputedStyle(results).backgroundColor,
                toolbar: bounds(toolbar),
                field: bounds(field),
                close: bounds(closeButton),
                results: bounds(results),
                classicCssLoaded: [...document.styleSheets].some(sheet => sheet.href?.endsWith('/tend.css'))
              };
            });
            assert.equal(populatedLayout.viewportWidth, viewportWidth);
            assert.equal(populatedLayout.documentWidth, viewportWidth,
              `Search must not cause horizontal overflow at ${viewportWidth}px / ${textSize}.`);
            assert.equal(populatedLayout.position, 'fixed');
            assert.equal(populatedLayout.background, 'rgb(247, 249, 247)',
              `Search must be an opaque surface at ${viewportWidth}px / ${textSize}.`);
            assert.equal(populatedLayout.bodyOverflow, 'hidden');
            assert.equal(populatedLayout.resultOverflow, 'auto');
            assert.equal(populatedLayout.resultBackground, 'rgb(255, 255, 255)');
            assert.equal(populatedLayout.searchAppearance, 'none');
            assert.equal(populatedLayout.customClearCount, 1);
            assert.equal(populatedLayout.liveStatusPosition, 'absolute');
            assert.equal(populatedLayout.liveStatusWidth, '1px');
            assert.equal(populatedLayout.liveStatusHeight, '1px');
            assert.equal(populatedLayout.liveStatusOverflow, 'hidden');
            assert.equal(populatedLayout.close.height >= 44, true);
            assert.ok(populatedLayout.close.left >= populatedLayout.field.right);
            assert.ok(populatedLayout.close.right <= viewportWidth);
            assert.ok(populatedLayout.results.top >= populatedLayout.toolbar.bottom);
            assert.ok(populatedLayout.results.bottom <= populatedLayout.viewportHeight);
            assert.equal(populatedLayout.classicCssLoaded, false);

            await input.fill('no-synthetic-search-match-9d321');
            await dialog.locator('.search-empty').waitFor();
            await input.fill('Avery');
            await dialog.getByRole('option').first().waitFor();
            await dialog.evaluate(element => {
              const results = element.querySelector<HTMLElement>('.utility-search-results');
              const group = results?.querySelector<HTMLElement>('.search-result-group');
              const first = group?.querySelector<HTMLButtonElement>('.search-result');
              if (!results || !group || !first) throw new Error('Search needs a synthetic result row.');
              for (let index = 0; index < 12; index += 1) {
                const row = first.cloneNode(true) as HTMLButtonElement;
                row.id = `synthetic-search-result-${index}`;
                const title = row.querySelector('strong');
                const metadata = row.querySelector('small');
                if (!title || !metadata) throw new Error('Synthetic search rows need title and metadata.');
                title.textContent = `Synthetic result ${index + 1}: a deliberately long result title that should wrap without overlapping its metadata or category label.`;
                metadata.textContent = 'Synthetic secondary metadata that remains distinct from the title and does not run into the category label.';
                group.append(row);
              }
            });
            const longResultsLayout = await dialog.locator('.utility-search-results').evaluate(results => {
              const rows = [...results.querySelectorAll<HTMLElement>('.search-result')];
              const last = rows[rows.length - 1];
              if (!last) throw new Error('Long search results must include rows.');
              results.scrollTop = results.scrollHeight;
              const bounds = last.getBoundingClientRect();
              const resultsBounds = results.getBoundingClientRect();
              return {
                scrollable: results.scrollHeight > results.clientHeight,
                lastRowVisible: bounds.bottom <= resultsBounds.bottom + 1,
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: document.documentElement.clientWidth
              };
            });
            assert.equal(longResultsLayout.scrollable, true,
              `Long Search results must scroll within the panel at ${viewportWidth}px / ${textSize}.`);
            assert.equal(longResultsLayout.lastRowVisible, true);
            assert.equal(longResultsLayout.documentWidth, longResultsLayout.viewportWidth);

            await close.click();
            await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Open search');
            assert.equal(await page.evaluate(() => document.body.classList.contains('mobile-search-open')), false);
          }
        }

        for (const textSize of ['small', 'medium', 'large'] as const) {
          await page.evaluate(size => {
            document.documentElement.dataset.mobileTextSize = size === 'small'
              ? 'normal'
              : size === 'medium' ? 'large' : 'larger';
            document.documentElement.dataset.mobileTextSizeLevel = size === 'large' ? 'larger' : size;
          }, textSize);
          await page.setViewportSize({ width: 375, height: 390 });
          await searchToggle.click();
          const dialog = page.getByRole('dialog', { name: 'Search Tend' });
          const input = dialog.getByRole('combobox', { name: 'Search Tend' });
          const close = dialog.getByRole('button', { name: 'Close search' });
          await input.focus();
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('aria-label')),
            'Close search', `Close must remain in the tab order in a keyboard-height viewport at ${textSize} text.`);
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.id), 'tendSearch');
          await input.fill('Avery');
          await dialog.getByRole('option').first().waitFor();
          await dialog.evaluate(element => {
            const results = element.querySelector<HTMLElement>('.utility-search-results');
            const group = results?.querySelector<HTMLElement>('.search-result-group');
            const first = group?.querySelector<HTMLButtonElement>('.search-result');
            if (!results || !group || !first) throw new Error('Search needs a synthetic result row.');
            for (let index = 0; index < 12; index += 1) {
              const row = first.cloneNode(true) as HTMLButtonElement;
              row.id = `keyboard-search-result-${index}`;
              const title = row.querySelector('strong');
              if (!title) throw new Error('Synthetic search rows need a title.');
              title.textContent = `Keyboard viewport result ${index + 1} with enough content to wrap onto multiple lines.`;
              group.append(row);
            }
          });

          const keyboardLayout = await dialog.evaluate(element => {
            const toolbar = element.querySelector<HTMLElement>('.utility-search-toolbar');
            const results = element.querySelector<HTMLElement>('.utility-search-results');
            const closeButton = element.querySelector<HTMLElement>('.utility-search-close');
            if (!toolbar || !results || !closeButton) throw new Error('Search controls must remain available.');
            const toolbarBounds = toolbar.getBoundingClientRect();
            const resultsBounds = results.getBoundingClientRect();
            const closeBounds = closeButton.getBoundingClientRect();
            return {
              viewportHeight: document.documentElement.clientHeight,
              dialogHeight: element.getBoundingClientRect().height,
              resultsHeight: results.clientHeight,
              resultsScrollable: results.scrollHeight > results.clientHeight,
              resultsTop: resultsBounds.top,
              resultsBottom: resultsBounds.bottom,
              toolbarBottom: toolbarBounds.bottom,
              closeBottom: closeBounds.bottom,
              bodyOverflow: getComputedStyle(document.body).overflow
            };
          });
          assert.equal(keyboardLayout.dialogHeight, 390);
          assert.ok(keyboardLayout.resultsHeight > 0);
          assert.ok(keyboardLayout.resultsTop >= keyboardLayout.toolbarBottom);
          assert.ok(keyboardLayout.resultsBottom <= keyboardLayout.viewportHeight);
          assert.ok(keyboardLayout.closeBottom <= keyboardLayout.viewportHeight);
          assert.equal(keyboardLayout.resultsScrollable, true,
            `Results must remain independently scrollable at keyboard height / ${textSize} text.`);
          assert.equal(keyboardLayout.bodyOverflow, 'hidden');
          await close.click();
          await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Open search');
        }
      }

      const profileContext = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        hasTouch: true
      });
      const profilePage = await profileContext.newPage();
      const profileClassicCssRequests: string[] = [];
      await profilePage.route('**/*', route => {
        const origin = new URL(route.request().url()).origin;
        if (origin === baseUrl || origin === catalogUrl) return route.continue();
        return route.abort();
      });
      await profilePage.route('**/tend.css', async route => {
        profileClassicCssRequests.push(route.request().url());
        await route.abort();
      });
      await profilePage.goto(`${catalogUrl}/preview.html`);
      await profilePage.getByRole('heading', { name: 'One shared language. Room for what’s different.' }).waitFor();
      await profilePage.setViewportSize({ width: 1280, height: 900 });
      await profilePage.getByRole('button', { name: 'Open synthetic profile for Avery Brooks' }).click();
      const personProfile = profilePage.getByRole('main', { name: 'Avery Brooks' });
      const overallHealth = personProfile.getByRole('region', { name: 'Overall Health summary' });
      assert.equal(await overallHealth.getByRole('button', {
        name: 'Show Overall Health component scores breakdown'
      }).count(), 1);
      const areaDisclosure = overallHealth.locator('.health-score-breakdown__measure-toggle');
      assert.equal(await areaDisclosure.getAttribute('aria-label'), 'Show Overall Health component scores breakdown');
      assert.equal(await areaDisclosure.getAttribute('aria-expanded'), 'false');
      for (const textSize of ['small', 'medium', 'large'] as const) {
        await profilePage.evaluate(size => {
          document.documentElement.dataset.mobileTextSize = size === 'small'
            ? 'normal'
            : size === 'medium' ? 'large' : 'larger';
          document.documentElement.dataset.mobileTextSizeLevel = size === 'large' ? 'larger' : size;
        }, textSize);
        for (const width of [320, 375, 390, 430]) {
          await profilePage.setViewportSize({ width, height: 844 });
          const collapsed = await overallHealth.evaluate(card => {
            const header = card.querySelector<HTMLElement>('.health-score-breakdown__header');
            const title = header?.querySelector<HTMLElement>('.health-score-breakdown__title');
            const score = header?.querySelector<HTMLElement>(':scope > span');
            const toggle = header?.querySelector<HTMLElement>('.health-score-breakdown__measure-toggle');
            const panel = card.querySelector<HTMLElement>('.person-health-component-disclosure');
            if (!header || !title || !score || !toggle || !panel) {
              throw new Error('Overall Health needs its title, score, disclosure, and collapsed panel.');
            }
            const titleBounds = title.getBoundingClientRect();
            const scoreBounds = score.getBoundingClientRect();
            const cardBounds = card.getBoundingClientRect();
            return {
              documentWidth: document.documentElement.scrollWidth,
              viewportWidth: document.documentElement.clientWidth,
              cardHeight: cardBounds.height,
              titleWidth: title.clientWidth,
              titleScrollWidth: title.scrollWidth,
              titleRight: titleBounds.right,
              scoreLeft: scoreBounds.left,
              toggleVisible: toggle.getBoundingClientRect().width > 0,
              panelHidden: panel.hidden,
              titleText: title.querySelector('h3')?.textContent?.trim()
                ?? title.textContent?.trim()
                ?? '',
              chevronBesideTitle: (() => {
                const heading = title.querySelector<HTMLElement>('h3');
                const chevron = title.querySelector<HTMLElement>('.health-score-breakdown__measure-toggle');
                if (!heading || !chevron) return false;
                const headingBounds = heading.getBoundingClientRect();
                const chevronBounds = chevron.getBoundingClientRect();
                return chevronBounds.left >= headingBounds.left
                  && chevronBounds.right <= headingBounds.right + 1
                  && chevronBounds.top < headingBounds.bottom
                  && chevronBounds.bottom > headingBounds.top;
              })()
            };
          });
          assert.equal(collapsed.documentWidth, width,
            `Person Overall Health must not overflow at ${width}px / ${textSize} text.`);
          assert.equal(collapsed.viewportWidth, width);
          assert.ok(collapsed.titleWidth > 0);
          assert.ok(collapsed.titleScrollWidth <= collapsed.titleWidth,
            `Overall Health heading must wrap without overflow at ${width}px / ${textSize} text.`);
          assert.equal(collapsed.titleText, 'Health');
          assert.equal(collapsed.chevronBesideTitle, true,
            `Health heading and chevron must stay together at ${width}px / ${textSize} text.`);
          assert.ok(collapsed.titleRight <= collapsed.scoreLeft + 1,
            `Overall Health heading and score must not overlap at ${width}px / ${textSize} text.`);
          assert.equal(collapsed.toggleVisible, true);
          assert.equal(collapsed.panelHidden, true,
            `Overall Health component scores must start collapsed at ${width}px / ${textSize} text.`);

          await areaDisclosure.click();
          assert.equal(await areaDisclosure.getAttribute('aria-expanded'), 'true');
          assert.equal(await areaDisclosure.getAttribute('aria-label'), 'Hide Overall Health component scores breakdown');
          const expanded = await overallHealth.evaluate(card => {
            const panel = card.querySelector<HTMLElement>('.person-health-component-disclosure');
            const group = panel?.querySelector<HTMLElement>('[aria-label="Health by area"]');
            const items = Array.from(panel?.querySelectorAll<HTMLElement>('.person-health-component-score') ?? []);
            if (!panel || !group || items.length !== 3) {
              throw new Error('Expanded Overall Health must show all three area score columns.');
            }
            const cardBounds = card.getBoundingClientRect();
            const groupBounds = group.getBoundingClientRect();
            const itemLayouts = items.map(item => {
              const badge = item.querySelector<HTMLElement>('.person-health-component-score__badge');
              const label = item.querySelector<HTMLElement>('.person-health-component-score__label');
              if (!badge || !label) throw new Error('An expanded Person Health item is missing its label or score.');
              const badgeBounds = badge.getBoundingClientRect();
              const labelBounds = label.getBoundingClientRect();
              const itemBounds = item.getBoundingClientRect();
              const labelStyle = getComputedStyle(label);
              const labelText = label.textContent?.trim() ?? '';
              const textRange = document.createRange();
              textRange.selectNodeContents(label);
              const textLineTops = new Set(
                [...textRange.getClientRects()].map(rect => Math.round(rect.top))
              );
              const stacked = getComputedStyle(group).gridTemplateColumns
                .trim()
                .split(/\s+/)
                .length === 1;
              const labelFits = label.clientWidth > 0
                && label.scrollWidth <= label.clientWidth + 1
                && labelStyle.whiteSpace === 'nowrap'
                && labelStyle.wordBreak === 'normal'
                && labelStyle.overflowWrap === 'normal'
                && textLineTops.size === 1
                && labelText.length > 0;
              return {
                text: labelText,
                stacked,
                labelWidth: label.clientWidth,
                labelScrollWidth: label.scrollWidth,
                whiteSpace: labelStyle.whiteSpace,
                wordBreak: labelStyle.wordBreak,
                overflowWrap: labelStyle.overflowWrap,
                textLineCount: textLineTops.size,
                fits: labelFits && (stacked
                  ? labelBounds.left >= itemBounds.left
                  && badgeBounds.right <= itemBounds.right + 1
                  && labelBounds.right < badgeBounds.left
                  && Math.abs(labelBounds.top + labelBounds.height / 2
                    - (badgeBounds.top + badgeBounds.height / 2)) <= 1
                  : labelBounds.top >= badgeBounds.bottom && labelBounds.bottom <= itemBounds.bottom + 1)
              };
            });
            const labelsFit = itemLayouts.every(item => item.fits);
            return {
              hidden: panel.hidden,
              cardHeight: cardBounds.height,
              groupFits: groupBounds.left >= cardBounds.left && groupBounds.right <= cardBounds.right,
              labelsFit,
              itemLayouts,
              connectionsText: items.find(item =>
                item.querySelector('.person-health-component-score__label')?.textContent?.trim() === 'Connections'
              )?.querySelector('.person-health-component-score__label')?.textContent?.trim(),
              documentWidth: document.documentElement.scrollWidth
            };
          });
          assert.equal(expanded.hidden, false);
          assert.ok(expanded.cardHeight > collapsed.cardHeight,
            `Expanding Overall Health must reveal its breakdown at ${width}px / ${textSize} text.`);
          assert.equal(expanded.groupFits, true);
          assert.equal(expanded.labelsFit, true,
            `Every Person Health label must fit without breaking at ${width}px / ${textSize}: ${JSON.stringify(expanded.itemLayouts)}`);
          assert.equal(expanded.connectionsText, 'Connections');
          assert.equal(expanded.documentWidth, width);

          await areaDisclosure.click();
          assert.equal(await areaDisclosure.getAttribute('aria-expanded'), 'false');
          assert.equal(await areaDisclosure.getAttribute('aria-label'), 'Show Overall Health component scores breakdown');
          const recollapsed = await overallHealth.evaluate(card => ({
            hidden: card.querySelector<HTMLElement>('.person-health-component-disclosure')?.hidden,
            cardHeight: card.getBoundingClientRect().height
          }));
          assert.equal(recollapsed.hidden, true);
          assert.ok(Math.abs(recollapsed.cardHeight - collapsed.cardHeight) <= 1,
            `Collapsed Overall Health should leave no reserved panel space at ${width}px / ${textSize} text.`);
        }
      }
      const personRhythmsPanel = personProfile.getByRole('tabpanel', { name: 'Rhythms' });
      assert.equal(await personProfile.getByRole('button', { name: /Show tended|Hide tended/ }).count(), 0);
      await personRhythmsPanel.evaluate(panel => {
        const item = document.createElement('div');
        item.className = 'tended-rhythm-done-row__item';
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'tended-rhythm-done-row';
        row.setAttribute('aria-expanded', 'false');
        row.setAttribute('aria-label', 'Synthetic long-titled Rhythm, Tended 10:15 am');
        const check = document.createElement('span');
        check.className = 'tended-rhythm-done-row__check';
        check.setAttribute('aria-hidden', 'true');
        check.textContent = '✓';
        const title = document.createElement('span');
        title.className = 'tended-rhythm-done-row__title';
        title.textContent = 'Avery and Morgan plan a thoughtful afternoon together beyond the usual routine with a deliberately long synthetic title for responsive wrapping';
        const time = document.createElement('time');
        time.className = 'tended-rhythm-done-row__time';
        time.dateTime = '2026-10-29T10:15:00';
        time.textContent = 'Tended 10:15 am';
        row.append(check, title, time);
        item.append(row);
        panel.append(item);
      });
      const syntheticTendedRow = personRhythmsPanel.locator('.tended-rhythm-done-row').last();
      for (const textSize of ['small', 'medium', 'large'] as const) {
        await profilePage.evaluate(size => {
          document.documentElement.dataset.mobileTextSize = size === 'small'
            ? 'normal'
            : size === 'medium' ? 'large' : 'larger';
          document.documentElement.dataset.mobileTextSizeLevel = size === 'large' ? 'larger' : size;
        }, textSize);
        for (const width of [375, 390, 430]) {
          await profilePage.setViewportSize({ width, height: 844 });
          const rowLayout = await syntheticTendedRow.evaluate(row => {
            const title = row.querySelector<HTMLElement>('.tended-rhythm-done-row__title');
            const time = row.querySelector<HTMLElement>('.tended-rhythm-done-row__time');
            const check = row.querySelector<HTMLElement>('.tended-rhythm-done-row__check');
            if (!title || !time || !check) throw new Error('Compact tended rows need their title, time, and check.');
            const rowBounds = row.getBoundingClientRect();
            const titleBounds = title.getBoundingClientRect();
            const timeBounds = time.getBoundingClientRect();
            const checkBounds = check.getBoundingClientRect();
            return {
              documentWidth: document.documentElement.scrollWidth,
              viewportWidth: document.documentElement.clientWidth,
              rowWidth: row.clientWidth,
              rowScrollWidth: row.scrollWidth,
              rowHeight: rowBounds.height,
              titleWidth: title.clientWidth,
              titleScrollWidth: title.scrollWidth,
              titleHeight: titleBounds.height,
              titleLineHeight: Number.parseFloat(getComputedStyle(title).lineHeight),
              titleRight: titleBounds.right,
              titleWhiteSpace: getComputedStyle(title).whiteSpace,
              timeLeft: timeBounds.left,
              timeRight: timeBounds.right,
              checkBottom: checkBounds.bottom,
              rowBottom: rowBounds.bottom
            };
          });
          assert.equal(rowLayout.documentWidth, width,
            `Person compact Rhythm rows must not create page overflow at ${width}px / ${textSize} text.`);
          assert.equal(rowLayout.viewportWidth, width);
          assert.ok(rowLayout.rowWidth > 0 && rowLayout.rowScrollWidth <= rowLayout.rowWidth + 1);
          assert.ok(rowLayout.titleWidth > 0 && rowLayout.titleScrollWidth <= rowLayout.titleWidth + 1,
            `Long compact-row titles must wrap without clipping at ${width}px / ${textSize} text.`);
          assert.ok(rowLayout.titleHeight > rowLayout.titleLineHeight,
            `Long compact-row titles should wrap onto multiple lines at ${width}px / ${textSize} text.`);
          assert.equal(rowLayout.titleWhiteSpace, 'normal');
          assert.ok(rowLayout.titleRight <= rowLayout.timeLeft,
            `Compact-row title and completion time must not overlap at ${width}px / ${textSize} text.`);
          assert.ok(rowLayout.timeRight <= width);
          assert.ok(rowLayout.checkBottom <= rowLayout.rowBottom);
        }
      }
      await personProfile.getByRole('tab', { name: 'Connections' }).click();
      await profilePage.setViewportSize({ width: 375, height: 844 });
      await personProfile.getByRole('button', { name: '+ Add', exact: true }).click();
      const createConnectionDialog = profilePage.getByRole('dialog', { name: 'Log connection' });
      await createConnectionDialog.getByRole('button', { name: 'Save connection' }).click();
      await createConnectionDialog.waitFor({ state: 'detached' });
      await personProfile.getByRole('button', { name: '+ Add', exact: true }).click();
      const describedConnectionDialog = profilePage.getByRole('dialog', { name: 'Log connection' });
      await describedConnectionDialog.getByRole('combobox', { name: 'Connection type: Text' }).click();
      await profilePage.getByRole('listbox', { name: 'Connection type' })
        .getByRole('option', { name: 'Time Together' }).click();
      await describedConnectionDialog.getByLabel('Time (optional)').fill('14:45');
      await describedConnectionDialog.getByLabel('Notes (optional)')
        .fill('Spent time together and talked about a meaningful family event during the long walk.');
      await describedConnectionDialog.getByRole('button', { name: 'Save connection' }).click();
      await describedConnectionDialog.waitFor({ state: 'detached' });
      const compactConnectionRow = personProfile.locator('.friendships-connection-row')
        .filter({ hasText: 'Text' }).last();
      await compactConnectionRow.waitFor();
      let checkedKeyboardSelect = false;
      let checkedTouchSelect = false;
      for (const textSize of ['small', 'medium', 'large'] as const) {
        await profilePage.evaluate(size => {
          document.documentElement.dataset.mobileTextSize = size === 'small'
            ? 'normal'
            : size === 'medium' ? 'large' : 'larger';
          document.documentElement.dataset.mobileTextSizeLevel = size === 'large' ? 'larger' : size;
        }, textSize);
        for (const viewport of [
          { width: 375, height: 844 },
          { width: 390, height: 844 },
          { width: 430, height: 844 }
        ]) {
          await profilePage.setViewportSize(viewport);
          const rowLayout = await compactConnectionRow.evaluate(row => {
            const title = row.querySelector<HTMLElement>('.friendships-connection-row__title');
            const footer = row.querySelector<HTMLElement>('.friendships-connection-row__footer');
            const icon = row.querySelector<HTMLElement>('.friendships-connection-row__icon');
            const chevron = row.querySelector<HTMLElement>('.friendships-connection-row__chevron');
            if (!title || !footer || !icon || !chevron) throw new Error('Connection rows need a title, date, and chevron.');
            const rowBounds = row.getBoundingClientRect();
            const titleBounds = title.getBoundingClientRect();
            const footerBounds = footer.getBoundingClientRect();
            const iconBounds = icon.getBoundingClientRect();
            const chevronBounds = chevron.getBoundingClientRect();
            return {
              documentWidth: document.documentElement.scrollWidth,
              rowWidth: row.clientWidth,
              rowScrollWidth: row.scrollWidth,
              titleWidth: title.clientWidth,
              titleScrollWidth: title.scrollWidth,
              titleBottom: titleBounds.bottom,
              footerTop: footerBounds.top,
              footerRightInset: rowBounds.right - footerBounds.right,
              footerText: footer.textContent?.trim(),
              notes: row.querySelector('.friendships-connection-row__notes')?.textContent,
              iconLeftInset: iconBounds.left - rowBounds.left,
              chevronRightInset: rowBounds.right - chevronBounds.right,
              radius: getComputedStyle(row).borderRadius,
              gridColumns: getComputedStyle(row).gridTemplateColumns
            };
          });
          assert.equal(rowLayout.documentWidth, viewport.width,
            `Connection rows must not create page overflow at ${viewport.width}px / ${textSize} text.`);
          assert.ok(rowLayout.rowWidth > 0 && rowLayout.rowScrollWidth <= rowLayout.rowWidth + 1);
          assert.ok(rowLayout.titleWidth > 0 && rowLayout.titleScrollWidth <= rowLayout.titleWidth + 1);
          assert.ok(rowLayout.titleBottom <= rowLayout.footerTop,
            `Connection title must remain above its date footer at ${viewport.width}px / ${textSize} text.`);
          assert.ok(Math.abs(rowLayout.footerRightInset - 14) <= 1,
            'The date footer should align with the compact row’s shared 14px content inset.');
          assert.ok(Math.abs(rowLayout.iconLeftInset - 14) <= 1,
            'The connection icon should align with the compact row’s shared 14px content inset.');
          assert.ok(Math.abs(rowLayout.chevronRightInset - 14) <= 1,
            'The chevron should align with the compact row’s shared 14px content inset.');
          assert.equal(rowLayout.notes, undefined, 'Empty descriptions should not render filler.');
          assert.equal(rowLayout.footerText?.includes('10:15'), false, 'A missing time should not be invented.');
          assert.equal(rowLayout.radius, '14px');
          assert.equal(rowLayout.gridColumns.split(' ').length, 2);

          const describedRow = personProfile.locator('.friendships-connection-row')
            .filter({ hasText: 'Spent time together' }).last();
          const describedLayout = await describedRow.evaluate(row => {
            const title = row.querySelector<HTMLElement>('.friendships-connection-row__title');
            const notes = row.querySelector<HTMLElement>('.friendships-connection-row__notes');
            const footer = row.querySelector<HTMLElement>('.friendships-connection-row__footer');
            if (!title || !notes || !footer) throw new Error('Described Connection needs its title, notes, and footer.');
            const titleBounds = title.getBoundingClientRect();
            const footerBounds = footer.getBoundingClientRect();
            return {
              title: title.textContent?.trim(),
              titleHeight: titleBounds.height,
              titleLineHeight: Number.parseFloat(getComputedStyle(title).lineHeight),
              titleWordBreak: getComputedStyle(title).wordBreak,
              titleOverflowWrap: getComputedStyle(title).overflowWrap,
              notes: notes.textContent?.trim(),
              footerText: footer.textContent?.trim(),
              titleBottom: titleBounds.bottom,
              footerTop: footerBounds.top,
              rowWidth: row.clientWidth,
              rowScrollWidth: row.scrollWidth
            };
          });
          assert.equal(describedLayout.title, 'Time Together');
          assert.equal(describedLayout.titleWordBreak, 'normal');
          assert.equal(describedLayout.titleOverflowWrap, 'break-word');
          assert.ok(describedLayout.titleHeight >= describedLayout.titleLineHeight);
          assert.ok(describedLayout.titleBottom <= describedLayout.footerTop);
          assert.ok(describedLayout.notes?.includes('Spent time together'));
          assert.ok(describedLayout.footerText?.includes('2:45 PM'));
          assert.ok(describedLayout.rowScrollWidth <= describedLayout.rowWidth + 1);
          const addConnection = personProfile.getByRole('button', { name: '+ Add', exact: true });
          const originalBodyStyles = await profilePage.evaluate(() => ({
            overflow: document.body.style.overflow,
            position: document.body.style.position,
            top: document.body.style.top
          }));
          await addConnection.click();
          const connectionDialog = profilePage.getByRole('dialog', { name: 'Log connection' });
          const typeSelect = connectionDialog.getByRole('combobox', { name: 'Connection type: Text' });
          const pointerFocus = await typeSelect.evaluate(trigger => ({
            active: document.activeElement === trigger,
            focusVisible: trigger.matches(':focus-visible'),
            outlineStyle: getComputedStyle(trigger).outlineStyle,
            borderColor: getComputedStyle(trigger).borderTopColor,
            boxShadow: getComputedStyle(trigger).boxShadow
          }));
          assert.equal(pointerFocus.active, true, 'The Connection type control should remain the dialog initial focus target.');
          assert.equal(pointerFocus.focusVisible, false,
            'Opening Log connection by pointer should not classify its initial focus as keyboard focus.');
          assert.equal(pointerFocus.outlineStyle, 'none');
          assert.equal(pointerFocus.boxShadow, 'none',
            'Pointer focus should retain the normal Connection type border without an outer shadow.');
          const connectionGeometry = await connectionDialog.evaluate(dialog => {
            const form = dialog.querySelector<HTMLElement>('.friendships-connection-form');
            const actions = dialog.querySelector<HTMLElement>('.friendships-connection-form button[type="submit"]');
            if (!form || !actions) throw new Error('The connection editor needs a scrollable form and save action.');
            form.scrollTop = form.scrollHeight;
            const formBounds = form.getBoundingClientRect();
            const actionsBounds = actions.getBoundingClientRect();
            const dialogBounds = dialog.getBoundingClientRect();
            return {
              width: dialogBounds.width,
              height: dialogBounds.height,
              top: dialogBounds.top,
              formOverflowY: getComputedStyle(form).overflowY,
              formClientHeight: form.clientHeight,
              formScrollHeight: form.scrollHeight,
              actionTop: actionsBounds.top,
              actionBottom: actionsBounds.bottom,
              formBottom: formBounds.bottom,
              documentWidth: document.documentElement.scrollWidth,
              viewportWidth: document.documentElement.clientWidth,
              bodyOverflow: document.body.style.overflow
            };
          });
          assert.equal(connectionGeometry.width, viewport.width);
          assert.equal(connectionGeometry.height, viewport.height);
          assert.equal(connectionGeometry.top, 0);
          assert.equal(connectionGeometry.formOverflowY, 'auto');
          assert.ok(connectionGeometry.formClientHeight > 0);
          assert.ok(connectionGeometry.actionTop >= 0);
          assert.ok(connectionGeometry.actionBottom <= connectionGeometry.formBottom + 1);
          assert.equal(connectionGeometry.documentWidth, viewport.width);
          assert.equal(connectionGeometry.viewportWidth, viewport.width);
          assert.equal(connectionGeometry.bodyOverflow, 'hidden');
          assert.equal(await connectionDialog.getByRole('button', { name: 'Close connection editor' }).isVisible(), true);
          assert.equal(await connectionDialog.getByRole('button', { name: 'Cancel' }).isVisible(), true);

          if (!checkedKeyboardSelect) {
            await profilePage.keyboard.press('Escape');
            await connectionDialog.waitFor({ state: 'detached' });
            await profilePage.waitForFunction(() => document.activeElement?.textContent?.trim() === '+ Add');
            await profilePage.keyboard.press('Enter');
            await connectionDialog.waitFor();
            const keyboardFocus = await typeSelect.evaluate(trigger => ({
              active: document.activeElement === trigger,
              focusVisible: trigger.matches(':focus-visible'),
              outlineStyle: getComputedStyle(trigger).outlineStyle,
              borderColor: getComputedStyle(trigger).borderTopColor,
              boxShadow: getComputedStyle(trigger).boxShadow
            }));
            assert.equal(keyboardFocus.active, true);
            assert.equal(keyboardFocus.focusVisible, true,
              'Keyboard opening should retain visible focus on the Connection type control.');
            assert.equal(keyboardFocus.outlineStyle, 'none',
              'Keyboard focus should not use the clipped outer outline.');
            assert.notEqual(keyboardFocus.borderColor, pointerFocus.borderColor,
              'Keyboard focus styling should use the existing field border.');
            assert.ok(keyboardFocus.boxShadow.includes('inset'),
              'Keyboard focus should use a subtle inset indicator that cannot be clipped.');
            await typeSelect.press('Enter');
            await profilePage.keyboard.press('ArrowDown');
            await profilePage.keyboard.press('Enter');
            assert.equal(await connectionDialog.getByRole('combobox', { name: 'Connection type: Call' }).isVisible(), true);
            checkedKeyboardSelect = true;
          }

          await connectionDialog.getByRole('button', { name: 'Close connection editor' }).click();
          await profilePage.waitForFunction(() => document.activeElement?.textContent?.trim() === '+ Add');
          if (!checkedTouchSelect) {
            const bounds = await addConnection.boundingBox();
            if (!bounds) throw new Error('The Connection type opener must remain visible for touch verification.');
            await profilePage.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            await connectionDialog.waitFor();
            const touchFocus = await typeSelect.evaluate(trigger => ({
              active: document.activeElement === trigger,
              focusVisible: trigger.matches(':focus-visible'),
              outlineStyle: getComputedStyle(trigger).outlineStyle,
              boxShadow: getComputedStyle(trigger).boxShadow
            }));
            assert.equal(touchFocus.active, true);
            assert.equal(touchFocus.focusVisible, false,
              'Opening Log connection by touch should not show a keyboard focus ring.');
            assert.equal(touchFocus.outlineStyle, 'none');
            assert.equal(touchFocus.boxShadow, 'none');
            await connectionDialog.getByRole('button', { name: 'Close connection editor' }).click();
            await profilePage.waitForFunction(() => document.activeElement?.textContent?.trim() === '+ Add');
            checkedTouchSelect = true;
          }
          assert.deepEqual(await profilePage.evaluate(() => ({
            overflow: document.body.style.overflow,
            position: document.body.style.position,
            top: document.body.style.top
          })), originalBodyStyles);
        }
      }

      await profilePage.setViewportSize({ width: 375, height: 844 });
      const detailsRow = compactConnectionRow;
      await detailsRow.focus();
      await profilePage.keyboard.press('Tab');
      await profilePage.keyboard.press('Shift+Tab');
      const connectionKeyboardFocus = await detailsRow.evaluate(element => ({
        visible: element.matches(':focus-visible'),
        outlineStyle: getComputedStyle(element).outlineStyle,
        outlineWidth: getComputedStyle(element).outlineWidth
      }));
      assert.equal(connectionKeyboardFocus.visible, true);
      assert.equal(connectionKeyboardFocus.outlineStyle, 'solid');
      assert.equal(connectionKeyboardFocus.outlineWidth, '3px');
      await profilePage.keyboard.press('Enter');
      const connectionDetails = profilePage.getByRole('dialog', { name: 'Connection details' });
      assert.equal(await connectionDetails.getByRole('button', { name: 'Close connection editor' }).isVisible(), true);
      assert.equal(await connectionDetails.getByText('0 / 4,000 characters').isVisible(), true);
      await connectionDetails.getByRole('button', { name: 'Close connection editor' }).click();
      await profilePage.waitForFunction(() => document.activeElement?.classList.contains('friendships-connection-row'));

      await profilePage.setViewportSize({ width: 430, height: 390 });
      await personProfile.getByRole('button', { name: '+ Add', exact: true }).click();
      const landscapeConnectionDialog = profilePage.getByRole('dialog', { name: 'Log connection' });
      const landscapeForm = landscapeConnectionDialog.locator('.friendships-connection-form');
      const landscapeScroll = await landscapeForm.evaluate(form => ({
        clientHeight: form.clientHeight,
        scrollHeight: form.scrollHeight,
        overflowY: getComputedStyle(form).overflowY
      }));
      assert.equal(landscapeScroll.overflowY, 'auto');
      assert.ok(landscapeScroll.scrollHeight > landscapeScroll.clientHeight,
        'The connection editor must scroll in a short landscape viewport.');
      await landscapeForm.evaluate(form => { form.scrollTop = form.scrollHeight; });
      assert.equal(await landscapeConnectionDialog.getByRole('button', { name: 'Save connection' }).isVisible(), true);
      assert.equal(await landscapeConnectionDialog.getByRole('button', { name: 'Cancel' }).isVisible(), true);
      await landscapeConnectionDialog.getByRole('button', { name: 'Cancel' }).click();
      await profilePage.waitForFunction(() => document.activeElement?.textContent?.trim() === '+ Add');
      assert.deepEqual(profileClassicCssRequests, [], 'Person profile React pages must not request tend.css.');
      await profileContext.close();

      const prayerFixture = createSamplePreviewData();
      const prayerToday = localDateString(new Date());
      const prayerNow = new Date().toISOString();
      const prayerCreatedAt = new Date(Date.parse(prayerNow) - 60 * 86_400_000).toISOString();
      const prayerTitle = 'Avery and Morgan are holding a thoughtful synthetic prayer request for a meaningful season';
      const prayerDetails = Array.from({ length: 20 }, (_, index) =>
        `Synthetic prayer context ${index + 1} explains the request with enough detail to test responsive wrapping, dialog scrolling, and preservation of the complete text.`
      ).join(' ');
      prayerFixture.prayerRequests = [{
        id: 'browser-prayer-request',
        personId: 'sample-person-avery',
        sharedWith: ['sample-person-morgan'],
        title: prayerTitle,
        details: prayerDetails,
        status: 'active',
        createdAt: prayerCreatedAt,
        updatedAt: prayerNow,
        prayerLogs: [
          { id: 'browser-prayer-today', prayedAt: prayerNow },
          { id: 'browser-prayer-older', prayedAt: new Date(Date.parse(prayerNow) - 45 * 86_400_000).toISOString() },
          { id: 'browser-prayer-undated' }
        ]
      }];
      const prayerEnvelope = createPreviewEnvelope(prayerFixture);
      const prayerValidation = parsePreviewBackup(JSON.stringify(prayerEnvelope), prayerToday);
      if (!prayerValidation.valid) {
        throw new Error(`Synthetic Prayer card fixture is invalid: ${prayerValidation.message}`);
      }
      const prayerStorageKey = `${PREVIEW_ACCOUNT_STORAGE_PREFIX}:c0000000-0000-4000-8000-000000000004`;
      const prayerContext = await browser.newContext({ viewport: { width: 375, height: 844 } });
      await prayerContext.addInitScript(({ key, value }) => {
        const session = {
          user: {
            id: 'c0000000-0000-4000-8000-000000000004',
            email: 'browser-test@example.test'
          }
        };
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
        window.localStorage.setItem(key, value);
      }, {
        key: prayerStorageKey,
        value: JSON.stringify(prayerEnvelope)
      });
      const prayerPage = await prayerContext.newPage();
      const prayerClassicRequests: string[] = [];
      await prayerPage.route('**/tend.css', async route => {
        prayerClassicRequests.push(route.request().url());
        await route.abort();
      });
      await prayerPage.route('https://cdn.jsdelivr.net/**', route => route.abort());
      await prayerPage.route('https://fonts.googleapis.com/**', route => route.abort());
      await prayerPage.route('https://fonts.gstatic.com/**', route => route.abort());
      await prayerPage.goto(`${baseUrl}/app-preview.html?identity=dashboard`);
      const prayerNavigation = prayerPage.getByRole('navigation', { name: 'Tools and navigation' });
      await prayerNavigation.waitFor();
      await prayerNavigation.getByRole('button', { name: 'People' }).click();
      await prayerPage.getByRole('button', { name: 'Open profile for Avery Brooks' }).click();
      const prayerProfile = prayerPage.getByRole('main', { name: 'Avery Brooks' });
      await prayerProfile.getByRole('tab', { name: 'Prayer' }).click();
      const prayerCard = prayerProfile.getByRole('article', { name: prayerTitle });
      await prayerCard.waitFor({ state: 'visible' });

      for (const textSize of ['small', 'medium', 'large'] as const) {
        await setPreviewTextSize(prayerPage, textSize);
        for (const viewportWidth of [375, 390, 430] as const) {
          await prayerPage.setViewportSize({ width: viewportWidth, height: 844 });
          const layout = await prayerCard.evaluate(card => {
            const title = card.querySelector<HTMLElement>('.person-prayer-card__title');
            const details = card.querySelector<HTMLElement>('.person-prayer-card__details');
            const actions = card.querySelector<HTMLElement>('.person-prayer-card__actions-trigger');
            const history = card.querySelector<HTMLElement>('.person-prayer-card__history');
            const footer = card.querySelector<HTMLElement>('.person-prayer-card__footer');
            if (!title || !details || !actions || !history || !footer) {
              throw new Error('Prayer cards need the request title, details, Actions, history, and footer.');
            }
            const bounds = (element: Element) => {
              const rect = element.getBoundingClientRect();
              return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width };
            };
            const cardStyle = getComputedStyle(card);
            const actionStyle = getComputedStyle(actions);
            const detailsStyle = getComputedStyle(details);
            return {
              viewportWidth: document.documentElement.clientWidth,
              documentWidth: document.documentElement.scrollWidth,
              card: bounds(card),
              cardScrollWidth: card.scrollWidth,
              background: cardStyle.backgroundColor,
              borderColor: cardStyle.borderTopColor,
              title: { ...bounds(title), scrollWidth: title.scrollWidth, clientWidth: title.clientWidth },
              details: { ...bounds(details), scrollWidth: details.scrollWidth, clientWidth: details.clientWidth },
              detailsWhiteSpace: detailsStyle.whiteSpace,
              actions: bounds(actions),
              history: bounds(history),
              footer: bounds(footer),
              actionForeground: actionStyle.color,
              actionBackground: actionStyle.backgroundColor
            };
          });
          const label = `Prayer card at ${viewportWidth}px / ${textSize} text`;
          assert.equal(layout.viewportWidth, viewportWidth, `${label} viewport`);
          assert.equal(layout.documentWidth, viewportWidth, `${label} must not create page overflow`);
          assert.ok(layout.card.left >= 0 && layout.card.right <= viewportWidth);
          assert.ok(layout.cardScrollWidth <= layout.card.width + 1, `${label} card should not overflow internally`);
          assert.ok(layout.title.clientWidth > 0 && layout.title.scrollWidth <= layout.title.clientWidth + 1,
            `${label} title must wrap rather than clip`);
          assert.ok(layout.details.clientWidth > 0 && layout.details.scrollWidth <= layout.details.clientWidth + 1,
            `${label} details must wrap rather than clip`);
          assert.equal(layout.detailsWhiteSpace, 'pre-wrap');
          assert.ok(layout.title.right <= layout.actions.left + 1,
            `${label} title and Actions control must not overlap`);
          assert.ok(layout.footer.left >= layout.card.left && layout.footer.right <= layout.card.right,
            `${label} footer divider must remain within the card`);
          assert.ok(layout.history.left >= layout.card.left && layout.history.right <= layout.card.right);
          const actionContrast = contrastRatio(layout.actionForeground, layout.actionBackground);
          assert.ok(actionContrast >= 4.5,
            `${label} Actions text must retain accessible contrast (${layout.actionForeground} on ${layout.actionBackground}, ${actionContrast.toFixed(2)}:1).`);
          assert.notEqual(layout.background, 'rgba(0, 0, 0, 0)',
            `${label} should retain the Prayer surface treatment`);
          assert.notEqual(layout.borderColor, 'rgba(0, 0, 0, 0)',
            `${label} should retain the Prayer border`);
        }
      }

      await prayerPage.setViewportSize({ width: 375, height: 650 });
      const prayerActions = prayerCard.getByRole('button', { name: `Actions for ${prayerTitle}` });
      await prayerActions.click();
      const prayerMenu = prayerPage.getByRole('menu', { name: `Actions for ${prayerTitle}` });
      const menuBounds = await prayerMenu.evaluate(menu => {
        const rect = menu.getBoundingClientRect();
        return {
          parentIsBody: menu.parentElement === document.body,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
          viewportWidth: document.documentElement.clientWidth
        };
      });
      assert.equal(menuBounds.parentIsBody, true, 'Prayer Actions must portal outside clipping cards and scroll containers.');
      assert.ok(menuBounds.left >= 0 && menuBounds.right <= menuBounds.viewportWidth);
      assert.ok(menuBounds.bottom <= 650);
      await prayerActions.click();
      await prayerMenu.waitFor({ state: 'detached' });

      await prayerActions.click();
      await prayerMenu.waitFor({ state: 'visible' });
      await prayerMenu.getByRole('menuitem', { name: 'Details/Edit' }).click();
      const prayerEditor = prayerPage.getByRole('dialog', { name: 'Prayer request details' });
      assert.equal(await prayerEditor.evaluate(dialog => dialog.classList.contains('dialog--phone-fullscreen')), true);
      const deleteAction = prayerEditor.locator('.person-prayer-form__delete');
      assert.equal(await deleteAction.isVisible(), true);
      assert.equal(await deleteAction.evaluate(element => getComputedStyle(element).borderTopStyle), 'solid');
      await prayerEditor.getByRole('button', { name: 'Close prayer request details' }).click();

      const historyTrigger = prayerCard.getByRole('button', {
        name: `Prayer history for ${prayerTitle}: 3 prayers recorded`
      });
      await historyTrigger.scrollIntoViewIfNeeded();
      const scrollBeforeHistory = await prayerPage.evaluate(() => window.scrollY);
      await historyTrigger.click();
      const prayerHistory = prayerPage.getByRole('dialog', { name: 'Prayer history' });
      const historyScroll = prayerHistory.locator('.money-goal-dialog__scroll-region');
      const historyScrollMetrics = await historyScroll.evaluate(region => ({
        clientHeight: region.clientHeight,
        scrollHeight: region.scrollHeight
      }));
      assert.ok(historyScrollMetrics.scrollHeight > historyScrollMetrics.clientHeight,
        'Long synthetic Prayer history must scroll inside the full-screen dialog.');
      const chartScroll = prayerHistory.getByRole('region', {
        name: 'Prayer history chart; scroll horizontally for older dates'
      });
      const chartScrollMetrics = await chartScroll.evaluate(region => ({
        clientWidth: region.clientWidth,
        scrollWidth: region.scrollWidth
      }));
      assert.ok(chartScrollMetrics.scrollWidth > chartScrollMetrics.clientWidth,
        'Prayer chart should provide horizontal access to older history.');
      await chartScroll.evaluate(region => { region.scrollLeft = 0; });
      assert.ok(await chartScroll.getByRole('listitem', { name: /prayer/ }).count() > 0);
      await historyScroll.evaluate(region => { region.scrollTop = region.scrollHeight; });
      assert.ok(await historyScroll.evaluate(region => region.scrollTop > 0));
      await prayerHistory.getByRole('button', { name: 'Close prayer history' }).click();
      await prayerPage.waitForFunction(
        expected => window.scrollY === expected
          && document.body.style.position === ''
          && document.body.style.top === '',
        scrollBeforeHistory
      );
      assert.deepEqual(prayerClassicRequests, [], 'Prayer React pages must not request tend.css.');
      await prayerContext.close();

      const doneRowsFixture = createEmptyPreviewData();
      const today = localDateString(new Date());
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localNow = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(new Date()).map(part => [part.type, part.value]));
      const localTime = `${localNow.hour}:${localNow.minute}`;
      const completedAt = localDateTimeInZone(today, localTime, timeZone).toISOString();
      const doneRhythms = [
        {
          id: 'user-rhythm-00000000-0000-4000-8000-000000000101',
          title: 'Midday walk',
          completedAt,
          localTime
        },
        {
          id: 'user-rhythm-00000000-0000-4000-8000-000000000102',
          title: 'Synthetic evening check-in with a deliberately long title',
          completedAt,
          localTime
        }
      ] as const;
      doneRowsFixture.todayView = 'all-today';
      doneRowsFixture.savedRhythms = doneRhythms.map(({ id, title }) => ({
        id,
        title,
        cadence: 'Daily',
        timeLabel: 'Anytime',
        automation: 'manual' as const,
        status: 'Due today' as const,
        personIds: [],
        categoryIds: ['faith'],
        primaryFoundationId: 'faith-prayer',
        schedule: { frequency: 'daily' as const }
      }));
      doneRowsFixture.completedRhythmIds = doneRhythms.map(rhythm => rhythm.id);
      doneRowsFixture.rhythmHistoryIds = doneRhythms.map(rhythm => rhythm.id);
      doneRowsFixture.datedRhythmCompletions = doneRhythms.map(rhythm => ({
        id: `${rhythm.id}-completion`,
        rhythmId: rhythm.id,
        effectiveDate: today,
        localTime: rhythm.localTime,
        timeZone,
        completedAt: rhythm.completedAt,
        recordedAt: rhythm.completedAt
      }));
      doneRowsFixture.activeRhythmCompletions = doneRhythms.map(rhythm => ({
        rhythmId: rhythm.id,
        completionId: `${rhythm.id}-completion`
      }));
      const doneRowsEnvelope = createPreviewEnvelope(doneRowsFixture);
      const doneRowsValidation = parsePreviewBackup(JSON.stringify(doneRowsEnvelope), today);
      if (!doneRowsValidation.valid) {
        throw new Error(`Synthetic done-row fixture is invalid: ${doneRowsValidation.message}`);
      }
      const doneRowsStorageKey = `${PREVIEW_ACCOUNT_STORAGE_PREFIX}:c0000000-0000-4000-8000-000000000003`;
      const doneContext = await browser.newContext({ viewport: { width: 375, height: 844 } });
      await doneContext.addInitScript(({ key, value }) => {
        const session = {
          user: {
            id: 'c0000000-0000-4000-8000-000000000003',
            email: 'browser-test@example.test'
          }
        };
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
        window.localStorage.setItem(key, value);
      }, {
        key: doneRowsStorageKey,
        value: JSON.stringify(doneRowsEnvelope)
      });
      const donePage = await doneContext.newPage();
      const doneRowsClassicRequests: string[] = [];
      await donePage.route('**/tend.css', async route => {
        doneRowsClassicRequests.push(route.request().url());
        await route.abort();
      });
      await donePage.route('https://cdn.jsdelivr.net/**', route => route.abort());
      await donePage.route('https://fonts.googleapis.com/**', route => route.abort());
      await donePage.route('https://fonts.gstatic.com/**', route => route.abort());
      await donePage.goto(`${baseUrl}/app-preview.html?identity=dashboard`);
      await donePage.locator('.home-dashboard').waitFor();
      const doneRows = donePage.locator('.tended-rhythm-done-row');
      await donePage.waitForTimeout(500);
      if (await doneRows.count() !== 2) {
        const fixtureState = await donePage.evaluate(key => ({
          bodyText: document.body.innerText.slice(0, 1600),
          storedFixture: window.localStorage.getItem(key) !== null,
          todayText: document.querySelector('.today-plan-section')?.textContent?.slice(0, 500) ?? null,
          savedText: document.querySelector('.preview-footer')?.textContent ?? null
        }), doneRowsStorageKey);
        throw new Error(`Synthetic done-row fixture did not render two rows: ${JSON.stringify(fixtureState)}`);
      }
      const collapsedTimeframeGroups = donePage.locator(
        '.today-plan-section .today-timeframe-header__disclosure[aria-expanded="false"]'
      );
      while (await collapsedTimeframeGroups.count() > 0) {
        await collapsedTimeframeGroups.first().click();
      }

      for (const textSize of ['small', 'medium', 'large'] as const) {
        await setPreviewTextSize(donePage, textSize);
        for (const viewportWidth of [375, 390, 430] as const) {
          await donePage.setViewportSize({ width: viewportWidth, height: 844 });
          const layout = await donePage.evaluate(() => {
            const rows = [...document.querySelectorAll<HTMLElement>('.tended-rhythm-done-row')];
            const first = rows[0];
            const second = rows[1];
            const firstItem = first?.closest<HTMLElement>('[data-tended-rhythm-item]');
            const secondItem = second?.closest<HTMLElement>('[data-tended-rhythm-item]');
            const itemGroup = firstItem?.parentElement;
            const check = first?.querySelector<HTMLElement>('.tended-rhythm-done-row__check');
            const title = second?.querySelector<HTMLElement>('.tended-rhythm-done-row__title');
            const time = second?.querySelector<HTMLElement>('.tended-rhythm-done-row__time');
            if (!first || !second || !firstItem || !secondItem || !itemGroup
              || itemGroup !== secondItem.parentElement || !check || !title || !time) {
              throw new Error('The synthetic Today fixture must render two compact tended rows.');
            }
            const bounds = (element: HTMLElement) => {
              const rect = element.getBoundingClientRect();
              return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
            };
            const firstBounds = bounds(first);
            const rowStyle = getComputedStyle(first);
            const titleStyle = getComputedStyle(title);
            const timeStyle = getComputedStyle(time);
            return {
              viewportWidth: document.documentElement.clientWidth,
              documentWidth: document.documentElement.scrollWidth,
              rowCount: rows.length,
              row: {
                ...firstBounds,
                padding: rowStyle.padding,
                borderTopWidth: rowStyle.borderTopWidth,
                borderTopStyle: rowStyle.borderTopStyle,
                borderTopColor: rowStyle.borderTopColor,
                borderRadius: rowStyle.borderTopLeftRadius,
                background: rowStyle.backgroundColor,
                gap: getComputedStyle(itemGroup).rowGap
              },
              check: bounds(check),
              title: {
                ...bounds(title),
                fontSize: titleStyle.fontSize,
                fontWeight: titleStyle.fontWeight,
                whiteSpace: titleStyle.whiteSpace,
                textOverflow: titleStyle.textOverflow,
                overflowWrap: titleStyle.overflowWrap
              },
              time: {
                ...bounds(time),
                fontSize: timeStyle.fontSize,
                whiteSpace: timeStyle.whiteSpace
              },
              hasSeparateDoneRowsSection: Boolean(document.querySelector('.tended-rhythm-done-rows')),
              hasSeparateDoneRowsHeading: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
                .some(heading => heading.textContent?.trim() === 'Tended today')
            };
          });
          assert.equal(layout.viewportWidth, viewportWidth);
          assert.equal(layout.documentWidth, viewportWidth,
            `Tended rows must not create horizontal overflow at ${viewportWidth}px / ${textSize}.`);
          assert.equal(layout.rowCount, 2);
          assert.equal(layout.row.left >= 0 && layout.row.right <= viewportWidth, true);
          assert.equal(layout.row.padding, '11px 14px');
          assert.equal(layout.row.borderTopWidth, '1px');
          assert.equal(layout.row.borderTopStyle, 'solid');
          assert.equal(layout.row.borderRadius, '14px');
          assert.equal(layout.row.background, 'rgb(255, 255, 255)');
          assert.equal(layout.row.gap, '16px');
          assert.equal(layout.check.width, 24);
          assert.equal(layout.check.height, 24);
          assert.equal(layout.title.whiteSpace, 'normal');
          assert.equal(layout.title.textOverflow, 'clip');
          assert.equal(layout.title.overflowWrap, 'anywhere');
          assert.equal(layout.time.whiteSpace, 'nowrap');
          assert.equal(layout.hasSeparateDoneRowsSection, false);
          assert.equal(layout.hasSeparateDoneRowsHeading, false);
        }
      }
      assert.deepEqual(doneRowsClassicRequests, [], 'Done-row React pages must not request tend.css.');
      await doneContext.close();

      const rotationFixture = createEmptyPreviewData();
      rotationFixture.strength.savedWorkouts = [
        {
          id: 'rotation-monday',
          name: 'Strength workout for Monday training',
          muscleIds: ['abs'],
          sharedWith: []
        },
        {
          id: 'rotation-wednesday',
          name: 'Strength workout for Wednesday training',
          muscleIds: ['abs'],
          sharedWith: []
        },
        {
          id: 'rotation-friday',
          name: 'Strength workout for Friday training',
          muscleIds: ['abs'],
          sharedWith: []
        }
      ];
      const rotationEnvelope = createPreviewEnvelope(rotationFixture);
      const rotationValidation = parsePreviewBackup(JSON.stringify(rotationEnvelope), today);
      if (!rotationValidation.valid) {
        throw new Error(`Synthetic workout rotation fixture is invalid: ${rotationValidation.message}`);
      }
      const rotationStorageKey = `${PREVIEW_ACCOUNT_STORAGE_PREFIX}:c0000000-0000-4000-8000-000000000003`;
      const rotationContext = await browser.newContext({
        viewport: { width: 375, height: 844 },
        hasTouch: true
      });
      await rotationContext.addInitScript(({ key, value }) => {
        const session = {
          user: {
            id: 'c0000000-0000-4000-8000-000000000003',
            email: 'browser-test@example.test'
          }
        };
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
        window.localStorage.setItem(key, value);
      }, {
        key: rotationStorageKey,
        value: JSON.stringify(rotationEnvelope)
      });
      const rotationPage = await rotationContext.newPage();
      await rotationPage.route('https://cdn.jsdelivr.net/**', route => route.abort());
      await rotationPage.route('https://fonts.googleapis.com/**', route => route.abort());
      await rotationPage.route('https://fonts.gstatic.com/**', route => route.abort());
      await rotationPage.goto(`${baseUrl}/app-preview.html?identity=dashboard`);
      await rotationPage.locator('.home-dashboard').waitFor();
      await rotationPage.locator('button.menu-area')
        .filter({ hasText: 'Health & Fitness' })
        .click();
      await rotationPage.getByRole('tab', { name: 'Rhythms' }).click();
      for (const textSize of ['small', 'medium', 'large'] as const) {
        await setPreviewTextSize(rotationPage, textSize);
        await rotationPage.getByRole('button', { name: 'Add Rhythm' }).click();
        await rotationPage.getByRole('combobox', { name: 'Recommended Workout' }).click();
        await rotationPage.getByRole('option', { name: 'Workout rotation' }).click();
        for (const name of [
          'Strength workout for Monday training',
          'Strength workout for Wednesday training',
          'Strength workout for Friday training'
        ]) {
          await rotationPage.getByRole('checkbox', { name }).click();
        }
        await rotationPage.getByRole('button', {
          name: 'Move Strength workout for Friday training up'
        }).click();
        assert.deepEqual(
          await rotationPage.locator('.rhythm-editor__rotation-order li > span:first-child').allTextContents(),
          [
            'Strength workout for Monday training',
            'Strength workout for Friday training',
            'Strength workout for Wednesday training'
          ]
        );
        for (const viewportWidth of [375, 390, 430] as const) {
          await rotationPage.setViewportSize({ width: viewportWidth, height: 844 });
          const layout = await rotationPage.locator('.rhythm-editor__rotation-setup').evaluate(element => {
            const setup = element.getBoundingClientRect();
            const rows = [...element.querySelectorAll<HTMLElement>('.rhythm-editor__rotation-order li')];
            return {
              viewportWidth: document.documentElement.clientWidth,
              documentWidth: document.documentElement.scrollWidth,
              textSize: document.querySelector('.tend-app-preview')?.getAttribute('data-text-size'),
              setup: {
                left: setup.left,
                right: setup.right,
                width: element.clientWidth,
                scrollWidth: element.scrollWidth
              },
              rows: rows.map(row => {
                const bounds = row.getBoundingClientRect();
                const name = row.querySelector<HTMLElement>('span:first-child')!.getBoundingClientRect();
                const actions = row.querySelector<HTMLElement>('.rhythm-editor__rotation-order-actions')!.getBoundingClientRect();
                const buttons = [...row.querySelectorAll<HTMLButtonElement>('button')].map(button => {
                  const rect = button.getBoundingClientRect();
                  return { left: rect.left, right: rect.right };
                });
                return {
                  left: bounds.left,
                  right: bounds.right,
                  name: { left: name.left, right: name.right, bottom: name.bottom },
                  actions: { left: actions.left, right: actions.right, top: actions.top },
                  buttons
                };
              })
            };
          });
          assert.equal(layout.viewportWidth, viewportWidth);
          assert.equal(layout.documentWidth, viewportWidth,
            `Workout rotation must not create horizontal page overflow at ${viewportWidth}px / ${textSize}.`);
          assert.equal(layout.textSize, textSize);
          assert.ok(layout.setup.scrollWidth <= layout.setup.width + 1,
            `Workout rotation setup must fit at ${viewportWidth}px / ${textSize}.`);
          for (const row of layout.rows) {
            assert.ok(row.left >= layout.setup.left - 1 && row.right <= layout.setup.right + 1);
            assert.ok(row.actions.right <= row.right + 1);
            for (const button of row.buttons) {
              assert.ok(button.left >= row.actions.left - 1 && button.right <= row.actions.right + 1);
            }
            if (row.actions.top >= row.name.bottom - 1) {
              assert.ok(row.name.bottom <= row.actions.top + 2);
            } else {
              assert.ok(row.name.right <= row.actions.left + 2);
            }
          }
        }
        await rotationPage.getByRole('button', { name: 'Cancel' }).click();
      }
      await rotationContext.close();

      assert.deepEqual(classicCssRequests, [], 'React pages must not request tend.css.');
      await context.close();
    }

    await verifyFoundationAlignmentAndDialogScrolling(browser, baseUrl);
    console.log('Browser CSS contract passed: sign-in and dashboard layouts render without tend.css.');
  } finally {
    await browser?.close();
    await new Promise<void>(resolve => catalogServer.close(() => resolve()));
    if (previewServer?.pid && previewServer.exitCode === null && previewServer.signalCode === null) {
      previewServer.kill('SIGKILL');
    }
    await rm(outputDirectory, { recursive: true, force: true });
    await rm(catalogOutputDirectory, { recursive: true, force: true });
  }
}

await main();
