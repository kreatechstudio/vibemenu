import Isotipo from "@/components/marca/Isotipo";
import { cn } from "@/lib/utils";

/**
 * Lockup horizontal: isotipo + nombre.
 *
 * El nombre va como texto HTML, NO como <text> dentro del SVG. Los lockups de
 * src/assets llevan `font-family="Space Grotesk"` dentro del SVG, y un SVG usado
 * como <img> no puede cargar webfonts: "Vibemenu" saldria en Arial. Aqui la
 * fuente la resuelve la pagina, que ya la tiene cargada.
 */
export default function Logo({
  className,
  tamano = "md",
}: {
  className?: string;
  /** `sm` para la barra del panel, `md` para la navbar publica. */
  tamano?: "sm" | "md";
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Isotipo className={tamano === "sm" ? "size-5" : "size-6"} />
      <span
        className={cn(
          "font-display font-bold tracking-tight text-vm-ink",
          tamano === "sm" ? "text-base" : "text-lg",
        )}
      >
        Vibemenu
      </span>
    </span>
  );
}
