import Isotipo from "@/components/marca/Isotipo";
import { MARCA_AGUA } from "@/lib/copy";

/**
 * Solo aparece si el plan del tenant tiene `marca_agua = true` (hoy, solo Free).
 * El valor sale de la tabla `planes`, nunca de una constante en el componente.
 *
 * Usa el isotipo en modo `mono`, que hereda `currentColor`. El watermark.svg de
 * assets trae el color fijo en #0B0B0F: sobre el formato TikTok, que es negro,
 * habria quedado invisible.
 */
export default function MarcaAgua({ flotante = false }: { flotante?: boolean }) {
  if (flotante) {
    return (
      <p className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-1.5 text-[11px] text-white/60">
        <Isotipo className="size-3.5" mono />
        {MARCA_AGUA}
      </p>
    );
  }

  return (
    <p
      className="flex items-center justify-center gap-1.5 py-6 text-[11px]"
      style={{ color: "var(--menu-texto-suave)" }}
    >
      <Isotipo className="size-3.5" mono />
      {MARCA_AGUA}
    </p>
  );
}
