/**
 * Isotipo de Vibemenu. Geometria tomada de src/assets/1b/isotype.svg.
 *
 * Dos variantes:
 *  - `color`: azul de marca + tinta. Para fondos claros de Vibemenu.
 *  - `mono`:  todo en `currentColor`. Es la que va en los menus de los tenants,
 *    donde el fondo puede ser crema o negro. El SVG original traia el color fijo
 *    en #0B0B0F y habria sido invisible sobre el formato TikTok.
 *
 * Las cuatro formas son los cuatro formatos. El rombo rompe la rejilla a
 * proposito: es el "elige el tuyo".
 */
export default function Isotipo({
  className,
  mono = false,
}: {
  className?: string;
  mono?: boolean;
}) {
  const azul = mono ? "currentColor" : "#2B4EFF";
  const tinta = mono ? "currentColor" : "#0B0B0F";

  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Vibemenu">
      <rect x="8" y="8" width="38" height="38" rx="8" fill={azul} />
      <rect x="54" y="8" width="38" height="38" rx="8" fill={tinta} />
      <rect
        x="8"
        y="54"
        width="38"
        height="38"
        rx="8"
        fill="none"
        stroke={tinta}
        strokeWidth="4.5"
      />
      <rect
        x="60"
        y="60"
        width="26"
        height="26"
        rx="6"
        fill={azul}
        opacity="0.55"
        transform="rotate(45 73 73)"
      />
    </svg>
  );
}
