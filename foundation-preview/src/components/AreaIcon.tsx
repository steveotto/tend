import { areas } from '../domain/preview-data.ts';

export function AreaIcon({ id }: { id: (typeof areas)[number]['id'] }) {
  const shared = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (id === 'faith') return <svg viewBox="0 0 24 24" {...shared}><path d="M12 4v16M7 9h10" /></svg>;
  if (id === 'marriage') return <svg viewBox="0 0 24 24" {...shared}><path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z" /></svg>;
  if (id === 'parenting') return <svg viewBox="0 0 24 24" {...shared}><path d="M4 11l8-7 8 7v9h-6v-6h-4v6H4z" /></svg>;
  if (id === 'health') return <svg viewBox="0 0 24 24" {...shared}><path d="M3 12h4l2-5 4 10 2-5h6" /></svg>;
  if (id === 'finances') return <svg viewBox="0 0 24 24" {...shared}><circle cx="12" cy="12" r="8" /><path d="M12 7.5v9M14.8 9.6c-.6-.8-1.6-1.1-2.8-1.1-1.6 0-2.7.7-2.7 1.9 0 2.5 5.6 1.3 5.6 3.8 0 1.2-1.2 1.9-2.9 1.9-1.3 0-2.4-.4-3-1.2" /></svg>;
  return <svg viewBox="0 0 24 24" {...shared}><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M17 7.1a2.4 2.4 0 0 1 0 4.8M16.2 15.6a4.6 4.6 0 0 1 4.3 3.9" /></svg>;
}
