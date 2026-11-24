export function SettingsSwitch({
  label,
  checked,
  onChange,
  variant = 'switch'
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  variant?: 'switch' | 'row';
}) {
  return (
    <label className={`settings-switch${variant === 'row' ? ' settings-switch--row' : ''}`}>
      {variant === 'row'
        ? <span className="settings-switch__label">{label}</span>
        : <span className="visually-hidden">Enable {label}</span>}
      <input
        type="checkbox"
        {...(variant === 'switch' ? { role: 'switch' as const } : {})}
        aria-label={label}
        checked={checked}
        onChange={event => onChange(event.currentTarget.checked)}
      />
    </label>
  );
}
