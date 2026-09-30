import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import type { SeleccionModificadores } from "@/lib/carrito";
import { precioMenu } from "@/lib/tema";
import type { ProductoConModificadores } from "@/hooks/useMenuPublico";

/** min real a exigir: `obligatorio` sin `min_selecciones` configurado igual pide 1. */
function minRequerido(grupo: ProductoConModificadores["grupos"][number]): number {
  if (!grupo.obligatorio) return 0;
  return Math.max(1, grupo.min_selecciones);
}

function grupoCompleto(
  grupo: ProductoConModificadores["grupos"][number],
  elegidas: string[],
): boolean {
  return elegidas.length >= minRequerido(grupo);
}

/**
 * Hoja para elegir los modificadores de un producto antes de agregarlo al
 * pedido. Cada confirmación agrega 1 unidad con esa selección exacta — repetir
 * con otra selección crea una línea aparte (`agregarProducto` en `carrito.ts`).
 *
 * "unica" siempre tiene `max_selecciones = 1` (ver admin); se pinta como
 * radio con toggle-off si el grupo no es obligatorio. "multiple" son
 * checkboxes, respetando `max_selecciones` si viene fijado.
 */
export default function HojaSeleccionModificadores({
  producto,
  alConfirmar,
  alCerrar,
}: {
  producto: ProductoConModificadores;
  alConfirmar: (seleccion: SeleccionModificadores) => void;
  alCerrar: () => void;
}) {
  const [seleccion, setSeleccion] = useState<SeleccionModificadores>({});
  const borde = "color-mix(in srgb, var(--menu-texto) 12%, transparent)";

  function elegirUnica(grupoId: string, opcionId: string) {
    setSeleccion((prev) => {
      const actual = prev[grupoId] ?? [];
      const yaElegida = actual[0] === opcionId;
      return { ...prev, [grupoId]: yaElegida ? [] : [opcionId] };
    });
  }

  function alternarMultiple(grupoId: string, opcionId: string, max: number | null) {
    setSeleccion((prev) => {
      const actual = prev[grupoId] ?? [];
      if (actual.includes(opcionId)) {
        return { ...prev, [grupoId]: actual.filter((id) => id !== opcionId) };
      }
      if (max !== null && actual.length >= max) return prev;
      return { ...prev, [grupoId]: [...actual, opcionId] };
    });
  }

  const listo = producto.grupos.every((g) => grupoCompleto(g, seleccion[g.id] ?? []));
  const extra = producto.grupos.reduce((suma, g) => {
    const elegidas = seleccion[g.id] ?? [];
    return (
      suma +
      g.opciones.filter((o) => elegidas.includes(o.id)).reduce((s, o) => s + o.precio_extra, 0)
    );
  }, 0);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={alCerrar}
    >
      <motion.article
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 32, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={producto.nombre}
        className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl shadow-vm-3 sm:max-h-[80vh] sm:rounded-2xl"
        style={{ background: "var(--menu-fondo)", color: "var(--menu-texto)" }}
      >
        <div
          className="flex items-center justify-between border-b p-4"
          style={{ borderColor: borde }}
        >
          <h2 className="text-base font-semibold">{producto.nombre}</h2>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            style={{ color: "var(--menu-texto-suave)" }}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {producto.grupos.map((g) => (
            <fieldset key={g.id} className="mb-5 last:mb-0">
              <legend className="mb-2 text-sm font-semibold">
                {g.nombre}
                {g.obligatorio ? (
                  <span style={{ color: "var(--menu-primario)" }}> · obligatorio</span>
                ) : (
                  <span style={{ color: "var(--menu-texto-suave)" }}> · opcional</span>
                )}
              </legend>
              <div className="space-y-1.5">
                {g.opciones.map((o) => {
                  const elegidas = seleccion[g.id] ?? [];
                  const activa = elegidas.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={activa}
                      onClick={() =>
                        g.tipo_seleccion === "unica"
                          ? elegirUnica(g.id, o.id)
                          : alternarMultiple(g.id, o.id, g.max_selecciones)
                      }
                      className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm"
                      style={{
                        borderColor: activa ? "var(--menu-primario)" : borde,
                        background: activa
                          ? "color-mix(in srgb, var(--menu-primario) 10%, transparent)"
                          : "transparent",
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="grid size-4 shrink-0 place-items-center rounded-full border"
                          style={{
                            borderColor: activa ? "var(--menu-primario)" : borde,
                            background: activa ? "var(--menu-primario)" : "transparent",
                          }}
                        >
                          {activa && (
                            <Check className="size-3" style={{ color: "var(--menu-fondo)" }} />
                          )}
                        </span>
                        {o.nombre}
                      </span>
                      {o.precio_extra > 0 && (
                        <span
                          className="vm-data shrink-0"
                          style={{ color: "var(--menu-texto-suave)" }}
                        >
                          +{precioMenu(o.precio_extra)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="border-t p-4" style={{ borderColor: borde }}>
          <button
            type="button"
            disabled={!listo}
            onClick={() => alConfirmar(seleccion)}
            className="h-11 w-full rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: "var(--menu-primario)", color: "var(--menu-fondo)" }}
          >
            Agregar — {precioMenu(producto.precio + extra)}
          </button>
        </div>
      </motion.article>
    </motion.div>
  );
}
