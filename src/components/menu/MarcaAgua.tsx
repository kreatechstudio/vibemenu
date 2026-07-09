import { MARCA_AGUA } from "@/lib/copy";

/**
 * Solo aparece si el plan del tenant tiene `marca_agua = true` (hoy, solo Free).
 * El valor sale de la tabla `planes`, nunca de una constante en el componente.
 *
 * Va al pie, discreta, sin estorbar el contenido. En TikTok flota sobre el video.
 */
export default function MarcaAgua({ flotante = false }: { flotante?: boolean }) {
  return (
    <p
      className={
        flotante
          ? "pointer-events-none absolute inset-x-0 bottom-3 z-20 text-center text-[11px] text-white/60"
          : "py-6 text-center text-[11px]"
      }
      style={flotante ? undefined : { color: "var(--menu-texto-suave)" }}
    >
      {MARCA_AGUA}
    </p>
  );
}
