import { useEffect, useState } from 'react';

/** Refresh date-sensitive UI without persisting a clock value. */
export function useCurrentInstant(): Date {
  const [instant, setInstant] = useState(() => new Date(Date.now()));
  useEffect(() => {
    const refresh = () => setInstant(new Date(Date.now()));
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return instant;
}
