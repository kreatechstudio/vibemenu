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

/* -------------------------------------------------------------------------- */
/*  Ciclo de vida del dominio (migracion 019, spec 2026-08-28)               */
/* -------------------------------------------------------------------------- */

/**
 * Lo ultimo que Vercel dijo del dominio, guardado en `tenants.dominio_diagnostico`.
 * Lo escriben las Edge Functions agregar-dominio-vercel / verificar-dominios-pendientes;
 * el frontend solo lo lee. Forma flexible: los helpers toleran campos ausentes.
 */
export type DominioDiagnostico = {
  name: string;
  apexName: string;
  misconfigured: boolean;
  verification: { type: string; domain: string; value: string; reason: string }[];
  recommendedIPv4: string[];
  recommendedCNAME: string[];
  revisado_at: string;
};

export type RegistroDNS = { tipo: "A" | "CNAME"; nombre: string; valor: string };

/** Sufijos publicos compuestos relevantes para el mercado MX; para el fallback sin datos de Vercel. */
const SUFIJOS_COMPUESTOS = [".com.mx", ".org.mx", ".net.mx", ".gob.mx", ".edu.mx"];

const IPV4_VERCEL = "76.76.21.21";
const CNAME_VERCEL = "cname.vercel-dns.com";

/** Vercel dice si el dominio es apex: apexName === name. */
export function esApexSegunVercel(name: string, apexName: string): boolean {
  return name.toLowerCase() === apexName.toLowerCase();
}

/** Fallback sin datos de Vercel: apex si solo queda 1 label sobre el sufijo conocido. */
function esApexPorHeuristica(dominio: string): boolean {
  const d = dominio.toLowerCase();
  const sufijo = SUFIJOS_COMPUESTOS.find((s) => d.endsWith(s));
  const labelsSufijo = sufijo ? sufijo.split(".").filter(Boolean).length : 1;
  return d.split(".").length === labelsSufijo + 1;
}

/**
 * El nombre del registro: "@" si es apex, si no todo lo que queda a la izquierda
 * del apex ("menu.sucursales" en "menu.sucursales.tienda.com"). Cuando hay
 * `apexName` de Vercel se deriva de ahi; sin el, cae al primer label.
 */
function nombreRegistro(dominio: string, apexName: string | null, esApex: boolean): string {
  if (esApex) return "@";
  const d = dominio.toLowerCase();
  const apex = apexName?.toLowerCase();
  if (apex && d.endsWith(`.${apex}`)) {
    return dominio.slice(0, dominio.length - apex.length - 1);
  }
  return dominio.split(".")[0];
}

/**
 * Registros DNS a mostrarle al dueno, derivados del diagnostico de Vercel.
 * Si `diag` es null (Vercel aun no respondio) cae a la heuristica + valores estaticos.
 */
export function instruccionesDNS(dominio: string, diag: DominioDiagnostico | null): RegistroDNS[] {
  const esApex = diag ? esApexSegunVercel(diag.name, diag.apexName) : esApexPorHeuristica(dominio);
  const nombre = nombreRegistro(dominio, diag?.apexName ?? null, esApex);

  if (esApex) {
    return [{ tipo: "A", nombre, valor: diag?.recommendedIPv4?.[0] ?? IPV4_VERCEL }];
  }
  return [{ tipo: "CNAME", nombre, valor: diag?.recommendedCNAME?.[0] ?? CNAME_VERCEL }];
}

/**
 * Motivo legible del problema de DNS, o null si no hay problema.
 * Hay problema si `misconfigured` (registros A/CNAME) O si hay un reto de
 * `verification` pendiente (TXT de propiedad) — son campos independientes.
 */
export function motivoProblemaDNS(diag: DominioDiagnostico | null): string | null {
  if (!diag) return null;
  const conReason = (diag.verification ?? []).find((v) => v.reason && v.domain);
  if (conReason) {
    return `Falta el registro ${conReason.type} en ${conReason.domain}. Créalo con el valor de abajo y vuelve a intentar.`;
  }
  if (!diag.misconfigured) return null;
  return "No encontramos el registro DNS, o apunta a otro lado. Revisa que coincida exactamente con lo de abajo.";
}
