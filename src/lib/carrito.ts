import type { ProductoConModificadores } from "@/hooks/useMenuPublico";
import type { LineaPedido } from "@/lib/pedido";

export type ItemCarrito = {
  producto: ProductoConModificadores;
  cantidad: number;
};

/** +1 al producto; si no estaba, lo agrega como línea nueva al final. */
export function agregarProducto(
  items: ItemCarrito[],
  producto: ProductoConModificadores,
): ItemCarrito[] {
  if (items.some((i) => i.producto.id === producto.id)) {
    return items.map((i) =>
      i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i,
    );
  }
  return [...items, { producto, cantidad: 1 }];
}

/** `n <= 0` quita la línea. Si el id no está y `n > 0`, devuelve `items` sin cambio. */
export function fijarCantidad(items: ItemCarrito[], productoId: string, n: number): ItemCarrito[] {
  if (n <= 0) return items.filter((i) => i.producto.id !== productoId);
  return items.map((i) => (i.producto.id === productoId ? { ...i, cantidad: n } : i));
}

export function quitarProducto(items: ItemCarrito[], productoId: string): ItemCarrito[] {
  return items.filter((i) => i.producto.id !== productoId);
}

export function cantidadDe(items: ItemCarrito[], productoId: string): number {
  return items.find((i) => i.producto.id === productoId)?.cantidad ?? 0;
}

export function cantidadTotal(items: ItemCarrito[]): number {
  return items.reduce((suma, i) => suma + i.cantidad, 0);
}

export function lineasDePedido(items: ItemCarrito[]): LineaPedido[] {
  return items.map((i) => ({
    nombre: i.producto.nombre,
    cantidad: i.cantidad,
    precioUnitario: i.producto.precio,
  }));
}
