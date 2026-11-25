import { useCallback, useEffect, useState } from 'react';

/** Refresh date-sensitive UI without persisting a clock value. */
export function useCurrentInstantController(): {
  instant: Date;
  refresh: (at?: Date) => void;
} {
  const [instant, setInstant] = useState(() => new Date(Date.now()));
  const refresh = useCallback((at?: Date) => {
    setInstant(at ? new Date(at.getTime()) : new Date(Date.now()));
  }, []);
  const refreshFromClock = useCallback(() => refresh(), [refresh]);

  useEffect(() => {
    const timer = window.setInterval(refreshFromClock, 60_000);
    window.addEventListener('focus', refreshFromClock);
    document.addEventListener('visibilitychange', refreshFromClock);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshFromClock);
      document.removeEventListener('visibilitychange', refreshFromClock);
    };
  }, [refreshFromClock]);

  return { instant, refresh };
}

export function useCurrentInstant(): Date {
  return useCurrentInstantController().instant;
}
