import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';

export type StyledSelectOption<Value extends string> = {
  value: Value;
  label: string;
  description?: string;
  group?: string;
  disabled?: boolean;
};

type StyledSelectProps<Value extends string> = {
  id?: string;
  label: string;
  options: readonly StyledSelectOption<Value>[];
  value: Value | '';
  placeholder?: string;
  describedBy?: string | undefined;
  invalid?: boolean | undefined;
  disabled?: boolean | undefined;
  containerClassName?: string | undefined;
  triggerClassName?: string | undefined;
  triggerAriaLabel?: string | undefined;
  sizeTriggerToOptions?: boolean | undefined;
  popoverMinWidth?: number | undefined;
  onChange: (value: Value) => void;
};

type PopoverPosition = CSSProperties & {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

export function StyledSelect<Value extends string>({
  id: providedId,
  label,
  options,
  value,
  placeholder = 'Choose…',
  describedBy,
  invalid = false,
  disabled = false,
  containerClassName,
  triggerClassName,
  triggerAriaLabel,
  sizeTriggerToOptions = false,
  popoverMinWidth = 280,
  onChange
}: StyledSelectProps<Value>) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const typeaheadRef = useRef('');
  const typeaheadTimerRef = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<PopoverPosition>();
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));
  const selectedOption = options.find(option => option.value === value);
  const optionGroups: Array<{ label: string; options: Array<{ option: StyledSelectOption<Value>; index: number }> }> = [];
  options.forEach((option, index) => {
    const label = option.group ?? '';
    let group = optionGroups[optionGroups.length - 1];
    if (!group || group.label !== label) {
      group = { label, options: [] };
      optionGroups.push(group);
    }
    group.options.push({ option, index });
  });
  const firstEnabledIndex = options.findIndex(option => !option.disabled);
  let lastEnabledIndex = -1;
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!options[index]?.disabled) {
      lastEnabledIndex = index;
      break;
    }
  }

  function updatePosition() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportPadding = 12;
    const minPopoverWidth = Math.min(popoverMinWidth, window.innerWidth - viewportPadding * 2);
    const width = Math.min(
      Math.max(rect.width, minPopoverWidth),
      window.innerWidth - viewportPadding * 2
    );
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - width - viewportPadding
    );
    const roomBelow = window.innerHeight - rect.bottom - viewportPadding;
    const roomAbove = rect.top - viewportPadding;
    const placeAbove = roomBelow < Math.min(240, roomAbove) && roomAbove > roomBelow;
    const maxHeight = Math.max(100, Math.min(280, placeAbove ? roomAbove : roomBelow));
    setPosition({
      position: 'fixed',
      left,
      top: placeAbove ? Math.max(viewportPadding, rect.top - maxHeight - 6) : rect.bottom + 6,
      width,
      maxHeight,
      zIndex: 10000
    });
  }

  function focusOption(index: number, direction: 1 | -1 = 1) {
    let next = (index + options.length) % options.length;
    for (let attempt = 0; options[next]?.disabled && attempt < options.length; attempt += 1) {
      next = (next + direction + options.length) % options.length;
    }
    if (options[next]?.disabled) return;
    setActiveIndex(next);
    optionRefs.current[next]?.focus();
  }

  function openMenu(index = selectedIndex, direction: 1 | -1 = 1) {
    if (disabled || firstEnabledIndex < 0) return;
    let next = (index + options.length) % options.length;
    for (let attempt = 0; options[next]?.disabled && attempt < options.length; attempt += 1) {
      next = (next + direction + options.length) % options.length;
    }
    if (options[next]?.disabled) return;
    setActiveIndex(next);
    updatePosition();
    setOpen(true);
  }

  function closeMenu(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }

  function selectOption(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    closeMenu();
  }

  function focusNextFromTrigger(backwards: boolean) {
    const dialog = triggerRef.current?.closest('dialog');
    if (!dialog || !triggerRef.current) {
      closeMenu(false);
      return;
    }
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [tabindex="0"]'
    )).filter(element => !element.closest('[role="listbox"]')
      && !element.closest('details:not([open])')
      && !element.closest('[hidden]'));
    const currentIndex = focusable.indexOf(triggerRef.current);
    const destination = focusable[currentIndex + (backwards ? -1 : 1)];
    closeMenu(false);
    destination?.focus();
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusOption(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusOption(activeIndex - 1, -1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusOption(firstEnabledIndex);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusOption(lastEnabledIndex, -1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectOption(activeIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      focusNextFromTrigger(event.shiftKey);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      typeaheadRef.current += event.key.toLocaleLowerCase();
      window.clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = window.setTimeout(() => {
        typeaheadRef.current = '';
      }, 700);
      const startIndex = (activeIndex + 1) % options.length;
      const matchingOffset = [...options.slice(startIndex), ...options.slice(0, startIndex)]
        .findIndex(option => !option.disabled && option.label.toLocaleLowerCase().startsWith(typeaheadRef.current));
      if (matchingOffset >= 0) {
        event.preventDefault();
        focusOption((startIndex + matchingOffset) % options.length);
      }
    }
  }

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.focus();
    const reposition = () => updatePosition();
    const dismissOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) closeMenu(false);
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('pointerdown', dismissOutside);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('pointerdown', dismissOutside);
    };
  }, [activeIndex, open]);

  useEffect(() => () => window.clearTimeout(typeaheadTimerRef.current), []);

  return (
    <div className={['rhythm-select', containerClassName].filter(Boolean).join(' ')} ref={containerRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={['rhythm-select__trigger', sizeTriggerToOptions && 'rhythm-select__trigger--size-to-options', triggerClassName]
          .filter(Boolean)
          .join(' ')}
        disabled={disabled}
        role="combobox"
        aria-label={triggerAriaLabel ?? `${label}: ${selectedOption?.label ?? placeholder}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => open ? closeMenu(false) : openMenu()}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            openMenu(selectedIndex);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            openMenu(selectedIndex - 1);
          } else if (event.key === 'Home') {
            event.preventDefault();
            openMenu(0, 1);
          } else if (event.key === 'End') {
            event.preventDefault();
            openMenu(options.length - 1, -1);
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openMenu();
          } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            const query = event.key.toLocaleLowerCase();
            const matchingIndex = options.findIndex(option => !option.disabled && option.label.toLocaleLowerCase().startsWith(query));
            openMenu(matchingIndex < 0 ? selectedIndex : matchingIndex);
            typeaheadRef.current = query;
            window.clearTimeout(typeaheadTimerRef.current);
            typeaheadTimerRef.current = window.setTimeout(() => {
              typeaheadRef.current = '';
            }, 700);
          }
        }}
      >
        <span>{selectedOption?.label ?? placeholder}</span>
        {sizeTriggerToOptions && (
          <span className="rhythm-select__trigger-sizer" aria-hidden="true">
            {options.map(option => <span key={option.value}>{option.label}</span>)}
          </span>
        )}
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </button>
      {open && position && (
        <div
          id={`${id}-listbox`}
          className="rhythm-select__popover"
          role="listbox"
          aria-label={label}
          style={position}
          onKeyDown={handleOptionKeyDown}
        >
          {optionGroups.map(group => {
            const choices = group.options.map(({ option, index }) => (
              <div
                key={option.value}
                ref={element => { optionRefs.current[index] = element; }}
                className="rhythm-select__option"
                role="option"
                aria-selected={value === option.value}
                aria-disabled={option.disabled ? true : false}
                tabIndex={-1}
                onFocus={() => setActiveIndex(index)}
                onClick={() => selectOption(index)}
              >
                <span className="rhythm-select__option-copy">
                  <span>{option.label}</span>
                  {option.description && <small>{option.description}</small>}
                </span>
                {value === option.value && (
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="m4 10 4 4 8-8" />
                  </svg>
                )}
              </div>
            ));
            return group.label
              ? (
                <div key={group.label} className="rhythm-select__group" role="group" aria-label={group.label}>
                  <span className="rhythm-select__group-label" aria-hidden="true">{group.label}</span>
                  {choices}
                </div>
              )
              : choices;
          })}
        </div>
      )}
    </div>
  );
}
