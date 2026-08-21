/** ID de metricas GA4 del sitio, creado en analytics.google.com. */
export const GA_MEASUREMENT_ID = "G-84887GV178";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * gtag('config', ...) ya manda el page_view inicial al cargar el sitio. Esta
 * funcion cubre las navegaciones siguientes, que en una SPA no recargan la
 * pagina y por lo tanto GA no las ve solo.
 */
export function trackPageView(path: string) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}
