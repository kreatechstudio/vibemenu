# Comparativa completa de planes — Diseño

**Fecha:** 2026-09-03
**Estado:** aprobado (brainstorm en chat, 3 decisiones cerradas con el usuario)

## Problema

La página pública `/precios` tiene una tabla comparativa ("Comparar planes") que
lee de la tabla `planes`, pero se quedó atrás: **no menciona ninguna de las 5
funciones de P1/P2** ya en producción (pedidos por WhatsApp, embudo a reseñas,
reservaciones, tarjeta de lealtad, analítica por platillo). Tampoco aparece el
soporte prioritario ni notas de contenido (1 foto por producto, video por URL).

Antes del lanzamiento oficial el cliente necesita **un lugar donde verificar,
función por función, exactamente qué incluye y qué no incluye cada plan**.

`src/docs/vibemenu_alcance.md` (fuente de verdad interna) tiene el mismo desfase:
su tabla de planes dice que Basic solo trae "Sin marca de agua", cuando en `planes`
Basic ya tiene `permite_pedidos_whatsapp = true` y `permite_embudo_resenas = true`.

## Estado real de `planes` (prod, consultado 2026-09-03)

| Capacidad | Free | Basic | Pro | Enterprise | Columna |
|---|:-:|:-:|:-:|:-:|---|
| Sucursales | 1 | 1 | 3 | ∞ | `limite_sucursales` |
| Productos | 20 | ∞ | ∞ | ∞ | `limite_productos` |
| Grupos de modificadores | 2 | 5 | ∞ | ∞ | `limite_grupos_modificadores` |
| Usuarios del panel | 1 | 1 | 2 | ∞ | `limite_usuarios` |
| Formatos | Solo Clásico | Clásico + 1 | Los 4 | Los 4 | `limite_formatos` / `formatos_permitidos` |
| Tipografías | 2 | 6 | 12 | 12 | `fuentes_permitidas` |
| Menú y precios propios por sucursal | ✗ | ✗ | ✓ | ✓ | `menu_independiente_por_sucursal` |
| Sin marca de agua | ✗ | ✓ | ✓ | ✓ | `marca_agua` (invertida) |
| Color de los modificadores | ✗ | ✓ | ✓ | ✓ | `permite_color_modificadores` |
| Imagen de fondo | ✗ | Modo marco | Marco y completo | Marco y completo | `modos_imagen_permitidos` |
| Desenfoque detrás del texto | ✗ | ✗ | ✓ | ✓ | `permite_desenfoque` |
| QR con los colores de tu menú | ✗ | ✓ | ✓ | ✓ | `qr_color` |
| QR con tu logo, foto y tipografía | ✗ | ✗ | ✓ | ✓ | `qr_avanzado` |
| Multi-usuario | ✗ | ✗ | ✓ | ✓ | `permite_multiusuario` |
| Dominio propio | ✗ | ✗ | ✓ | ✓ | `permite_dominio_propio` |
| Pedir por WhatsApp | ✗ | ✓ | ✓ | ✓ | `permite_pedidos_whatsapp` |
| Embudo a reseñas de Google | ✗ | ✓ | ✓ | ✓ | `permite_embudo_resenas` |
| Reservaciones | ✗ | ✗ | ✓ | ✓ | `permite_reservaciones` |
| Tarjeta de lealtad con QR | ✗ | ✗ | ✓ | ✓ | `permite_lealtad` |
| Analítica por platillo | ✗ | ✗ | ✗ | ✓ | `permite_analitica_platillo` |
| Descuento en plan anual | ✗ | ✓ | ✓ | ✓ | `precio_mxn_anual` no nulo |
| 1 foto por producto | ✓ | ✓ | ✓ | ✓ | — (fijo) |
| Video por URL embebida | ✓ | ✓ | ✓ | ✓ | — (fijo) |
| Precio congelado al suscribirte | ✓ | ✓ | ✓ | ✓ | — (fijo) |
| Soporte por correo | ✓ | ✓ | ✓ | ✓ | — (fijo) |
| Soporte prioritario | ✗ | ✗ | ✗ | ✓ | — (fijo, solo `enterprise`) |

## Decisiones (cerradas con el usuario)

1. **Dos tablas**: la actual se recorta a una "Comparación rápida" (~8-9 filas
   estrella); debajo, una matriz **completa** con todas las capacidades agrupadas.
2. **La matriz completa incluye filas fijas** que no salen de la BD (foto por
   producto, video por URL, soporte prioritario, precio congelado). Se codifican
   a mano.
3. Se actualizan **las 3 superficies**: `/precios`, `vibemenu_alcance.md` y los
   headlines de `PLANES_COPY` en `src/lib/copy.ts`.

## Diseño

### `src/lib/comparativa.ts` (nuevo, puro)

Mueve el modelo de datos de la tabla fuera del componente, siguiendo el patrón
de `src/lib/plan.ts` (helpers puros sobre `Plan`, nunca hardcodea un número —
lee la fila de `planes`; las filas fijas son la excepción explícita y documentada).

```ts
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
  { grupo: "Tu menú", etiqueta: "Sucursales", valor: (p) => textoLimite(p.limite_sucursales), destacada: true },
  { grupo: "Tu menú", etiqueta: "Productos", valor: (p) => textoLimite(p.limite_productos), destacada: true },
  { grupo: "Tu menú", etiqueta: "Grupos de modificadores", valor: (p) => textoLimite(p.limite_grupos_modificadores) },
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
  { grupo: "Tu menú", etiqueta: "Menú y precios propios por sucursal", valor: (p) => p.menu_independiente_por_sucursal, destacada: true },
  { grupo: "Tu menú", etiqueta: "Sin marca de agua", valor: (p) => !p.marca_agua, destacada: true },

  // Contenido
  { grupo: "Contenido", etiqueta: "1 foto por producto", valor: () => true },
  { grupo: "Contenido", etiqueta: "Video por URL embebida", valor: () => true },

  // Diseño
  { grupo: "Diseño", etiqueta: "Tipografías", valor: (p) => `${fuentesDelPlan(p).length} de ${CLAVES_FUENTE.length}` },
  { grupo: "Diseño", etiqueta: "Color de acento, fondo y texto", valor: () => true },
  { grupo: "Diseño", etiqueta: "Color de los modificadores", valor: (p) => permiteColorModificadores(p) },
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
  { grupo: "Tu QR", etiqueta: "QR imprimible con tu nombre", valor: () => true },
  { grupo: "Tu QR", etiqueta: "Los colores de tu menú en el QR", valor: (p) => permiteQrColor(p) },
  { grupo: "Tu QR", etiqueta: "Tu tipografía, tu logo y tu foto en el QR", valor: (p) => permiteQrAvanzado(p) },

  // Tu equipo
  { grupo: "Tu equipo", etiqueta: "Usuarios del panel", valor: (p) => textoLimite(p.limite_usuarios) },
  { grupo: "Tu equipo", etiqueta: "Varios usuarios en el panel", valor: (p) => p.permite_multiusuario },
  { grupo: "Tu equipo", etiqueta: "Dominio propio", valor: (p) => p.permite_dominio_propio, destacada: true },

  // Pedidos y reseñas
  { grupo: "Pedidos y reseñas", etiqueta: "Pedir por WhatsApp", valor: (p) => p.permite_pedidos_whatsapp, destacada: true },
  { grupo: "Pedidos y reseñas", etiqueta: "Embudo a reseñas de Google", valor: (p) => p.permite_embudo_resenas, destacada: true },
  { grupo: "Pedidos y reseñas", etiqueta: "Reservaciones", valor: (p) => p.permite_reservaciones },

  // Fidelización y analítica
  { grupo: "Fidelización y analítica", etiqueta: "Tarjeta de lealtad con QR", valor: (p) => p.permite_lealtad, destacada: true },
  { grupo: "Fidelización y analítica", etiqueta: "Analítica por platillo", valor: (p) => p.permite_analitica_platillo, destacada: true },

  // Soporte
  { grupo: "Soporte", etiqueta: "Soporte por correo", valor: () => true },
  { grupo: "Soporte", etiqueta: "Soporte prioritario", valor: (p) => (p.nombre as NombrePlan) === "enterprise" },
  { grupo: "Soporte", etiqueta: "Precio congelado al suscribirte", valor: () => true },
  { grupo: "Soporte", etiqueta: "Descuento en plan anual", valor: (p) => p.precio_mxn_anual != null },
];

/** Filas de un grupo, en orden. Si `soloDestacadas`, únicamente las de la vista rápida. */
export function filasDeGrupo(
  grupo: GrupoComparativa,
  soloDestacadas = false,
): FilaComparativa[] {
  return FILAS_COMPARATIVA.filter(
    (f) => f.grupo === grupo && (!soloDestacadas || f.destacada),
  );
}

/** Grupos que tienen al menos una fila (respetando `soloDestacadas`), en orden. */
export function gruposConFilas(soloDestacadas = false): GrupoComparativa[] {
  return GRUPOS_COMPARATIVA.filter((g) => filasDeGrupo(g, soloDestacadas).length > 0);
}
```

### `src/pages/Precios.tsx`

- Borra el tipo local `Fila`, el array `CARACTERISTICAS` y el const `GRUPOS`
  (ahora viven en `src/lib/comparativa.ts`).
- Extrae un componente `TablaComparativa({ planes, titulo, soloDestacadas })`
  que renderiza la tabla (el `<table>` que hoy está inline en `Precios()`),
  iterando `gruposConFilas(soloDestacadas)` y `filasDeGrupo(grupo, soloDestacadas)`.
  `Celda` no cambia.
- En `Precios()`, donde hoy está la tabla, renderiza **dos**:
  1. `<TablaComparativa planes={planes} titulo="Comparación rápida" soloDestacadas />`
     — justo debajo de `notaPrecioCongelado`, como ahora.
  2. Una sección nueva más abajo (con su `<h2>` "Todo lo que incluye cada plan"
     y una línea de apoyo) con
     `<TablaComparativa planes={planes} titulo="Comparar todo" />`.
- El `<th>` de la esquina de cada tabla muestra `titulo`.
- Se conserva el patrón responsive existente: `overflow-x-auto` + `min-w-[640px]`.
- Sin acordeón, sin estado nuevo: las dos tablas siempre visibles.

Copy de la sección nueva (añadir a `PRECIOS` en `src/lib/copy.ts`):

```ts
comparativaCompletaTitulo: "Todo lo que incluye cada plan",
comparativaCompletaNota:
  "Cada función, en cada plan. Lo que tu plan no incluye aparece con una raya (–).",
```

### `src/lib/copy.ts` — `PLANES_COPY`

Actualiza los `descripcion` para nombrar lo nuevo (sin inflar):

```ts
basic: {
  headline: "Para un solo local, sin límites de menú",
  descripcion:
    "Productos ilimitados, sin marca de agua, con pedidos por WhatsApp y embudo a reseñas de Google.",
  cta: "Elegir plan",
},
pro: {
  headline: "Para negocios que quieren destacar",
  descripcion:
    "Los 4 formatos, hasta 3 sucursales, dominio propio, reservaciones y tarjeta de lealtad con QR.",
  cta: "Elegir plan",
},
enterprise: {
  headline: "Para cadenas y grupos restauranteros",
  descripcion:
    "Todo lo de Pro sin límites, más analítica por platillo y soporte prioritario.",
  cta: "Contactar ventas",
},
```

`free` no cambia.

### `src/docs/vibemenu_alcance.md`

- **Tabla "Modelo de negocio — Planes"**, columna "Extras": alinear con `planes`.
  - Basic: `Sin marca de agua · Pedir por WhatsApp · Embudo a reseñas`
  - Pro: `Todo lo de Basic · Reservaciones · Tarjeta de lealtad · Dominio propio (CNAME)`
  - Enterprise: `Todo lo de Pro · Analítica por platillo · Soporte prioritario`
- Añadir, después de la tabla de "Personalización del menú por plan", una tabla
  nueva **"Funciones de conversión y fidelización por plan"** con las 5 columnas
  `permite_*` y sus valores reales (Free ✗ en todas; Basic ✓ WhatsApp/embudo;
  Pro + reservaciones/lealtad; Enterprise + analítica).
- Corregir el encabezado de la sección de reservaciones si dice "migración 012"
  — dejarlo como "(Pro/Enterprise)" sin número, consistente con el resto.

## Pruebas

`src/lib/comparativa.test.ts` (nuevo, `bun:test`), con un factory de `Plan`
parcial como el de `plan.test.ts`:

- Toda columna `permite_*` de `planes` tiene su fila en `FILAS_COMPARATIVA`
  (lista blanca explícita de las 5 etiquetas nuevas + las viejas).
- Un plan Free (todo restrictivo) da `false` en toda fila booleana salvo las
  fijas (`1 foto por producto`, `Video por URL embebida`, `Color de acento…`,
  `QR imprimible con tu nombre`, `Soporte por correo`, `Precio congelado…`).
- Un plan Enterprise da `true`/valor en toda fila booleana.
- `Soporte prioritario` es `true` solo con `nombre === "enterprise"`.
- `Descuento en plan anual` es `false` cuando `precio_mxn_anual === null`.
- `gruposConFilas(true)` ⊆ `gruposConFilas(false)`, y ambas en el orden de
  `GRUPOS_COMPARATIVA`.
- `filasDeGrupo(g, true)` son todas `destacada`.
- Hay entre 7 y 10 filas `destacada` (cota de cordura para la tabla rápida).

## Fuera de alcance

- Rediseño visual de la página o de las tarjetas de plan.
- Acordeón / colapsables.
- Tocar `/admin/suscripcion` (usa `PRECIOS.notaPrecioCongelado` y
  `PRECIOS.notaAhorroAnual`, que no cambian).
- Cambiar precios, gating, o cualquier columna de `planes`.
- Canal de ventas real para "Contactar ventas".

## Constraints

- TS estricto, 0 errores de `tsc` y `eslint` (los ~15 warnings de
  `react-refresh` preexistentes son tolerados).
- `bun test` verde; hoy son 199 tests, no deben bajar.
- Copy en español de México, tú/tu, sin signos de admiración de más
  (regla de `copy.ts`).
- La tabla comparativa nunca hardcodea un límite numérico: sale de `planes`.
  Las filas fijas (mismo valor en los 4 planes) son la única excepción y van
  comentadas como tal.
