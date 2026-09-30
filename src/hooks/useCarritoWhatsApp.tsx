import { createContext, useCallback, useContext, useMemo, useState } from "react";
import * as carrito from "@/lib/carrito";
import type { ItemCarrito, SeleccionModificadores } from "@/lib/carrito";
import type { ProductoConModificadores } from "@/hooks/useMenuPublico";

export type { ItemCarrito, SeleccionModificadores };

export type CarritoWhatsApp = {
  /** Orden estable de inserción. */
  items: ItemCarrito[];
  /** Σ cantidad. */
  cantidadTotal: number;
  habilitado: boolean;
  /** Sin `seleccion`, o `{}`, agrega/suma a la línea sin modificadores. */
  agregar: (p: ProductoConModificadores, seleccion?: SeleccionModificadores) => void;
  /** `n <= 0` quita la línea. `itemId` es `ItemCarrito.id`, no `producto.id`. */
  fijarCantidad: (itemId: string, n: number) => void;
  quitar: (itemId: string) => void;
  vaciar: () => void;
  /** Σ cantidad de todas las líneas de ese producto (con cualquier selección). */
  cantidadDe: (productoId: string) => number;
};

const Ctx = createContext<CarritoWhatsApp | null>(null);

/**
 * Estado del carrito de "Pedir por WhatsApp". EFÍMERO: no toca `localStorage`.
 * En `MenuPublico` se monta con `key` por sucursal, así que cambiar de sucursal
 * lo desmonta y remonta vacío.
 *
 * `habilitado` (plan de pago + WhatsApp resoluble) se re-expone tal cual para
 * que los hijos se auto-oculten. Cuando es `false`, `agregar`/`fijarCantidad`
 * son no-ops (defensa; los controles ya no se renderizan).
 */
export function CarritoWhatsAppProvider({
  habilitado,
  children,
}: {
  habilitado: boolean;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<ItemCarrito[]>([]);

  const agregar = useCallback(
    (p: ProductoConModificadores, seleccion?: SeleccionModificadores) => {
      if (!habilitado) return;
      setItems((prev) => carrito.agregarProducto(prev, p, seleccion));
    },
    [habilitado],
  );

  const fijarCantidad = useCallback(
    (itemId: string, n: number) => {
      if (!habilitado) return;
      setItems((prev) => carrito.fijarCantidad(prev, itemId, n));
    },
    [habilitado],
  );

  const quitar = useCallback((itemId: string) => {
    setItems((prev) => carrito.quitarProducto(prev, itemId));
  }, []);

  const vaciar = useCallback(() => setItems([]), []);

  const valor = useMemo<CarritoWhatsApp>(
    () => ({
      items,
      cantidadTotal: carrito.cantidadTotal(items),
      habilitado,
      agregar,
      fijarCantidad,
      quitar,
      vaciar,
      cantidadDe: (productoId: string) => carrito.cantidadDe(items, productoId),
    }),
    [items, habilitado, agregar, fijarCantidad, quitar, vaciar],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useCarritoWhatsApp(): CarritoWhatsApp {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCarritoWhatsApp se usó fuera de <CarritoWhatsAppProvider>");
  return ctx;
}
