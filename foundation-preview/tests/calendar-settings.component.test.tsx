import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarSettings } from '../src/components/CalendarSettings.tsx';
import type { CalendarSource } from '../src/domain/calendar-sources.ts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CalendarSettings', () => {
  it('stages an accessible source edit until settings are explicitly saved', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_sources: CalendarSource[]) => null);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('123e4567-e89b-42d3-a456-426614174000');
    render(<CalendarSettings sources={[]} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Add calendar' }));
    await user.type(screen.getByLabelText('Calendar name'), 'Work');
    const url = 'webcal://p123-caldav.icloud.com/published/synthetic-token';
    await user.type(screen.getByLabelText('Public iCloud calendar link'), url);
    await user.click(screen.getByRole('button', { name: 'Save calendar' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Work')).toBeTruthy();
    expect(screen.queryByText(url)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save calendar settings' }));
    expect(onSave).toHaveBeenCalledWith([{
      id: 'calendar-source-123e4567-e89b-42d3-a456-426614174000',
      name: 'Work',
      url
    }]);
  });

  it('validates a source and keeps failed settings available for retry', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn()
      .mockReturnValueOnce('Preview storage is unavailable.')
      .mockReturnValueOnce(null);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('123e4567-e89b-42d3-a456-426614174001');
    render(<CalendarSettings sources={[]} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Add calendar' }));
    await user.type(screen.getByLabelText('Calendar name'), 'Personal');
    await user.type(screen.getByLabelText('Public iCloud calendar link'), 'http://example.com/private.ics');
    await user.click(screen.getByRole('button', { name: 'Save calendar' }));
    expect(screen.getByRole('alert').textContent).toContain('HTTPS or webcal');
    expect(onSave).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Public iCloud calendar link'));
    await user.type(screen.getByLabelText('Public iCloud calendar link'), 'https://p123-caldav.icloud.com/published/synthetic-token');
    await user.click(screen.getByRole('button', { name: 'Save calendar' }));
    await user.click(screen.getByRole('button', { name: 'Save calendar settings' }));
    expect(screen.getByRole('alert').textContent).toContain('Preview storage is unavailable.');
    expect(screen.getByText('Personal')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save calendar settings' }));
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('cancels staged additions and removals without persisting them', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_sources: CalendarSource[]) => null);
    const sources = [{
      id: 'calendar-source-existing',
      name: 'Work',
      url: 'https://p123-caldav.icloud.com/published/synthetic-token'
    }];
    render(<CalendarSettings sources={sources} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Remove Work' }));
    expect(screen.queryByText('Work')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Work')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('stages edits and explicit removals in the same settings save boundary', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_sources: CalendarSource[]) => null);
    const source = {
      id: 'calendar-source-existing',
      name: 'Work',
      url: 'https://p123-caldav.icloud.com/published/synthetic-token'
    };
    const { rerender } = render(<CalendarSettings sources={[source]} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Calendar name'));
    await user.type(screen.getByLabelText('Calendar name'), 'Home');
    await user.click(screen.getByRole('button', { name: 'Save calendar' }));
    expect(onSave).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save calendar settings' }));
    expect(onSave).toHaveBeenLastCalledWith([{
      ...source,
      name: 'Home'
    }]);

    rerender(<CalendarSettings sources={[{ ...source, name: 'Home' }]} onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: 'Remove Home' }));
    await user.click(screen.getByRole('button', { name: 'Save calendar settings' }));
    expect(onSave).toHaveBeenLastCalledWith([]);
  });
});
