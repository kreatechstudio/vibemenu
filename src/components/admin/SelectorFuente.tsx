import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Lock } from "lucide-react";
import { CLAVES_FUENTE, FUENTES, type ClaveFuente } from "@/lib/fuentes";
import { cn } from "@/lib/utils";

/**
 * Selector de tipografia. Un desplegable, no una lista de doce filas siempre
 * abierta: en la pantalla de Diseno cada seccion compite por el mismo espacio.
 *
 * Un `<select>` nativo no sirve aqui. Chrome y Safari ignoran el `font-family`
 * de cada `<option>`, asi que el dueno del negocio elegiria a ciegas, leyendo
 * nombres en vez de viendo letras.
 */
export default function SelectorFuente({
  valor,
  permitidas,
  alElegir,
}: {
  valor: ClaveFuente;
  permitidas: ClaveFuente[];
  alElegir: (f: ClaveFuente) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;

    const alClic = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };

    document.addEventListener("mousedown", alClic);
    window.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alClic);
      window.removeEventListener("keydown", alTeclear);
    };
  }, [abierto]);

  const actual = FUENTES[valor];

  return (
    <div ref={caja} className="relative max-w-md">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        className="flex h-14 w-full items-center gap-3 rounded-lg border px-4 text-left hover:bg-vm-bg-soft"
      >
        <span
          className="min-w-0 flex-1 truncate text-xl text-vm-ink"
          style={{ fontFamily: actual.css }}
        >
          Flat White
        </span>
        <span className="hidden text-right sm:block">
          <span className="block text-xs font-medium text-vm-ink">{actual.nombre}</span>
          <span className="block text-[11px] text-vm-body">{actual.categoria}</span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-vm-body transition-transform",
            abierto && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {abierto && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute inset-x-0 z-30 mt-2 max-h-80 overflow-y-auto rounded-xl border bg-white py-1 shadow-vm-3"
          >
            {CLAVES_FUENTE.map((clave) => {
              const permitida = permitidas.includes(clave);
              const activa = clave === valor;
              const f = FUENTES[clave];

              return (
                <li key={clave} role="option" aria-selected={activa}>
                  <button
                    type="button"
                    disabled={!permitida}
                    onClick={() => {
                      alElegir(clave);
                      setAbierto(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left",
                      activa && "bg-vm-primary/5",
                      permitida ? "hover:bg-vm-bg-soft" : "cursor-not-allowed opacity-55",
                    )}
                  >
                    <span
                      className="min-w-0 flex-1 truncate text-lg text-vm-ink"
                      style={{ fontFamily: f.css }}
                    >
                      Flat White
                    </span>

                    <span className="hidden text-right sm:block">
                      <span className="block text-xs font-medium text-vm-ink">{f.nombre}</span>
                      <span className="block text-[11px] text-vm-body">{f.nota}</span>
                    </span>

                    {activa ? (
                      <Check className="size-4 shrink-0 text-vm-primary" aria-hidden />
                    ) : !permitida ? (
                      <Lock className="size-3.5 shrink-0 text-vm-body" aria-hidden />
                    ) : (
                      <span className="size-4 shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
