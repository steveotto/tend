import type { ChangeEvent } from 'react';

export type NumericControlProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
  onStep: (direction: -1 | 1) => void;
  decreaseLabel: string;
  increaseLabel: string;
  groupLabel?: string;
  min?: number;
  max?: number;
  step?: number | 'any';
  inputMode?: 'decimal' | 'numeric';
  placeholder?: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  inputClassName?: string;
  stepperClassName?: string;
};

export function NumericControl({
  id,
  label,
  value,
  onChange,
  onStep,
  decreaseLabel,
  increaseLabel,
  groupLabel = `${label} controls`,
  min,
  max,
  step,
  inputMode = 'decimal',
  placeholder,
  required = false,
  invalid = false,
  describedBy,
  className = '',
  inputClassName = '',
  stepperClassName = ''
}: NumericControlProps) {
  return (
    <div className={`numeric-control ${className}`.trim()} role="group" aria-label={groupLabel}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={`numeric-control__input ${inputClassName}`.trim()}
        type="number"
        inputMode={inputMode}
        {...(min === undefined ? {} : { min })}
        {...(max === undefined ? {} : { max })}
        {...(step === undefined ? {} : { step })}
        {...(placeholder === undefined ? {} : { placeholder })}
        {...(describedBy === undefined ? {} : { 'aria-describedby': describedBy })}
        aria-invalid={invalid || undefined}
        required={required}
        value={value}
        onChange={event => onChange(event.currentTarget.value, event)}
      />
      <div className={`numeric-control__steppers ${stepperClassName}`.trim()}>
        <button type="button" aria-label={decreaseLabel} onClick={() => onStep(-1)}>−</button>
        <button type="button" aria-label={increaseLabel} onClick={() => onStep(1)}>+</button>
      </div>
    </div>
  );
}
