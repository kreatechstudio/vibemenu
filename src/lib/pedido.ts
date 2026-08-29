import { precioMenu } from "@/lib/tema";

export type LineaPedido = {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
};

/** Suma de `cantidad × precioUnitario` de todas las líneas. */
export function totalPedido(lineas: LineaPedido[]): number {
  return lineas.reduce((suma, l) => suma + l.cantidad * l.precioUnitario, 0);
}

/**
 * Texto del pedido para `wa.me` (sin URL-encode — eso lo hace `enlaceWhatsApp`).
 * Sin modificadores en v1. La nota va al final solo si trae contenido tras `trim`.
 */
export function construirMensajePedido(params: {
  negocio: string;
  sucursal?: string | null;
  lineas: LineaPedido[];
  nota?: string;
}): string {
  const { negocio, lineas, nota } = params;
  const sucursal = params.sucursal?.trim();

  const encabezado = sucursal
    ? `Hola, quiero hacer un pedido de ${negocio} (${sucursal}):`
    : `Hola, quiero hacer un pedido de ${negocio}:`;

  const renglones = lineas.map(
    (l) => `• ${l.cantidad} × ${l.nombre} — ${precioMenu(l.cantidad * l.precioUnitario)}`,
  );

  const partes = [encabezado, "", ...renglones, "", `Total: ${precioMenu(totalPedido(lineas))}`];

  const notaLimpia = nota?.trim();
  if (notaLimpia) partes.push("", `Nota: ${notaLimpia}`);

  return partes.join("\n");
}
