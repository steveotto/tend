import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.tsx';
import { PREVIEW_SCHEMA_VERSION } from '../src/domain/preview-state.ts';
import { PREVIEW_STORAGE_KEY } from '../src/storage/preview-storage.ts';
import { installMemoryStorage } from './memory-storage.ts';

beforeEach(installMemoryStorage);
afterEach(() => {
  cleanup();
  window.localStorage.removeItem(PREVIEW_STORAGE_KEY);
  vi.restoreAllMocks();
});

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'More, settings' }));
  await user.click(await screen.findByRole('button', { name: 'Settings' }));
}

describe('Calendar settings in Preview', () => {
  it('saves source configuration locally, renders no fake events, and restores it after remount', async () => {
    const user = userEvent.setup();
    const url = 'webcal://p123-caldav.icloud.com/published/synthetic-token';
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('123e4567-e89b-42d3-a456-426614174002');
    const first = render(<App />);
    await openSettings(user);
    await user.click(screen.getByRole('button', { name: 'Add calendar' }));
    await user.type(screen.getByLabelText('Calendar name'), 'Synthetic work');
    await user.type(screen.getByLabelText('Public iCloud calendar link'), url);
    await user.click(screen.getByRole('button', { name: 'Save calendar' }));
    await user.click(screen.getByRole('button', { name: 'Save calendar settings' }));

    expect(await screen.findByText('Link saved in this browser')).toBeTruthy();
    const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const envelope = JSON.parse(raw ?? '{}') as {
      schemaVersion: number;
      data: { calendarSources: { name: string; url: string }[] };
    };
    expect(envelope.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    expect(envelope.data.calendarSources).toEqual([expect.objectContaining({ name: 'Synthetic work', url })]);
    expect(first.container.textContent).not.toContain(url);

    first.unmount();
    render(<App />);
    await openSettings(user);
    expect(await screen.findByText('Synthetic work')).toBeTruthy();
    expect(screen.queryByText(url)).toBeNull();
  });
});
