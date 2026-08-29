# Carrito de WhatsApp — Diseño

**Fecha:** 2026-08-29
**Rama:** feat/carrito-whatsapp (parte de `main`)
**Origen:** Auditoría Vibemenu (artifact `8d645623`), sección 04 "Extras vendibles" ("Pedir por WhatsApp") y sección 07 P1.
**Predecesores:** sub-proyectos #1 (`docs/superpowers/specs/2026-08-28-contacto-resenas-sucursal-design.md`) y #2 (`docs/superpowers/specs/2026-08-28-embudo-resenas-design.md`), ambos mergeados a `main` y con migración aplicada. Este es el **sub-proyecto #3 de 3**.

## Problema

El comensal ve el menú público pero no tiene forma de pedir. "Pedir por WhatsApp" es el puente entre "solo mostrar" y "vender" sin romper la regla dura del producto (*Vibemenu enseña el menú, no cobra dentro de él*): el comensal marca platillos, un botón arma un mensaje de WhatsApp prellenado al número de la sucursal, y el pedido se cierra en el chat del negocio. No hay carrito de pago, no se guarda ninguna orden.

## Decisiones tomadas (con el usuario, 2026-08-29)

1. **Alcance:** selección de platillos + carrito (no un botón genérico), en los **3 formatos de tarjeta** (Clásico, Pinterest, Instagram). **TikTok** queda fuera del carrito — solo un botón flotante con mensaje genérico.
2. **Control de "agregar":**
   - **Clásico:** stepper `− N +` al final de cada renglón.
   - **Pinterest / Instagram:** un `+` (badge) sobre la tarjeta del grid **y** un stepper al pie del modal de detalle que ya existe.
3. **Hoja de resumen:** ítems editables (`− N +` y quitar), total, campo de **nota opcional**, botón "Enviar por WhatsApp", "Vaciar".
4. **Carrito vs. embudo (#2):** mientras el carrito tenga ítems, el aviso "¿cómo estuvo tu visita?" **no aparece** — pedir es señal de que la visita no terminó.
5. **Gating:** planes de pago (Basic/Pro/Enterprise). Flag nuevo `planes.permite_pedidos_whatsapp` (patrón `marca_agua` / `permite_embudo_resenas`).
6. **Número:** se reusa `contactoSucursal(sucursal, tenant).whatsapp` (#1, fallback sucursal→empresa) + `telefonoParaWaMe` (#1). Si no resuelve un número usable, la feature entera se oculta.
7. **Sin modificadores en v1:** la línea del pedido es `N × nombre — precio`. El precio es el base o el de `precios_sucursal`, ya resuelto en `armarMenuPublico`.
8. **`/demo`:** incluido — `SUCURSAL_DEMO` gana un WhatsApp de demo y `Demo.tsx` monta el carrito, para que el prospecto vea la feature.

## Alcance

1. Migración: flag `planes.permite_pedidos_whatsapp`.
2. Helper puro `src/lib/pedido.ts` (`construirMensajePedido`, `totalPedido`) + suite.
3. Contexto/hook `src/hooks/useCarritoWhatsApp.tsx` (estado del carrito, efímero) + suite del reducer.
4. Componentes de menú: `BotonAgregar`, `BarraPedido`, `HojaPedido`, `BotonPedidoTikTok`.
5. Los 3 formatos de tarjeta montan `BotonAgregar`; Pinterest/Instagram reestructuran la tarjeta del grid para no anidar `<button>`.
6. `useMenuPublico` expone `permitePedidosWhatsApp`; `MenuPublico.tsx` envuelve el cuerpo en el provider, monta `BarraPedido` y `BotonPedidoTikTok`, y `EmbudoResenas` pasa a esperar al carrito.
7. `/demo`: `SUCURSAL_DEMO.whatsapp` + wiring del carrito en `Demo.tsx`.
8. Tipos (`src/types/database.ts`).

## Fuera de alcance

- Modificadores en el carrito (decisión 7). El modal de detalle los sigue mostrando en solo-lectura, como hoy.
- Guardar el pedido en la base, historial de pedidos, notificar al dueño. El pedido vive solo en el mensaje de WhatsApp.
- Cualquier integración de pago / cobro.
- Carrito en TikTok (formato de descubrimiento a pantalla completa).
- Persistir el carrito entre recargas (es deliberadamente efímero).
- El embudo a reseñas (#2, ya mergeado) — solo se le añade la condición "carrito vacío".

## Lo que ya existe (contexto, no se reescribe)

- **`src/lib/whatsapp.ts`** (#1) — `telefonoParaWaMe(valor): string | null` (dígitos, o null si < 8), `enlaceWhatsApp(valor, mensaje?): string | null` (`https://wa.me/<digitos>?text=<encoded>`).
- **`src/lib/contacto.ts`** (#1) — `contactoSucursal(sucursal, tenant): { telefono, whatsapp, googleReviewsUrl }`, fallback sucursal→empresa.
- **`src/lib/tema.ts`** — `precioMenu(monto: number): string` → `"$1,234.00"` (`Intl.NumberFormat("es-MX")`, 2 decimales). Los precios no llevan moneda.
- **`src/hooks/useMenuPublico.ts`** — `MenuPublico` type con `marcaAgua`, `permiteEmbudoResenas`, `menuIndependiente`, `sucursalActiva`. Tres funciones `obtener*` con `.select("*, plan:planes(marca_agua, menu_independiente_por_sucursal, permite_embudo_resenas)")`. `armarMenuPublico` hace `plan?.X ?? default`. `ProductoConModificadores = Producto & { grupos: GrupoConOpciones[] }` — `precio` ya viene resuelto por sucursal.
- **`src/components/menu/EmbudoResenas.tsx`** (#2) — props `{ tenant, sucursal, habilitado }`; hooks siempre declarados, gate `if (!puedeMostrar || fase === "oculto") return null`. Estilo con `--menu-*`.
- **`src/pages/MenuPublico.tsx`** — rama `data.formato === "tiktok"` (fullscreen, `<Formato/>` + `<MarcaAgua flotante />`, sin `cuerpo`). El `cuerpo` (compartido por los modos `marco`, `completo`, y el default) = `<HeaderMenu/>` + `<Formato/>` + `<ContactoMenu/>` + `<EmbudoResenas/>` + `{marcaAgua && <MarcaAgua/>}`. `key` de la cortina = `${tenant.id}-${sucursalActiva?.id ?? "principal"}`.
- **Formatos** (`src/components/formatos/`):
  - `Clasico.tsx` — `{ categorias }`. Lista vertical; cada producto es un `<li className="flex gap-3">` con nombre/precio/descr/`<Modificadores>`. Sin modal.
  - `Pinterest.tsx` — `{ categorias }`. Mosaico de `<motion.button layoutId=... onClick={() => setAbierto(producto)}>`; modal `<Detalle>` con foto/precio/descr/modificadores solo-lectura.
  - `Instagram.tsx` — `{ categorias, logoUrl?, inicial? }`. Grid 3-col de `<button className="group relative aspect-square ...">` (ya tiene `relative`); modal `<Post>` (bottom-sheet). Nota en el modal: "Los grupos obligatorios se eligen al ordenar en el mostrador."
  - `TikTok.tsx` — `{ categorias }`. Scroll-snap fullscreen; sheet de modificadores. **No** recibe `BotonAgregar`.
- **`src/lib/demo.ts`** — `TENANT_DEMO`, `SUCURSAL_DEMO` (hoy `whatsapp: null`), `CATEGORIAS_DEMO`. Objetos literales tipados: una columna nueva rompe `tsc`.
- **`src/pages/Demo.tsx`** — render propio (no usa `MenuPublico`). Rama no-TikTok: `<div className="min-h-[calc(100dvh-3rem)]" style={...}>` con `<HeaderMenu .../>` + `<Formato .../>`.
- **`src/components/menu/*`** — regla dura: solo variables `--menu-*`, nunca `vm-*` / azul de Vibemenu.

## Arquitectura

### 1. Migración (`src/docs/vibemenu_migracion_pedidos_whatsapp.sql`)

```sql
begin;

alter table planes
  add column permite_pedidos_whatsapp boolean not null default false;

update planes set permite_pedidos_whatsapp = true where nombre <> 'free';

commit;

-- Verificar:
--   select nombre, permite_pedidos_whatsapp from planes order by precio_usd;
--   -- free=false, basic/pro/enterprise=true
```

Una columna. Nada más — el carrito no toca la base. Se aplica vía MCP `apply_migration` (`name: "pedidos_whatsapp"`); si el MCP no está disponible, paso manual. **Sin gate de deploy**: una columna faltante solo haría `permitePedidosWhatsApp` caer a `false` (la feature no aparece), no rompe ninguna escritura.

### 2. `src/lib/pedido.ts` (nuevo) + `src/lib/pedido.test.ts`

```ts
import { precioMenu } from "@/lib/tema";

export type LineaPedido = {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
};

/** Suma de cantidad × precioUnitario de todas las líneas. */
export function totalPedido(lineas: LineaPedido[]): number;

/**
 * Texto del pedido para wa.me (sin URL-encode — eso lo hace enlaceWhatsApp).
 * Sin modificadores en v1. La nota va al final solo si trae contenido.
 */
export function construirMensajePedido(params: {
  negocio: string;
  sucursal?: string | null;
  lineas: LineaPedido[];
  nota?: string;
}): string;
```

Forma del mensaje:
```
Hola, quiero hacer un pedido de <negocio><sucursal ? " ("+sucursal+")" : "">:

• <cantidad> × <nombre> — <precioMenu(cantidad*precioUnitario)>
...

Total: <precioMenu(totalPedido(lineas))>

Nota: <nota.trim()>        ← solo si nota?.trim()
```

Suite (`bun:test`):
- `totalPedido` con varias líneas → suma correcta; lista vacía → 0.
- `construirMensajePedido` con sucursal → encabezado `"... de Café Aurora (Centro):"`.
- sin sucursal (`undefined` / `null`) → `"... de Café Aurora:"`.
- una línea `{ nombre: "Cappuccino", cantidad: 2, precioUnitario: 180 }` → contiene `"• 2 × Cappuccino — $360.00"` y `"Total: $360.00"`.
- con `nota: "  a las 3pm  "` → termina en `"Nota: a las 3pm"` (trim); con `nota: "   "` o `undefined` → sin línea "Nota:".

### 3. `src/hooks/useCarritoWhatsApp.tsx` (nuevo) + `src/hooks/useCarritoWhatsApp.test.tsx`

```ts
import type { ProductoConModificadores } from "@/hooks/useMenuPublico";

export type ItemCarrito = { producto: ProductoConModificadores; cantidad: number };

export type CarritoWhatsApp = {
  items: ItemCarrito[];              // orden estable de inserción
  cantidadTotal: number;             // Σ cantidad
  habilitado: boolean;
  agregar: (p: ProductoConModificadores) => void;   // +1
  fijarCantidad: (productoId: string, n: number) => void;  // n<=0 quita la línea
  quitar: (productoId: string) => void;
  vaciar: () => void;
  cantidadDe: (productoId: string) => number;       // 0 si no está
};

export function CarritoWhatsAppProvider(props: {
  habilitado: boolean;
  children: React.ReactNode;
}): React.JSX.Element;

/** Lanza si se usa fuera del provider. */
export function useCarritoWhatsApp(): CarritoWhatsApp;
```

- Estado interno: `Map<string, ItemCarrito>` en `useState` (clave = `producto.id`). `items` se deriva con `[...map.values()]`; el `Map` preserva orden de inserción.
- **Efímero.** No `localStorage`, no `sessionStorage`. El provider se monta con `key={sucursalId}` en `MenuPublico` → cambiar de sucursal lo desmonta y remonta vacío.
- `habilitado` se pasa como prop y se re-expone tal cual (los componentes hijos lo consultan para auto-ocultarse). Cuando `false`, `agregar`/`fijarCantidad` son no-ops (defensa; los controles ya no se renderizan).
- La lógica pura (agregar, fijar a 0 = quitar, total) se extrae a un reducer o a funciones puras para poder testearla sin React. **Alternativa aceptada:** testear el hook con `@testing-library/react`'s `renderHook` si ya está en el proyecto; si no, extraer `aplicarAccion(estado, accion)` puro y testear eso. El plan decide según lo que haya en `package.json`.

Suite: agregar dos veces el mismo producto → cantidad 2, una sola línea; `fijarCantidad(id, 0)` → línea desaparece; `fijarCantidad(id, 5)` → cantidad 5; `vaciar` → `items` vacío, `cantidadTotal` 0; `cantidadDe` de un id ausente → 0; orden de `items` = orden en que se agregaron.

### 4. `src/components/menu/BotonAgregar.tsx` (nuevo)

```tsx
export default function BotonAgregar({
  producto,
  variante,
}: {
  producto: ProductoConModificadores;
  variante: "stepper" | "badge";
}): React.JSX.Element | null;
```

- `const c = useCarritoWhatsApp()`. Si `!c.habilitado` → `return null`. Así los formatos lo montan sin condicional propio.
- `const n = c.cantidadDe(producto.id)`.
- **`variante="stepper"`:**
  - `n === 0` → una pastilla-botón "Agregar" con icono `+`, fondo `--menu-primario`, texto claro.
  - `n > 0` → fila `[−]  n  [+]` (borde `--menu-primario`): `−` llama `c.fijarCantidad(id, n-1)`, `+` llama `c.agregar(producto)`.
  - Misma forma en todos los montajes de `stepper` (renglón de Clásico, pie de `Detalle`, pie de `Post`). Compacto, no rompe el layout de un `<li>` ni el pie de un modal.
- **`variante="badge"`:**
  - Un `+` circular flotante (posición la pone el contenedor del formato, no el componente — el componente es `inline-flex`, el formato lo envuelve en un `absolute`). Si `n > 0`, muestra el número en vez del `+` (o un badge con el número). Toca → `c.agregar(producto)`. Un toque largo / segundo control para restar no aplica en el badge: para ajustar cantidades desde el grid, el comensal abre el modal o la hoja de resumen.
- Estilo: solo `--menu-*`. `type="button"`, `aria-label` con el nombre del producto y la acción.

### 5. `src/components/menu/BarraPedido.tsx` (nuevo)

```tsx
export default function BarraPedido({
  tenant,
  sucursal,
}: {
  tenant: Tenant;
  sucursal: Sucursal | null;
}): React.JSX.Element | null;
```

- `const c = useCarritoWhatsApp()`. Si `!c.habilitado || c.cantidadTotal === 0` → `return null`.
- Barra `position: fixed; inset-inline: 0; bottom: 0; z-40`, `max-w-md` centrada, entra desde abajo (framer-motion, como el resto del menú).
- Contenido: `"Ver pedido"` · `c.cantidadTotal` ítems · `precioMenu(totalPedido(...))`. Toda la barra es el botón que abre `<HojaPedido>`.
- Mantiene su propio estado `abierta: boolean` para el sheet, o `MenuPublico` lo controla. **Decisión:** `BarraPedido` es dueña del `useState` del sheet y renderiza `<HojaPedido>` dentro de un `<AnimatePresence>`.
- `tenant`/`sucursal` se pasan a `HojaPedido` para resolver el número y armar el mensaje.

### 6. `src/components/menu/HojaPedido.tsx` (nuevo)

```tsx
export default function HojaPedido({
  tenant,
  sucursal,
  alCerrar,
}: {
  tenant: Tenant;
  sucursal: Sucursal | null;
  alCerrar: () => void;
}): React.JSX.Element;
```

- Bottom-sheet sobre velo oscuro (patrón del `Post` de Instagram: `fixed inset-0 z-50 ... bg-black/60`, `motion.article` que sube). `role="dialog" aria-modal="true"`. Esc / tap en el velo → `alCerrar`.
- Lista `c.items`: por ítem → nombre, `[−] n [+]` (reusa `BotonAgregar variante="stepper"` o su propia fila), `precioMenu(n * precioUnitario)`, botón quitar (`×`, llama `c.quitar(id)`).
- `<textarea>` "Nota (opcional)" — estado local `nota`, `maxLength` 300, `placeholder` "Hora de recogida, algo sin lo que no puedas… lo verá el negocio en WhatsApp."
- Total: `precioMenu(totalPedido(lineasDe(c.items)))`.
- **"Enviar por WhatsApp":**
  - `const numero = contactoSucursal(sucursal, tenant).whatsapp` → `const url = enlaceWhatsApp(numero, construirMensajePedido({ negocio: tenant.nombre_negocio, sucursal: sucursal?.nombre, lineas, nota }))`.
  - `if (url) window.open(url, "_blank", "noopener,noreferrer")`.
  - Luego `c.vaciar()` + `alCerrar()`.
  - (El número siempre resuelve aquí: `BarraPedido` solo se monta si `habilitado`, que ya incluyó `telefonoParaWaMe(...) !== null`.)
- **"Vaciar":** `c.vaciar()` + `alCerrar()`. Con confirmación inline ligera ("¿Vaciar el pedido?") o directo — el plan decide; directo es aceptable (el carrito es de bajo riesgo).
- Estilo `--menu-*`.

### 7. `src/components/menu/BotonPedidoTikTok.tsx` (nuevo)

```tsx
export default function BotonPedidoTikTok({
  tenant,
  sucursal,
  habilitado,
}: {
  tenant: Tenant;
  sucursal: Sucursal | null;
  habilitado: boolean;
}): React.JSX.Element | null;
```

- `if (!habilitado) return null`. (En TikTok no hay provider de carrito — el `habilitado` se calcula en `MenuPublico` igual que para el resto.)
- `const url = enlaceWhatsApp(contactoSucursal(sucursal, tenant).whatsapp, \`Hola, quiero hacer un pedido del menú de ${tenant.nombre_negocio}.\`)`. Si `url` es null → `return null`.
- Botón flotante `position: fixed`, esquina inferior, **por encima** de `<MarcaAgua flotante />` (que también es fixed en TikTok) — coordinar `bottom` y `z-index`. Toca → `window.open(url, "_blank", "noopener,noreferrer")`.
- Estilo `--menu-*`.

### 8. `useMenuPublico.ts`

- Las **tres** consultas: `.select("*, plan:planes(marca_agua, menu_independiente_por_sucursal, permite_embudo_resenas, permite_pedidos_whatsapp))`.
- `MenuPublico` type: `permitePedidosWhatsApp: boolean` (junto a `permiteEmbudoResenas`).
- `armarMenuPublico`: `permitePedidosWhatsApp: plan?.permite_pedidos_whatsapp ?? false`; ampliar el `Pick<Plan, ...>` del parámetro `plan`.

### 9. `MenuPublico.tsx` — wiring

Cálculo compartido (antes de las ramas):
```ts
const numeroPedido = telefonoParaWaMe(
  contactoSucursal(data.sucursalActiva, data.tenant).whatsapp,
);
const pedidosOn = data.permitePedidosWhatsApp && numeroPedido !== null;
```

**Rama TikTok:** dentro del `<main>`, antes de `{data.marcaAgua && <MarcaAgua flotante />}`:
```tsx
<BotonPedidoTikTok tenant={data.tenant} sucursal={data.sucursalActiva} habilitado={pedidosOn} />
```

**No-TikTok:** envolver `cuerpo` en el provider, con `key` por sucursal para que se vacíe al cambiar:
```tsx
<CarritoWhatsAppProvider key={data.sucursalActiva?.id ?? "principal"} habilitado={pedidosOn}>
  {cuerpo}
</CarritoWhatsAppProvider>
```
Como `cuerpo` se usa en tres ramas (`marco`, `completo`, default), lo más limpio es envolverlo una vez donde se define:
```ts
const cuerpo = (
  <CarritoWhatsAppProvider key={...} habilitado={pedidosOn}>
    <HeaderMenu .../>
    {…formato…}
    <ContactoMenu .../>
    <BarraPedido tenant={data.tenant} sucursal={data.sucursalActiva} />
    <EmbudoResenas .../>
    {data.marcaAgua && <MarcaAgua />}
  </CarritoWhatsAppProvider>
);
```
Nota: el `key` en un elemento dentro de una expresión JSX que se reusa en 3 returns funciona (React lo re-monta cuando cambia). Si resulta frágil, mover el `key` a un `<Fragment key=...>` externo. El plan lo resuelve.

Añadir `pb-24` (o similar) al contenedor del `cuerpo` **cuando `pedidosOn`**, para que la barra fija no tape el final de `ContactoMenu` al hacer scroll hasta abajo.

**`EmbudoResenas` espera al carrito:** el componente pasa a leer `useCarritoWhatsApp()` (ya está dentro del provider) y añade `&& c.cantidadTotal === 0` a su `puedeMostrar`. Cuando `pedidosOn` es `false`, `cantidadTotal` siempre es 0 → sin efecto. Si el carrito se vacía (envío o "vaciar"), el embudo puede aparecer en la siguiente evaluación (su `setTimeout` ya habrá corrido o no — aceptable, es un aviso oportunista).

### 10. `/demo`

- `src/lib/demo.ts`: `SUCURSAL_DEMO.whatsapp = "+52 55 1234 5678"` (número de demo).
- `src/pages/Demo.tsx`, rama no-TikTok: envolver el `<div>` del menú en `<CarritoWhatsAppProvider habilitado>` y montar `<BarraPedido tenant={TENANT_DEMO} sucursal={SUCURSAL_DEMO} />` tras el `<Formato/>`. Los `BotonAgregar` de los formatos funcionan solos dentro del provider. TikTok en demo: montar `<BotonPedidoTikTok tenant={TENANT_DEMO} sucursal={SUCURSAL_DEMO} habilitado />`.
- El plan Free de demo no aplica aquí — `Demo.tsx` no resuelve un plan real, así que se pasa `habilitado` fijo.

### 11. Formatos — montaje de `BotonAgregar`

- **`Clasico.tsx`:** en cada `<li>` del producto, tras `<Modificadores>`, añadir `<BotonAgregar producto={producto} variante="stepper" />` alineado a la derecha o debajo del precio. Import del componente.
- **`Pinterest.tsx`:** envolver cada `<motion.button>` del mosaico en un `<div className="relative mb-3 break-inside-avoid">` (mover `mb-3`/`break-inside-avoid` al wrapper), y como hermano de la `motion.button` poner `<div className="absolute right-2 top-2"><BotonAgregar producto={producto} variante="badge" /></div>`. Además, en `<Detalle>`, tras el bloque de precio, `<BotonAgregar producto={producto} variante="stepper" />`.
- **`Instagram.tsx`:** cada tarjeta del grid ya es `<button className="group relative ...">` — envolver en `<div className="relative">`, quitar `relative` del botón si estorba, y poner `<div className="absolute left-1 top-1"><BotonAgregar producto={producto} variante="badge" /></div>` como hermano (la pastilla de precio ya ocupa `bottom-1 right-1`). En `<Post>`, tras la pastilla de precio, `<BotonAgregar producto={producto} variante="stepper" />`.
- **`TikTok.tsx`:** sin cambios.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/docs/vibemenu_migracion_pedidos_whatsapp.sql` | nuevo |
| `src/lib/pedido.ts` + `.test.ts` | nuevo |
| `src/hooks/useCarritoWhatsApp.tsx` + `.test.tsx` | nuevo |
| `src/components/menu/BotonAgregar.tsx` | nuevo |
| `src/components/menu/BarraPedido.tsx` | nuevo |
| `src/components/menu/HojaPedido.tsx` | nuevo |
| `src/components/menu/BotonPedidoTikTok.tsx` | nuevo |
| `src/components/menu/EmbudoResenas.tsx` | + condición `cantidadTotal === 0` |
| `src/hooks/useMenuPublico.ts` | select de plan + `permitePedidosWhatsApp` |
| `src/pages/MenuPublico.tsx` | provider, `BarraPedido`, `BotonPedidoTikTok`, `pb-24`, cálculo `pedidosOn` |
| `src/components/formatos/Clasico.tsx` | `BotonAgregar` stepper por renglón |
| `src/components/formatos/Pinterest.tsx` | wrapper `relative` + badge + stepper en `Detalle` |
| `src/components/formatos/Instagram.tsx` | wrapper `relative` + badge + stepper en `Post` |
| `src/pages/Demo.tsx` | provider + `BarraPedido` + `BotonPedidoTikTok` |
| `src/lib/demo.ts` | `SUCURSAL_DEMO.whatsapp` |
| `src/types/database.ts` | `planes.permite_pedidos_whatsapp` |

## Secuencia

1. Migración (MCP o SQL Editor). Sin gate de deploy.
2. Regenerar tipos.
3. `pedido.ts` + tests.
4. `useCarritoWhatsApp` + tests.
5. `BotonAgregar`, `BarraPedido`, `HojaPedido`, `BotonPedidoTikTok`.
6. `useMenuPublico` + `MenuPublico` wiring + `EmbudoResenas` (condición del carrito).
7. Los 3 formatos.
8. `/demo`.
9. `bun test src/lib && bun run typecheck && bun run lint && bun run build`.

## QA manual

- **Plan de pago, sucursal con WhatsApp:** en Clásico, el stepper de un renglón sube a `2`; la barra "Ver pedido · 2 · $…" aparece abajo. Abrir → hoja con el ítem, `− +`, quitar, nota. "Enviar" abre WhatsApp con el mensaje `• 2 × … — $…` + `Total: …` + `Nota: …`; al volver, el carrito está vacío y la barra desapareció.
- **Pinterest / Instagram:** el `+` sobre una tarjeta la agrega sin abrir el modal; abrir el modal muestra el stepper con la cantidad correcta; los dos controles (grid y modal) quedan sincronizados.
- **Cambiar de sucursal** (plan con menú independiente): el carrito se vacía.
- **Plan Free / sin `permite_pedidos_whatsapp`:** ningún stepper, ninguna barra, ningún botón.
- **Sucursal y empresa sin WhatsApp:** ídem — feature oculta (aunque el plan lo permita).
- **Carrito con ítems + plan con embudo:** el aviso "¿cómo estuvo tu visita?" NO aparece a los 20 s; tras "Enviar" (carrito vacío) sí puede aparecer.
- **TikTok, plan de pago con WhatsApp:** botón flotante "Pedir por WhatsApp" → abre WhatsApp con el mensaje genérico. No hay steppers ni barra. No aparece en Free.
- **`/demo`:** el carrito funciona con el número de demo; en los 4 formatos.
- **Scroll hasta abajo con la barra visible:** `ContactoMenu` no queda tapado por la barra.
- Regenerar `src/types/database.ts` y comparar con el hand-add.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Migración no aplicada | Sin gate: la feature no aparece hasta que exista la columna. No rompe nada. |
| `<button>` anidado en Pinterest/Instagram (badge dentro de la tarjeta-botón) | Reestructurar la tarjeta: wrapper `relative`, badge como hermano absoluto de la tarjeta-botón. Cubierto en §11. |
| `key` en el `<CarritoWhatsAppProvider>` dentro de una expresión reusada en 3 returns no re-monta bien | Si falla, envolver en `<Fragment key=...>`; el plan lo verifica con QA de cambio de sucursal. |
| Real estate abajo: barra + embudo + contacto | Embudo espera al carrito (decisión 4) → nunca coinciden barra y embudo. `pb-24` evita tapar `ContactoMenu`. |
| El comensal arma un pedido de 20 ítems y el mensaje `wa.me` excede el límite de URL | `wa.me` tolera mensajes largos; a 20 líneas está muy por debajo de límites reales. Sin paginación en v1 — anotado. |
| Sin `renderHook` en el proyecto para testear el hook | Extraer la lógica pura (`aplicarAccion`) y testear eso; el hook queda como una cáscara delgada. El plan revisa `package.json`. |
| Otra sesión toca `MenuPublico.tsx` / los formatos | La implementación espera a que el árbol quede libre; los implementadores verifican `git branch --show-current` antes de commitear (lección de #2). |
