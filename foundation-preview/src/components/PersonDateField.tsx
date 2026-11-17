import { useState } from 'react';

export function PersonDateField({
  id,
  label,
  value,
  invalid,
  describedBy,
  onChange,
  min,
  max,
  required = false,
  showClearButton = true
}: {
  id: string;
  label: string;
  value: string;
  invalid?: boolean;
  describedBy?: string | undefined;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  showClearButton?: boolean;
}) {
  const [editingPartialDate, setEditingPartialDate] = useState(false);
  const partialDate = /^\d{2}-\d{2}$/.test(value);

  return (
    <div className={`person-date-field${value ? '' : ' person-date-field--empty'}`}>
      <input
        id={id}
        type={partialDate ? 'text' : 'date'}
        inputMode={partialDate ? 'numeric' : undefined}
        placeholder={partialDate ? 'MM-DD' : undefined}
        value={partialDate && !editingPartialDate ? formatPartialDate(value) : value}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        min={min}
        max={max}
        required={required || undefined}
        onFocus={() => setEditingPartialDate(true)}
        onBlur={() => setEditingPartialDate(false)}
        onChange={event => onChange(event.currentTarget.value)}
      />
      {showClearButton && value && (
        <button
          type="button"
          className="person-date-field__clear"
          aria-label={`Clear ${label.toLocaleLowerCase()}`}
          onClick={() => onChange('')}
        >
          Clear
        </button>
      )}
    </div>
  );
}

function formatPartialDate(monthDay: string): string {
  const [month, day] = monthDay.split('-').map(Number);
  return new Date(Date.UTC(2000, month! - 1, day!)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
}
