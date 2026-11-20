import { SettingsSwitch } from './SettingsSwitch.tsx';

export function PrayerSettings({
  enabled,
  onChange
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="prayer-settings">
      <div className="prayer-settings__row">
        <div className="prayer-settings__copy">
          <span className="prayer-settings__label">Prayer</span>
          <span className="prayer-settings__description">
            Show prayer features and include Prayer in Person Health.
          </span>
        </div>
        <SettingsSwitch label="Prayer" checked={enabled} onChange={onChange} />
      </div>
    </div>
  );
}
