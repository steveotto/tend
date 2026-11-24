export function CompletionNotesField({
  id,
  value,
  error,
  onChange
}: {
  id: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <label className="rhythm-completion-form__memory-label" htmlFor={id}>
        Notes <span>Optional</span>
      </label>
      <textarea
        id={id}
        value={value}
        maxLength={1000}
        rows={3}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={event => onChange(event.currentTarget.value)}
      />
      {error && <p id={`${id}-error`} className="rhythm-completion-form__error">{error}</p>}
    </>
  );
}
