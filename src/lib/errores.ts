import type { PostgrestError } from "@supabase/supabase-js";
import { ESTADOS } from "@/lib/copy";

/**
 * Los triggers de la base levantan `raise exception '<slug>' using detail = '<texto con el numero>'`.
 * En supabase-js eso llega como { code: 'P0001', message: '<slug>', details: '<texto>' }.
 *
 * El slug es el contrato estable. El numero real del limite viaja en `details` y sale
 * de la tabla `planes` — nunca se hardcodea en el frontend.
 *
 * Ver seccion 11 de src/docs/vibemenu_base-datos.md.
 */
export type SlugErrorDb =
  | "limite_productos_alcanzado"
  | "limite_sucursales_alcanzado"
  | "limite_usuarios_alcanzado"
  | "limite_modificadores_alcanzado"
  | "limite_formatos_alcanzado"
  | "formato_no_permitido"
  | "formato_activo_no_desbloqueado"
  | "multiusuario_no_permitido"
  | "menu_independiente_no_permitido"
  | "sucursal_de_otro_tenant"
  | "categoria_de_otro_tenant"
  | "producto_sucursal_incoherente"
  | "timezone_invalida"
  | "plan_inexistente"
  // Migración 002: validar_tema_tenant
  | "fuente_no_permitida"
  | "modo_imagen_no_permitido"
  | "color_modificadores_no_permitido"
  | "desenfoque_no_permitido"
  // Migración 005: validar_precio_sucursal
  | "precio_por_sucursal_no_permitido";

/** Errores que el usuario resuelve actualizando su plan. */
export const SLUGS_DE_LIMITE: readonly SlugErrorDb[] = [
  "limite_productos_alcanzado",
  "limite_sucursales_alcanzado",
  "limite_usuarios_alcanzado",
  "limite_modificadores_alcanzado",
  "limite_formatos_alcanzado",
  "multiusuario_no_permitido",
  "menu_independiente_no_permitido",
  "formato_no_permitido",
  "fuente_no_permitida",
  "modo_imagen_no_permitido",
  "color_modificadores_no_permitido",
  "desenfoque_no_permitido",
  "precio_por_sucursal_no_permitido",
];

const MENSAJES: Record<SlugErrorDb, string> = {
  limite_productos_alcanzado: ESTADOS.limiteProductos,
  // El numero real viene en `details`; si falta, se cae a un texto sin cifra.
  limite_sucursales_alcanzado: "Alcanzaste el límite de sucursales de tu plan actual.",
  limite_usuarios_alcanzado: "Alcanzaste el límite de usuarios de tu plan actual.",
  limite_modificadores_alcanzado:
    "Alcanzaste el límite de grupos de modificadores de tu plan actual.",
  limite_formatos_alcanzado: "Alcanzaste el límite de formatos desbloqueados de tu plan actual.",
  formato_no_permitido: "Ese formato no está incluido en tu plan actual.",
  formato_activo_no_desbloqueado: "Primero desbloquea ese formato en tu plan.",
  multiusuario_no_permitido: "El trabajo en equipo es parte de Pro.",
  menu_independiente_no_permitido: "Tu plan solo admite un menú compartido entre sucursales.",
  sucursal_de_otro_tenant: "Esa sucursal no pertenece a tu negocio.",
  categoria_de_otro_tenant: "Esa categoría no pertenece a tu negocio.",
  producto_sucursal_incoherente:
    "La categoría es exclusiva de una sucursal; el producto debe pertenecer a la misma.",
  timezone_invalida: "Esa zona horaria no es válida.",
  plan_inexistente: "No encontramos tu plan. Vuelve a intentar en un momento.",
  fuente_no_permitida: "Esa tipografía no está incluida en tu plan.",
  modo_imagen_no_permitido: "La imagen de fondo no está incluida en tu plan.",
  color_modificadores_no_permitido: "Darle color a los modificadores es parte de Basic.",
  desenfoque_no_permitido: "El desenfoque detrás del texto es parte de Pro.",
  precio_por_sucursal_no_permitido: "Los precios distintos por sucursal son parte de Pro.",
};

const esSlugConocido = (m: string): m is SlugErrorDb => m in MENSAJES;

export type ErrorTraducido = {
  mensaje: string;
  /** true si la salida es actualizar el plan: el llamador puede abrir el modal de upsell. */
  esLimiteDePlan: boolean;
  slug: SlugErrorDb | null;
};

/**
 * Traduce un error de Postgres al copy real. `detail` gana sobre el mensaje
 * generico porque trae el limite concreto del plan del tenant.
 */
export function traducirError(error: PostgrestError | Error | null): ErrorTraducido {
  if (!error) return { mensaje: "", esLimiteDePlan: false, slug: null };

  const pg = error as Partial<PostgrestError>;

  // Slug unico ya tomado: viola el unique de tenants.slug.
  if (pg.code === "23505" && pg.message?.includes("slug")) {
    return { mensaje: ESTADOS.slugNoDisponible, esLimiteDePlan: false, slug: null };
  }

  const mensajeCrudo = pg.message ?? "";
  if (esSlugConocido(mensajeCrudo)) {
    return {
      mensaje: pg.details?.trim() || MENSAJES[mensajeCrudo],
      esLimiteDePlan: SLUGS_DE_LIMITE.includes(mensajeCrudo),
      slug: mensajeCrudo,
    };
  }

  return {
    mensaje: "Algo salió mal. Vuelve a intentar en un momento.",
    esLimiteDePlan: false,
    slug: null,
  };
}
