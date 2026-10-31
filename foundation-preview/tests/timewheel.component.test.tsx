import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

type TimeWheelInstance = {
  getValue: () => string;
  refresh: () => void;
  destroy: () => void;
};

declare global {
  interface Window {
    TimeWheelPicker: {
      mount: (
        root: HTMLElement,
        options: { value: string; onChange?: (value: string) => void }
      ) => TimeWheelInstance;
    };
  }
}

const source = readFileSync(resolve(process.cwd(), '..', 'app-timewheel.js'), 'utf8');

beforeAll(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true });
  window.eval(source);
});

describe('shared time wheel minute shortcuts', () => {
  let host: HTMLDivElement;
  let picker: TimeWheelInstance;

  function mount(value: string) {
    host = document.createElement('div');
    document.body.append(host);
    picker = window.TimeWheelPicker.mount(host, { value });
    prepareMinuteWheel();
    picker.refresh();
  }

  function prepareMinuteWheel() {
    const wheel = host.querySelector<HTMLElement>('[data-wheel="minute"]')!;
    const viewport = wheel.parentElement!;
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 210 });
    viewport.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, right: 100, bottom: 210, left: 0, width: 100, height: 210,
      toJSON: () => ({})
    });
    Object.defineProperty(wheel, 'scrollTo', {
      configurable: true,
      value: ({ top }: ScrollToOptions) => {
        wheel.scrollTop = top ?? 0;
        wheel.dispatchEvent(new Event('scroll'));
      }
    });
    wheel.querySelectorAll<HTMLElement>('.time-wheel-option').forEach((option, index) => {
      option.getBoundingClientRect = () => {
        const top = 84 + index * 42 - wheel.scrollTop;
        return {
          x: 0, y: top, top, right: 100, bottom: top + 42, left: 0, width: 100, height: 42,
          toJSON: () => ({})
        };
      };
    });
  }

  function shortcut(minute: number) {
    return host.querySelector<HTMLButtonElement>(`.time-wheel-shortcut[data-minute="${minute}"]`)!;
  }

  function settleMinute() {
    host.querySelector<HTMLElement>('[data-wheel="minute"]')!.dispatchEvent(new Event('scrollend'));
  }

  afterEach(() => {
    picker?.destroy();
    host?.remove();
    vi.useRealTimers();
  });

  it.each([
    ['00', 0],
    ['15', 15],
    ['30', 30],
    ['45', 45]
  ])('sets minute %s exactly without changing the hour or period', (label, minute) => {
    const time = minute === 0 ? '23:59' : minute === 15 ? '00:07' : minute === 30 ? '12:07' : '11:59';
    const onChange = vi.fn();
    host = document.createElement('div');
    document.body.append(host);
    picker = window.TimeWheelPicker.mount(host, { value: time, onChange });
    prepareMinuteWheel();
    picker.refresh();

    shortcut(minute).click();

    const expected = minute === 0 ? '23:00' : minute === 15 ? '00:15' : minute === 30 ? '12:30' : '11:45';
    expect(picker.getValue()).toBe(expected);
    expect(onChange).toHaveBeenLastCalledWith(expected);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-wheel="minute"]')?.getAttribute('aria-valuetext')).toBe(label);
    expect(shortcut(minute).getAttribute('aria-pressed')).toBe('true');
    settleMinute();
  });

  it('does not change time on open and selects no shortcut for a non-shortcut minute', () => {
    mount('08:28');

    expect(picker.getValue()).toBe('08:28');
    expect(host.querySelectorAll('.time-wheel-shortcut')).toHaveLength(4);
    expect([...host.querySelectorAll('.time-wheel-shortcut')].every(button =>
      button.getAttribute('aria-pressed') === 'false'
    )).toBe(true);
    expect(host.querySelectorAll('[data-wheel="minute"] .time-wheel-option')).toHaveLength(60);
  });

  it('synchronizes wheel and shortcut state and clears the state for a manual minute', () => {
    mount('00:00');
    expect(shortcut(0).getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('[data-wheel="minute"] .time-wheel-option[data-value="0"]')
      ?.getAttribute('data-selected')).toBe('true');

    shortcut(15).click();
    settleMinute();
    const wheel = host.querySelector<HTMLElement>('[data-wheel="minute"]')!;
    wheel.scrollTop = 27 * 42;
    wheel.dispatchEvent(new Event('scroll'));

    expect(picker.getValue()).toBe('00:27');
    expect(host.querySelectorAll('.time-wheel-shortcut[aria-pressed="true"]')).toHaveLength(0);
    expect(wheel.getAttribute('aria-valuetext')).toBe('27');
  });

  it('keeps the latest shortcut selected through repeated selection and stale snap events', () => {
    mount('12:04');
    shortcut(15).click();
    shortcut(45).click();

    const wheel = host.querySelector<HTMLElement>('[data-wheel="minute"]')!;
    wheel.scrollTop = 15 * 42;
    wheel.dispatchEvent(new Event('scrollend'));
    expect(picker.getValue()).toBe('12:45');
    expect(shortcut(45).getAttribute('aria-pressed')).toBe('true');

    picker.refresh();
    settleMinute();
    expect(picker.getValue()).toBe('12:45');
    expect(wheel.getAttribute('aria-valuetext')).toBe('45');
  });

  it('does not move focus programmatically or save beyond the existing change callback', () => {
    const onChange = vi.fn();
    host = document.createElement('div');
    document.body.append(host);
    picker = window.TimeWheelPicker.mount(host, { value: '00:28', onChange });
    prepareMinuteWheel();
    picker.refresh();

    shortcut(30).focus();
    shortcut(30).click();

    expect(document.activeElement).toBe(shortcut(30));
    expect(onChange).toHaveBeenCalledWith('00:30');
    expect(host.querySelector('[data-wheel="hour"]')?.getAttribute('aria-valuetext')).toBe('12');
    expect(host.querySelector('[data-wheel="period"]')?.getAttribute('aria-valuetext')).toBe('AM');
    settleMinute();
  });

  it('lets manual wheel keyboard selection replace a shortcut selection', () => {
    mount('00:00');
    shortcut(15).click();
    settleMinute();

    const wheel = host.querySelector<HTMLElement>('[data-wheel="minute"]')!;
    wheel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(picker.getValue()).toBe('00:16');
    expect(host.querySelectorAll('.time-wheel-shortcut[aria-pressed="true"]')).toHaveLength(0);
    expect(wheel.getAttribute('aria-valuetext')).toBe('16');
    settleMinute();
  });
});
