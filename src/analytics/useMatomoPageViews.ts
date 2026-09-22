import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from './matomo';

/** Sends one Matomo page view per route change, including the initial one. */
export function useMatomoPageViews() {
  const { pathname, search } = useLocation();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const path = pathname + search;
    if (previous.current === path) return;
    trackPageView(path, previous.current);
    previous.current = path;
  }, [pathname, search]);
}
