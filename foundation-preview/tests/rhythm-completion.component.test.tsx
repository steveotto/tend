import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { RhythmCompletionDialog } from '../src/components/RhythmCompletionDialog.tsx';
import { RhythmCompletionForm } from '../src/components/RhythmCompletionForm.tsx';
import { TimeDial } from '../src/components/TimeDial.tsx';
import { localDateString } from '../src/domain/money-goals.ts';
import { todayRhythms } from '../src/domain/preview-data.ts';
import type { RhythmCompletionRecord } from '../src/domain/rhythm-completion.ts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const rhythm = todayRhythms.find(item => item.id === 'sample-pray-together')!;

function PeriodDialHarness({ initial }: { initial: 'AM' | 'PM' }) {
  const [period, setPeriod] = useState(initial);
  return (
    <TimeDial
      label="AM / PM"
      values={['AM', 'PM'] as const}
      value={period}
      formatValue={value => value}
      onChange={setPeriod}
    />
  );
}

describe('Rhythm completion controls', () => {
  it('ignores restored initial scroll offsets before supporting keyboard and scroll selection', async () => {
    const onChange = vi.fn();
    render(
      <TimeDial
        label="Minute"
        values={Array.from({ length: 60 }, (_, index) => index)}
        value={7}
        formatValue={value => String(value).padStart(2, '0')}
        onChange={onChange}
      />
    );
    const dial = screen.getByRole('spinbutton', { name: 'Minute' });
    expect(dial.getAttribute('aria-valuenow')).toBe('7');
    expect(dial.scrollTop).toBe(7 * 40);
    fireEvent.scroll(dial, { target: { scrollTop: 40 } });
    expect(onChange).not.toHaveBeenCalled();
    await new Promise<void>(resolve => {
      if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(() => resolve());
      else window.setTimeout(resolve, 0);
    });
    expect(dial.scrollTop).toBe(7 * 40);
    dial.focus();
    fireEvent.keyDown(dial, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(8);
    fireEvent.keyDown(dial, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(dial, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(59);
    fireEvent.scroll(dial, { target: { scrollTop: 4 * 40 } });
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it.each(['AM', 'PM'] as const)('centers the initial %s value and keeps click and keyboard selection synchronized', async initial => {
    render(<PeriodDialHarness initial={initial} />);
    const dial = screen.getByRole('spinbutton', { name: 'AM / PM' });
    const selectedIndex = initial === 'AM' ? 0 : 1;
    await new Promise<void>(resolve => {
      if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(() => resolve());
      else window.setTimeout(resolve, 0);
    });
    expect(dial.scrollTop).toBe(selectedIndex * 40);
    expect(dial.getAttribute('aria-valuetext')).toBe(initial);
    expect(dial.querySelectorAll('.time-dial__value.is-selected')[0]?.textContent).toBe(initial);

    const other = initial === 'AM' ? 'PM' : 'AM';
    fireEvent.click(screen.getByText(other));
    expect(dial.getAttribute('aria-valuetext')).toBe(other);
    expect(dial.scrollTop).toBe((other === 'AM' ? 0 : 1) * 40);
    expect(dial.querySelectorAll('.time-dial__value.is-selected')[0]?.textContent).toBe(other);

    dial.focus();
    fireEvent.keyDown(dial, { key: other === 'AM' ? 'Home' : 'End' });
    expect(dial.getAttribute('aria-valuetext')).toBe(other);
  });

  it('defaults to the current local date and time and keeps the draft stable while editing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T00:07:00.000Z'));
    render(<RhythmCompletionForm rhythm={rhythm} onSave={() => null} onCancel={() => undefined} />);

    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'When did you tend it?' }));
    expect(document.activeElement).not.toBe(screen.getByLabelText('Date'));
    const date = screen.getByLabelText('Date') as HTMLInputElement;
    expect(date.value).toBe(localDateString(new Date()));
    const hour = screen.getByRole('spinbutton', { name: 'Hour' });
    const minute = screen.getByRole('spinbutton', { name: 'Minute' });
    const period = screen.getByRole('spinbutton', { name: 'AM / PM' });
    expect(hour.getAttribute('aria-valuetext')).toBe(String(new Date().getHours() % 12 || 12));
    expect(minute.getAttribute('aria-valuetext')).toBe(String(new Date().getMinutes()).padStart(2, '0'));
    expect(period.getAttribute('aria-valuetext')).toBe(new Date().getHours() < 12 ? 'AM' : 'PM');

    fireEvent.change(date, { target: { value: '2026-10-31' } });
    minute.focus();
    fireEvent.keyDown(minute, { key: 'ArrowUp' });
    expect(date.value).toBe('2026-10-31');
    expect(screen.getByLabelText(/Notes/)).toBeTruthy();
  });

  it('saves the visible AM/PM choice and reopens an existing PM note in sync for editing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 8, 7));
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const onSave = vi.fn<(record: RhythmCompletionRecord) => string | null>(() => null);
    const onCancel = vi.fn();
    const { unmount } = render(
      <RhythmCompletionForm rhythm={rhythm} onSave={onSave} onCancel={onCancel} />
    );
    const periodDial = screen.getByRole('spinbutton', { name: 'AM / PM' });
    expect(periodDial.getAttribute('aria-valuetext')).toBe('AM');
    expect(periodDial.scrollTop).toBe(0);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: localDateString(yesterday) } });
    fireEvent.click(screen.getByText('PM'));
    expect(periodDial.getAttribute('aria-valuetext')).toBe('PM');
    expect(periodDial.scrollTop).toBe(40);
    fireEvent.change(screen.getByLabelText(/Notes/), {
      target: { value: 'An existing note.\nSecond line.' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      localTime: '20:07',
      memory: 'An existing note.\nSecond line.'
    });
    const createdRecord = onSave.mock.calls[0]?.[0];
    expect(createdRecord).toBeTruthy();

    unmount();
    const editSave = vi.fn<(record: RhythmCompletionRecord) => string | null>(() => null);
    render(
      <RhythmCompletionForm
        rhythm={rhythm}
        initialRecord={createdRecord!}
        onSave={editSave}
        onCancel={() => undefined}
      />
    );
    const editedPeriodDial = screen.getByRole('spinbutton', { name: 'AM / PM' });
    expect(editedPeriodDial.getAttribute('aria-valuetext')).toBe('PM');
    expect(editedPeriodDial.scrollTop).toBe(40);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Edit logged moment' }));
    expect(screen.getByLabelText(/Notes/)).toHaveProperty('value', 'An existing note.\nSecond line.');
    fireEvent.click(screen.getByText('AM'));
    expect(editedPeriodDial.getAttribute('aria-valuetext')).toBe('AM');
    expect(editedPeriodDial.scrollTop).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(editSave.mock.calls[0]?.[0]).toMatchObject({
      id: createdRecord!.id,
      rhythmId: createdRecord!.rhythmId,
      localTime: '08:07',
      recordedAt: createdRecord!.recordedAt,
      memory: 'An existing note.\nSecond line.'
    });
  });

  it('submits one backdated record with optional memory and prevents repeated submission', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T12:34:00.000Z'));
    const onSave = vi.fn<(record: RhythmCompletionRecord) => string | null>(() => null);
    const onCancel = vi.fn();
    const { container } = render(<RhythmCompletionForm rhythm={rhythm} onSave={onSave} onCancel={onCancel} />);
    const form = container.querySelector('form')!;
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-31' } });
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: 'A good conversation.' } });
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(onSave).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0]![0]).toMatchObject({
      rhythmId: rhythm.id,
      effectiveDate: '2026-10-31',
      memory: 'A good conversation.',
      recordedAt: '2026-11-01T12:34:00.000Z',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  });

  it('rejects a future selected time without saving and supports cancel', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T10:30:00.000Z'));
    const onSave = vi.fn(() => null);
    const onCancel = vi.fn();
    render(<RhythmCompletionForm rhythm={rhythm} onSave={onSave} onCancel={onCancel} />);
    const minuteDial = screen.getByRole('spinbutton', { name: 'Minute' });
    minuteDial.focus();
    fireEvent.keyDown(minuteDial, { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Choose a time that is not in the future.');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('provides an accessible Close action in the shared dialog shell', () => {
    const onClose = vi.fn();
    render(
      <RhythmCompletionDialog
        rhythm={rhythm}
        onSave={() => null}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close completion' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
