import { esClaveFuente, FUENTES, type ClaveFuente } from "@/lib/fuentes";
import type { FormatoMenu, Json } from "@/types/database";

/**
 * Forma del jsonb `tenants.tema`.
 *
 * El trigger `validar_tema_tenant` valida estas claves contra el plan:
 * `fuente` contra planes.fuentes_permitidas, `modo_imagen` contra
 * planes.modos_imagen_permitidos, `color_modificadores` contra
 * permite_color_modificadores y `desenfoque_texto` contra permite_desenfoque.
 *
 * El azul #2B4EFF de Vibemenu NO aparece nunca como valor por defecto: los menus
 * publicos llevan el tema del negocio, no el de la plataforma.
 */

/** Cómo se usa la imagen de fondo del tenant. */
export type ModoImagen = "ninguno" | "marco" | "completo";

export const MODOS_IMAGEN: Record<
  Exclude<ModoImagen, "ninguno">,
  { nombre: string; nota: string }
> = {
  marco: {
    nombre: "Marco",
    nota: "La foto enmarca. Tu carta va en una tarjeta al centro, siempre legible.",
  },
  completo: {
    nombre: "Fondo completo",
    nota: "La foto ocupa toda la pantalla. El texto va encima, con un velo oscuro.",
  },
};

export type TemaTenant = {
  color_primario?: string;
  color_fondo?: string;
  color_texto?: string;
  color_texto_suave?: string;
  color_modificadores?: string;
  fuente?: ClaveFuente;
  /** Legado: la primera versión solo distinguía serif de sans. */
  tipografia?: "serif" | "sans";
  imagen_fondo_url?: string | null;
  modo_imagen?: ModoImagen;
  desenfoque_texto?: boolean;
};

export type TemaResuelto = {
  color_primario: string;
  color_fondo: string;
  color_texto: string;
  color_texto_suave: string;
  color_modificadores: string;
  fuente: ClaveFuente;
  imagen_fondo_url: string | null;
  modo_imagen: ModoImagen;
  desenfoque_texto: boolean;
};

/** Neutro calido, no el azul de la marca. Sirve para cualquier giro. */
const BASE: TemaResuelto = {
  color_primario: "#C2410C",
  color_fondo: "#FBF7F2",
  color_texto: "#1C1917",
  color_texto_suave: "#57534E",
  color_modificadores: "#57534E",
  fuente: "fraunces",
  imagen_fondo_url: null,
  modo_imagen: "ninguno",
  desenfoque_texto: false,
};

/**
 * Cada formato arranca de un punto distinto (DESIGN.md, seccion de los 4 formatos).
 * Pinterest e Instagram dejan mandar a las fotos con fondo casi blanco;
 * TikTok es oscuro por definicion.
 */
const POR_FORMATO: Record<FormatoMenu, Partial<TemaResuelto>> = {
  clasico: {},
  pinterest: { color_fondo: "#FFFFFF", fuente: "inter" },
  instagram: { color_fondo: "#FFFFFF", fuente: "inter" },
  tiktok: {
    color_fondo: "#0A0A0A",
    color_texto: "#FFFFFF",
    color_texto_suave: "#D4D4D4",
    color_modificadores: "#D4D4D4",
    fuente: "inter",
  },
};

function esObjeto(v: Json): v is { [k: string]: Json | undefined } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Descarta claves vacías y traduce el campo legado `tipografia` a una fuente. */
function limpiar(t: TemaTenant): Partial<TemaResuelto> {
  const salida: Partial<TemaResuelto> = {};

  for (const [k, v] of Object.entries(t)) {
    if (v === undefined || v === "") continue;
    if (k === "tipografia" || k === "fuente") continue;
    (salida as Record<string, unknown>)[k] = v;
  }

  if (esClaveFuente(t.fuente)) salida.fuente = t.fuente;
  else if (t.tipografia) salida.fuente = t.tipografia === "serif" ? "fraunces" : "inter";

  return salida;
}

export function resolverTema(temaCrudo: Json, formato: FormatoMenu): TemaResuelto {
  const guardado = esObjeto(temaCrudo) ? (temaCrudo as TemaTenant) : {};
  const resuelto = { ...BASE, ...POR_FORMATO[formato], ...limpiar(guardado) };

  // Sin imagen no hay modo: evita marcos vacíos si borraron la foto.
  if (!resuelto.imagen_fondo_url) resuelto.modo_imagen = "ninguno";

  return resuelto;
}

/** Variables CSS que consumen los 4 formatos. Se aplican en el contenedor raiz del menu. */
export function variablesDeTema(t: TemaResuelto): React.CSSProperties {
  return {
    "--menu-primario": t.color_primario,
    "--menu-fondo": t.color_fondo,
    "--menu-texto": t.color_texto,
    "--menu-texto-suave": t.color_texto_suave,
    "--menu-modificadores": t.color_modificadores,
    "--menu-fuente": FUENTES[t.fuente].css,
  } as React.CSSProperties;
}

const FORMATO_PRECIO = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Los precios del menu no llevan moneda en la base; `moneda_cobro` es de facturacion. */
export function precioMenu(monto: number): string {
  return `$${FORMATO_PRECIO.format(monto)}`;
}
