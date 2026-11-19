export type FitnessSessionResumeBannerProps = {
  ariaLabel: string;
  sessionName: string;
  status: string;
  onResume: (button: HTMLButtonElement) => void;
};

export function FitnessSessionResumeBanner({
  ariaLabel,
  sessionName,
  status,
  onResume
}: FitnessSessionResumeBannerProps) {
  return (
    <aside className="strength-guided-banner fitness-session-resume-banner" aria-label={ariaLabel}>
      <div className="fitness-session-resume-banner__copy">
        <strong className="fitness-session-resume-banner__title">{sessionName}</strong>
        <span className="fitness-session-resume-banner__status">{status}</span>
        <span className="fitness-session-resume-banner__support">Pick up where you left off.</span>
      </div>
      <button
        type="button"
        className="btn mini fitness-session-resume-banner__action"
        onClick={event => onResume(event.currentTarget)}
      >
        Resume
      </button>
    </aside>
  );
}
