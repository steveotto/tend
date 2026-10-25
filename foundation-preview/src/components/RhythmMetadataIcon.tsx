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
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 4v16h16" />
      <path d="M8 16v-4M12 16V7M16 16V9M20 16v-3" />
    </svg>
  );
}
