import { CLAVES_FUENTE, type ClaveFuente } from "@/lib/fuentes";
import type { ModoImagen } from "@/lib/tema";
import type { FormatoMenu, MonedaCobro, Plan } from "@/types/database";
import { FORMATOS } from "@/types/database";

/**
 * Helpers puros sobre una fila de `planes`.
 *
 * Regla del proyecto: la logica de limites SIEMPRE lee la tabla `planes`.
 * Nunca se hardcodea un numero aqui ni en un componente. `null` = ilimitado.
 *
 * Esto es solo para la UI (deshabilitar botones, mostrar candados). El bloqueo
 * de verdad lo hacen los triggers de Postgres — ver seccion 11 de vibemenu_base-datos.md.
 */

export const esIlimitado = (limite: number | null): boolean => limite === null;

/** Cuantos quedan antes de topar. `null` si es ilimitado. */
export function restantes(limite: number | null, usados: number): number | null {
  if (limite === null) return null;
  return Math.max(0, limite - usados);
}

export function alcanzoLimite(limite: number | null, usados: number): boolean {
  return limite !== null && usados >= limite;
}

/** Fraccion de uso 0..1, para barras de progreso. `null` si es ilimitado. */
export function fraccionDeUso(limite: number | null, usados: number): number | null {
  if (limite === null || limite === 0) return null;
  return Math.min(1, usados / limite);
}

/** Los formatos del pool del plan, en el orden canonico. */
export function formatosDelPool(plan: Plan): FormatoMenu[] {
  return FORMATOS.filter((f) => plan.formatos_permitidos.includes(f));
}

/** Formatos del pool que el tenant todavia no eligio. */
export function formatosBloqueados(plan: Plan, desbloqueados: readonly string[]): FormatoMenu[] {
  return formatosDelPool(plan).filter((f) => !desbloqueados.includes(f));
}

/** Formatos que ni siquiera estan en el pool: requieren cambiar de plan. */
export function formatosFueraDelPlan(plan: Plan): FormatoMenu[] {
  return FORMATOS.filter((f) => !plan.formatos_permitidos.includes(f));
}

/**
 * Basic tiene pool de los 4 y limite 2: siempre Clasico + uno a elegir.
 * `clasico` cuenta dentro del limite.
 */
export function puedeDesbloquearOtroFormato(plan: Plan, desbloqueados: readonly string[]): boolean {
  if (plan.limite_formatos === null) return formatosBloqueados(plan, desbloqueados).length > 0;
  return desbloqueados.length < plan.limite_formatos;
}

/* ── Personalización de tema (migración 002) ───────────────────────── */

/**
 * Estas cuatro columnas las agrega `vibemenu_migracion_tema.sql`. Mientras no se
 * haya corrido, la fila de `planes` no las trae y llegan como `undefined`.
 * Los accesores caen entonces al comportamiento más restrictivo, en vez de
 * romper la pantalla de Diseño con un TypeError.
 */
const FUENTES_ANTES_DE_MIGRAR: string[] = ["fraunces", "inter"];

const fuentesCrudas = (plan: Plan): string[] =>
  (plan.fuentes_permitidas as string[] | undefined) ?? FUENTES_ANTES_DE_MIGRAR;

const modosCrudos = (plan: Plan): string[] =>
  (plan.modos_imagen_permitidos as string[] | undefined) ?? [];

/** Fuentes que el plan deja elegir, en el orden canónico del catálogo. */
export function fuentesDelPlan(plan: Plan): ClaveFuente[] {
  const permitidas = fuentesCrudas(plan);
  return CLAVES_FUENTE.filter((f) => permitidas.includes(f));
}

export const permiteFuente = (plan: Plan, f: ClaveFuente): boolean =>
  fuentesCrudas(plan).includes(f);

/** `marco`, `completo`, o ninguno. `ninguno` siempre está disponible. */
export function modosImagenDelPlan(plan: Plan): ModoImagen[] {
  const permitidos = modosCrudos(plan);
  return (["marco", "completo"] as const).filter((m) => permitidos.includes(m));
}

export const permiteImagenDeFondo = (plan: Plan): boolean => modosCrudos(plan).length > 0;

export const permiteColorModificadores = (plan: Plan): boolean =>
  (plan.permite_color_modificadores as boolean | undefined) ?? false;

export const permiteDesenfoque = (plan: Plan): boolean =>
  (plan.permite_desenfoque as boolean | undefined) ?? false;

export function precioDelPlan(plan: Plan, moneda: MonedaCobro): number {
  return moneda === "mxn" ? plan.precio_mxn : plan.precio_usd;
}

const FORMATEADORES: Record<MonedaCobro, Intl.NumberFormat> = {
  usd: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }),
  mxn: new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
  }),
};

export function formatearPrecio(monto: number, moneda: MonedaCobro): string {
  return FORMATEADORES[moneda].format(monto);
}

/** Texto de un limite para la UI: "3" o "Ilimitados". */
export function textoLimite(limite: number | null): string {
  return limite === null ? "Ilimitados" : String(limite);
}

/** "2 de 3 sucursales" / "34 productos" cuando es ilimitado. */
export function textoUso(usados: number, limite: number | null, sustantivo: string): string {
  return limite === null ? `${usados} ${sustantivo}` : `${usados} de ${limite} ${sustantivo}`;
}
