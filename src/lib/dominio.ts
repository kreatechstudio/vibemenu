import { EMPRESA } from "@/lib/legal";

/**
 * El dominio personalizado que un tenant en plan Pro apunta a su menu, en vez
 * de vibemenu.com.mx/<slug>. Se guarda como host puro (sin protocolo ni ruta).
 * La validacion real de formato, unicidad y plan vive en el trigger
 * `validar_dominio_tenant` (migracion 013) — esto es solo cortesia de UI.
 */

const FORMATO_DOMINIO =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Si pegan la URL completa ("https://menu.tunegocio.com/"), se queda solo con el host. */
export function normalizarDominio(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

export type ErrorDominio = "formato" | "reservado";

export function validarFormatoDominio(dominio: string): ErrorDominio | null {
  if (!FORMATO_DOMINIO.test(dominio)) return "formato";
  if (dominio === EMPRESA.dominio || dominio.endsWith(`.${EMPRESA.dominio}`)) return "reservado";
  return null;
}

export const MENSAJE_ERROR_DOMINIO: Record<ErrorDominio, string> = {
  formato: "Escribe un dominio válido, como menu.tunegocio.com.",
  reservado: "Ese dominio está reservado para Vibemenu.",
};
