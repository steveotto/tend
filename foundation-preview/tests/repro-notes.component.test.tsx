import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, expect, test } from 'vitest';
import { App } from '../src/App.tsx';
import { createSamplePreviewData, createPreviewEnvelope } from '../src/domain/preview-state.ts';
import { PREVIEW_STORAGE_KEY } from '../src/storage/preview-storage.ts';
import { installMemoryStorage } from './memory-storage.ts';

beforeEach(() => {
  installMemoryStorage();
  window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(createSamplePreviewData())));
});
afterEach(() => {
  document.body.innerHTML = '';
});

test('preserves a shared Person note and its owner across a reload', async () => {
  const user = userEvent.setup();
  const openPerson = async (name: string) => {
    await user.click(within(screen.getByRole('navigation', { name: 'Tools and navigation' })).getByRole('button', { name: 'People' }));
    await user.click(screen.getByRole('button', { name: `Open profile for ${name}` }));
  };

  const { unmount } = render(<App />);
  await screen.findByText('Preview data saved in this browser.');
  await openPerson('Avery Brooks');
  await user.click(screen.getByRole('button', { name: 'Notes (0)' }));
  await user.click(screen.getByRole('button', { name: 'Add note' }));
  const editor = screen.getByRole('dialog', { name: 'Add note for Avery Brooks' });
  await user.type(within(editor).getByRole('textbox', { name: 'Note' }), 'App integration first line{Enter}second line');
  await user.click(within(editor).getByRole('button', { name: 'Choose people' }));
  const picker = screen.getByRole('dialog', { name: 'Share note' });
  await user.click(within(picker).getByRole('button', { name: 'Morgan Reed' }));
  await user.click(within(picker).getByRole('button', { name: 'Done' }));
  await user.click(within(editor).getByRole('button', { name: 'Save note' }));

  await waitFor(() => {
    const saved = JSON.parse(window.localStorage.getItem(PREVIEW_STORAGE_KEY) ?? '{}') as { data?: { personNotes?: Array<Record<string, unknown>> } };
    expect(saved.data?.personNotes).toHaveLength(1);
  }, { timeout: 8000 });

  await user.click(screen.getByRole('button', { name: 'Back to People' }));
  await openPerson('Morgan Reed');
  await user.click(screen.getByRole('button', { name: 'Notes (1)' }));
  await user.click(screen.getByRole('button', { name: /Open note updated/ }));
  const noteDetail = screen.getByRole('dialog', { name: 'Note' });
  expect(within(noteDetail).getByText(/Primary person: Avery Brooks/)).toBeTruthy();
  await user.click(within(noteDetail).getByRole('button', { name: 'Edit note' }));
  const edit = screen.getByRole('dialog', { name: 'Edit note' });
  await user.clear(within(edit).getByRole('textbox', { name: 'Note' }));
  await user.type(within(edit).getByRole('textbox', { name: 'Note' }), 'Edited from the shared profile');
  await user.click(within(edit).getByRole('button', { name: 'Save changes' }));

  await waitFor(() => {
    const saved = JSON.parse(window.localStorage.getItem(PREVIEW_STORAGE_KEY) ?? '{}') as { data?: { personNotes?: Array<Record<string, unknown>> } };
    expect(saved.data?.personNotes).toHaveLength(1);
    expect(saved.data?.personNotes?.[0]).toMatchObject({ content: 'Edited from the shared profile' });
  }, { timeout: 8000 });

  unmount();
  render(<App />);
  await screen.findByText('Preview data saved in this browser.');
  await openPerson('Avery Brooks');
  await user.click(screen.getByRole('button', { name: 'Notes (1)' }));
  expect(screen.getByRole('heading', { name: 'Notes (1)' })).toBeTruthy();
  expect(screen.getByText('Edited from the shared profile')).toBeTruthy();
});
