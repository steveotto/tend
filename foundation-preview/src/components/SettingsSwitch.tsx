export function SettingsSwitch({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="settings-switch">
      <span className="visually-hidden">Enable {label}</span>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        onChange={event => onChange(event.currentTarget.checked)}
      />
    </label>
  );
}
