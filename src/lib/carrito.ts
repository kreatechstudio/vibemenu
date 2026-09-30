import type { ProductoConModificadores } from "@/hooks/useMenuPublico";
import type { LineaPedido } from "@/lib/pedido";

/** grupoId -> ids de opciones elegidas en ese grupo. */
export type SeleccionModificadores = Record<string, string[]>;

export type ItemCarrito = {
  /** `producto.id` si no lleva modificadores; si no, incluye la selección. */
  id: string;
  producto: ProductoConModificadores;
  cantidad: number;
  seleccion: SeleccionModificadores;
};

/** "" si no hay nada elegido, para que la clave coincida con `producto.id` a secas. */
function claveSeleccion(seleccion: SeleccionModificadores): string {
  const grupos = Object.keys(seleccion)
    .filter((g) => seleccion[g].length > 0)
    .sort();
  if (grupos.length === 0) return "";
  return grupos.map((g) => `${g}:${[...seleccion[g]].sort().join(",")}`).join("|");
}

function idDeLinea(productoId: string, seleccion: SeleccionModificadores): string {
  const clave = claveSeleccion(seleccion);
  return clave ? `${productoId}::${clave}` : productoId;
}

/**
 * +1 a la línea con ese producto y esa selección exacta de modificadores; si no
 * existía, la agrega al final. Dos selecciones distintas del mismo producto son
 * líneas separadas.
 */
export function agregarProducto(
  items: ItemCarrito[],
  producto: ProductoConModificadores,
  seleccion: SeleccionModificadores = {},
): ItemCarrito[] {
  const id = idDeLinea(producto.id, seleccion);
  if (items.some((i) => i.id === id)) {
    return items.map((i) => (i.id === id ? { ...i, cantidad: i.cantidad + 1 } : i));
  }
  return [...items, { id, producto, cantidad: 1, seleccion }];
}

/** `n <= 0` quita la línea. Si el id no está y `n > 0`, devuelve `items` sin cambio. */
export function fijarCantidad(items: ItemCarrito[], itemId: string, n: number): ItemCarrito[] {
  if (n <= 0) return items.filter((i) => i.id !== itemId);
  return items.map((i) => (i.id === itemId ? { ...i, cantidad: n } : i));
}

export function quitarProducto(items: ItemCarrito[], itemId: string): ItemCarrito[] {
  return items.filter((i) => i.id !== itemId);
}

/** Σ cantidad de todas las líneas de ese producto, sin importar la selección. */
export function cantidadDe(items: ItemCarrito[], productoId: string): number {
  return items
    .filter((i) => i.producto.id === productoId)
    .reduce((suma, i) => suma + i.cantidad, 0);
}

export function cantidadTotal(items: ItemCarrito[]): number {
  return items.reduce((suma, i) => suma + i.cantidad, 0);
}

/** Nombres de las opciones elegidas, en el orden de los grupos del producto. */
function nombresElegidos(item: ItemCarrito): string[] {
  return item.producto.grupos.flatMap((g) => {
    const elegidas = item.seleccion[g.id] ?? [];
    return g.opciones.filter((o) => elegidas.includes(o.id)).map((o) => o.nombre);
  });
}

/** Precio base del producto más el extra de cada opción elegida. */
export function precioLinea(item: ItemCarrito): number {
  const extra = item.producto.grupos.reduce((suma, g) => {
    const elegidas = item.seleccion[g.id] ?? [];
    return (
      suma +
      g.opciones.filter((o) => elegidas.includes(o.id)).reduce((s, o) => s + o.precio_extra, 0)
    );
  }, 0);
  return item.producto.precio + extra;
}

export function nombreLinea(item: ItemCarrito): string {
  const extras = nombresElegidos(item);
  return extras.length ? `${item.producto.nombre} (${extras.join(", ")})` : item.producto.nombre;
}

export function lineasDePedido(items: ItemCarrito[]): LineaPedido[] {
  return items.map((i) => ({
    nombre: nombreLinea(i),
    cantidad: i.cantidad,
    precioUnitario: precioLinea(i),
  }));
}
