import { useContext, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { createPortal } from "react-dom";
import HojaSeleccionModificadores from "@/components/menu/HojaSeleccionModificadores";
import { useAnalitica } from "@/hooks/useAnalitica";
import { useCarritoWhatsApp } from "@/hooks/useCarritoWhatsApp";
import type { ProductoConModificadores } from "@/hooks/useMenuPublico";
import { ContenedorTemaContext } from "@/lib/temaPortal";

/**
 * Control "agregar al pedido". Se monta SIN condicional en los formatos: si el
 * carrito no está habilitado (plan / número), devuelve `null` solo.
 *
 * - `variante="stepper"`: `n === 0` → pastilla "Agregar" con `+`; `n > 0` → fila
 *   `[−] n [+]`. Igual en el renglón de Clásico y al pie de los modales.
 * - `variante="badge"`: `+` circular (el formato lo posiciona con un `absolute`).
 *   Con `n > 0` muestra el número. Solo suma; para restar desde el grid se abre
 *   el modal o la hoja de resumen.
 *
 * Con modificadores (`producto.grupos.length > 0`) ninguna variante suma
 * directo: siempre abre `HojaSeleccionModificadores`, porque dos selecciones
 * del mismo producto son líneas distintas del carrito y no hay un "−"
 * inequívoco aquí (ese ajuste fino vive en `HojaPedido`, por línea).
 *
 * Estilo: solo variables `--menu-*`.
 */
export default function BotonAgregar({
  producto,
  variante,
}: {
  producto: ProductoConModificadores;
  variante: "stepper" | "badge";
}) {
  const c = useCarritoWhatsApp();
  const analitica = useAnalitica();
  const contenedorTema = useContext(ContenedorTemaContext);
  const [seleccionando, setSeleccionando] = useState(false);
  if (!c.habilitado) return null;

  const tieneModificadores = producto.grupos.length > 0;
  const n = c.cantidadDe(producto.id);

  // Se portea al contenedor temado (ver ContenedorTemaContext), NO a
  // document.body: ahí se pierden las variables --menu-* y la hoja sale
  // transparente. El contenedor temado también evita que un ancestro con
  // transform (framer-motion en el grid, p. ej. Pinterest) rompa el
  // `position: fixed` del backdrop. `AnimatePresence` va DENTRO del portal
  // (no al revés): envolviendo un `Portal` no detecta un elemento válido y lo
  // descarta en silencio.
  const hoja =
    tieneModificadores &&
    contenedorTema &&
    createPortal(
      <AnimatePresence>
        {seleccionando && (
          <HojaSeleccionModificadores
            producto={producto}
            alConfirmar={(seleccion) => {
              c.agregar(producto, seleccion);
              analitica.registrarAgregado(producto.id);
              setSeleccionando(false);
            }}
            alCerrar={() => setSeleccionando(false)}
          />
        )}
      </AnimatePresence>,
      contenedorTema,
    );

  if (variante === "badge") {
    return (
      <>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (tieneModificadores) {
              setSeleccionando(true);
              return;
            }
            c.agregar(producto);
            analitica.registrarAgregado(producto.id);
          }}
          aria-label={
            n > 0
              ? `${producto.nombre}: ${n} en el pedido. Agregar otro`
              : `Agregar ${producto.nombre} al pedido`
          }
          className="grid size-8 place-items-center rounded-full text-sm font-bold shadow-md tabular-nums"
          style={{ background: "var(--menu-primario)", color: "var(--menu-fondo)" }}
        >
          {n > 0 ? n : <Plus className="size-4" aria-hidden />}
        </button>
        {hoja}
      </>
    );
  }

  if (tieneModificadores) {
    return (
      <>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSeleccionando(true);
          }}
          aria-label={
            n > 0
              ? `${producto.nombre}: ${n} en el pedido. Agregar otro`
              : `Agregar ${producto.nombre} al pedido`
          }
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-medium"
          style={{ background: "var(--menu-primario)", color: "var(--menu-fondo)" }}
        >
          <Plus className="size-4" aria-hidden />
          {n > 0 ? `Agregar (${n})` : "Agregar"}
        </button>
        {hoja}
      </>
    );
  }

  if (n === 0) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          c.agregar(producto);
          analitica.registrarAgregado(producto.id);
        }}
        aria-label={`Agregar ${producto.nombre} al pedido`}
        className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-medium"
        style={{ background: "var(--menu-primario)", color: "var(--menu-fondo)" }}
      >
        <Plus className="size-4" aria-hidden />
        Agregar
      </button>
    );
  }

  return (
    <div
      className="inline-flex shrink-0 items-center gap-2 rounded-full border px-1.5 py-1"
      style={{ borderColor: "var(--menu-primario)", color: "var(--menu-texto)" }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          c.fijarCantidad(producto.id, n - 1);
        }}
        aria-label={`Quitar uno de ${producto.nombre}`}
        className="grid size-6 place-items-center rounded-full"
        style={{ color: "var(--menu-primario)" }}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <span className="min-w-4 text-center text-sm font-semibold tabular-nums">{n}</span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          c.agregar(producto);
          analitica.registrarAgregado(producto.id);
        }}
        aria-label={`Agregar otro ${producto.nombre}`}
        className="grid size-6 place-items-center rounded-full"
        style={{ color: "var(--menu-primario)" }}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
