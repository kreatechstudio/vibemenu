/**
 * Lógica pura de analítica por platillo. Sin React, sin red.
 *
 * `claveDedup` + `yaRegistrada`: una interacción por (tenant, sucursal|general,
 * producto, tipo) por hora local del navegador, en `sessionStorage`. El servidor
 * recalcula la hora con la zona de la sucursal; para el dedup basta la del
 * navegador (el comensal está en la zona del local en la práctica).
 *
 * `rankingDesde` / `porHoraDe` / `serieDesde` / `ignoradosDesde`: agregan las
 * filas crudas de `interacciones_producto` para el panel. `useAnaliticaProducto`
 * solo hace el `select` y llama a estas.
 */

export type TipoInteraccion = "vista" | "agregado";

export type FilaInteraccion = {
  sucursal_id: string | null;
  producto_id: string;
  dia: string;
  hora: number;
  vistas: number;
  agregados: number;
};

export type FilaRanking = {
  productoId: string;
  nombre: string;
  vistas: number;
  agregados: number;
  /** agregados/vistas cuando vistas>0 y agregados<=vistas; si no, null → "—". */
  tasa: number | null;
};

export const UMBRAL_IGNORADO = 3;

const pad2 = (n: number) => String(n).padStart(2, "0");

function ymdHLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}-${pad2(d.getHours())}`;
}

export function claveDedup(
  tenantId: string,
  sucursalId: string | null,
  productoId: string,
  tipo: TipoInteraccion,
  ahora: Date,
): string {
  return `vm:ip:${tenantId}:${sucursalId ?? "general"}:${productoId}:${tipo}:${ymdHLocal(ahora)}`;
}

export function yaRegistrada(clave: string): boolean {
  try {
    if (sessionStorage.getItem(clave)) return true;
    sessionStorage.setItem(clave, "1");
    return false;
  } catch {
    return false;
  }
}

export function rankingDesde(
  filas: FilaInteraccion[],
  nombres: Map<string, string>,
): FilaRanking[] {
  const acc = new Map<string, { vistas: number; agregados: number }>();
  for (const f of filas) {
    const a = acc.get(f.producto_id) ?? { vistas: 0, agregados: 0 };
    a.vistas += f.vistas;
    a.agregados += f.agregados;
    acc.set(f.producto_id, a);
  }
  return [...acc.entries()]
    .map(([productoId, { vistas, agregados }]) => ({
      productoId,
      nombre: nombres.get(productoId) ?? "Platillo eliminado",
      vistas,
      agregados,
      tasa: vistas > 0 && agregados <= vistas ? agregados / vistas : null,
    }))
    .sort((a, b) => b.vistas - a.vistas || b.agregados - a.agregados);
}

export function porHoraDe(
  filas: FilaInteraccion[],
  productoId: string,
): { hora: number; vistas: number; agregados: number }[] {
  const base = Array.from({ length: 24 }, (_, hora) => ({ hora, vistas: 0, agregados: 0 }));
  for (const f of filas) {
    if (f.producto_id !== productoId) continue;
    base[f.hora].vistas += f.vistas;
    base[f.hora].agregados += f.agregados;
  }
  return base;
}

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function serieDesde(
  filas: FilaInteraccion[],
  dias: number,
  hoy: Date,
): { dia: string; vistas: number; agregados: number }[] {
  const porDia = new Map<string, { vistas: number; agregados: number }>();
  for (const f of filas) {
    const a = porDia.get(f.dia) ?? { vistas: 0, agregados: 0 };
    a.vistas += f.vistas;
    a.agregados += f.agregados;
    porDia.set(f.dia, a);
  }
  const out: { dia: string; vistas: number; agregados: number }[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - i);
    const clave = ymdLocal(d);
    const v = porDia.get(clave) ?? { vistas: 0, agregados: 0 };
    out.push({ dia: clave, ...v });
  }
  return out;
}

export function ignoradosDesde(
  filas: FilaInteraccion[],
  productosActivos: { id: string; nombre: string }[],
  umbral: number,
): { productoId: string; nombre: string; vistas: number }[] {
  const vistasPorProd = new Map<string, number>();
  for (const f of filas) {
    vistasPorProd.set(f.producto_id, (vistasPorProd.get(f.producto_id) ?? 0) + f.vistas);
  }
  return productosActivos
    .map((p) => ({ productoId: p.id, nombre: p.nombre, vistas: vistasPorProd.get(p.id) ?? 0 }))
    .filter((x) => x.vistas < umbral)
    .sort((a, b) => a.vistas - b.vistas);
}
