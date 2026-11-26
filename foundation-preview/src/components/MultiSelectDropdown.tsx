import { useEffect, useId, useRef, useState } from 'react';

export type MultiSelectOption<Value extends string> = {
  value: Value;
  label: string;
};

export type MultiSelectValue<Value extends string> = 'all' | readonly Value[];

export function MultiSelectDropdown<Value extends string>({
  label,
  allLabel,
  options,
  value,
  onChange
}: {
  label: string;
  allLabel: string;
  options: readonly MultiSelectOption<Value>[];
  value: MultiSelectValue<Value>;
  onChange: (value: MultiSelectValue<Value>) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedLabels = value === 'all'
    ? []
    : options.filter(option => value.includes(option.value)).map(option => option.label);
  const summary = value === 'all'
    ? allLabel
    : selectedLabels.length === 1 ? selectedLabels[0]! : `${selectedLabels.length} selected`;

  function toggleOption(optionValue: Value) {
    if (value === 'all') {
      onChange([optionValue]);
      return;
    }
    const next = value.includes(optionValue)
      ? value.filter(selected => selected !== optionValue)
      : [...value, optionValue];
    onChange(next.length > 0 ? next : 'all');
  }

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="all-items-filter">
      <span className="all-items-filter__label">{label}</span>
      <div
        ref={containerRef}
        className={`all-items-filter__dropdown${open ? ' all-items-filter__dropdown--open' : ''}`}
      >
        <button
          ref={triggerRef}
          type="button"
          className="all-items-filter__trigger"
          aria-label={`${label}: ${summary}`}
          aria-expanded={open}
          aria-controls={`${id}-options`}
          onClick={() => setOpen(current => !current)}
        >
          <span className="all-items-filter__value">{summary}</span>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m5 7.5 5 5 5-5" />
          </svg>
        </button>
        {open && (
          <div
            id={`${id}-options`}
            className="all-items-filter__menu"
            role="group"
            aria-label={`${label} options`}
          >
            <label className="all-items-filter__option">
              <input
                type="checkbox"
                checked={value === 'all'}
                onChange={() => onChange('all')}
              />
              <span>{allLabel}</span>
            </label>
            <div className="all-items-filter__divider" />
            {options.map(option => (
              <label key={option.value} className="all-items-filter__option">
                <input
                  type="checkbox"
                  checked={value !== 'all' && value.includes(option.value)}
                  onChange={() => toggleOption(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
