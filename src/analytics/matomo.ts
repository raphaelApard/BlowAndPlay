/**
 * Matomo page tracking for the single-page app.
 *
 * The tracker itself is bootstrapped in `index.html`; it only registers the
 * queue and loads `matomo.js`. Because React Router never reloads the
 * document, each route change has to be reported by hand.
 */

type MatomoQueue = unknown[][];

declare global {
  interface Window {
    _paq?: MatomoQueue;
  }
}

/** Pushes a command onto the Matomo queue, a no-op when the tracker is absent. */
function push(command: unknown[]) {
  window._paq?.push(command);
}

/**
 * Reports a page view for the given path.
 *
 * `setReferrerUrl` keeps the in-app navigation chain readable in Matomo:
 * without it every view after the first looks like a direct entry.
 */
export function trackPageView(path: string, previousPath: string | null) {
  if (previousPath) push(['setReferrerUrl', window.location.origin + previousPath]);
  push(['setCustomUrl', window.location.origin + path]);
  push(['setDocumentTitle', document.title]);
  push(['trackPageView']);
  push(['enableLinkTracking']);
}
