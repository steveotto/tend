import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App.tsx';
import { PREVIEW_STORAGE_KEY } from '../src/storage/preview-storage.ts';
import { installMemoryStorage } from './memory-storage.ts';

beforeEach(() => {
  installMemoryStorage();
});

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(PREVIEW_STORAGE_KEY);
});

describe('app release label', () => {
  it('shows the shared display version at the bottom of the More screen', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');

    await user.click(screen.getByRole('button', { name: 'More, settings' }));

    const more = screen.getByRole('main', { name: 'More' });
    const version = within(more).getByText('Version 1.2');
    expect(more.lastElementChild).toBe(version);
  });
});
