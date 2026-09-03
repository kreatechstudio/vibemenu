import { CLAVES_FUENTE } from "@/lib/fuentes";
import {
  fuentesDelPlan,
  modosImagenDelPlan,
  permiteColorModificadores,
  permiteDesenfoque,
  permiteQrAvanzado,
  permiteQrColor,
  textoLimite,
} from "@/lib/plan";
import type { NombrePlan, Plan } from "@/types/database";

/**
 * Modelo de datos de la tabla comparativa de `/precios`. Patrón de `src/lib/plan.ts`:
 * cada fila lee su valor de la fila de `planes` — nunca se hardcodea un límite,
 * un `UPDATE` en la base cambia la tabla sola.
 *
 * Las filas marcadas `// fijo` son la única excepción: valen lo mismo en los 4
 * planes (o dependen de algo que no vive en `planes`, como el soporte prioritario)
 * y por eso se codifican a mano. Si agregas una capacidad que sí varía por plan,
 * añade la columna en `planes` y léela aquí, no un `() => true/false`.
 */
export const GRUPOS_COMPARATIVA = [
  "Tu menú",
  "Contenido",
  "Diseño",
  "Tu QR",
  "Tu equipo",
  "Pedidos y reseñas",
  "Fidelización y analítica",
  "Soporte",
] as const;

export type GrupoComparativa = (typeof GRUPOS_COMPARATIVA)[number];

export type FilaComparativa = {
  grupo: GrupoComparativa;
  etiqueta: string;
  /** Valor por plan. `boolean` pinta ✓ / –; `string` se muestra tal cual. */
  valor: (p: Plan) => string | boolean;
  /** Aparece también en la tabla "Comparación rápida". */
  destacada?: boolean;
};

export const FILAS_COMPARATIVA: FilaComparativa[] = [
  // Tu menú
  {
    grupo: "Tu menú",
    etiqueta: "Sucursales",
    valor: (p) => textoLimite(p.limite_sucursales),
    destacada: true,
  },
  {
    grupo: "Tu menú",
    etiqueta: "Productos",
    valor: (p) => textoLimite(p.limite_productos),
    destacada: true,
  },
  {
    grupo: "Tu menú",
    etiqueta: "Grupos de modificadores",
    valor: (p) => textoLimite(p.limite_grupos_modificadores),
  },
  {
    grupo: "Tu menú",
    etiqueta: "Formatos visuales",
    valor: (p) =>
      p.limite_formatos === null
        ? "Los 4"
        : p.limite_formatos === 1
          ? "Solo Clásico"
          : `Clásico + ${p.limite_formatos - 1} a elegir`,
    destacada: true,
  },
  {
    grupo: "Tu menú",
    etiqueta: "Menú y precios propios por sucursal",
    valor: (p) => p.menu_independiente_por_sucursal,
    destacada: true,
  },
  { grupo: "Tu menú", etiqueta: "Sin marca de agua", valor: (p) => !p.marca_agua, destacada: true },

  // Contenido
  { grupo: "Contenido", etiqueta: "1 foto por producto", valor: () => true }, // fijo
  { grupo: "Contenido", etiqueta: "Video por URL embebida", valor: () => true }, // fijo

  // Diseño
  {
    grupo: "Diseño",
    etiqueta: "Tipografías",
    valor: (p) => `${fuentesDelPlan(p).length} de ${CLAVES_FUENTE.length}`,
  },
  { grupo: "Diseño", etiqueta: "Color de acento, fondo y texto", valor: () => true }, // fijo
  {
    grupo: "Diseño",
    etiqueta: "Color de los modificadores",
    valor: (p) => permiteColorModificadores(p),
  },
  {
    grupo: "Diseño",
    etiqueta: "Imagen de fondo",
    valor: (p) => {
      const modos = modosImagenDelPlan(p);
      if (modos.length === 0) return false;
      return modos.length === 1 ? "Modo marco" : "Marco y fondo completo";
    },
  },
  { grupo: "Diseño", etiqueta: "Desenfoque detrás del texto", valor: (p) => permiteDesenfoque(p) },

  // Tu QR
  { grupo: "Tu QR", etiqueta: "QR imprimible con tu nombre", valor: () => true }, // fijo
  { grupo: "Tu QR", etiqueta: "Los colores de tu menú en el QR", valor: (p) => permiteQrColor(p) },
  {
    grupo: "Tu QR",
    etiqueta: "Tu tipografía, tu logo y tu foto en el QR",
    valor: (p) => permiteQrAvanzado(p),
  },

  // Tu equipo
  {
    grupo: "Tu equipo",
    etiqueta: "Usuarios del panel",
    valor: (p) => textoLimite(p.limite_usuarios),
  },
  {
    grupo: "Tu equipo",
    etiqueta: "Varios usuarios en el panel",
    valor: (p) => p.permite_multiusuario,
  },
  {
    grupo: "Tu equipo",
    etiqueta: "Dominio propio",
    valor: (p) => p.permite_dominio_propio,
    destacada: true,
  },

  // Pedidos y reseñas
  {
    grupo: "Pedidos y reseñas",
    etiqueta: "Pedir por WhatsApp",
    valor: (p) => p.permite_pedidos_whatsapp,
    destacada: true,
  },
  {
    grupo: "Pedidos y reseñas",
    etiqueta: "Embudo a reseñas de Google",
    valor: (p) => p.permite_embudo_resenas,
    destacada: true,
  },
  {
    grupo: "Pedidos y reseñas",
    etiqueta: "Reservaciones",
    valor: (p) => p.permite_reservaciones,
    destacada: true,
  },

  // Fidelización y analítica
  {
    grupo: "Fidelización y analítica",
    etiqueta: "Tarjeta de lealtad con QR",
    valor: (p) => p.permite_lealtad,
    destacada: true,
  },
  {
    grupo: "Fidelización y analítica",
    etiqueta: "Analítica por platillo",
    valor: (p) => p.permite_analitica_platillo,
    destacada: true,
  },

  // Soporte
  { grupo: "Soporte", etiqueta: "Soporte por correo", valor: () => true }, // fijo
  {
    grupo: "Soporte",
    etiqueta: "Soporte prioritario",
    // fijo: no hay columna en `planes`; solo enterprise
    valor: (p) => (p.nombre as NombrePlan) === "enterprise",
  },
  { grupo: "Soporte", etiqueta: "Precio congelado al suscribirte", valor: () => true }, // fijo
  {
    grupo: "Soporte",
    etiqueta: "Descuento en plan anual",
    valor: (p) => p.precio_mxn_anual != null,
  },
];

/** Filas de un grupo, en orden. Si `soloDestacadas`, únicamente las de la vista rápida. */
export function filasDeGrupo(grupo: GrupoComparativa, soloDestacadas = false): FilaComparativa[] {
  return FILAS_COMPARATIVA.filter((f) => f.grupo === grupo && (!soloDestacadas || f.destacada));
}

/** Grupos que tienen al menos una fila (respetando `soloDestacadas`), en orden. */
export function gruposConFilas(soloDestacadas = false): GrupoComparativa[] {
  return GRUPOS_COMPARATIVA.filter((g) => filasDeGrupo(g, soloDestacadas).length > 0);
}
