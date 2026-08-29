import { createContext, useCallback, useContext, useMemo, useState } from "react";
import * as carrito from "@/lib/carrito";
import type { ItemCarrito } from "@/lib/carrito";
import type { ProductoConModificadores } from "@/hooks/useMenuPublico";

export type { ItemCarrito };

export type CarritoWhatsApp = {
  /** Orden estable de inserción. */
  items: ItemCarrito[];
  /** Σ cantidad. */
  cantidadTotal: number;
  habilitado: boolean;
  agregar: (p: ProductoConModificadores) => void;
  /** `n <= 0` quita la línea. */
  fijarCantidad: (productoId: string, n: number) => void;
  quitar: (productoId: string) => void;
  vaciar: () => void;
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
    (p: ProductoConModificadores) => {
      if (!habilitado) return;
      setItems((prev) => carrito.agregarProducto(prev, p));
    },
    [habilitado],
  );

  const fijarCantidad = useCallback(
    (productoId: string, n: number) => {
      if (!habilitado) return;
      setItems((prev) => carrito.fijarCantidad(prev, productoId, n));
    },
    [habilitado],
  );

  const quitar = useCallback((productoId: string) => {
    setItems((prev) => carrito.quitarProducto(prev, productoId));
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
