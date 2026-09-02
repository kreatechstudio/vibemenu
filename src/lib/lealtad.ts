/**
 * Lógica pura de lealtad. Sin React, sin red.
 *
 * `codigo`: 6 caracteres de un alfabeto sin ambigüedad. El servidor lo genera;
 * aquí solo se normaliza lo que teclea el encargado y se valida la forma.
 * `progresoLealtad` / `rejillaSellos`: pintan la tarjeta del comensal.
 * Los helpers de `localStorage` guardan el UUID de la tarjeta por slug de negocio.
 */

export const ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const LARGO_CODIGO = 6;

export function normalizarCodigo(s: string): string {
  return [...(s ?? "").toUpperCase()]
    .filter((c) => ALFABETO_CODIGO.includes(c))
    .join("")
    .slice(0, LARGO_CODIGO);
}

export function codigoValido(s: string): boolean {
  return normalizarCodigo(s).length === LARGO_CODIGO;
}

export function validarTelefono(s: string): { ok: boolean; e164: string | null } {
  const bruto = (s ?? "").trim();
  const digitos = bruto.replace(/\D/g, "");
  if (bruto.startsWith("+")) {
    return digitos.length >= 8 && digitos.length <= 15
      ? { ok: true, e164: "+" + digitos }
      : { ok: false, e164: null };
  }
  if (digitos.length === 10) return { ok: true, e164: "+52" + digitos };
  if (digitos.length >= 11 && digitos.length <= 15) return { ok: true, e164: "+" + digitos };
  return { ok: false, e164: null };
}

const RE_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export function validarCorreo(s: string): boolean {
  return RE_CORREO.test((s ?? "").trim());
}

export type Progreso = { hechos: number; faltan: number; completa: boolean; pct: number };

export function progresoLealtad(sellos: number, meta: number): Progreso {
  const m = Math.max(0, meta);
  return {
    hechos: Math.min(sellos, m),
    faltan: Math.max(0, m - sellos),
    completa: sellos >= m && m > 0,
    pct: m > 0 ? Math.min(1, sellos / m) : 0,
  };
}

export function rejillaSellos(sellos: number, meta: number): boolean[] {
  return Array.from({ length: Math.max(0, meta) }, (_, i) => i < sellos);
}

export function puedeSellarHoy(ultimoSelloDia: string | null, hoyISO: string): boolean {
  return ultimoSelloDia !== hoyISO;
}

export const claveLocal = (slug: string) => `vm:lealtad:${slug}`;

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function leerTarjetaLocal(slug: string): string | null {
  try {
    const uuid = localStorage.getItem(claveLocal(slug));
    return uuid && RE_UUID.test(uuid) ? uuid : null;
  } catch {
    return null;
  }
}

export function guardarTarjetaLocal(slug: string, uuid: string): void {
  try {
    localStorage.setItem(claveLocal(slug), uuid);
  } catch {
    /* Safari privado */
  }
}

export function olvidarTarjetaLocal(slug: string): void {
  try {
    localStorage.removeItem(claveLocal(slug));
  } catch {
    /* Safari privado */
  }
}
