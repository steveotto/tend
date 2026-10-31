import { useEffect, useState } from 'react';

/** Refresh date-sensitive derived scores without persisting a clock or score. */
export function useScoringInstant(): Date {
  const [instant, setInstant] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setInstant(new Date());
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
