/**
 * Lightweight fire-and-forget analytics helper.
 *
 * Priority:
 *  1. window.umami.track  — Umami (already loaded via index.html)
 *  2. window.gtag         — Google Analytics (if ever added)
 *  3. silent no-op        — analytics not configured, never throws
 *
 * Usage:
 *   trackEvent('pitchmirror_cta_click', { location: 'homepage_strip' })
 */

declare global {
  interface Window {
    // Umami custom event API
    umami?: {
      track: (eventName: string, eventData?: Record<string, unknown>) => void;
    };
    // Google Analytics gtag API
    gtag?: (
      command: "event",
      eventName: string,
      params?: Record<string, unknown>
    ) => void;
  }
}

export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>
): void {
  try {
    if (typeof window === "undefined") return;

    if (typeof window.umami?.track === "function") {
      window.umami.track(eventName, params);
      return;
    }

    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, params);
      return;
    }

    // No analytics configured — silent no-op
  } catch {
    // Never let analytics errors affect the user experience
  }
}
