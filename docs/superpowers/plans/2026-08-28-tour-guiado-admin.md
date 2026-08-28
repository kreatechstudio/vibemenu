# Tour guiado en el panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los 3 ítems "creables/personalizables" del modal de ayuda (Mi carta, Diseño, QR)
abran, al hacer clic, un recorrido guiado tipo spotlight (driver.js) sobre la página real,
señalando los controles reales de crear/editar/personalizar.

**Architecture:** Un wrapper delgado sobre `driver.js` (`src/lib/tour.ts`) que centraliza el
theming y los textos en español. Cada una de las 3 páginas declara su propio array de pasos
(selector CSS + título + descripción) apuntando a atributos `data-tour="..."` nuevos en su
propio JSX, y arranca el tour leyendo un query param `?tour=1` que el modal de ayuda agrega al
navegar. `driver.js` con `skipMissingElement: true` salta solo cualquier paso cuyo elemento no
exista todavía (categoría/producto/sucursal que el negocio aún no tiene) — sin condicionales
propias por página.

**Tech Stack:** React 19, TanStack Router (file-based, `getRouteApi` para evitar imports
circulares entre ruta y página), driver.js 1.8, Tailwind (tokens `vm-*`), bun:test.

**Spec:** `docs/superpowers/specs/2026-08-28-tour-guiado-admin-design.md`

## Global Constraints

- Todo el copy de los pasos va en español, mismo tono cálido-pero-directo del resto del repo.
- Reusar SIEMPRE lo que ya existe: `Modal` (`@/components/ui/modal`), `TUTORIAL` (`@/lib/copy`),
  `getRouteApi`/`useNavigate` de `@tanstack/react-router` — no reimplementar.
- Clases Tailwind: solo tokens `vm-*` ya definidos (`text-vm-ink`, `text-vm-body`,
  `bg-vm-primary`, `bg-vm-primary/10`) — no inventar colores nuevos. El theming de driver.js
  usa las variables CSS ya definidas en `src/styles.css` (`--vm-primary`, `--vm-ink`,
  `--vm-body`, `--font-sans`), no valores hardcodeados nuevos.
- **`src/lib/tour.ts` NO lleva archivo de test, y ningún `src/lib/*.test.ts` existente debe
  importarlo.** Ese archivo importa `"driver.js/dist/driver.css"` a nivel de módulo — si un test
  de `bun test src/lib` llegara a importarlo transitivamente, rompería el mismo tipo de bug ya
  encontrado y corregido en la feature anterior (registro asistido: un import a nivel de módulo
  que revienta en un entorno sin bundler). No es necesario mockearlo: basta con no crear ese
  import.
- No hay setup de testing de componentes React en este repo (`bun test` solo corre `src/lib`).
  Las páginas se verifican con `bun run typecheck` + prueba manual en `bun dev`.
- No tocar `AdminLayout.tsx` más allá de lo ya hecho en la feature anterior (el botón de ayuda
  ya vive ahí) — esta feature solo modifica `TutorialAyuda.tsx` y las 3 páginas/rutas de Mi
  carta, Diseño y QR.

---

### Task 1: `src/lib/tour.ts` — wrapper de driver.js + theming

**Files:**
- Modify: `package.json` (vía `bun add`)
- Create: `src/lib/tour.ts`
- Modify: `src/styles.css` (agrega bloque de theming al final)

**Interfaces:**
- Produces: `type PasoTour = { elemento?: string; titulo: string; descripcion: string }` y
  `crearTour(pasos: PasoTour[]): Driver` (tipo `Driver` de `driver.js`) — lo consumen las
  Tasks 4, 5 y 6.

- [ ] **Step 1: Instalar la dependencia**

Run: `bun add driver.js@^1.8.0`

Expected: `package.json` gana `"driver.js": "^1.8.0"` en `dependencies`, `bun.lock` se
actualiza.

- [ ] **Step 2: Crear `src/lib/tour.ts`**

```typescript
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

/**
 * Paso de un tour guiado, en español. `elemento` es el selector CSS del
 * control real que se señala (un atributo `data-tour="..."` en el JSX de la
 * página) — sin él, el paso se muestra centrado, sin spotlight.
 */
export type PasoTour = {
  elemento?: string;
  titulo: string;
  descripcion: string;
};

/**
 * Arma un tour de driver.js a partir de pasos en español. `skipMissingElement`
 * hace que cualquier paso cuyo elemento no exista hoy en el DOM (una
 * categoría que el negocio aún no crea, una sucursal que no tiene) se salte
 * solo, en vez de romper el tour — así cada página declara su tour "ideal"
 * sin armar condicionales propias para cada estado vacío.
 */
export function crearTour(pasos: PasoTour[]) {
  const steps: DriveStep[] = pasos.map((p) => ({
    element: p.elemento,
    popover: { title: p.titulo, description: p.descripcion },
  }));

  return driver({
    steps,
    showProgress: true,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Siguiente",
    prevBtnText: "Atrás",
    doneBtnText: "Listo",
    skipMissingElement: true,
    popoverClass: "vm-tour-popover",
  });
}
```

- [ ] **Step 3: Agregar el theming al final de `src/styles.css`**

El archivo termina hoy en el `@utility vm-data { ... }`. Agregar, después de ese bloque:

```css

/* Tour guiado del panel admin (driver.js) — combina con los tokens vm-*. */
.vm-tour-popover.driver-popover {
  border-radius: 0.75rem;
  box-shadow: 0 8px 24px rgba(11, 11, 15, 0.16);
  font-family: var(--font-sans);
  padding: 1.25rem;
}

.vm-tour-popover .driver-popover-title {
  color: var(--vm-ink);
  font-size: 1rem;
  font-weight: 600;
}

.vm-tour-popover .driver-popover-description {
  color: var(--vm-body);
  font-size: 0.875rem;
  line-height: 1.5;
}

.vm-tour-popover .driver-popover-progress-text {
  color: var(--vm-body);
  font-size: 0.75rem;
}

.vm-tour-popover .driver-popover-footer-btn {
  border-radius: 0.5rem;
  border: none;
  background: var(--vm-primary);
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 500;
  padding: 0.5rem 0.875rem;
  text-shadow: none;
}

.vm-tour-popover .driver-popover-footer-btn:hover {
  background: var(--vm-primary-hover);
}

.vm-tour-popover .driver-popover-close-btn {
  color: var(--vm-body);
}
```

- [ ] **Step 4: Verificar que compila**

Run: `bun run typecheck`
Expected: sin errores. (`tsconfig.json` ya incluye `"types": ["vite/client", "bun"]`, que trae
la declaración ambiental de módulos `*.css` — el `import "driver.js/dist/driver.css"` no
necesita configuración adicional.)

- [ ] **Step 5: Verificar que `src/lib` sigue pasando limpio**

Run: `bun test src/lib`
Expected: mismo número de tests que antes, todos PASS — `tour.ts` no tiene test propio y
ningún test existente lo importa (ver Global Constraints).

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock src/lib/tour.ts src/styles.css
git commit -m "feat: agrega driver.js y wrapper de tour guiado"
```

---

### Task 2: `validateSearch` en las 3 rutas (Mi carta, Diseño, QR)

**Files:**
- Modify: `src/routes/admin.menu.tsx`
- Modify: `src/routes/admin.diseno.tsx`
- Modify: `src/routes/admin.qr.tsx`

**Interfaces:**
- Produces: cada ruta acepta y expone un search param `{ tour?: boolean }`. Lo consume
  `TutorialAyuda.tsx` (Task 3, vía `navigate({ to, search: { tour: true } })`) y las propias
  páginas (Tasks 4-6, vía `getRouteApi(id).useSearch()`).

- [ ] **Step 1: `src/routes/admin.menu.tsx`**

Reemplazar el archivo completo:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import Menu from "@/pages/admin/Menu";

export const Route = createFileRoute("/admin/menu")({
  component: Menu,
  validateSearch: (buscar: Record<string, unknown>): { tour?: boolean } => ({
    tour: buscar.tour ? true : undefined,
  }),
});
```

- [ ] **Step 2: `src/routes/admin.diseno.tsx`**

Reemplazar el archivo completo:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import Diseno from "@/pages/admin/Diseno";

export const Route = createFileRoute("/admin/diseno")({
  component: Diseno,
  validateSearch: (buscar: Record<string, unknown>): { tour?: boolean } => ({
    tour: buscar.tour ? true : undefined,
  }),
});
```

- [ ] **Step 3: `src/routes/admin.qr.tsx`**

Reemplazar el archivo completo:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import QR from "@/pages/admin/QR";

export const Route = createFileRoute("/admin/qr")({
  component: QR,
  validateSearch: (buscar: Record<string, unknown>): { tour?: boolean } => ({
    tour: buscar.tour ? true : undefined,
  }),
});
```

- [ ] **Step 4: Verificar que compila**

Run: `bun run typecheck`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin.menu.tsx src/routes/admin.diseno.tsx src/routes/admin.qr.tsx
git commit -m "feat: agrega search param tour a las rutas de Mi carta, Diseno y QR"
```

---

### Task 3: `TutorialAyuda.tsx` — 3 ítems abren su tour

**Files:**
- Modify: `src/components/layout/TutorialAyuda.tsx` (reemplazo completo)

**Interfaces:**
- Consumes: search param `{ tour?: boolean }` de las 3 rutas (Task 2) — navega con
  `search: { tour: true }`.

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence } from "framer-motion";
import {
  Building2,
  ChevronRight,
  HelpCircle,
  LayoutDashboard,
  Palette,
  QrCode,
  UtensilsCrossed,
  X,
} from "lucide-react";
import Modal from "@/components/ui/modal";
import { TUTORIAL } from "@/lib/copy";

/**
 * Íconos emparejados por posición con TUTORIAL.secciones (copy.ts) — mismo
 * orden que NAV en AdminLayout.tsx. Si cambia el orden de una lista, cambia
 * el de la otra.
 */
const ICONOS = [LayoutDashboard, UtensilsCrossed, Building2, Palette, QrCode];

/**
 * Botón de ayuda del header del admin: abre un modal con un resumen de las
 * 5 secciones del panel. Puramente manual — nunca se abre solo, sin estado
 * persistido. Complementa (no reemplaza) el tour guiado por pestaña que
 * documenta vibemenu_registro_asistido.md §6, pospuesto hasta que Diseño.tsx
 * se estabilice.
 *
 * 3 de las 5 secciones (Mi carta, Diseño, QR — índices 1, 3, 4) además
 * arrancan un recorrido guiado (driver.js) sobre la página real: navega ahí
 * con `?tour=1` y la propia página lo arranca (ver PASOS_TOUR_* en cada
 * página). Resumen y Mi negocio (0, 2) se quedan sin esa opción — son de
 * solo-lectura/datos, no de crear-editar-personalizar.
 */
export default function TutorialAyuda() {
  const [abierto, setAbierto] = useState(false);
  const navigate = useNavigate();

  const accionesTour: Partial<Record<number, () => void>> = {
    1: () => {
      setAbierto(false);
      void navigate({ to: "/admin/menu", search: { tour: true } });
    },
    3: () => {
      setAbierto(false);
      void navigate({ to: "/admin/diseno", search: { tour: true } });
    },
    4: () => {
      setAbierto(false);
      void navigate({ to: "/admin/qr", search: { tour: true } });
    },
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm text-vm-ink hover:bg-vm-bg-soft"
      >
        <HelpCircle className="size-4" aria-hidden />
        <span className="hidden sm:inline">{TUTORIAL.boton}</span>
      </button>

      <AnimatePresence>
        {abierto && (
          <Modal
            alCerrar={() => setAbierto(false)}
            etiqueta={TUTORIAL.titulo}
            anchoMaximo="sm:max-w-lg"
          >
            <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
              <h2 className="text-lg">{TUTORIAL.titulo}</h2>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="text-vm-body"
              >
                <X className="size-5" />
              </button>
            </header>

            <div className="space-y-5 p-5">
              <p className="text-sm text-vm-body">{TUTORIAL.intro}</p>

              <ul className="space-y-4">
                {TUTORIAL.secciones.map((seccion, i) => {
                  const Icono = ICONOS[i];
                  const iniciarTour = accionesTour[i];

                  const contenido = (
                    <>
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-vm-primary/10">
                        <Icono className="size-4.5 text-vm-primary" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-vm-ink">{seccion.etiqueta}</p>
                        <p className="mt-0.5 text-sm text-vm-body">{seccion.descripcion}</p>
                      </div>
                    </>
                  );

                  if (!iniciarTour) {
                    return (
                      <li key={seccion.etiqueta} className="flex gap-3">
                        {contenido}
                      </li>
                    );
                  }

                  return (
                    <li key={seccion.etiqueta}>
                      <button
                        type="button"
                        onClick={iniciarTour}
                        className="group -m-1.5 flex w-full items-start gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-vm-bg-soft"
                      >
                        {contenido}
                        <span className="mt-1 flex shrink-0 items-center gap-0.5 text-xs font-medium text-vm-primary opacity-0 transition-opacity group-hover:opacity-100">
                          Ver tour
                          <ChevronRight className="size-3.5" aria-hidden />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `bun run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/TutorialAyuda.tsx
git commit -m "feat: los items de Mi carta, Diseno y QR abren su tour guiado"
```

---

### Task 4: Tour de Mi carta (`Menu.tsx`)

**Files:**
- Modify: `src/pages/admin/Menu.tsx`

**Interfaces:**
- Consumes: `crearTour`, `type PasoTour` (`@/lib/tour`, Task 1); `getRouteApi` de
  `@tanstack/react-router`; search param `{ tour?: boolean }` de `/admin/menu` (Task 2).

- [ ] **Step 1: Agregar imports**

En `src/pages/admin/Menu.tsx`, reemplazar la primera línea:

```tsx
import { useEffect, useState } from "react";
```

por:

```tsx
import { useEffect, useRef, useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
```

Y agregar, junto a los demás imports de `@/lib/...` (después de `import { cn } from "@/lib/utils";`):

```tsx
import { crearTour, type PasoTour } from "@/lib/tour";
```

- [ ] **Step 2: Declarar `routeApi` y los pasos del tour**

Justo antes de `export default function Menu() {`, agregar:

```tsx
const routeApi = getRouteApi("/admin/menu");

const PASOS_TOUR_CARTA: PasoTour[] = [
  {
    titulo: "Mi carta",
    descripcion: "Aquí armas tu menú: categorías a la izquierda, productos a la derecha.",
  },
  {
    elemento: '[data-tour="carta-nueva-categoria"]',
    titulo: "Crea una categoría",
    descripcion: 'Empieza creando una categoría, como "Bebidas" o "Entradas".',
  },
  {
    elemento: '[data-tour="carta-lista-categorias"]',
    titulo: "Elige una categoría",
    descripcion: "Selecciona una categoría para ver y agregar sus productos.",
  },
  {
    elemento: '[data-tour="carta-agregar-producto"]',
    titulo: "Agrega un producto",
    descripcion: "Agrega tus platillos: nombre, precio, foto y descripción.",
  },
  {
    elemento: '[data-tour="carta-productos"]',
    titulo: "Edita o personaliza",
    descripcion:
      "Haz clic en cualquier producto para editarlo o agregarle modificadores (tamaños, extras).",
  },
  {
    elemento: '[data-tour="carta-activo-borrador"]',
    titulo: "Activo o borrador",
    descripcion: "Desactiva un producto sin borrarlo si se te acaba por un día.",
  },
];
```

- [ ] **Step 3: Leer el search param y arrancar el tour**

Dentro de `function Contenido() {`, reemplazar:

```tsx
  const crearCategoria = useCrearCategoria(tenantId);
  const borrarCategoria = useBorrarCategoria(tenantId);
  const alternarActivo = useAlternarActivo(tenantId);
```

por:

```tsx
  const crearCategoria = useCrearCategoria(tenantId);
  const borrarCategoria = useBorrarCategoria(tenantId);
  const alternarActivo = useAlternarActivo(tenantId);

  const { tour } = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const tourIniciado = useRef(false);
```

Y agregar un nuevo `useEffect`, justo después del `useEffect` existente que auto-selecciona la
primera categoría (el que termina en `}, [idsVisibles, seleccionada]);`):

```tsx
  useEffect(() => {
    if (!tour || !ctx || tourIniciado.current) return;
    tourIniciado.current = true;
    requestAnimationFrame(() => crearTour(PASOS_TOUR_CARTA).drive());
    void navigate({ search: {}, replace: true });
  }, [tour, ctx, navigate]);
```

(Va antes de `if (!ctx) return null;` — todos los hooks del componente ya viven arriba de ese
`return`, este no rompe esa regla.)

- [ ] **Step 4: Atributo `data-tour` en "Nueva" (categoría)**

Reemplazar:

```tsx
            <button
              type="button"
              onClick={() => setCreandoCategoria(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-vm-primary hover:underline"
            >
              <FolderPlus className="size-3.5" aria-hidden />
              Nueva
            </button>
```

por:

```tsx
            <button
              type="button"
              data-tour="carta-nueva-categoria"
              onClick={() => setCreandoCategoria(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-vm-primary hover:underline"
            >
              <FolderPlus className="size-3.5" aria-hidden />
              Nueva
            </button>
```

- [ ] **Step 5: Atributo `data-tour` en la lista de categorías**

Reemplazar:

```tsx
        {/* Categorías */}
        <aside>
```

por:

```tsx
        {/* Categorías */}
        <aside data-tour="carta-lista-categorias">
```

- [ ] **Step 6: Atributo `data-tour` en "Agregar Producto" (header)**

Reemplazar:

```tsx
        <button
          type="button"
          disabled={!categoria || topado}
          onClick={() => setEditando({ producto: null })}
          title={topado ? ESTADOS.limiteProductos : undefined}
          className="inline-flex h-12 items-center gap-2 rounded-lg bg-vm-primary px-5 text-sm font-medium text-white hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden />
          {BOTONES.agregarProducto}
        </button>
```

por:

```tsx
        <button
          type="button"
          data-tour="carta-agregar-producto"
          disabled={!categoria || topado}
          onClick={() => setEditando({ producto: null })}
          title={topado ? ESTADOS.limiteProductos : undefined}
          className="inline-flex h-12 items-center gap-2 rounded-lg bg-vm-primary px-5 text-sm font-medium text-white hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden />
          {BOTONES.agregarProducto}
        </button>
```

- [ ] **Step 7: Atributo `data-tour` en la sección de productos**

Reemplazar:

```tsx
        {/* Productos */}
        <section>
```

por:

```tsx
        {/* Productos */}
        <section data-tour="carta-productos">
```

- [ ] **Step 8: Atributo `data-tour` en el toggle activo/borrador**

Reemplazar:

```tsx
                      <label className="pointer-events-auto mt-2 flex w-fit items-center gap-2 text-xs text-vm-body">
                        <input
                          type="checkbox"
                          checked={p.activo}
```

por:

```tsx
                      <label
                        data-tour="carta-activo-borrador"
                        className="pointer-events-auto mt-2 flex w-fit items-center gap-2 text-xs text-vm-body"
                      >
                        <input
                          type="checkbox"
                          checked={p.activo}
```

- [ ] **Step 9: Verificar que compila**

Run: `bun run typecheck`
Expected: sin errores.

- [ ] **Step 10: Prueba manual**

Run: `bun dev`, abrir `/admin`, hacer clic en "Ayuda" → "Mi carta". Confirmar: navega a
`/admin/menu`, el tour arranca solo y señala en orden los 6 controles reales. Probar también
con la carta vacía (sin categorías) — los pasos que apuntan a algo que no existe deben
saltarse solos, no romper el tour.

- [ ] **Step 11: Commit**

```bash
git add src/pages/admin/Menu.tsx
git commit -m "feat: agrega tour guiado a Mi carta"
```

---

### Task 5: Tour de Diseño (`Diseno.tsx`)

**Files:**
- Modify: `src/pages/admin/Diseno.tsx`

**Interfaces:**
- Consumes: `crearTour`, `type PasoTour` (`@/lib/tour`, Task 1); `getRouteApi`; search param
  `{ tour?: boolean }` de `/admin/diseno` (Task 2).

- [ ] **Step 1: Agregar imports**

Reemplazar la primera línea:

```tsx
import { useRef, useState } from "react";
```

por:

```tsx
import { useEffect, useRef, useState } from "react";
```

Reemplazar:

```tsx
import { Link } from "@tanstack/react-router";
```

por:

```tsx
import { Link, getRouteApi } from "@tanstack/react-router";
```

Y junto a los demás imports de `@/lib/...` (después de `import { cn } from "@/lib/utils";`):

```tsx
import { crearTour, type PasoTour } from "@/lib/tour";
```

- [ ] **Step 2: Declarar `routeApi` y los pasos del tour**

Justo antes de `export default function Diseno() {`, agregar:

```tsx
const routeApi = getRouteApi("/admin/diseno");

const PASOS_TOUR_DISENO: PasoTour[] = [
  {
    elemento: '[data-tour="diseno-formatos"]',
    titulo: "Elige tu formato",
    descripcion: "Elige cómo se ve tu menú: Clásico, Pinterest, Instagram o TikTok.",
  },
  {
    elemento: '[data-tour="diseno-tipografia"]',
    titulo: "Tipografía",
    descripcion: "Elige la tipografía que combine con tu marca.",
  },
  {
    elemento: '[data-tour="diseno-colores"]',
    titulo: "Colores",
    descripcion: "Personaliza los colores de acento, fondo, texto y modificadores.",
  },
  {
    elemento: '[data-tour="diseno-fondo"]',
    titulo: "Imagen de fondo",
    descripcion: "Sube o cambia la imagen de fondo para darle más personalidad a tu menú.",
  },
  {
    elemento: '[data-tour="diseno-preview"]',
    titulo: "Vista previa",
    descripcion: "Aquí ves los cambios en tiempo real antes de guardar.",
  },
  {
    elemento: '[data-tour="diseno-guardar"]',
    titulo: "No olvides guardar",
    descripcion: "Guarda tus cambios para que se vean en tu menú público.",
  },
];
```

- [ ] **Step 3: Leer el search param y arrancar el tour**

Dentro de `function Contenido() {`, reemplazar:

```tsx
  const [tema, setTema] = useState<TemaTenant>((ctx?.tenant.tema ?? {}) as TemaTenant);
  // Solo se borra la imagen vieja si el guardado sale bien.
  const fondoOriginal = useRef(((ctx?.tenant.tema ?? {}) as TemaTenant).imagen_fondo_url ?? null);

  if (!ctx) return null;
```

por:

```tsx
  const [tema, setTema] = useState<TemaTenant>((ctx?.tenant.tema ?? {}) as TemaTenant);
  // Solo se borra la imagen vieja si el guardado sale bien.
  const fondoOriginal = useRef(((ctx?.tenant.tema ?? {}) as TemaTenant).imagen_fondo_url ?? null);

  const { tour } = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const tourIniciado = useRef(false);

  useEffect(() => {
    if (!tour || !ctx || tourIniciado.current) return;
    tourIniciado.current = true;
    requestAnimationFrame(() => crearTour(PASOS_TOUR_DISENO).drive());
    void navigate({ search: {}, replace: true });
  }, [tour, ctx, navigate]);

  if (!ctx) return null;
```

- [ ] **Step 4: Atributo `data-tour` en la vista previa**

Reemplazar:

```tsx
        <aside className="sticky top-0 z-20 -mx-4 mb-6 border-b bg-white/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8 xl:order-2 xl:mx-0 xl:mb-0 xl:self-start xl:border-0 xl:bg-transparent xl:px-0 xl:py-0 xl:backdrop-blur-none">
```

por:

```tsx
        <aside
          data-tour="diseno-preview"
          className="sticky top-0 z-20 -mx-4 mb-6 border-b bg-white/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8 xl:order-2 xl:mx-0 xl:mb-0 xl:self-start xl:border-0 xl:bg-transparent xl:px-0 xl:py-0 xl:backdrop-blur-none"
        >
```

- [ ] **Step 5: Atributo `data-tour` en las tarjetas de formato**

Reemplazar:

```tsx
            {/* Carrusel táctil en móvil, rejilla desde md. */}
            <div className="tira-scroll -mx-4 mt-4 flex gap-3 px-4 pb-3 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 2xl:grid-cols-4">
```

por:

```tsx
            {/* Carrusel táctil en móvil, rejilla desde md. */}
            <div
              data-tour="diseno-formatos"
              className="tira-scroll -mx-4 mt-4 flex gap-3 px-4 pb-3 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 2xl:grid-cols-4"
            >
```

- [ ] **Step 6: Atributo `data-tour` en el selector de tipografía**

Reemplazar:

```tsx
            <div className="mt-4">
              <SelectorFuente
                valor={preview.fuente}
                permitidas={fuentesPermitidas}
                alElegir={(f) => parche({ fuente: f, tipografia: undefined })}
              />
            </div>
```

por:

```tsx
            <div data-tour="diseno-tipografia" className="mt-4">
              <SelectorFuente
                valor={preview.fuente}
                permitidas={fuentesPermitidas}
                alElegir={(f) => parche({ fuente: f, tipografia: undefined })}
              />
            </div>
```

- [ ] **Step 7: Atributo `data-tour` en los color pickers**

Reemplazar:

```tsx
            <div className="mt-4 flex flex-wrap gap-4">
              {(
                [
                  ["color_primario", "Acento", true],
```

por:

```tsx
            <div data-tour="diseno-colores" className="mt-4 flex flex-wrap gap-4">
              {(
                [
                  ["color_primario", "Acento", true],
```

- [ ] **Step 8: Atributo `data-tour` en la imagen de fondo (los dos estados)**

Reemplazar el bloque de "ya tiene imagen":

```tsx
                {tema.imagen_fondo_url ? (
                  <div className="mt-4 flex items-center gap-3">
                    <img
```

por:

```tsx
                {tema.imagen_fondo_url ? (
                  <div data-tour="diseno-fondo" className="mt-4 flex items-center gap-3">
                    <img
```

Y el botón de subir (estado sin imagen), reemplazar:

```tsx
                  <button
                    type="button"
                    onClick={() => inputImagen.current?.click()}
                    disabled={subiendo}
                    className="mt-4 flex h-28 w-full max-w-md flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-sm text-vm-body hover:bg-vm-bg-soft"
                  >
```

por:

```tsx
                  <button
                    type="button"
                    data-tour="diseno-fondo"
                    onClick={() => inputImagen.current?.click()}
                    disabled={subiendo}
                    className="mt-4 flex h-28 w-full max-w-md flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-sm text-vm-body hover:bg-vm-bg-soft"
                  >
```

(Los dos estados son mutuamente excluyentes — nunca coexisten en el DOM a la vez, así que
compartir el mismo `data-tour` no genera ambigüedad.)

- [ ] **Step 9: Atributo `data-tour` en Guardar**

Reemplazar:

```tsx
            <button
              type="submit"
              disabled={actualizar.isPending || subiendo}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-vm-primary px-6 text-sm font-medium text-white hover:bg-vm-primary-hover disabled:opacity-50 sm:flex-none"
            >
```

por:

```tsx
            <button
              type="submit"
              data-tour="diseno-guardar"
              disabled={actualizar.isPending || subiendo}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-vm-primary px-6 text-sm font-medium text-white hover:bg-vm-primary-hover disabled:opacity-50 sm:flex-none"
            >
```

- [ ] **Step 10: Verificar que compila**

Run: `bun run typecheck`
Expected: sin errores.

- [ ] **Step 11: Prueba manual**

Run: `bun dev`, "Ayuda" → "Diseño". Confirmar que arranca y señala los 6 pasos en orden.
Probar en un plan sin imagen de fondo habilitada (`hayImagen` falso) — el paso de imagen de
fondo debe saltarse solo (el botón/bloque no existe en el DOM en ese caso).

- [ ] **Step 12: Commit**

```bash
git add src/pages/admin/Diseno.tsx
git commit -m "feat: agrega tour guiado a Diseno"
```

---

### Task 6: Tour de QR (`QR.tsx`)

**Files:**
- Modify: `src/pages/admin/QR.tsx`

**Interfaces:**
- Consumes: `crearTour`, `type PasoTour` (`@/lib/tour`, Task 1); `getRouteApi`; search param
  `{ tour?: boolean }` de `/admin/qr` (Task 2).

- [ ] **Step 1: Agregar imports**

Reemplazar la primera línea:

```tsx
import { useRef, useState } from "react";
```

por:

```tsx
import { useEffect, useRef, useState } from "react";
```

Reemplazar:

```tsx
import { Link } from "@tanstack/react-router";
```

por:

```tsx
import { Link, getRouteApi } from "@tanstack/react-router";
```

Y junto a los demás imports de `@/lib/...` (después del bloque `import { ... } from "@/lib/qr";`):

```tsx
import { crearTour, type PasoTour } from "@/lib/tour";
```

- [ ] **Step 2: Declarar `routeApi` y los pasos del tour**

Justo antes de `export default function QR() {`, agregar:

```tsx
const routeApi = getRouteApi("/admin/qr");

const PASOS_TOUR_QR: PasoTour[] = [
  {
    elemento: '[data-tour="qr-preview"]',
    titulo: "Tu código QR",
    descripcion: "Este es el código QR de tu menú, listo para compartir.",
  },
  {
    elemento: '[data-tour="qr-copiar"]',
    titulo: "Copia el link",
    descripcion: "Cópialo si prefieres compartirlo por WhatsApp o redes.",
  },
  {
    elemento: '[data-tour="qr-descargar"]',
    titulo: "Descarga tu QR",
    descripcion:
      "Descarga la tarjeta en PNG para imprimir, o el SVG si quieres editarlo con un diseñador.",
  },
  {
    elemento: '[data-tour="qr-personalizacion"]',
    titulo: "Personalízalo",
    descripcion:
      "Decide qué información se ve en la tarjeta: descripción, colores, tipografía, tu logo o tu imagen de fondo.",
  },
  {
    elemento: '[data-tour="qr-sucursal"]',
    titulo: "Una por sucursal",
    descripcion: "Si tienes varias sucursales, cada una puede tener su propio QR.",
  },
];
```

- [ ] **Step 3: Leer el search param y arrancar el tour**

Dentro de `function Contenido() {`, reemplazar:

```tsx
  const [usarColores, setUsarColores] = useState(true);
  const [usarFuente, setUsarFuente] = useState(true);
  const [usarLogo, setUsarLogo] = useState(true);
  const [usarFondo, setUsarFondo] = useState(false);
  const [usarDescripcion, setUsarDescripcion] = useState(false);

  if (!ctx) return null;
```

por:

```tsx
  const [usarColores, setUsarColores] = useState(true);
  const [usarFuente, setUsarFuente] = useState(true);
  const [usarLogo, setUsarLogo] = useState(true);
  const [usarFondo, setUsarFondo] = useState(false);
  const [usarDescripcion, setUsarDescripcion] = useState(false);

  const { tour } = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const tourIniciado = useRef(false);

  useEffect(() => {
    if (!tour || !ctx || tourIniciado.current) return;
    tourIniciado.current = true;
    requestAnimationFrame(() => crearTour(PASOS_TOUR_QR).drive());
    void navigate({ search: {}, replace: true });
  }, [tour, ctx, navigate]);

  if (!ctx) return null;
```

- [ ] **Step 4: Atributo `data-tour` en el selector de sucursal**

Reemplazar:

```tsx
      {sucursales && sucursales.length > 0 && (
        <div className="mt-6">
```

por:

```tsx
      {sucursales && sucursales.length > 0 && (
        <div data-tour="qr-sucursal" className="mt-6">
```

- [ ] **Step 5: Atributo `data-tour` en la vista previa del QR**

Reemplazar:

```tsx
        <div className="min-w-0">
          <TarjetaQR opciones={opciones} refQr={refQr} />
```

por:

```tsx
        <div data-tour="qr-preview" className="min-w-0">
          <TarjetaQR opciones={opciones} refQr={refQr} />
```

- [ ] **Step 6: Atributo `data-tour` en copiar link**

Reemplazar:

```tsx
            <button
              type="button"
              onClick={() => void copiar()}
              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-vm-primary"
            >
```

por:

```tsx
            <button
              type="button"
              data-tour="qr-copiar"
              onClick={() => void copiar()}
              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-vm-primary"
            >
```

- [ ] **Step 7: Atributo `data-tour` en los botones de descarga**

Reemplazar:

```tsx
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={generando}
              onClick={() => void descargarPNG()}
```

por:

```tsx
          <div data-tour="qr-descargar" className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={generando}
              onClick={() => void descargarPNG()}
```

- [ ] **Step 8: Atributo `data-tour` en la personalización**

Reemplazar:

```tsx
          <div className="mt-4 space-y-2.5">
            <Opcion
              titulo="La descripción de mi negocio"
```

por:

```tsx
          <div data-tour="qr-personalizacion" className="mt-4 space-y-2.5">
            <Opcion
              titulo="La descripción de mi negocio"
```

- [ ] **Step 9: Verificar que compila**

Run: `bun run typecheck`
Expected: sin errores.

- [ ] **Step 10: Prueba manual**

Run: `bun dev`, "Ayuda" → "QR". Confirmar que arranca y señala los 4 o 5 pasos según haya
sucursales o no — con un tenant de una sola sucursal (o sin sucursales), el paso "Una por
sucursal" debe saltarse solo.

- [ ] **Step 11: Commit**

```bash
git add src/pages/admin/QR.tsx
git commit -m "feat: agrega tour guiado a QR"
```

---

### Task 7: QA final

**Files:** ninguno nuevo — verificación de todo lo anterior.

- [ ] **Step 1: Lint completo**

Run: `bun run lint`
Expected: sin errores nuevos (los 12 warnings preexistentes de `react-refresh` en archivos no
tocados por este plan son aceptables).

- [ ] **Step 2: Typecheck completo**

Run: `bun run typecheck`
Expected: sin errores.

- [ ] **Step 3: Tests de `src/lib`**

Run: `bun test src/lib`
Expected: PASS, mismo número de tests que antes de este plan (Task 1 no agrega tests propios
a propósito).

- [ ] **Step 4: Formato**

Run: `bun run format`

**Antes de aceptar el resultado:** correr `git status --short` y confirmar que el diff de
formato solo toca archivos de este plan (`src/lib/tour.ts`, `src/styles.css`,
`src/components/layout/TutorialAyuda.tsx`, `src/routes/admin.menu.tsx`,
`src/routes/admin.diseno.tsx`, `src/routes/admin.qr.tsx`, `src/pages/admin/Menu.tsx`,
`src/pages/admin/Diseno.tsx`, `src/pages/admin/QR.tsx`) — este repo tiene sesiones
concurrentes trabajando en otras ramas en el mismo checkout; `prettier --write .` es
repo-wide y puede tocar archivos ajenos que no le tocan a este plan. Si aparece algo fuera de
esa lista, `git checkout -- <archivo>` antes de continuar.

- [ ] **Step 5: Prueba manual completa de los 3 tours**

Run: `bun dev`, abrir `/admin`, y para cada uno de los 3 ítems del modal de ayuda (Mi carta,
Diseño, QR):

1. Clic en "Ayuda" → clic en el ítem → confirmar que navega, cierra el modal y el tour arranca
   solo, señalando el elemento correcto en cada paso.
2. Recorrer con "Siguiente" hasta el final, confirmar que "Listo" cierra el tour.
3. Volver a abrir el mismo tour y probar "Atrás" y "Salir" (click fuera / tecla Esc).
4. Confirmar que Resumen y Mi negocio, en el modal de ayuda, NO tienen la opción "Ver tour" —
   son filas planas.
5. Refrescar la página después de que un tour ya arrancó — confirmar que no se repite solo
   (el query param se limpia).

- [ ] **Step 6: Commit final si el formato tocó algo**

```bash
git add -A
git commit -m "chore: formato final del tour guiado"
```

(Omitir este paso si `bun run format` no generó cambios en los archivos de este plan.)
