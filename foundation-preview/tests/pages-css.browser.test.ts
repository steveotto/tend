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
import type { Page } from 'playwright';
import { createEmptyPreviewData, createPreviewEnvelope } from '../src/domain/preview-state.ts';
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

type PreviewTextSize = 'small' | 'medium' | 'large';

function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const channels = color.match(/\d+(?:\.\d+)?/g);
    assert.ok(channels && channels.length >= 3, `Expected an RGB color, got ${color}.`);
    const linearChannel = (index: number) => {
      const value = channels[index];
      if (value === undefined) throw new Error(`Missing RGB channel in ${color}.`);
      const channel = Number(value) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
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
      assert.equal(focusMetrics.outlineOffset, '2px');
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
              if (!headerActions || !mobileSearch || !sizeToggle || !brandTagline || !stickyNav
                || !areaNavigation || !utilitySearch || !menuGrid || !firstMenuArea || !currentTool
                || !calendarSection || !calendarHeadingRow || !calendarHeading || !prayerHeading
                || !calendarRange || !calendarRangeLabel || !todayTitleRow || !todayTitleMain
                || !todayHeading || !todayWeather || !todayWeatherImage || !todayWeatherCompact
                || !todayWeatherIcon || !todayProgress) {
                throw new Error('Dashboard is missing an expected mobile shell or Health category element.');
              }
              const searchStyle = getComputedStyle(mobileSearch);
              const toggleStyle = getComputedStyle(sizeToggle);
              const toolStyle = getComputedStyle(currentTool);
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
                  titleTop: titleRect ? titleRect.top - rect.top : null,
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
              if (headingName === 'Body overview') {
                assert.ok(position.subtitleTop !== null && position.subtitleTop > 0,
                  `Training status should be a subtitle below Body overview at ${viewportWidth}px / ${textSize} text.`);
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
            tabs: ['Progress', 'Activities', 'Rhythms'],
            panels: ['cardio-panel-progress', 'cardio-panel-activities', 'cardio-panel-rhythms'],
            gear: 'Cardio tracking settings',
            dialog: 'Cardio goals',
            emptyActivity: 'No valid runs logged yet.',
            emptyRhythms: 'No Rhythms are linked to Cardio yet.',
            card: '.cardio-progress-card',
            toolZone: 'Activity insights'
          },
          {
            name: 'Weight',
            tablist: 'Weight Foundation sections',
            tabs: ['Progress', 'Measurements', 'Rhythms'],
            panels: ['weight-panel-progress', 'weight-panel-measurements', 'weight-panel-rhythms'],
            gear: 'Weight tracking settings',
            dialog: 'Weight goals',
            emptyActivity: 'No valid weigh-ins to show.',
            emptyRhythms: 'No Rhythms are linked to Weight yet.',
            card: '.weight-progress-card',
            toolZone: 'Weight insights'
          }
        ] as const;

        for (const [foundationIndex, foundation] of cardioWeightFoundations.entries()) {
          if (foundationIndex > 0) {
            await page.getByRole('button', { name: /All Foundations/ }).click();
          }
          await page.getByRole('button', {
            name: `Open ${foundation.name} foundation details`
          }).click();
          const tabs = page.getByRole('tablist', { name: foundation.tablist });
          await tabs.getByRole('tab', { name: 'Progress', exact: true }).click();
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
                const panelLayout = await panel.evaluate((element, { tablistName, tabName }) => {
                  const panelElement = element as HTMLElement;
                  const tablist = document.querySelector<HTMLElement>(
                    `[role="tablist"][aria-label="${tablistName}"]`
                  );
                  const zone = panelElement.querySelector<HTMLElement>('.tool-zone');
                  const heading = panelElement.querySelector<HTMLElement>('.strength-section-heading');
                  const isProgress = tabName === 'Progress';
                  const root = isProgress ? zone : heading;
                  const title = isProgress
                    ? zone?.querySelector<HTMLElement>('.tool-zone__intro')
                    : heading?.querySelector<HTMLElement>('.strength-section-heading__title-row');
                  const actions = isProgress
                    ? zone?.querySelector<HTMLElement>('.tool-zone__actions')
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
                }, { tablistName: foundation.tablist, tabName });
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
                  || (foundation.name === 'Weight' && tabName === 'Measurements')) {
                  const sectionSpacing = await panel.evaluate(element => {
                    const heading = element.querySelector<HTMLElement>('.strength-section-heading');
                    const historyCard = element.querySelector<HTMLElement>(
                      '.cardio-progress-card, .cardio-history-card, .weight-history-card'
                    );
                    if (!heading || !historyCard) {
                      throw new Error('A Foundation panel is missing its shared heading or card.');
                    }
                    return {
                      sharedSpacing: element.classList.contains('strength-workout-section'),
                      rowGap: getComputedStyle(element).rowGap,
                      headingToCard: historyCard.getBoundingClientRect().top - heading.getBoundingClientRect().bottom
                    };
                  });
                  assert.equal(sectionSpacing.sharedSpacing, true);
                  assert.equal(sectionSpacing.rowGap, '12px');
                  assert.ok(Math.abs(sectionSpacing.headingToCard - 12) < 0.5,
                    `${foundation.name} ${tabName} content should have the same section gap as Strength Add at ${viewportWidth}px / ${textSize} text.`);
                }
                if (tabName === 'Progress') {
                  assert.ok(Number.parseFloat(panelLayout.cardPadding ?? '0') >= 16,
                    `${foundation.name} chart card must keep comfortable padding.`);
                  assert.equal(await page.getByRole('button', { name: foundation.gear }).isVisible(), true);
                  if (foundation.name === 'Cardio') {
                    const todayHighlight = await panel.evaluate(element => {
                      const day = element.querySelector<HTMLElement>('.cardio-week-day.is-today');
                      const zone = element.querySelector<HTMLElement>('.tool-zone');
                      const purpose = zone?.querySelector<HTMLElement>('.tool-zone__purpose');
                      const weekday = day?.querySelector<HTMLElement>(':scope > span:first-child');
                      const date = day?.querySelector<HTMLElement>('small');
                      const today = day?.querySelector<HTMLElement>('.cardio-week-day__today');
                      const activity = day?.querySelector<HTMLElement>('i');
                      if (!day || !zone || !purpose || !weekday || !date || !today || !activity) {
                        throw new Error('Cardio Activity insights needs a complete current-day highlight.');
                      }
                      return {
                        dayBackground: getComputedStyle(day).backgroundColor,
                        zoneBackground: getComputedStyle(zone).backgroundColor,
                        dayBorder: getComputedStyle(day).borderTopColor,
                        zoneBorder: getComputedStyle(zone).borderTopColor,
                        weekdayColor: getComputedStyle(weekday).color,
                        dateColor: getComputedStyle(date).color,
                        todayColor: getComputedStyle(today).color,
                        accentColor: getComputedStyle(purpose).color,
                        activityColor: getComputedStyle(activity).color
                      };
                    });
                    assert.equal(todayHighlight.dayBackground, todayHighlight.zoneBackground);
                    assert.equal(todayHighlight.dayBorder, todayHighlight.zoneBorder);
                    assert.equal(todayHighlight.weekdayColor, todayHighlight.accentColor);
                    assert.equal(todayHighlight.dateColor, todayHighlight.accentColor);
                    assert.equal(todayHighlight.todayColor, todayHighlight.accentColor);
                    assert.notEqual(todayHighlight.activityColor, todayHighlight.accentColor,
                      'The activity marker must retain its semantic status color.');
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
                    const dateInput = settings.locator('input[type="date"]').first();
                    await dateInput.focus();
                    await page.keyboard.press('Tab');
                    await page.keyboard.press('Shift+Tab');
                    const dateFocus = await dateInput.evaluate(input => {
                      const region = input.closest<HTMLElement>('.fitness-goals-scroll');
                      if (!region) throw new Error('Foundation tracking date needs a scroll region.');
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
                    assert.equal(dateFocus.active, true);
                    assert.equal(dateFocus.visible, true);
                    assert.ok(dateFocus.leftClearance >= dateFocus.requiredClearance);
                    assert.ok(dateFocus.rightClearance >= dateFocus.requiredClearance);

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
                        leftClearance: rect.left - regionRect.left,
                        rightClearance: regionRect.right - rect.right,
                        requiredClearance: clearance
                      };
                    });
                    assert.equal(numericFocus.active, true);
                    assert.equal(numericFocus.overflow, 'visible');
                    assert.equal(numericFocus.outlineWidth, '2px');
                    assert.equal(numericFocus.outlineOffset, '2px');
                    assert.ok(numericFocus.leftClearance >= numericFocus.requiredClearance);
                    assert.ok(numericFocus.rightClearance >= numericFocus.requiredClearance);
                    await settings.getByRole('button', { name: 'Cancel' }).click();
                    await page.waitForFunction(label =>
                      document.activeElement?.getAttribute('aria-label') === label, foundation.gear);
                  }
                } else if (tabName === 'Activities' || tabName === 'Measurements') {
                  assert.equal(await panel.getByText(foundation.emptyActivity, { exact: true }).isVisible(), true);
                  if (foundation.name === 'Cardio') {
                    const runDivider = await panel.evaluate(element => {
                      const card = element.querySelector<HTMLElement>('.cardio-history-card');
                      if (!card) throw new Error('Cardio Activities needs its run-history card.');
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
                      'Run-history rows should not use an internal top divider.');
                  }
                } else {
                  assert.equal(await panel.getByText(foundation.emptyRhythms, { exact: true }).isVisible(), true);
                }
              }

            }
          }
        }
      }

      if (identity === 'dashboard') {
        const categorySizeToggle = page.locator('.mobile-display-toggle');
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (await categorySizeToggle.getAttribute('data-text-size') === 'small') break;
          await categorySizeToggle.click();
        }
        assert.equal(await categorySizeToggle.getAttribute('data-text-size'), 'small');
        const areaNavigation = page.getByRole('navigation', { name: 'Areas' });
        await page.setViewportSize({ width: 1280, height: 900 });
        await areaNavigation.getByRole('button', { name: 'Marriage', exact: true }).click();
        const categoryHero = page.locator('.category-header--hero');
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
        assert.equal(categoryHeroStyle.padding, '24px 22px');
        assert.equal(categoryHeroStyle.titleFontSize, '26px');
        assert.equal(categoryHeroStyle.titleFontWeight, '800');
        assert.equal(categoryHeroStyle.titleColor, 'rgb(255, 255, 255)');
        assert.equal(categoryHeroStyle.subtitleColor, 'rgb(216, 230, 222)');
        assert.equal(categoryHeroStyle.subtitleMaxWidth, '90%');
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
        ), 'none');

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
        assert.equal(foundationHeroStyle.padding, '24px 22px');
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
        assert.equal(foundationBackStyle.marginBottom, '10px');
        assert.equal(foundationBackStyle.iconWidth, '12px');
        assert.equal(foundationBackStyle.iconHeight, '12px');
        assert.equal(foundationBackStyle.iconStroke, 'rgb(36, 107, 82)');
        await page.setViewportSize({ width: 359, height: 844 });
        assert.equal(await foundationHero.locator('.page-hero-header__icon').evaluate(
          element => getComputedStyle(element).display
        ), 'none');
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
            assert.equal(heroLayout.documentWidth, viewportWidth);
            assert.ok(heroLayout.heroRight <= viewportWidth);
            if (viewportWidth < 360) {
              assert.equal(heroLayout.iconDisplay, 'none');
              assert.equal(heroLayout.copyPaddingRight, '0px');
            } else {
              assert.ok(heroLayout.copyContentRight < heroLayout.iconLeft,
                `Foundation hero copy must not overlap its icon at ${viewportWidth}px / ${textSize}.`);
            }
          }
        }
      }

      if (identity === 'dashboard') {
        await page.setViewportSize({ width: 375, height: 844 });
        await page.getByRole('button', { name: 'More, settings' }).click();
        await page.getByRole('button', { name: /^Settings/ }).click();
        await page.getByRole('button', { name: 'Categories', exact: true }).click();
        const financeSwitch = page.locator('.category-settings__item')
          .filter({ hasText: 'Finances' })
          .locator('input[role="switch"]');
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
              if (!tablist || !panel || !content) {
                throw new Error('Finance must expose a tablist and one visible panel.');
              }
              const tabsRect = tablist.getBoundingClientRect();
              const panelRect = panel.getBoundingClientRect();
              const contentRect = content.getBoundingClientRect();
              return {
                viewportWidth: document.documentElement.clientWidth,
                documentWidth: document.documentElement.scrollWidth,
                summaryAndTabs: Math.round(tabsRect.top - element.querySelector('.category-health-summary')!.getBoundingClientRect().bottom),
                tabsToContent: Math.round(contentRect.top - tabsRect.bottom),
                panelVisible: panelRect.width > 0 && panelRect.height > 0
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
      await personProfile.getByRole('tab', { name: 'Connections' }).click();
      await profilePage.setViewportSize({ width: 375, height: 844 });
      let checkedKeyboardSelect = false;
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
          const addConnection = personProfile.getByRole('button', { name: '+ Add' });
          const originalBodyStyles = await profilePage.evaluate(() => ({
            overflow: document.body.style.overflow,
            position: document.body.style.position,
            top: document.body.style.top
          }));
          await addConnection.click();
          const connectionDialog = profilePage.getByRole('dialog', { name: 'Log connection' });
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
            const typeSelect = connectionDialog.getByRole('combobox', { name: 'Connection type: Text' });
            await typeSelect.press('Enter');
            await profilePage.keyboard.press('ArrowDown');
            await profilePage.keyboard.press('Enter');
            assert.equal(await connectionDialog.getByRole('combobox', { name: 'Connection type: Call' }).isVisible(), true);
            checkedKeyboardSelect = true;
          }

          await connectionDialog.getByRole('button', { name: 'Close connection editor' }).click();
          await profilePage.waitForFunction(() => document.activeElement?.textContent?.trim() === '+ Add');
          assert.deepEqual(await profilePage.evaluate(() => ({
            overflow: document.body.style.overflow,
            position: document.body.style.position,
            top: document.body.style.top
          })), originalBodyStyles);
        }
      }

      await profilePage.setViewportSize({ width: 430, height: 390 });
      await personProfile.getByRole('button', { name: '+ Add' }).click();
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

      assert.deepEqual(classicCssRequests, [], 'React pages must not request tend.css.');
      await context.close();
    }

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
