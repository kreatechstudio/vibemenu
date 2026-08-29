# Carrito de WhatsApp — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El comensal marca platillos en el menú público (formatos Clásico, Pinterest, Instagram), una barra flotante abre una hoja de resumen editable, y "Enviar por WhatsApp" arma un mensaje `wa.me` prellenado al número de la sucursal. TikTok solo recibe un botón flotante con mensaje genérico.

**Architecture:** Lógica pura en `src/lib/` (testeable con `bun test src/lib`): `pedido.ts` arma el texto del mensaje, `carrito.ts` es el reducer del carrito. Un contexto React efímero (`useCarritoWhatsApp`) envuelve el cuerpo del menú y se remonta por sucursal. Componentes de presentación (`BotonAgregar`, `BarraPedido`, `HojaPedido`, `BotonPedidoTikTok`) consumen el contexto y se auto-ocultan si el plan o el número no habilitan la feature. Gating por flag de plan `planes.permite_pedidos_whatsapp` + resolución del WhatsApp vía `contactoSucursal` (#1).

**Tech Stack:** React 18 + TypeScript strict, TanStack Router/Query, framer-motion, lucide-react, Tailwind v4 (solo variables `--menu-*` en componentes de menú), `bun` (test/typecheck/lint/build), Supabase (una columna nueva, sin RPC).

**Spec:** `docs/superpowers/specs/2026-08-29-carrito-whatsapp-design.md`

## Global Constraints

- **Rama:** `feat/carrito-whatsapp` (ya creada, parte de `main`). Verificar `git branch --show-current` antes de cada commit — otra sesión comparte el checkout (lección de #2).
- **Toolchain:** `bun test src/lib` (el runner SOLO mira `src/lib` — por eso la lógica testeable vive ahí), `bun run typecheck`, `bun run lint`. `bun run build` solo en la tarea final.
- **Componentes de menú (`src/components/menu/`, `src/components/formatos/`):** SOLO variables `--menu-primario`, `--menu-fondo`, `--menu-texto`, `--menu-texto-suave`, `--menu-modificadores`. NUNCA clases `vm-*` ni el azul de Vibemenu. (`vm-data` sí se usa — es una clase de tipografía tabular, no color de marca; ya está en los formatos.)
- **Sin modificadores en el carrito v1:** la línea del pedido es `N × nombre — precio`. `producto.precio` ya viene resuelto por sucursal desde `armarMenuPublico`.
- **Carrito efímero:** nada de `localStorage` / `sessionStorage`. El provider se remonta (`key` por sucursal) y arranca vacío.
- **La migración ES un gate de deploy duro:** los 3 `.select("*, plan:planes(…, permite_pedidos_whatsapp)")` de `useMenuPublico` piden la columna, así que PostgREST responde 400 a TODA la consulta del menú público si falta (cada menú público se cae). Aplicar la migración antes o junto con el deploy.
- **Copy en español**, tono del producto (cercano, directo). Precios sin moneda escrita — `precioMenu()` ya pone `$`.
- **`Producto.id` es `string`.** Las claves del carrito son `producto.id`.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/docs/vibemenu_migracion_pedidos_whatsapp.sql` | Migración: flag `planes.permite_pedidos_whatsapp`. |
| `src/lib/pedido.ts` | Puro. `LineaPedido`, `totalPedido`, `construirMensajePedido`. |
| `src/lib/pedido.test.ts` | Suite `bun:test` de `pedido.ts`. |
| `src/lib/carrito.ts` | Puro. `ItemCarrito` + funciones del reducer (agregar, fijar cantidad, quitar, totales, líneas). |
| `src/lib/carrito.test.ts` | Suite `bun:test` de `carrito.ts`. |
| `src/hooks/useCarritoWhatsApp.tsx` | Contexto React efímero — cáscara delgada sobre `carrito.ts`. |
| `src/components/menu/BotonAgregar.tsx` | Control "agregar": `variante="stepper"` (− N +) o `"badge"` (+ flotante). Se auto-oculta si `!habilitado`. |
| `src/components/menu/HojaPedido.tsx` | Bottom-sheet: ítems editables, nota, total, enviar, vaciar. |
| `src/components/menu/BarraPedido.tsx` | Barra fija inferior "Ver pedido · N · $total"; dueña del sheet. |
| `src/components/menu/BotonPedidoTikTok.tsx` | Botón flotante para TikTok, mensaje genérico, sin carrito. |
| `src/components/menu/EmbudoResenas.tsx` | (modificar) + condición `carrito.cantidadTotal === 0`. |
| `src/hooks/useMenuPublico.ts` | (modificar) select del plan + `permitePedidosWhatsApp`. |
| `src/pages/MenuPublico.tsx` | (modificar) provider, `BarraPedido`, `BotonPedidoTikTok`, `pb-24`, cálculo `pedidosOn`. |
| `src/components/formatos/Clasico.tsx` | (modificar) `BotonAgregar` stepper por renglón. |
| `src/components/formatos/Pinterest.tsx` | (modificar) wrapper `relative` + badge + stepper en `Detalle`. |
| `src/components/formatos/Instagram.tsx` | (modificar) wrapper `relative` + badge + stepper en `Post`. |
| `src/pages/Demo.tsx` | (modificar) provider + `BarraPedido` + `BotonPedidoTikTok`. |
| `src/lib/demo.ts` | (modificar) `SUCURSAL_DEMO.whatsapp`. |
| `src/types/database.ts` | (modificar) `planes.permite_pedidos_whatsapp` en Row/Insert/Update. |

---

## Task 1: Migración + tipos

**Files:**
- Create: `src/docs/vibemenu_migracion_pedidos_whatsapp.sql`
- Modify: `src/types/database.ts` (tabla `planes`, secciones `Row` / `Insert` / `Update`)

**Interfaces:**
- Produces: columna `planes.permite_pedidos_whatsapp: boolean` en los tipos generados de Supabase.

- [ ] **Step 1: Escribir el archivo de migración**

Create `src/docs/vibemenu_migracion_pedidos_whatsapp.sql`:

```sql
begin;

alter table planes
  add column permite_pedidos_whatsapp boolean not null default false;

update planes set permite_pedidos_whatsapp = true where nombre <> 'free';

commit;

-- Verificar:
--   select nombre, permite_pedidos_whatsapp from planes order by precio_usd;
--   -- free=false, basic/pro/enterprise=true
--
-- Aplicar vía MCP `apply_migration` (name: "pedidos_whatsapp") o el SQL Editor.
--
-- GATE DE DEPLOY: requisito para desplegar la rama. `useMenuPublico` selecciona
-- `permite_pedidos_whatsapp` en tres consultas, así que si la columna falta
-- PostgREST responde 400 a toda la consulta del menú y cada menú público se cae.
-- Seguro aplicarla temprano (`not null default false`, nada viejo la lee).
```

- [ ] **Step 2: Hand-edit `src/types/database.ts` — `planes.Row`**

Busca la sección `planes: { Row: { ... } }` (cerca de la línea 400). Después de `permite_embudo_resenas: boolean;` agrega:

```ts
          permite_pedidos_whatsapp: boolean;
```

- [ ] **Step 3: Hand-edit `src/types/database.ts` — `planes.Insert` y `planes.Update`**

En las secciones `Insert:` y `Update:` de `planes`, después de `permite_embudo_resenas?: boolean;` agrega en cada una:

```ts
          permite_pedidos_whatsapp?: boolean;
```

- [ ] **Step 4: Verificar typecheck**

Run: `bun run typecheck`
Expected: PASS (sin errores nuevos).

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # debe decir feat/carrito-whatsapp
git add src/docs/vibemenu_migracion_pedidos_whatsapp.sql src/types/database.ts
git commit -m "feat: flag planes.permite_pedidos_whatsapp"
```

**Nota para el controller:** aplicar la migración en Supabase (MCP `apply_migration` o SQL Editor) cuando el MCP esté autorizado. No bloquea el resto del plan.

---

## Task 2: `src/lib/pedido.ts` — texto del mensaje

**Files:**
- Create: `src/lib/pedido.ts`
- Test: `src/lib/pedido.test.ts`

**Interfaces:**
- Consumes: `precioMenu(monto: number): string` de `@/lib/tema` → `"$1,234.00"`.
- Produces:
  - `type LineaPedido = { nombre: string; cantidad: number; precioUnitario: number }`
  - `totalPedido(lineas: LineaPedido[]): number`
  - `construirMensajePedido(params: { negocio: string; sucursal?: string | null; lineas: LineaPedido[]; nota?: string }): string`

- [ ] **Step 1: Escribir el test que falla**

Create `src/lib/pedido.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { construirMensajePedido, totalPedido, type LineaPedido } from "@/lib/pedido";

const lineas: LineaPedido[] = [
  { nombre: "Cappuccino", cantidad: 2, precioUnitario: 180 },
  { nombre: "Concha", cantidad: 1, precioUnitario: 45 },
];

describe("totalPedido", () => {
  test("suma cantidad x precioUnitario de cada linea", () => {
    expect(totalPedido(lineas)).toBe(405);
  });

  test("lista vacia => 0", () => {
    expect(totalPedido([])).toBe(0);
  });
});

describe("construirMensajePedido", () => {
  test("encabezado con sucursal", () => {
    const msg = construirMensajePedido({ negocio: "Café Aurora", sucursal: "Centro", lineas });
    expect(msg.startsWith("Hola, quiero hacer un pedido de Café Aurora (Centro):")).toBe(true);
  });

  test("encabezado sin sucursal (null o undefined)", () => {
    expect(
      construirMensajePedido({ negocio: "Café Aurora", sucursal: null, lineas }).startsWith(
        "Hola, quiero hacer un pedido de Café Aurora:",
      ),
    ).toBe(true);
    expect(
      construirMensajePedido({ negocio: "Café Aurora", lineas }).startsWith(
        "Hola, quiero hacer un pedido de Café Aurora:",
      ),
    ).toBe(true);
  });

  test("una linea se formatea con cantidad, nombre y subtotal", () => {
    const msg = construirMensajePedido({
      negocio: "X",
      lineas: [{ nombre: "Cappuccino", cantidad: 2, precioUnitario: 180 }],
    });
    expect(msg).toContain("• 2 × Cappuccino — $360.00");
    expect(msg).toContain("Total: $360.00");
  });

  test("nota con espacios => se recorta y va al final", () => {
    const msg = construirMensajePedido({
      negocio: "X",
      lineas,
      nota: "  a las 3pm  ",
    });
    expect(msg.endsWith("Nota: a las 3pm")).toBe(true);
  });

  test("nota vacia o ausente => sin linea Nota:", () => {
    expect(construirMensajePedido({ negocio: "X", lineas, nota: "   " })).not.toContain("Nota:");
    expect(construirMensajePedido({ negocio: "X", lineas })).not.toContain("Nota:");
  });
});
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `bun test src/lib/pedido.test.ts`
Expected: FAIL (`Cannot find module '@/lib/pedido'`).

- [ ] **Step 3: Implementar `src/lib/pedido.ts`**

```ts
import { precioMenu } from "@/lib/tema";

export type LineaPedido = {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
};

/** Suma de `cantidad × precioUnitario` de todas las líneas. */
export function totalPedido(lineas: LineaPedido[]): number {
  return lineas.reduce((suma, l) => suma + l.cantidad * l.precioUnitario, 0);
}

/**
 * Texto del pedido para `wa.me` (sin URL-encode — eso lo hace `enlaceWhatsApp`).
 * Sin modificadores en v1. La nota va al final solo si trae contenido tras `trim`.
 */
export function construirMensajePedido(params: {
  negocio: string;
  sucursal?: string | null;
  lineas: LineaPedido[];
  nota?: string;
}): string {
  const { negocio, lineas, nota } = params;
  const sucursal = params.sucursal?.trim();

  const encabezado = sucursal
    ? `Hola, quiero hacer un pedido de ${negocio} (${sucursal}):`
    : `Hola, quiero hacer un pedido de ${negocio}:`;

  const renglones = lineas.map(
    (l) => `• ${l.cantidad} × ${l.nombre} — ${precioMenu(l.cantidad * l.precioUnitario)}`,
  );

  const partes = [encabezado, "", ...renglones, "", `Total: ${precioMenu(totalPedido(lineas))}`];

  const notaLimpia = nota?.trim();
  if (notaLimpia) partes.push("", `Nota: ${notaLimpia}`);

  return partes.join("\n");
}
```

- [ ] **Step 4: Correr el test — debe pasar**

Run: `bun test src/lib/pedido.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: typecheck + lint + commit**

```bash
bun run typecheck && bun run lint
git branch --show-current
git add src/lib/pedido.ts src/lib/pedido.test.ts
git commit -m "feat: helper pedido.ts (mensaje wa.me del carrito)"
```

---

## Task 3: `src/lib/carrito.ts` — reducer del carrito

**Files:**
- Create: `src/lib/carrito.ts`
- Test: `src/lib/carrito.test.ts`

**Interfaces:**
- Consumes:
  - `type LineaPedido` de `@/lib/pedido`.
  - `type ProductoConModificadores` de `@/hooks/useMenuPublico` (import de solo tipo — se borra en runtime; no arrastra `supabase`).
- Produces:
  - `type ItemCarrito = { producto: ProductoConModificadores; cantidad: number }`
  - `agregarProducto(items: ItemCarrito[], producto: ProductoConModificadores): ItemCarrito[]` — +1, o nueva línea al final
  - `fijarCantidad(items: ItemCarrito[], productoId: string, n: number): ItemCarrito[]` — `n <= 0` quita la línea; si el id no está y `n > 0`, no-op
  - `quitarProducto(items: ItemCarrito[], productoId: string): ItemCarrito[]`
  - `cantidadDe(items: ItemCarrito[], productoId: string): number` — 0 si no está
  - `cantidadTotal(items: ItemCarrito[]): number`
  - `lineasDePedido(items: ItemCarrito[]): LineaPedido[]` — `{ nombre, cantidad, precioUnitario: producto.precio }`

- [ ] **Step 1: Escribir el test que falla**

Create `src/lib/carrito.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import type { ProductoConModificadores } from "@/hooks/useMenuPublico";
import {
  agregarProducto,
  cantidadDe,
  cantidadTotal,
  fijarCantidad,
  lineasDePedido,
  quitarProducto,
  type ItemCarrito,
} from "@/lib/carrito";

const prod = (id: string, nombre: string, precio: number) =>
  ({ id, nombre, precio, grupos: [] }) as unknown as ProductoConModificadores;

const cafe = prod("p1", "Cappuccino", 180);
const pan = prod("p2", "Concha", 45);

describe("carrito", () => {
  test("agregar dos veces el mismo producto => una linea, cantidad 2, orden preservado", () => {
    let items: ItemCarrito[] = [];
    items = agregarProducto(items, cafe);
    items = agregarProducto(items, pan);
    items = agregarProducto(items, cafe);
    expect(items.map((i) => i.producto.id)).toEqual(["p1", "p2"]);
    expect(cantidadDe(items, "p1")).toBe(2);
    expect(cantidadTotal(items)).toBe(3);
  });

  test("fijarCantidad a 0 quita la linea", () => {
    let items = agregarProducto([], cafe);
    items = fijarCantidad(items, "p1", 0);
    expect(items).toEqual([]);
  });

  test("fijarCantidad a 5 fija la cantidad exacta", () => {
    let items = agregarProducto([], cafe);
    items = fijarCantidad(items, "p1", 5);
    expect(cantidadDe(items, "p1")).toBe(5);
  });

  test("fijarCantidad de un id ausente con n>0 es no-op", () => {
    expect(fijarCantidad([], "zzz", 3)).toEqual([]);
  });

  test("quitarProducto elimina solo esa linea", () => {
    let items = agregarProducto(agregarProducto([], cafe), pan);
    items = quitarProducto(items, "p1");
    expect(items.map((i) => i.producto.id)).toEqual(["p2"]);
  });

  test("cantidadDe de un id ausente => 0", () => {
    expect(cantidadDe([], "p1")).toBe(0);
  });

  test("lineasDePedido mapea nombre, cantidad y precio del producto", () => {
    let items = agregarProducto([], cafe);
    items = agregarProducto(items, cafe);
    items = agregarProducto(items, pan);
    expect(lineasDePedido(items)).toEqual([
      { nombre: "Cappuccino", cantidad: 2, precioUnitario: 180 },
      { nombre: "Concha", cantidad: 1, precioUnitario: 45 },
    ]);
  });
});
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `bun test src/lib/carrito.test.ts`
Expected: FAIL (`Cannot find module '@/lib/carrito'`).

- [ ] **Step 3: Implementar `src/lib/carrito.ts`**

```ts
import type { ProductoConModificadores } from "@/hooks/useMenuPublico";
import type { LineaPedido } from "@/lib/pedido";

export type ItemCarrito = {
  producto: ProductoConModificadores;
  cantidad: number;
};

/** +1 al producto; si no estaba, lo agrega como línea nueva al final. */
export function agregarProducto(
  items: ItemCarrito[],
  producto: ProductoConModificadores,
): ItemCarrito[] {
  if (items.some((i) => i.producto.id === producto.id)) {
    return items.map((i) =>
      i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i,
    );
  }
  return [...items, { producto, cantidad: 1 }];
}

/** `n <= 0` quita la línea. Si el id no está y `n > 0`, devuelve `items` sin cambio. */
export function fijarCantidad(
  items: ItemCarrito[],
  productoId: string,
  n: number,
): ItemCarrito[] {
  if (n <= 0) return items.filter((i) => i.producto.id !== productoId);
  return items.map((i) => (i.producto.id === productoId ? { ...i, cantidad: n } : i));
}

export function quitarProducto(items: ItemCarrito[], productoId: string): ItemCarrito[] {
  return items.filter((i) => i.producto.id !== productoId);
}

export function cantidadDe(items: ItemCarrito[], productoId: string): number {
  return items.find((i) => i.producto.id === productoId)?.cantidad ?? 0;
}

export function cantidadTotal(items: ItemCarrito[]): number {
  return items.reduce((suma, i) => suma + i.cantidad, 0);
}

export function lineasDePedido(items: ItemCarrito[]): LineaPedido[] {
  return items.map((i) => ({
    nombre: i.producto.nombre,
    cantidad: i.cantidad,
    precioUnitario: i.producto.precio,
  }));
}
```

- [ ] **Step 4: Correr el test — debe pasar**

Run: `bun test src/lib/carrito.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: typecheck + lint + commit**

```bash
bun run typecheck && bun run lint
git branch --show-current
git add src/lib/carrito.ts src/lib/carrito.test.ts
git commit -m "feat: reducer carrito.ts"
```

---

## Task 4: `src/hooks/useCarritoWhatsApp.tsx` — contexto efímero

**Files:**
- Create: `src/hooks/useCarritoWhatsApp.tsx`

**Interfaces:**
- Consumes: todo `@/lib/carrito` (Task 3); `type ProductoConModificadores` de `@/hooks/useMenuPublico`.
- Produces:
  - `type ItemCarrito` (re-export de `@/lib/carrito`)
  - `type CarritoWhatsApp = { items: ItemCarrito[]; cantidadTotal: number; habilitado: boolean; agregar: (p: ProductoConModificadores) => void; fijarCantidad: (productoId: string, n: number) => void; quitar: (productoId: string) => void; vaciar: () => void; cantidadDe: (productoId: string) => number }`
  - `CarritoWhatsAppProvider(props: { habilitado: boolean; children: React.ReactNode }): React.JSX.Element`
  - `useCarritoWhatsApp(): CarritoWhatsApp` — lanza si se usa fuera del provider

- [ ] **Step 1: Implementar el hook**

```tsx
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import * as carrito from "@/lib/carrito";
import type { ItemCarrito } from "@/lib/carrito";
import type { ProductoConModificadores } from "@/hooks/useMenuPublico";

export type { ItemCarrito };

export type CarritoWhatsApp = {
  /** Orden estable de inserción. */
  items: ItemCarrito[];
  /** Σ cantidad. */
  cantidadTotal: number;
  habilitado: boolean;
  agregar: (p: ProductoConModificadores) => void;
  /** `n <= 0` quita la línea. */
  fijarCantidad: (productoId: string, n: number) => void;
  quitar: (productoId: string) => void;
  vaciar: () => void;
  cantidadDe: (productoId: string) => number;
};

const Ctx = createContext<CarritoWhatsApp | null>(null);

/**
 * Estado del carrito de "Pedir por WhatsApp". EFÍMERO: no toca `localStorage`.
 * En `MenuPublico` se monta con `key` por sucursal, así que cambiar de sucursal
 * lo desmonta y remonta vacío.
 *
 * `habilitado` (plan de pago + WhatsApp resoluble) se re-expone tal cual para
 * que los hijos se auto-oculten. Cuando es `false`, `agregar`/`fijarCantidad`
 * son no-ops (defensa; los controles ya no se renderizan).
 */
export function CarritoWhatsAppProvider({
  habilitado,
  children,
}: {
  habilitado: boolean;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<ItemCarrito[]>([]);

  const agregar = useCallback(
    (p: ProductoConModificadores) => {
      if (!habilitado) return;
      setItems((prev) => carrito.agregarProducto(prev, p));
    },
    [habilitado],
  );

  const fijarCantidad = useCallback(
    (productoId: string, n: number) => {
      if (!habilitado) return;
      setItems((prev) => carrito.fijarCantidad(prev, productoId, n));
    },
    [habilitado],
  );

  const quitar = useCallback((productoId: string) => {
    setItems((prev) => carrito.quitarProducto(prev, productoId));
  }, []);

  const vaciar = useCallback(() => setItems([]), []);

  const valor = useMemo<CarritoWhatsApp>(
    () => ({
      items,
      cantidadTotal: carrito.cantidadTotal(items),
      habilitado,
      agregar,
      fijarCantidad,
      quitar,
      vaciar,
      cantidadDe: (productoId: string) => carrito.cantidadDe(items, productoId),
    }),
    [items, habilitado, agregar, fijarCantidad, quitar, vaciar],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useCarritoWhatsApp(): CarritoWhatsApp {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCarritoWhatsApp se usó fuera de <CarritoWhatsAppProvider>");
  return ctx;
}
```

- [ ] **Step 2: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add src/hooks/useCarritoWhatsApp.tsx
git commit -m "feat: contexto useCarritoWhatsApp (efimero)"
```

---

## Task 5: `src/components/menu/BotonAgregar.tsx`

**Files:**
- Create: `src/components/menu/BotonAgregar.tsx`

**Interfaces:**
- Consumes: `useCarritoWhatsApp()` (Task 4); `type ProductoConModificadores` de `@/hooks/useMenuPublico`.
- Produces: `default function BotonAgregar({ producto, variante }: { producto: ProductoConModificadores; variante: "stepper" | "badge" }): React.JSX.Element | null`

- [ ] **Step 1: Implementar el componente**

```tsx
import { Minus, Plus } from "lucide-react";
import { useCarritoWhatsApp } from "@/hooks/useCarritoWhatsApp";
import type { ProductoConModificadores } from "@/hooks/useMenuPublico";

/**
 * Control "agregar al pedido". Se monta SIN condicional en los formatos: si el
 * carrito no está habilitado (plan / número), devuelve `null` solo.
 *
 * - `variante="stepper"`: `n === 0` → pastilla "Agregar" con `+`; `n > 0` → fila
 *   `[−] n [+]`. Igual en el renglón de Clásico y al pie de los modales.
 * - `variante="badge"`: `+` circular (el formato lo posiciona con un `absolute`).
 *   Con `n > 0` muestra el número. Solo suma; para restar desde el grid se abre
 *   el modal o la hoja de resumen.
 *
 * Estilo: solo variables `--menu-*`.
 */
export default function BotonAgregar({
  producto,
  variante,
}: {
  producto: ProductoConModificadores;
  variante: "stepper" | "badge";
}) {
  const c = useCarritoWhatsApp();
  if (!c.habilitado) return null;

  const n = c.cantidadDe(producto.id);

  if (variante === "badge") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          c.agregar(producto);
        }}
        aria-label={
          n > 0
            ? `${producto.nombre}: ${n} en el pedido. Agregar otro`
            : `Agregar ${producto.nombre} al pedido`
        }
        className="grid size-8 place-items-center rounded-full text-sm font-bold shadow-md tabular-nums"
        style={{ background: "var(--menu-primario)", color: "var(--menu-fondo)" }}
      >
        {n > 0 ? n : <Plus className="size-4" aria-hidden />}
      </button>
    );
  }

  if (n === 0) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          c.agregar(producto);
        }}
        aria-label={`Agregar ${producto.nombre} al pedido`}
        className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-medium"
        style={{ background: "var(--menu-primario)", color: "var(--menu-fondo)" }}
      >
        <Plus className="size-4" aria-hidden />
        Agregar
      </button>
    );
  }

  return (
    <div
      className="inline-flex shrink-0 items-center gap-2 rounded-full border px-1.5 py-1"
      style={{ borderColor: "var(--menu-primario)", color: "var(--menu-texto)" }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          c.fijarCantidad(producto.id, n - 1);
        }}
        aria-label={`Quitar uno de ${producto.nombre}`}
        className="grid size-6 place-items-center rounded-full"
        style={{ color: "var(--menu-primario)" }}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <span className="min-w-4 text-center text-sm font-semibold tabular-nums">{n}</span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          c.agregar(producto);
        }}
        aria-label={`Agregar otro ${producto.nombre}`}
        className="grid size-6 place-items-center rounded-full"
        style={{ color: "var(--menu-primario)" }}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add src/components/menu/BotonAgregar.tsx
git commit -m "feat: BotonAgregar (stepper / badge)"
```

---

## Task 6: `src/components/menu/HojaPedido.tsx`

**Files:**
- Create: `src/components/menu/HojaPedido.tsx`

**Interfaces:**
- Consumes:
  - `useCarritoWhatsApp()` (Task 4), `BotonAgregar` (Task 5)
  - `contactoSucursal(sucursal, tenant)` de `@/lib/contacto`
  - `enlaceWhatsApp(valor, mensaje?)` de `@/lib/whatsapp`
  - `construirMensajePedido`, `totalPedido` de `@/lib/pedido`; `lineasDePedido` de `@/lib/carrito`
  - `precioMenu` de `@/lib/tema`
  - `type Sucursal`, `type Tenant` de `@/types/database`
- Produces: `default function HojaPedido({ tenant, sucursal, alCerrar }: { tenant: Tenant; sucursal: Sucursal | null; alCerrar: () => void }): React.JSX.Element`

- [ ] **Step 1: Implementar el componente**

```tsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import BotonAgregar from "@/components/menu/BotonAgregar";
import { useCarritoWhatsApp } from "@/hooks/useCarritoWhatsApp";
import { lineasDePedido } from "@/lib/carrito";
import { contactoSucursal } from "@/lib/contacto";
import { construirMensajePedido, totalPedido } from "@/lib/pedido";
import { precioMenu } from "@/lib/tema";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import type { Sucursal, Tenant } from "@/types/database";

/**
 * Hoja de resumen del pedido (bottom-sheet, patrón del `Post` de Instagram).
 * Ítems editables, nota opcional, total, "Enviar por WhatsApp" y "Vaciar".
 * Al quedarse sin ítems se cierra sola.
 */
export default function HojaPedido({
  tenant,
  sucursal,
  alCerrar,
}: {
  tenant: Tenant;
  sucursal: Sucursal | null;
  alCerrar: () => void;
}) {
  const c = useCarritoWhatsApp();
  const [nota, setNota] = useState("");

  useEffect(() => {
    if (c.items.length === 0) alCerrar();
  }, [c.items.length, alCerrar]);

  const lineas = lineasDePedido(c.items);
  const borde = "color-mix(in srgb, var(--menu-texto) 12%, transparent)";

  function enviar() {
    const url = enlaceWhatsApp(
      contactoSucursal(sucursal, tenant).whatsapp,
      construirMensajePedido({
        negocio: tenant.nombre_negocio,
        sucursal: sucursal?.nombre,
        lineas,
        nota,
      }),
    );
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    c.vaciar();
    alCerrar();
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={alCerrar}
    >
      <motion.article
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 32, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Tu pedido"
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl shadow-vm-3 sm:max-h-[88vh] sm:rounded-2xl"
        style={{ background: "var(--menu-fondo)", color: "var(--menu-texto)" }}
      >
        <div
          className="flex items-center justify-between border-b p-4"
          style={{ borderColor: borde }}
        >
          <h2 className="text-base font-semibold">Tu pedido</h2>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            style={{ color: "var(--menu-texto-suave)" }}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <ul className="space-y-4">
            {c.items.map((it) => (
              <li key={it.producto.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.producto.nombre}</p>
                  <p className="vm-data text-xs" style={{ color: "var(--menu-texto-suave)" }}>
                    {precioMenu(it.cantidad * it.producto.precio)}
                  </p>
                </div>
                <BotonAgregar producto={it.producto} variante="stepper" />
                <button
                  type="button"
                  onClick={() => c.quitar(it.producto.id)}
                  aria-label={`Quitar ${it.producto.nombre} del pedido`}
                  style={{ color: "var(--menu-texto-suave)" }}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>

          <label
            className="mt-5 block text-xs font-medium"
            style={{ color: "var(--menu-texto-suave)" }}
          >
            Nota (opcional)
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Hora de recogida, algo que quieras avisar… lo verá el negocio en WhatsApp."
              className="mt-1 w-full resize-none rounded-lg border bg-transparent p-2.5 text-sm outline-none"
              style={{ borderColor: borde, color: "var(--menu-texto)" }}
            />
          </label>
        </div>

        <div className="border-t p-4" style={{ borderColor: borde }}>
          <div className="mb-3 flex items-center justify-between text-sm font-semibold">
            <span>Total</span>
            <span className="vm-data">{precioMenu(totalPedido(lineas))}</span>
          </div>
          <button
            type="button"
            onClick={enviar}
            className="h-11 w-full rounded-xl text-sm font-semibold"
            style={{ background: "var(--menu-primario)", color: "var(--menu-fondo)" }}
          >
            Enviar por WhatsApp
          </button>
          <button
            type="button"
            onClick={() => {
              c.vaciar();
              alCerrar();
            }}
            className="mt-2 h-9 w-full text-xs transition-opacity hover:opacity-70"
            style={{ color: "var(--menu-texto-suave)" }}
          >
            Vaciar pedido
          </button>
        </div>
      </motion.article>
    </motion.div>
  );
}
```

- [ ] **Step 2: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add src/components/menu/HojaPedido.tsx
git commit -m "feat: HojaPedido (hoja de resumen del carrito)"
```

---

## Task 7: `src/components/menu/BarraPedido.tsx`

**Files:**
- Create: `src/components/menu/BarraPedido.tsx`

**Interfaces:**
- Consumes: `useCarritoWhatsApp()` (Task 4), `HojaPedido` (Task 6); `lineasDePedido` de `@/lib/carrito`; `totalPedido` de `@/lib/pedido`; `precioMenu` de `@/lib/tema`; `type Sucursal`, `type Tenant`.
- Produces: `default function BarraPedido({ tenant, sucursal }: { tenant: Tenant; sucursal: Sucursal | null }): React.JSX.Element | null`

- [ ] **Step 1: Implementar el componente**

```tsx
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import HojaPedido from "@/components/menu/HojaPedido";
import { useCarritoWhatsApp } from "@/hooks/useCarritoWhatsApp";
import { lineasDePedido } from "@/lib/carrito";
import { totalPedido } from "@/lib/pedido";
import { precioMenu } from "@/lib/tema";
import type { Sucursal, Tenant } from "@/types/database";

/**
 * Barra fija al fondo con el resumen del pedido. Solo aparece si el carrito está
 * habilitado y tiene al menos un ítem — por eso nunca coincide con el aviso del
 * embudo (#2), que espera a que el carrito esté vacío. Dueña del sheet.
 */
export default function BarraPedido({
  tenant,
  sucursal,
}: {
  tenant: Tenant;
  sucursal: Sucursal | null;
}) {
  const c = useCarritoWhatsApp();
  const [abierta, setAbierta] = useState(false);

  if (!c.habilitado || c.cantidadTotal === 0) return null;

  const total = totalPedido(lineasDePedido(c.items));

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md p-3"
      >
        <button
          type="button"
          onClick={() => setAbierta(true)}
          className="flex h-12 w-full items-center justify-between rounded-2xl px-4 text-sm font-semibold shadow-lg"
          style={{ background: "var(--menu-primario)", color: "var(--menu-fondo)" }}
        >
          <span className="flex items-center gap-2">
            <ShoppingBag className="size-4" aria-hidden />
            Ver pedido · {c.cantidadTotal}
          </span>
          <span className="vm-data">{precioMenu(total)}</span>
        </button>
      </motion.div>

      <AnimatePresence>
        {abierta && (
          <HojaPedido tenant={tenant} sucursal={sucursal} alCerrar={() => setAbierta(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 2: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add src/components/menu/BarraPedido.tsx
git commit -m "feat: BarraPedido (barra fija del carrito)"
```

---

## Task 8: `src/components/menu/BotonPedidoTikTok.tsx`

**Files:**
- Create: `src/components/menu/BotonPedidoTikTok.tsx`

**Interfaces:**
- Consumes: `contactoSucursal` de `@/lib/contacto`; `enlaceWhatsApp` de `@/lib/whatsapp`; `type Sucursal`, `type Tenant`.
- Produces: `default function BotonPedidoTikTok({ tenant, sucursal, habilitado }: { tenant: Tenant; sucursal: Sucursal | null; habilitado: boolean }): React.JSX.Element | null`

- [ ] **Step 1: Implementar el componente**

```tsx
import { MessageCircle } from "lucide-react";
import { contactoSucursal } from "@/lib/contacto";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import type { Sucursal, Tenant } from "@/types/database";

/**
 * TikTok es un feed de descubrimiento a pantalla completa: no lleva carrito.
 * Solo un botón flotante que abre WhatsApp con un mensaje genérico. `habilitado`
 * lo calcula `MenuPublico` igual que para el resto (plan + número resoluble).
 *
 * `bottom-16`: por encima de `<MarcaAgua flotante />` (bottom-3) y del hint de
 * scroll (bottom-9). `z-30`: nivel de las pastillas de categoría de TikTok.
 */
export default function BotonPedidoTikTok({
  tenant,
  sucursal,
  habilitado,
}: {
  tenant: Tenant;
  sucursal: Sucursal | null;
  habilitado: boolean;
}) {
  if (!habilitado) return null;

  const url = enlaceWhatsApp(
    contactoSucursal(sucursal, tenant).whatsapp,
    `Hola, quiero hacer un pedido del menú de ${tenant.nombre_negocio}.`,
  );
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-16 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur"
    >
      <MessageCircle className="size-4" aria-hidden />
      Pedir por WhatsApp
    </a>
  );
}
```

- [ ] **Step 2: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add src/components/menu/BotonPedidoTikTok.tsx
git commit -m "feat: BotonPedidoTikTok (boton generico, sin carrito)"
```

---

## Task 9: `src/hooks/useMenuPublico.ts` — exponer `permitePedidosWhatsApp`

**Files:**
- Modify: `src/hooks/useMenuPublico.ts`

**Interfaces:**
- Consumes: `planes.permite_pedidos_whatsapp` (Task 1).
- Produces: `MenuPublico.permitePedidosWhatsApp: boolean`.

- [ ] **Step 1: Agregar el campo al type `MenuPublico`**

En el `export type MenuPublico`, después de `permiteEmbudoResenas: boolean;`:

```ts
  /** planes.permite_pedidos_whatsapp — gatea "Pedir por WhatsApp" (el carrito). */
  permitePedidosWhatsApp: boolean;
```

- [ ] **Step 2: Ampliar los 3 `.select(...)` del plan**

Hay **tres** llamadas idénticas `.select("*, plan:planes(marca_agua, menu_independiente_por_sucursal, permite_embudo_resenas)")` (en `obtenerMenuPublico`, `obtenerMenuPublicoPorDominio`, `obtenerSucursalPublicaPorDominio`). En las tres, cambia a:

```ts
.select(
  "*, plan:planes(marca_agua, menu_independiente_por_sucursal, permite_embudo_resenas, permite_pedidos_whatsapp)",
)
```

- [ ] **Step 3: Ampliar el `Pick<Plan, ...>` de `armarMenuPublico`**

En la firma de `armarMenuPublico`, el tipo del parámetro `tenantRow`:

```ts
        plan: Pick<
          Plan,
          | "marca_agua"
          | "menu_independiente_por_sucursal"
          | "permite_embudo_resenas"
          | "permite_pedidos_whatsapp"
        > | null;
```

- [ ] **Step 4: Devolver el campo en `armarMenuPublico`**

En el objeto `return`, después de `permiteEmbudoResenas: plan?.permite_embudo_resenas ?? false,`:

```ts
    permitePedidosWhatsApp: plan?.permite_pedidos_whatsapp ?? false,
```

- [ ] **Step 5: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add src/hooks/useMenuPublico.ts
git commit -m "feat: useMenuPublico expone permitePedidosWhatsApp"
```

---

## Task 10: `MenuPublico.tsx` wiring + `EmbudoResenas` espera al carrito

**Files:**
- Modify: `src/pages/MenuPublico.tsx`
- Modify: `src/components/menu/EmbudoResenas.tsx`

**Interfaces:**
- Consumes: `CarritoWhatsAppProvider` (Task 4), `BarraPedido` (Task 7), `BotonPedidoTikTok` (Task 8), `MenuPublico.permitePedidosWhatsApp` (Task 9), `contactoSucursal`, `telefonoParaWaMe`, `useCarritoWhatsApp`.
- Produces: el menú público con carrito cableado; `EmbudoResenas` con la condición `cantidadTotal === 0`.

- [ ] **Step 1: Imports en `MenuPublico.tsx`**

Junto a los imports de `@/components/menu/*` y `@/lib/*` existentes, agrega:

```ts
import BarraPedido from "@/components/menu/BarraPedido";
import BotonPedidoTikTok from "@/components/menu/BotonPedidoTikTok";
import { CarritoWhatsAppProvider } from "@/hooks/useCarritoWhatsApp";
import { contactoSucursal } from "@/lib/contacto";
import { telefonoParaWaMe } from "@/lib/whatsapp";
```

- [ ] **Step 2: Calcular `pedidosOn` antes de las ramas de render**

Después de `const Formato = FORMATOS[data.formato];` (justo antes de `const propsFormato`):

```ts
  // "Pedir por WhatsApp": lo permite el plan Y hay un WhatsApp resoluble
  // (sucursal → empresa). Sin número usable, la feature entera se oculta.
  const numeroPedido = telefonoParaWaMe(
    contactoSucursal(data.sucursalActiva, data.tenant).whatsapp,
  );
  const pedidosOn = data.permitePedidosWhatsApp && numeroPedido !== null;
```

- [ ] **Step 3: Botón en la rama TikTok**

En el `return` de `if (data.formato === "tiktok")`, dentro del `<main>`, después de `{data.marcaAgua && <MarcaAgua flotante />}`:

```tsx
          <BotonPedidoTikTok
            tenant={data.tenant}
            sucursal={data.sucursalActiva}
            habilitado={pedidosOn}
          />
```

- [ ] **Step 4: Envolver `cuerpo` en el provider y montar `BarraPedido`**

Reemplaza el bloque `const cuerpo = ( <> ... </> );` por:

```tsx
  const cuerpo = (
    <CarritoWhatsAppProvider
      key={data.sucursalActiva?.id ?? "principal"}
      habilitado={pedidosOn}
    >
      {/* pb-24: deja aire para que BarraPedido (fixed) no tape el final de ContactoMenu */}
      <div className={cn(pedidosOn && "pb-24")}>
        <HeaderMenu
          tenant={data.tenant}
          sucursales={data.sucursales}
          sucursalActiva={data.sucursalActiva}
          menuIndependiente={data.menuIndependiente}
          compacta={data.formato === "instagram"}
          sobreOscuro={tema.modo_imagen === "completo"}
        />

        {data.categorias.length === 0 ? (
          <p
            className="px-4 py-20 text-center text-sm"
            style={{ color: "var(--menu-texto-suave)" }}
          >
            Este menú todavía no tiene productos.
          </p>
        ) : (
          <Formato {...propsFormato} />
        )}

        <ContactoMenu tenant={data.tenant} sucursal={data.sucursalActiva} />

        <BarraPedido tenant={data.tenant} sucursal={data.sucursalActiva} />

        <EmbudoResenas
          tenant={data.tenant}
          sucursal={data.sucursalActiva}
          habilitado={data.permiteEmbudoResenas}
        />

        {data.marcaAgua && <MarcaAgua />}
      </div>
    </CarritoWhatsAppProvider>
  );
```

(El `key` en el elemento raíz de una expresión JSX reusada en 3 returns re-monta el provider al cambiar de sucursal — es el comportamiento estándar de React con `key`. Verificado en QA manual, Step 8.)

- [ ] **Step 5: `EmbudoResenas.tsx` — import y hook**

En `src/components/menu/EmbudoResenas.tsx`, agrega el import:

```ts
import { useCarritoWhatsApp } from "@/hooks/useCarritoWhatsApp";
```

Dentro del componente, junto a los otros hooks (todos van sin condicional), después de `const [yaRespondio] = useState(...)`:

```ts
  const carrito = useCarritoWhatsApp();
```

- [ ] **Step 6: `EmbudoResenas.tsx` — añadir la condición a `puedeMostrar`**

```ts
  const puedeMostrar =
    habilitado && resenasUrl !== null && !yaRespondio && carrito.cantidadTotal === 0;
```

(Cuando `pedidosOn` es `false`, `cantidadTotal` siempre es 0 → sin efecto. `EmbudoResenas` solo se renderiza dentro del `cuerpo`, que ahora siempre está bajo el provider; TikTok y `/demo` no montan `EmbudoResenas`.)

- [ ] **Step 7: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 8: QA manual rápido (dev server)**

Run: `bun dev` y abre un menú público de un tenant con plan de pago y una sucursal con WhatsApp.
Expected:
- Ninguna barra visible al cargar (carrito vacío).
- El menú se ve idéntico a antes salvo el espacio inferior extra.
- Cambiar de sucursal no rompe nada (la barra sigue oculta con carrito vacío).
- Con plan Free / sin `permite_pedidos_whatsapp`: sin cambios visibles.

- [ ] **Step 9: Commit**

```bash
git branch --show-current
git add src/pages/MenuPublico.tsx src/components/menu/EmbudoResenas.tsx
git commit -m "feat: cablea el carrito en MenuPublico; el embudo espera al carrito"
```

---

## Task 11: Formatos — montar `BotonAgregar`

**Files:**
- Modify: `src/components/formatos/Clasico.tsx`
- Modify: `src/components/formatos/Pinterest.tsx`
- Modify: `src/components/formatos/Instagram.tsx`

**Interfaces:**
- Consumes: `BotonAgregar` (Task 5). El componente ya se auto-oculta si el carrito no está habilitado — los formatos lo montan sin condicional.

### Clásico

- [ ] **Step 1: Import**

```ts
import BotonAgregar from "@/components/menu/BotonAgregar";
```

- [ ] **Step 2: Stepper al pie de cada renglón**

Dentro del `<li key={producto.id} className="flex gap-3">`, en el `<div className="min-w-0 flex-1">`, después de `<Modificadores producto={producto} />`:

```tsx
                  <div className="mt-2">
                    <BotonAgregar producto={producto} variante="stepper" />
                  </div>
```

### Pinterest

- [ ] **Step 3: Import**

```ts
import BotonAgregar from "@/components/menu/BotonAgregar";
```

- [ ] **Step 4: Reestructurar la tarjeta del mosaico (evitar `<button>` anidado)**

Hoy cada tarjeta es `<motion.button key={producto.id} ... className="mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl text-left">`. Cámbiala a un wrapper `div` con el badge como hermano:

```tsx
          {productos.map((producto) => (
            <div key={producto.id} className="relative mb-3 break-inside-avoid">
              <motion.button
                layoutId={`producto-${producto.id}`}
                onClick={() => setAbierto(producto)}
                whileHover={{ scale: 1.015 }}
                className="block w-full overflow-hidden rounded-xl text-left"
                style={{ background: "color-mix(in srgb, var(--menu-texto) 5%, transparent)" }}
              >
                {/* …contenido del botón sin cambios (imagen / placeholder + <div className="p-3">…)… */}
              </motion.button>

              <div className="absolute right-2 top-2 z-10">
                <BotonAgregar producto={producto} variante="badge" />
              </div>
            </div>
          ))}
```

(Se movió `key` al `div`, y `mb-3 break-inside-avoid` del botón al wrapper. El contenido interno del `<motion.button>` no cambia.)

- [ ] **Step 5: Stepper en el modal `Detalle`**

En `Detalle`, después del `<p>` del precio (`{precioMenu(producto.precio)}`):

```tsx
          <div className="mt-3">
            <BotonAgregar producto={producto} variante="stepper" />
          </div>
```

### Instagram

- [ ] **Step 6: Import**

```ts
import BotonAgregar from "@/components/menu/BotonAgregar";
```

- [ ] **Step 7: Reestructurar la tarjeta del grid (evitar `<button>` anidado)**

Hoy cada celda es `<button key={producto.id} type="button" onClick={...} className="group relative aspect-square overflow-hidden" aria-label={producto.nombre}>`. Envuélvela en un `div` que herede las clases de posición y mueve `group` al wrapper:

```tsx
          {productos.map((producto) => (
            <div key={producto.id} className="group relative aspect-square overflow-hidden">
              <button
                type="button"
                onClick={() => setAbierto(producto)}
                className="block size-full"
                aria-label={producto.nombre}
              >
                {/* …imagen / placeholder sin cambios… */}
                <span className="vm-data absolute bottom-1 right-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                  {precioMenu(producto.precio)}
                </span>
              </button>

              <div className="absolute left-1 top-1 z-10">
                <BotonAgregar producto={producto} variante="badge" />
              </div>
            </div>
          ))}
```

(La pastilla de precio se queda dentro del `<button>`, esquina `bottom-1 right-1`; el badge va arriba-izquierda, fuera del botón.)

- [ ] **Step 8: Stepper en el modal `Post`**

En `Post`, dentro del `<div className="flex items-start justify-between gap-3">` va el `<h2>` y la pastilla de precio (`<span className="vm-data shrink-0 ...">`). Después de ese `<div>` (aún dentro del `<div className="min-h-0 flex-1 overflow-y-auto p-5">`, antes de `{producto.descripcion && ...}`):

```tsx
          <div className="mt-3">
            <BotonAgregar producto={producto} variante="stepper" />
          </div>
```

- [ ] **Step 9: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 10: QA manual (dev server, tenant de pago con WhatsApp)**

- Clásico: el stepper de un renglón sube a 2; aparece la barra "Ver pedido · 2 · $…". Abrir → hoja con el ítem; `− +`, quitar, nota; "Enviar" abre WhatsApp con `• 2 × … — $…`, `Total: …`; al volver el carrito está vacío.
- Pinterest / Instagram: el `+` sobre una tarjeta la agrega sin abrir el modal; abrir el modal muestra el stepper con la cantidad correcta; grid y modal sincronizados.
- Cambiar de sucursal: el carrito se vacía.

- [ ] **Step 11: Commit**

```bash
git branch --show-current
git add src/components/formatos/Clasico.tsx src/components/formatos/Pinterest.tsx src/components/formatos/Instagram.tsx
git commit -m "feat: BotonAgregar en los 3 formatos de tarjeta"
```

---

## Task 12: `/demo` + verificación final

**Files:**
- Modify: `src/lib/demo.ts`
- Modify: `src/pages/Demo.tsx`

**Interfaces:**
- Consumes: `CarritoWhatsAppProvider` (Task 4), `BarraPedido` (Task 7), `BotonPedidoTikTok` (Task 8).

- [ ] **Step 1: `src/lib/demo.ts` — WhatsApp de demo en la sucursal**

En `export const SUCURSAL_DEMO: Sucursal = { ... }`, cambia `whatsapp: null,` por:

```ts
  whatsapp: "+52 55 1234 5678",
```

- [ ] **Step 2: `src/pages/Demo.tsx` — imports**

```ts
import BarraPedido from "@/components/menu/BarraPedido";
import BotonPedidoTikTok from "@/components/menu/BotonPedidoTikTok";
import { CarritoWhatsAppProvider } from "@/hooks/useCarritoWhatsApp";
```

- [ ] **Step 3: `Demo.tsx` — envolver ambas ramas en el provider**

El `<motion.div key={formato} ... className="pt-12">` contiene el `formato === "tiktok" ? (…) : (…)`. Envuelve todo su contenido en `<CarritoWhatsAppProvider habilitado>`:

```tsx
        <motion.div
          key={formato}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="pt-12"
        >
          <CarritoWhatsAppProvider habilitado>
            {formato === "tiktok" ? (
              <div
                className="relative h-[calc(100dvh-3rem)] overflow-hidden"
                style={variablesDeTema(tema)}
              >
                <Formato categorias={CATEGORIAS_DEMO} />
                <BotonPedidoTikTok tenant={TENANT_DEMO} sucursal={SUCURSAL_DEMO} habilitado />
              </div>
            ) : (
              <div
                className="min-h-[calc(100dvh-3rem)]"
                style={{ ...variablesDeTema(tema), background: "var(--menu-fondo)" }}
              >
                <HeaderMenu
                  tenant={TENANT_DEMO}
                  sucursales={[SUCURSAL_DEMO]}
                  sucursalActiva={SUCURSAL_DEMO}
                  menuIndependiente={false}
                  compacta={formato === "instagram"}
                  abiertaFija
                />
                <Formato
                  categorias={CATEGORIAS_DEMO}
                  logoUrl={TENANT_DEMO.logo_url}
                  inicial={TENANT_DEMO.nombre_negocio.slice(0, 1)}
                />
                <ContactoMenu tenant={TENANT_DEMO} sucursal={SUCURSAL_DEMO} />
                <BarraPedido tenant={TENANT_DEMO} sucursal={SUCURSAL_DEMO} />
              </div>
            )}
          </CarritoWhatsAppProvider>
        </motion.div>
```

(`BotonPedidoTikTok` en TikTok usa `fixed` — dentro del contenedor `relative` de la demo funciona igual. `BarraPedido` es `fixed` a viewport.)

- [ ] **Step 4: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 5: Suite completa + build**

Run: `bun test src/lib && bun run typecheck && bun run lint && bun run build`
Expected: todo PASS. `bun run build` regenera `routeTree.gen.ts` sin cambios (no hay rutas nuevas) y compila sin errores.

- [ ] **Step 6: QA manual `/demo`**

- Los 4 formatos: el carrito funciona con el número de demo (`+52 55 1234 5678`).
- Clásico/Pinterest/Instagram: agregar → barra → hoja → "Enviar" abre `wa.me/525512345678?text=…`.
- TikTok: botón flotante "Pedir por WhatsApp" con mensaje genérico; sin steppers ni barra.
- Scroll hasta abajo con la barra visible: `ContactoMenu` no queda tapado.

- [ ] **Step 7: Commit**

```bash
git branch --show-current
git add src/lib/demo.ts src/pages/Demo.tsx
git commit -m "feat: carrito de WhatsApp en /demo"
```

---

## Self-Review (hecho al escribir el plan)

**Cobertura del spec:**
- §1 Migración → Task 1. ✓
- §2 `pedido.ts` → Task 2. ✓
- §3 `useCarritoWhatsApp` (lógica pura testeable → `carrito.ts` por la restricción `bun test src/lib`) → Tasks 3 + 4. ✓
- §4 `BotonAgregar` → Task 5. ✓
- §5 `BarraPedido` → Task 7. ✓
- §6 `HojaPedido` → Task 6. ✓
- §7 `BotonPedidoTikTok` → Task 8. ✓
- §8 `useMenuPublico` → Task 9. ✓
- §9 `MenuPublico` wiring + embudo espera al carrito → Task 10. ✓
- §10 `/demo` → Task 12. ✓
- §11 Formatos → Task 11. ✓
- Tipos (`database.ts`) → Task 1. ✓

**Desviación registrada:** el spec propone `src/hooks/useCarritoWhatsApp.test.tsx`. El runner es `bun test src/lib` (solo mira `src/lib`), así que la lógica pura vive en `src/lib/carrito.ts` con su suite en `src/lib/carrito.test.ts`, y el hook (`src/hooks/useCarritoWhatsApp.tsx`) queda como cáscara sin test unitario propio — se cubre con typecheck y el QA manual de Tasks 10–12. Es exactamente la "alternativa aceptada" del riesgo "Sin `renderHook` en el proyecto".

**Consistencia de tipos:** `LineaPedido` (pedido.ts) se consume en carrito.ts, HojaPedido, BarraPedido con la misma forma. `ItemCarrito` se define en carrito.ts y se re-exporta desde el hook. `cantidadDe`/`fijarCantidad`/`agregar`/`quitar`/`vaciar`/`cantidadTotal`/`items` idénticos entre `CarritoWhatsApp` (hook) y los consumidores. `permitePedidosWhatsApp` idéntico en `MenuPublico` type, `armarMenuPublico` y `MenuPublico.tsx`.

**Placeholders:** ninguno — todo el código va literal.

---

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-08-29-carrito-whatsapp.md`.
