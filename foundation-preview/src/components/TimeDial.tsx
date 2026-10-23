import { useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';

const rowHeight = 40;

export function TimeDial<Value extends string | number>({
  label,
  values,
  value,
  formatValue,
  onChange
}: {
  label: string;
  values: readonly Value[];
  value: Value;
  formatValue: (value: Value) => string;
  onChange: (value: Value) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const selectedIndex = Math.max(0, values.indexOf(value));
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const minimum = typeof values[0] === 'number' ? values[0] : 1;
  const maximum = typeof values.at(-1) === 'number' ? Number(values.at(-1)) : values.length;
  const current = typeof value === 'number' ? value : selectedIndex + 1;

  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    viewport.scrollTop = selectedIndex * rowHeight;
    if (initializedRef.current) return;

    const initialize = () => {
      if (scrollRef.current) scrollRef.current.scrollTop = selectedIndexRef.current * rowHeight;
      initializedRef.current = true;
    };
    const usesAnimationFrame = typeof window.requestAnimationFrame === 'function';
    const frame = usesAnimationFrame
      ? window.requestAnimationFrame(initialize)
      : window.setTimeout(initialize, 0);

    return () => {
      if (usesAnimationFrame) window.cancelAnimationFrame(frame);
      else window.clearTimeout(frame);
    };
  }, [selectedIndex]);

  function moveTo(index: number) {
    const boundedIndex = Math.max(0, Math.min(values.length - 1, index));
    const next = values[boundedIndex];
    if (next !== undefined) onChange(next);
    if (scrollRef.current) scrollRef.current.scrollTop = boundedIndex * rowHeight;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveTo(selectedIndex + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveTo(values.length - 1);
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      moveTo(selectedIndex + (event.key === 'PageDown' ? 5 : -5));
    }
  }

  return (
    <div className="time-dial">
      <span className="time-dial__label" id={`time-dial-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`}>
        {label}
      </span>
      <div
        ref={scrollRef}
        className="time-dial__viewport"
        role="spinbutton"
        aria-labelledby={`time-dial-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`}
        aria-valuemin={minimum}
        aria-valuemax={maximum}
        aria-valuenow={current}
        aria-valuetext={formatValue(value)}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onScroll={event => {
          if (!initializedRef.current) return;
          const nextIndex = Math.max(0, Math.min(values.length - 1,
            Math.round(event.currentTarget.scrollTop / rowHeight)));
          if (values[nextIndex] !== undefined && nextIndex !== selectedIndex) {
            onChange(values[nextIndex]!);
          }
        }}
      >
        <div className="time-dial__selection" aria-hidden="true" />
        <div className="time-dial__spacer" aria-hidden="true" />
        {values.map((option, index) => (
          <span
            key={String(option)}
            className={`time-dial__value${index === selectedIndex ? ' is-selected' : ''}`}
            aria-hidden="true"
            onClick={() => moveTo(index)}
          >
            {formatValue(option)}
          </span>
        ))}
        <div className="time-dial__spacer" aria-hidden="true" />
      </div>
    </div>
  );
}
