export function RhythmMetadataIcon({ kind }: { kind: 'back' | 'history' | 'edit' | 'delete' }) {
  if (kind === 'back') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M19 12H5M11 18l-6-6 6-6" />
      </svg>
    );
  }
  if (kind === 'edit') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m4 16.5-.8 4.3 4.3-.8L19.8 7.7a2.2 2.2 0 0 0-3.1-3.1L4 16.5Z" />
        <path d="m14.9 6.4 3.1 3.1" />
      </svg>
    );
  }
  if (kind === 'delete') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
      </svg>
    );
  }
  return (
    <svg className="rhythm-metadata-icon--history" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="13" width="4" height="7" rx="1" />
      <rect x="10" y="9" width="4" height="11" rx="1" />
      <rect x="16" y="5" width="4" height="15" rx="1" />
    </svg>
  );
}
