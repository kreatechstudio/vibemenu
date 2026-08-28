export type SentimientoEmbudo = "bien" | "regular" | "mal";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** localStorage (persiste entre sesiones, a diferencia de las visitas). */
export const claveEmbudo = (tenantId: string): string => `vm:embudo:${tenantId}`;

/**
 * ¿Ya respondió (o cerró) el embudo en este navegador para este tenant?
 * Cualquier fallo de storage (modo privado, cuota) cuenta como "no respondió":
 * peor mostrarlo dos veces que tragarse una reseña.
 */
export function yaRespondioEmbudo(tenantId: string, storage: StorageLike | undefined): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(claveEmbudo(tenantId)) !== null;
  } catch {
    return false;
  }
}

/** Marca el embudo como atendido en este navegador. Silenciosa ante fallos. */
export function marcarEmbudoRespondido(tenantId: string, storage: StorageLike | undefined): void {
  if (!storage) return;
  try {
    storage.setItem(claveEmbudo(tenantId), new Date().toISOString());
  } catch {
    /* modo privado: se aceptará mostrarlo otra vez */
  }
}
