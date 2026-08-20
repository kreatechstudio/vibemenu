import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Precios sobrescritos por sucursal (migracion 005).
 *
 * Un producto, un precio base en `productos.precio`, y cero o mas filas en
 * `precios_sucursal`. Si una sucursal no tiene fila, cobra el precio base: no se
 * duplica el producto, no hay dos fichas que mantener sincronizadas.
 *
 * El trigger `validar_precio_sucursal` rechaza la escritura si el plan no trae
 * `menu_independiente_por_sucursal`, y si el producto y la sucursal no son del
 * mismo tenant. Aqui no se valida nada de eso.
 */

/** `{ [sucursal_id]: precio }`. Una sucursal ausente cobra el precio base. */
export type PreciosPorSucursal = Record<string, number>;

export function usePreciosDeProducto(productoId: string | undefined) {
  return useQuery({
    queryKey: ["precios-sucursal", productoId],
    enabled: Boolean(productoId),
    queryFn: async (): Promise<PreciosPorSucursal> => {
      const { data, error } = await supabase
        .from("precios_sucursal")
        .select("sucursal_id, precio")
        .eq("producto_id", productoId!);
      if (error) throw error;
      return Object.fromEntries(data.map((f) => [f.sucursal_id, f.precio]));
    },
  });
}

/**
 * Deja `precios_sucursal` exactamente como dice `deseados`: borra las sucursales
 * que volvieron al precio base e inserta o actualiza el resto.
 *
 * No usa `upsert` a secas porque hay que borrar lo que sobra, y el upsert solo
 * escribe. Se hace en dos pasos, igual que `sincronizarModificadores`.
 */
export async function sincronizarPreciosSucursal(
  productoId: string,
  deseados: PreciosPorSucursal,
): Promise<void> {
  const { data: actuales, error: errorLectura } = await supabase
    .from("precios_sucursal")
    .select("sucursal_id")
    .eq("producto_id", productoId);
  if (errorLectura) throw errorLectura;

  const antes = actuales.map((f) => f.sucursal_id);
  const aBorrar = antes.filter((id) => !(id in deseados));

  if (aBorrar.length) {
    const { error } = await supabase
      .from("precios_sucursal")
      .delete()
      .eq("producto_id", productoId)
      .in("sucursal_id", aBorrar);
    if (error) throw error;
  }

  const filas = Object.entries(deseados).map(([sucursal_id, precio]) => ({
    producto_id: productoId,
    sucursal_id,
    precio,
  }));

  if (filas.length) {
    const { error } = await supabase
      .from("precios_sucursal")
      .upsert(filas, { onConflict: "producto_id,sucursal_id" });
    if (error) throw error;
  }
}
