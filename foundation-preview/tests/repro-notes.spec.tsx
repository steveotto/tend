import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, test } from 'vitest';
import { App } from '../src/App.tsx';
import { createSamplePreviewData, createPreviewEnvelope } from '../src/domain/preview-state.ts';
import { PREVIEW_STORAGE_KEY } from '../src/storage/preview-storage.ts';

document.body.innerHTML = '';

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(createSamplePreviewData())));
});
afterEach(() => {
  document.body.innerHTML = '';
});

test('open people and inspect notes button', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText('Preview data saved in this browser.');
  await user.click(within(screen.getByRole('navigation', { name: 'Tools and navigation' })).getByRole('button', { name: 'People' }));
  await user.click(screen.getByRole('button', { name: 'Open profile for Avery Brooks' }));
  void screen.queryByRole('button', { name: 'Notes (0)' });
});
