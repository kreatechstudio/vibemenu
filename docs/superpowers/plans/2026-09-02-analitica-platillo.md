# Analítica por platillo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un tenant Enterprise ve qué platillos se ven y se agregan más, a qué hora y en qué sucursal, en `/admin/analitica`.

**Architecture:** Contador `interacciones_producto` incrementado por una RPC session-less (`registrar_interaccion_producto`) que el menú público llama vía un context `AnaliticaProvider`. `vista` se dispara al abrir el detalle (Pinterest/Instagram) o al mirar ≥2 s un slide (TikTok); `agregado` al meter al carrito (`BotonAgregar`, formatos con grid/lista). Dedup 1/producto/sesión/hora en `sessionStorage`. Panel con 4 vistas (ranking, curva por hora, ignorados, tendencia). Purga a 180 días por cron.

**Tech Stack:** React + TanStack Router (file-based) + TanStack Query + Tailwind + shadcn/ui + framer-motion + recharts (`src/components/ui/chart.tsx`, wrapper sin estrenar); Supabase (Postgres + RLS + RPC); Bun test runner; GitHub Actions (cron).

**Spec:** `docs/superpowers/specs/2026-09-01-analitica-platillo-design.md`

## Global Constraints

- **Proyecto Supabase:** `vibemenu`, ref `iaiiwtqqiaqxnzxjqcnt` (**producción**; Supabase Free = sin branching). Todo SQL con el conector `claude.ai Supabase` (`mcp__claude_ai_Supabase__*`) — **los subagentes NO tienen el conector**: el controlador ejecuta migración, regeneración de tipos y verificación SQL. Migración aditiva y transaccional (`begin; … commit;`).
- **Patrón contador (no fila por evento):** `interacciones_producto` es un contador `(tenant, sucursal, producto, día, hora)`, exactamente como `visitas_menu`. Solo se crean filas con interacción real.
- **Escritura sin sesión:** el comensal no tiene sesión. RPC `SECURITY DEFINER` `to anon, authenticated` (precedente `registrar_visita`, `registrar_feedback`), que **nunca lanza** y hace `return` silencioso ante cualquier dato inválido.
- **Chequeo de plan DENTRO de la RPC:** solo `permite_analitica_platillo` (Enterprise) acumula. El frontend además gatea las llamadas, pero la RPC es la red real.
- **Zona horaria:** `día` y `hora` se calculan con `now() at time zone coalesce(sucursal.timezone, 'UTC')` (o la primera sucursal del tenant si `p_sucursal_id` es null) — mismo camino probado que `registrar_visita` y `combinar_fecha_hora_sucursal`.
- **`sucursal_id` nullable** → dos índices únicos **parciales** (`where sucursal_id is not null` / `where sucursal_id is null`), truco de `visitas_menu`. `null` = menú general (`/:slug` sin sucursal).
- **Supabase concede `EXECUTE` a `anon`/`authenticated` por defecto** en funciones de `public`. Para `service_role`-only hace falta `revoke execute … from public, anon, authenticated` explícito (lección de #4).
- **Dedup:** 1 por `(tenant, sucursal|general, producto, tipo, YYYY-MM-DD-HH)` por sesión de navegador, `sessionStorage`, `try/catch` (Safari privado lanza) — patrón `yaContada` de `useVisitas`.
- **`agregado` solo existe en Pinterest / Instagram / Clásico** — **TikTok NO tiene carrito** (`BotonPedidoTikTok` es un link `wa.me` genérico; `BotonAgregar` no se usa en TikTok). El spec dice "4 formatos"; son 3. TikTok solo aporta `vistas`.
- **`useAnalitica()` sin provider = no-ops** — `/demo` renderiza los formatos sin `AnaliticaProvider`.
- **Plan Enterprise:** `permite_analitica_platillo = true` solo en `enterprise`.
- **Tests:** solo `src/lib/*.test.ts`, `bun:test` (`import { describe, expect, test } from "bun:test"`). CI: `src/lib` + `bunx tsc --noEmit` + `bunx eslint .` (0 errores; ~14 warnings `react-refresh` preexistentes OK). Componentes/hooks: `tsc` + `eslint` + `bun run build` + prueba manual.
- **`src/types/database.ts`** es generado; se **regenera** con `mcp__claude_ai_Supabase__generate_typescript_types` tras la migración, **conservando el bloque de alias manual al pie** (de `export type Plan = Tables<"planes">;` a EOF).
- **`src/routeTree.gen.ts`** es TRACKED; lo regenera `bun run build` / `vite dev`. Commitear el cambio.
- **Copy:** español de México, tono directo (ver `src/lib/copy.ts`).
- **Estilo de gráficas hoy:** el Dashboard pinta `visitas` con barras CSS animadas (framer-motion `width`), no con `recharts`. `recharts` es dependencia y `src/components/ui/chart.tsx` está sin usar.

---

## File Structure

**Nuevos:**

| Archivo | Responsabilidad |
|---|---|
| `src/docs/vibemenu_migracion_analitica_platillo.sql` | Registro de la migración (se aplica por el conector). |
| `src/lib/analitica.ts` | Puro: `claveDedup`, `yaRegistrada`, y las funciones de agregación del panel (`rankingDesde`, `porHoraDe`, `serieDesde`, `ignoradosDesde`). Sin React, sin red. |
| `src/lib/analitica.test.ts` | Suite de lo anterior (CI). |
| `src/hooks/useAnalitica.tsx` | `AnaliticaProvider({ tenantId, sucursalId, habilitado })` + `useAnalitica()` → `{ registrarVista, registrarAgregado }` (fire-and-forget, deduplicado, no-op sin provider). |
| `src/hooks/useAnaliticaProducto.ts` | `useAnaliticaProducto(tenantId, { dias, sucursalId })` — select RLS + `useProductos`, deriva `{ ranking, porHora, ignorados, serie }` con las funciones puras de `analitica.ts`. |
| `src/pages/admin/Analitica.tsx` | Página del panel: muro de plan + 4 vistas. |
| `src/routes/admin.analitica.tsx` | Ruta file-based. |
| `.github/workflows/purgar-interacciones-producto.yml` | Cron diario que llama la RPC de purga. |

**Modificados:**

| Archivo | Cambio |
|---|---|
| `src/types/database.ts` | Regenerado (tabla + `planes.permite_analitica_platillo` + RPCs). |
| `src/hooks/useMenuPublico.ts` | `permite_analitica_platillo` en los 3 joins de plan + el `Pick<Plan,…>` + `MenuPublico` gana `permiteAnaliticaPlatillo` + el `return`. |
| `src/pages/MenuPublico.tsx` | Monta `<AnaliticaProvider>` en las dos ramas (TikTok y `cuerpo`). |
| `src/components/formatos/Pinterest.tsx` | `registrarVista(producto.id)` en `onClick={() => setAbierto(producto)}`. |
| `src/components/formatos/Instagram.tsx` | Idem. |
| `src/components/formatos/TikTok.tsx` | `Slide` gana `IntersectionObserver` + timer 2 s → `registrarVista`. |
| `src/components/menu/BotonAgregar.tsx` | `registrarAgregado(producto.id)` junto a cada `c.agregar(producto)` (3 sitios). |
| `src/components/layout/PillTabs.tsx` | Pestaña "Analítica" en `PESTANAS_NEGOCIO`. |
| `src/components/layout/AdminLayout.tsx` | `/admin/analitica` en el `cubre` de "Mi negocio". |
| `src/pages/Privacidad.tsx` | Una línea: el conteo agregado incluye interacciones por platillo, sin identificar al comensal. |
| `src/docs/vibemenu_alcance.md` | Sale de "fuera de alcance"; entra en features/planes/rutas. |
| `src/docs/vibemenu_base-datos.md` | Sección nueva (DDL + RLS + RPCs + nota). |

---

## Task 1: Migración de esquema

**Files:**
- Create: `src/docs/vibemenu_migracion_analitica_platillo.sql`

**Interfaces:**
- Produces: `planes.permite_analitica_platillo boolean`; tabla `interacciones_producto (id bigint, tenant_id uuid, sucursal_id uuid|null, producto_id uuid, dia date, hora smallint 0..23, vistas int, agregados int)`; RPC `registrar_interaccion_producto(p_tenant_id uuid, p_producto_id uuid, p_tipo text, p_sucursal_id uuid default null) returns void`; RPC `purgar_interacciones_producto() returns integer`.

- [ ] **Step 1: Escribir `src/docs/vibemenu_migracion_analitica_platillo.sql`**

Contenido exacto (cabecera de comentario estilo peers + `begin;…commit;` + verificación al pie):

```sql
-- ============================================================================
--  VIBEMENU — migracion: analitica por platillo (sub-proyecto #5)
--
--  1. planes.permite_analitica_platillo → gatea la feature (Enterprise).
--  2. interacciones_producto → contador (tenant, sucursal, producto, dia, hora)
--     con dos columnas: vistas y agregados. NO fila por evento (patron visitas_menu).
--  3. registrar_interaccion_producto → unico camino del comensal (sin sesion).
--     SECURITY DEFINER, nunca lanza. Chequea el plan adentro: solo Enterprise cuenta.
--  4. purgar_interacciones_producto → la llama un workflow nocturno (180 dias).
--
--  Aplicar con apply_migration del conector Supabase (project_id
--  iaiiwtqqiaqxnzxjqcnt, name: analitica_platillo).
--  APLICAR ANTES del deploy de la rama: el menu publico llama la RPC y el panel
--  lee la tabla; sin ellas hay errores en consola / panel roto.
-- ============================================================================

begin;

alter table planes
  add column if not exists permite_analitica_platillo boolean not null default false;

update planes set permite_analitica_platillo = true where nombre = 'enterprise';

create table interacciones_producto (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  sucursal_id uuid references sucursales(id) on delete set null,
  producto_id uuid not null references productos(id) on delete cascade,
  dia         date     not null,
  hora        smallint not null check (hora between 0 and 23),
  vistas      integer  not null default 0 check (vistas >= 0),
  agregados   integer  not null default 0 check (agregados >= 0)
);

create unique index uq_interacciones_prod_sucursal
  on interacciones_producto (tenant_id, sucursal_id, producto_id, dia, hora)
  where sucursal_id is not null;

create unique index uq_interacciones_prod_general
  on interacciones_producto (tenant_id, producto_id, dia, hora)
  where sucursal_id is null;

create index idx_interacciones_prod_tenant_dia
  on interacciones_producto (tenant_id, dia desc);

alter table interacciones_producto enable row level security;

create policy "interacciones_prod_select_miembros" on interacciones_producto for select
  to authenticated using (pertenece_a_tenant(tenant_id));

revoke all on interacciones_producto from anon, authenticated;
grant select on interacciones_producto to authenticated;

create or replace function registrar_interaccion_producto(
  p_tenant_id   uuid,
  p_producto_id uuid,
  p_tipo        text,
  p_sucursal_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_permite boolean;
  v_tz      text;
  v_dia     date;
  v_hora    smallint;
begin
  if p_tipo not in ('vista', 'agregado') then
    return;
  end if;

  select p.permite_analitica_platillo into v_permite
    from planes p join tenants t on t.plan_id = p.id
   where t.id = p_tenant_id;
  if not coalesce(v_permite, false) then
    return;
  end if;

  if not exists (
    select 1 from productos pr
     where pr.id = p_producto_id and pr.tenant_id = p_tenant_id
  ) then
    return;
  end if;

  if p_sucursal_id is not null and not exists (
    select 1 from sucursales s where s.id = p_sucursal_id and s.tenant_id = p_tenant_id
  ) then
    p_sucursal_id := null;
  end if;

  select s.timezone into v_tz
    from sucursales s
   where s.tenant_id = p_tenant_id
     and (p_sucursal_id is null or s.id = p_sucursal_id)
   order by s.created_at
   limit 1;

  v_dia  := (now() at time zone coalesce(v_tz, 'UTC'))::date;
  v_hora := extract(hour from (now() at time zone coalesce(v_tz, 'UTC')))::smallint;

  if p_sucursal_id is null then
    insert into interacciones_producto (tenant_id, sucursal_id, producto_id, dia, hora, vistas, agregados)
    values (p_tenant_id, null, p_producto_id, v_dia, v_hora,
            case when p_tipo = 'vista' then 1 else 0 end,
            case when p_tipo = 'agregado' then 1 else 0 end)
    on conflict (tenant_id, producto_id, dia, hora) where sucursal_id is null
    do update set
      vistas    = interacciones_producto.vistas    + case when p_tipo = 'vista'    then 1 else 0 end,
      agregados = interacciones_producto.agregados + case when p_tipo = 'agregado' then 1 else 0 end;
  else
    insert into interacciones_producto (tenant_id, sucursal_id, producto_id, dia, hora, vistas, agregados)
    values (p_tenant_id, p_sucursal_id, p_producto_id, v_dia, v_hora,
            case when p_tipo = 'vista' then 1 else 0 end,
            case when p_tipo = 'agregado' then 1 else 0 end)
    on conflict (tenant_id, sucursal_id, producto_id, dia, hora) where sucursal_id is not null
    do update set
      vistas    = interacciones_producto.vistas    + case when p_tipo = 'vista'    then 1 else 0 end,
      agregados = interacciones_producto.agregados + case when p_tipo = 'agregado' then 1 else 0 end;
  end if;
end;
$$;

revoke execute on function registrar_interaccion_producto(uuid, uuid, text, uuid) from public;
grant  execute on function registrar_interaccion_producto(uuid, uuid, text, uuid) to anon, authenticated;

create or replace function purgar_interacciones_producto()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_borradas integer;
begin
  delete from interacciones_producto where dia < current_date - 180;
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$$;

revoke execute on function purgar_interacciones_producto() from public, anon, authenticated;
grant  execute on function purgar_interacciones_producto() to service_role;

commit;

-- ============================================================================
--  Verificar:
--    select nombre, permite_analitica_platillo from planes order by precio_usd;
--    -- free/basic/pro = false, enterprise = true
--
--    select count(*) from pg_policies where tablename = 'interacciones_producto';  -- 1
--
--    select proname, provolatile from pg_proc
--     where proname in ('registrar_interaccion_producto','purgar_interacciones_producto');
--
--    -- anon puede registrar, no purgar:
--    set role anon;
--    select registrar_interaccion_producto(gen_random_uuid(), gen_random_uuid(), 'vista');  -- void, sin error
--    select purgar_interacciones_producto();  -- ERROR permission denied
--    reset role;
-- ============================================================================
```

- [ ] **Step 2: Verificar el estilo contra los peers**

Abrir `src/docs/vibemenu_migracion_redes_visitas.sql` (visitas_menu + registrar_visita) y `src/docs/vibemenu_migracion_reservaciones.sql` y confirmar: cabecera de comentario, `begin;/commit;`, verificación al pie, `pertenece_a_tenant(check_tenant_id uuid)` existe (schema doc), `productos.tenant_id` y `sucursales.timezone` existen. Si algo no cuadra, STOP y reportar BLOCKED.

- [ ] **Step 3: Commit**

```bash
git add src/docs/vibemenu_migracion_analitica_platillo.sql
git commit -m "feat(analitica): migración de esquema (interacciones_producto, RPCs, flag de plan)"
```

**NOTA para el controlador:** aplicar esta migración a prod por el conector (`apply_migration`, name `analitica_platillo`), correr las queries de verificación, probar la RPC con un producto real (bump temporal de un tenant a Enterprise), revertir el bump. Luego regenerar `database.ts` (Task 2).

---

## Task 2: Regenerar tipos de base de datos

**Files:**
- Modify: `src/types/database.ts`

**Interfaces:**
- Consumes: el esquema de Task 1 aplicado a prod.
- Produces: `Tables<"interacciones_producto">`, `Plan.permite_analitica_platillo: boolean`, firmas de `registrar_interaccion_producto` / `purgar_interacciones_producto` en `Database["public"]["Functions"]`.

- [ ] **Step 1: (controlador) regenerar**

`mcp__claude_ai_Supabase__generate_typescript_types` con `project_id: "iaiiwtqqiaqxnzxjqcnt"`. El controlador guarda la salida cruda a `.superpowers/sdd/<plan>/generated-types.ts` y se la pasa al implementador (los subagentes no tienen conector).

- [ ] **Step 2: splice**

`src/types/database.ts` = [salida generada, de `export type Json` a `export const Constants = {…} as const`] + línea en blanco + [bloque manual existente desde `export type Plan = Tables<"planes">;` a EOF, **sin cambios**].
No añadir alias `Interaccion*` (el panel usa `Tables<...>` / tipos locales).

- [ ] **Step 3: formato + typecheck**

```
bunx prettier --write src/types/database.ts
bunx tsc --noEmit
```
Expected: PASS. Si `tsc` marca `src/lib/demo.ts` por `Plan` incompleto, añadir `permite_analitica_platillo: false` donde se construya un `Plan` literal (revisar `demo.ts`).

- [ ] **Step 4: lint + commit**

```bash
bunx eslint src/types/database.ts
git add src/types/database.ts src/lib/demo.ts
git commit -m "feat(analitica): regenera tipos de base de datos"
```

---

## Task 3: Biblioteca pura `src/lib/analitica.ts`

**Files:**
- Create: `src/lib/analitica.ts`
- Test: `src/lib/analitica.test.ts`

**Interfaces:**
- Consumes: nada (solo `Date` y `sessionStorage`).
- Produces:
  - `type TipoInteraccion = "vista" | "agregado"`
  - `claveDedup(tenantId: string, sucursalId: string | null, productoId: string, tipo: TipoInteraccion, ahora: Date): string`
  - `yaRegistrada(clave: string): boolean`
  - `type FilaInteraccion = { sucursal_id: string | null; producto_id: string; dia: string; hora: number; vistas: number; agregados: number }`
  - `type FilaRanking = { productoId: string; nombre: string; vistas: number; agregados: number; tasa: number | null }`
  - `rankingDesde(filas: FilaInteraccion[], nombres: Map<string, string>): FilaRanking[]` — suma por producto, `tasa = agregados/vistas` solo si `vistas > 0 && agregados <= vistas`, si no `null`; orden por `vistas` desc.
  - `porHoraDe(filas: FilaInteraccion[], productoId: string): { hora: number; vistas: number; agregados: number }[]` — exactamente 24 entradas (0..23), relleno con ceros.
  - `serieDesde(filas: FilaInteraccion[], dias: number, hoy: Date): { dia: string; vistas: number; agregados: number }[]` — total del menú por día, relleno de días sin datos, del más viejo al más nuevo.
  - `ignoradosDesde(filas: FilaInteraccion[], productosActivos: { id: string; nombre: string }[], umbral: number): { productoId: string; nombre: string; vistas: number }[]` — productos activos con `sum(vistas) < umbral` en las filas, orden por vistas asc.
  - `export const UMBRAL_IGNORADO = 3`

- [ ] **Step 1: Escribir los tests que fallan**

`src/lib/analitica.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import {
  claveDedup,
  ignoradosDesde,
  porHoraDe,
  rankingDesde,
  serieDesde,
  yaRegistrada,
  type FilaInteraccion,
} from "@/lib/analitica";

const fila = (over: Partial<FilaInteraccion>): FilaInteraccion => ({
  sucursal_id: null,
  producto_id: "p1",
  dia: "2026-09-01",
  hora: 14,
  vistas: 0,
  agregados: 0,
  ...over,
});

describe("claveDedup", () => {
  const ahora = new Date("2026-09-01T14:30:00-06:00");
  test("incluye tenant, sucursal, producto, tipo y la hora local", () => {
    const k = claveDedup("t1", "s1", "p1", "vista", ahora);
    expect(k).toContain("t1");
    expect(k).toContain("s1");
    expect(k).toContain("p1");
    expect(k).toContain("vista");
  });
  test("menú general usa 'general' en vez de la sucursal", () => {
    expect(claveDedup("t1", null, "p1", "vista", ahora)).toContain("general");
  });
  test("cambia al cambiar de hora", () => {
    const otra = new Date("2026-09-01T15:30:00-06:00");
    expect(claveDedup("t1", "s1", "p1", "vista", ahora)).not.toBe(
      claveDedup("t1", "s1", "p1", "vista", otra),
    );
  });
  test("cambia al cambiar de tipo y de producto", () => {
    expect(claveDedup("t1", "s1", "p1", "vista", ahora)).not.toBe(
      claveDedup("t1", "s1", "p1", "agregado", ahora),
    );
    expect(claveDedup("t1", "s1", "p1", "vista", ahora)).not.toBe(
      claveDedup("t1", "s1", "p2", "vista", ahora),
    );
  });
});

describe("yaRegistrada", () => {
  test("false la primera vez, true la segunda", () => {
    const k = "vm:ip:test:" + Math.random();
    expect(yaRegistrada(k)).toBe(false);
    expect(yaRegistrada(k)).toBe(true);
  });
});

describe("rankingDesde", () => {
  const nombres = new Map([
    ["p1", "Tacos"],
    ["p2", "Pozole"],
  ]);
  test("suma por producto y ordena por vistas desc", () => {
    const r = rankingDesde(
      [
        fila({ producto_id: "p1", vistas: 3, agregados: 1 }),
        fila({ producto_id: "p1", hora: 20, vistas: 2, agregados: 1 }),
        fila({ producto_id: "p2", vistas: 10, agregados: 0 }),
      ],
      nombres,
    );
    expect(r.map((x) => x.productoId)).toEqual(["p2", "p1"]);
    expect(r[1]).toMatchObject({ nombre: "Tacos", vistas: 5, agregados: 2 });
  });
  test("tasa null si vistas 0 o si agregados > vistas", () => {
    const r = rankingDesde(
      [
        fila({ producto_id: "p1", vistas: 0, agregados: 2 }),
        fila({ producto_id: "p2", vistas: 4, agregados: 1 }),
      ],
      nombres,
    );
    expect(r.find((x) => x.productoId === "p1")!.tasa).toBeNull();
    expect(r.find((x) => x.productoId === "p2")!.tasa).toBeCloseTo(0.25);
  });
});

describe("porHoraDe", () => {
  test("24 entradas, relleno con ceros, filtrado al producto", () => {
    const h = porHoraDe(
      [
        fila({ producto_id: "p1", hora: 14, vistas: 2 }),
        fila({ producto_id: "p1", hora: 14, agregados: 1 }),
        fila({ producto_id: "p2", hora: 9, vistas: 99 }),
      ],
      "p1",
    );
    expect(h).toHaveLength(24);
    expect(h[14]).toEqual({ hora: 14, vistas: 2, agregados: 1 });
    expect(h[9]).toEqual({ hora: 9, vistas: 0, agregados: 0 });
  });
});

describe("serieDesde", () => {
  test("rellena días sin datos y respeta el rango", () => {
    const hoy = new Date("2026-09-03T12:00:00Z");
    const s = serieDesde([fila({ dia: "2026-09-02", vistas: 5 })], 3, hoy);
    expect(s).toHaveLength(3);
    expect(s.map((x) => x.dia)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(s[1].vistas).toBe(5);
    expect(s[0].vistas).toBe(0);
  });
});

describe("ignoradosDesde", () => {
  test("productos activos por debajo del umbral, orden por vistas asc", () => {
    const r = ignoradosDesde(
      [fila({ producto_id: "p1", vistas: 1 }), fila({ producto_id: "p2", vistas: 10 })],
      [
        { id: "p1", nombre: "Tacos" },
        { id: "p2", nombre: "Pozole" },
        { id: "p3", nombre: "Agua" },
      ],
      3,
    );
    expect(r.map((x) => x.productoId)).toEqual(["p3", "p1"]); // p3 con 0, p1 con 1
    expect(r).not.toContainEqual(expect.objectContaining({ productoId: "p2" }));
  });
});
```

- [ ] **Step 2: Correr, ver fallar**

Run: `bun test src/lib/analitica.test.ts`
Expected: FAIL — `Cannot find module "@/lib/analitica"`.

- [ ] **Step 3: Implementar `src/lib/analitica.ts`**

```ts
/**
 * Lógica pura de analítica por platillo. Sin React, sin red.
 *
 * `claveDedup` + `yaRegistrada`: una interacción por (tenant, sucursal|general,
 * producto, tipo) por hora local del navegador, en `sessionStorage`. El servidor
 * recalcula la hora con la zona de la sucursal; para el dedup basta la del
 * navegador (el comensal está en la zona del local en la práctica).
 *
 * `rankingDesde` / `porHoraDe` / `serieDesde` / `ignoradosDesde`: agregan las
 * filas crudas de `interacciones_producto` para el panel. `useAnaliticaProducto`
 * solo hace el `select` y llama a estas.
 */

export type TipoInteraccion = "vista" | "agregado";

export type FilaInteraccion = {
  sucursal_id: string | null;
  producto_id: string;
  dia: string;
  hora: number;
  vistas: number;
  agregados: number;
};

export type FilaRanking = {
  productoId: string;
  nombre: string;
  vistas: number;
  agregados: number;
  /** agregados/vistas cuando vistas>0 y agregados<=vistas; si no, null → "—". */
  tasa: number | null;
};

export const UMBRAL_IGNORADO = 3;

function ymdHLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}`;
}

export function claveDedup(
  tenantId: string,
  sucursalId: string | null,
  productoId: string,
  tipo: TipoInteraccion,
  ahora: Date,
): string {
  return `vm:ip:${tenantId}:${sucursalId ?? "general"}:${productoId}:${tipo}:${ymdHLocal(ahora)}`;
}

export function yaRegistrada(clave: string): boolean {
  try {
    if (sessionStorage.getItem(clave)) return true;
    sessionStorage.setItem(clave, "1");
    return false;
  } catch {
    return false;
  }
}

export function rankingDesde(
  filas: FilaInteraccion[],
  nombres: Map<string, string>,
): FilaRanking[] {
  const acc = new Map<string, { vistas: number; agregados: number }>();
  for (const f of filas) {
    const a = acc.get(f.producto_id) ?? { vistas: 0, agregados: 0 };
    a.vistas += f.vistas;
    a.agregados += f.agregados;
    acc.set(f.producto_id, a);
  }
  return [...acc.entries()]
    .map(([productoId, { vistas, agregados }]) => ({
      productoId,
      nombre: nombres.get(productoId) ?? "Platillo eliminado",
      vistas,
      agregados,
      tasa: vistas > 0 && agregados <= vistas ? agregados / vistas : null,
    }))
    .sort((a, b) => b.vistas - a.vistas || b.agregados - a.agregados);
}

export function porHoraDe(
  filas: FilaInteraccion[],
  productoId: string,
): { hora: number; vistas: number; agregados: number }[] {
  const base = Array.from({ length: 24 }, (_, hora) => ({ hora, vistas: 0, agregados: 0 }));
  for (const f of filas) {
    if (f.producto_id !== productoId) continue;
    base[f.hora].vistas += f.vistas;
    base[f.hora].agregados += f.agregados;
  }
  return base;
}

function ymdLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function serieDesde(
  filas: FilaInteraccion[],
  dias: number,
  hoy: Date,
): { dia: string; vistas: number; agregados: number }[] {
  const porDia = new Map<string, { vistas: number; agregados: number }>();
  for (const f of filas) {
    const a = porDia.get(f.dia) ?? { vistas: 0, agregados: 0 };
    a.vistas += f.vistas;
    a.agregados += f.agregados;
    porDia.set(f.dia, a);
  }
  const out: { dia: string; vistas: number; agregados: number }[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - i);
    const clave = ymdLocal(d);
    const v = porDia.get(clave) ?? { vistas: 0, agregados: 0 };
    out.push({ dia: clave, ...v });
  }
  return out;
}

export function ignoradosDesde(
  filas: FilaInteraccion[],
  productosActivos: { id: string; nombre: string }[],
  umbral: number,
): { productoId: string; nombre: string; vistas: number }[] {
  const vistasPorProd = new Map<string, number>();
  for (const f of filas) {
    vistasPorProd.set(f.producto_id, (vistasPorProd.get(f.producto_id) ?? 0) + f.vistas);
  }
  return productosActivos
    .map((p) => ({ productoId: p.id, nombre: p.nombre, vistas: vistasPorProd.get(p.id) ?? 0 }))
    .filter((x) => x.vistas < umbral)
    .sort((a, b) => a.vistas - b.vistas);
}
```

- [ ] **Step 4: Correr los tests**

Run: `bun test src/lib/analitica.test.ts` → PASS.
Si `claveDedup`/`serieDesde` fallan por el manejo de fecha local del runtime, ajustar las aserciones a lo que emite Bun (la intención: la clave cambia por hora; la serie tiene `dias` entradas terminando en `hoy`). No debilitar los demás tests.

- [ ] **Step 5: Suite completa + lint + typecheck + commit**

```bash
bun test && bunx eslint src/lib/analitica.ts src/lib/analitica.test.ts && bunx tsc --noEmit
git add src/lib/analitica.ts src/lib/analitica.test.ts
git commit -m "feat(analitica): biblioteca pura (dedup + agregación del panel)"
```

---

## Task 4: `AnaliticaProvider` + `useAnalitica`

**Files:**
- Create: `src/hooks/useAnalitica.tsx`

**Interfaces:**
- Consumes: `supabase` de `@/lib/supabase`; `claveDedup`, `yaRegistrada`, `type TipoInteraccion` de `@/lib/analitica`.
- Produces:
  - `AnaliticaProvider(props: { tenantId: string; sucursalId: string | null; habilitado: boolean; children: React.ReactNode }): JSX.Element`
  - `useAnalitica(): { registrarVista: (productoId: string) => void; registrarAgregado: (productoId: string) => void }` — **sin provider devuelve no-ops** (no lanza).

- [ ] **Step 1: Leer el patrón**

Abrir `src/hooks/useCarritoWhatsApp.tsx` (createContext + Provider + hook; qué hace `useCarritoWhatsApp()` sin provider — replicar la tolerancia) y `src/hooks/useVisitas.ts` (`useRegistrarVisita` fire-and-forget, `yaContada`).

- [ ] **Step 2: Implementar**

```tsx
import { createContext, useCallback, useContext, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { claveDedup, yaRegistrada, type TipoInteraccion } from "@/lib/analitica";

type Analitica = {
  registrarVista: (productoId: string) => void;
  registrarAgregado: (productoId: string) => void;
};

const NOOP: Analitica = { registrarVista: () => {}, registrarAgregado: () => {} };

const Ctx = createContext<Analitica | null>(null);

/**
 * Cuenta interacciones por platillo del menú público (sub-proyecto #5).
 *
 * `habilitado` = `planes.permite_analitica_platillo` (Enterprise). Cuando es
 * `false` no hay tenant, o ya se contó esta hora, las funciones son no-ops.
 * Fire-and-forget: un menú público jamás se rompe por una métrica. La RPC
 * `SECURITY DEFINER` revalida plan + pertenencia y nunca lanza.
 */
export function AnaliticaProvider({
  tenantId,
  sucursalId,
  habilitado,
  children,
}: {
  tenantId: string;
  sucursalId: string | null;
  habilitado: boolean;
  children: React.ReactNode;
}) {
  const registrar = useCallback(
    (productoId: string, tipo: TipoInteraccion) => {
      if (!habilitado || !tenantId || !productoId) return;
      if (yaRegistrada(claveDedup(tenantId, sucursalId, productoId, tipo, new Date()))) return;
      void supabase.rpc("registrar_interaccion_producto", {
        p_tenant_id: tenantId,
        p_producto_id: productoId,
        p_tipo: tipo,
        p_sucursal_id: sucursalId ?? undefined,
      });
    },
    [habilitado, tenantId, sucursalId],
  );

  const valor = useMemo<Analitica>(
    () => ({
      registrarVista: (id) => registrar(id, "vista"),
      registrarAgregado: (id) => registrar(id, "agregado"),
    }),
    [registrar],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAnalitica(): Analitica {
  return useContext(Ctx) ?? NOOP;
}
```

- [ ] **Step 3: typecheck + lint**

Run: `bunx tsc --noEmit && bunx eslint src/hooks/useAnalitica.tsx`
Expected: PASS. (Un warning `react-refresh` por exportar `AnaliticaProvider` + `useAnalitica` de un `.tsx` es consistente con `useCarritoWhatsApp.tsx` — no bloquea.)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAnalitica.tsx
git commit -m "feat(analitica): AnaliticaProvider + useAnalitica (fire-and-forget, deduplicado)"
```

---

## Task 5: `useMenuPublico` — flag de plan

**Files:**
- Modify: `src/hooks/useMenuPublico.ts`

**Interfaces:**
- Produces: `MenuPublico` gana `permiteAnaliticaPlatillo: boolean`.

- [ ] **Step 1: Editar los 4 puntos**

En `src/hooks/useMenuPublico.ts`:
1. Los **3** strings `.select("*, plan:planes(marca_agua, menu_independiente_por_sucursal, permite_embudo_resenas, permite_pedidos_whatsapp, permite_reservaciones)")` → añadir `, permite_analitica_platillo`.
2. El `Pick<Plan, | "marca_agua" | … | "permite_reservaciones">` en el parámetro de `armarMenuPublico` → añadir `| "permite_analitica_platillo"`.
3. El tipo `MenuPublico` → añadir tras `permiteReservaciones`:
   ```ts
   /** planes.permite_analitica_platillo — cuenta interacciones por platillo (Enterprise). */
   permiteAnaliticaPlatillo: boolean;
   ```
4. El `return` de `armarMenuPublico` → añadir tras `permiteReservaciones: …`:
   ```ts
   permiteAnaliticaPlatillo: plan?.permite_analitica_platillo ?? false,
   ```

- [ ] **Step 2: typecheck + lint + build**

Run: `bunx tsc --noEmit && bunx eslint src/hooks/useMenuPublico.ts && bun run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMenuPublico.ts
git commit -m "feat(analitica): permiteAnaliticaPlatillo en useMenuPublico"
```

---

## Task 6: Montar `AnaliticaProvider` + disparar `vista`/`agregado`

**Files:**
- Modify: `src/pages/MenuPublico.tsx`
- Modify: `src/components/formatos/Pinterest.tsx`
- Modify: `src/components/formatos/Instagram.tsx`
- Modify: `src/components/formatos/TikTok.tsx`
- Modify: `src/components/menu/BotonAgregar.tsx`

**Interfaces:**
- Consumes: `AnaliticaProvider`, `useAnalitica` (Task 4); `data.permiteAnaliticaPlatillo` (Task 5).

- [ ] **Step 1: `MenuPublico.tsx` — envolver las dos ramas**

Importar `AnaliticaProvider`. Hay dos returns con JSX de menú:
- La rama TikTok (`if (data.formato === "tiktok") return (<>…</>)`): envolver el fragmento interno con
  ```tsx
  <AnaliticaProvider tenantId={data.tenant.id} sucursalId={data.sucursalActiva?.id ?? null} habilitado={data.permiteAnaliticaPlatillo}>
    …
  </AnaliticaProvider>
  ```
- La constante `cuerpo` (envuelta hoy en `<CarritoWhatsAppProvider>`): envolver **por fuera** de `CarritoWhatsAppProvider`:
  ```tsx
  const cuerpo = (
    <AnaliticaProvider tenantId={data.tenant.id} sucursalId={data.sucursalActiva?.id ?? null} habilitado={data.permiteAnaliticaPlatillo}>
      <CarritoWhatsAppProvider key={data.sucursalActiva?.id ?? "principal"} habilitado={pedidosOn}>
        …
      </CarritoWhatsAppProvider>
    </AnaliticaProvider>
  );
  ```
No poner `key` en `AnaliticaProvider` (el dedup ya distingue por sucursal en la clave).

- [ ] **Step 2: Pinterest + Instagram — `vista` al abrir**

En `src/components/formatos/Pinterest.tsx`: `import { useAnalitica } from "@/hooks/useAnalitica";`, dentro del componente `const analitica = useAnalitica();`, y cambiar `onClick={() => setAbierto(producto)}` por:
```tsx
onClick={() => {
  analitica.registrarVista(producto.id);
  setAbierto(producto);
}}
```
Mismo cambio en `src/components/formatos/Instagram.tsx` (su `onClick={() => setAbierto(producto)}` en el grid).

- [ ] **Step 3: TikTok — `vista` por permanencia ≥ 2 s**

En `src/components/formatos/TikTok.tsx`, en el componente `Slide`:
```tsx
import { useEffect, useRef, useState } from "react";
import { useAnalitica } from "@/hooks/useAnalitica";
// ...
function Slide({ producto }: { producto: ProductoConModificadores }) {
  const [sheet, setSheet] = useState(false);
  const embed = producto.video_url ? urlEmbebida(producto.video_url) : null;
  const seccionRef = useRef<HTMLElement>(null);
  const analitica = useAnalitica();

  useEffect(() => {
    const el = seccionRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          timer = setTimeout(() => analitica.registrarVista(producto.id), 2000);
        } else if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    obs.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      obs.disconnect();
    };
  }, [producto.id, analitica]);

  return (
    <section ref={seccionRef} className="relative h-dvh …">
```
(añadir `ref={seccionRef}` al `<section>` existente; no cambiar sus clases.)

- [ ] **Step 4: `BotonAgregar.tsx` — `agregado` en cada `c.agregar`**

`import { useAnalitica } from "@/hooks/useAnalitica";`, `const analitica = useAnalitica();` en el cuerpo. Hay **3** `onClick` que llaman `c.agregar(producto)` (variante `badge`; variante `stepper` con `n === 0`; variante `stepper` con `n > 0`, el botón `+`). En cada uno, justo después de `c.agregar(producto);` añadir `analitica.registrarAgregado(producto.id);`.
Nota: `BotonAgregar` retorna `null` si `!c.habilitado`, así que `agregado` solo se cuenta cuando el carrito está activo — correcto. Clásico/Pinterest/Instagram lo montan; TikTok no usa `BotonAgregar` (sin cambios en TikTok para `agregado`).

- [ ] **Step 5: typecheck + lint + build**

Run: `bunx tsc --noEmit && bunx eslint src/pages/MenuPublico.tsx src/components/formatos/Pinterest.tsx src/components/formatos/Instagram.tsx src/components/formatos/TikTok.tsx src/components/menu/BotonAgregar.tsx && bun run build`
Expected: PASS.

- [ ] **Step 6: Prueba manual (dev)**

`bun run dev`. El controlador habrá dejado un tenant de prueba en Enterprise con productos (o el implementador lo pide). Abrir su menú en formato Pinterest → abrir 2 productos; formato TikTok → deslizar despacio por 1 slide (≥2 s) y rápido por otro. Verificar por el conector (`select * from interacciones_producto order by id desc`) que entraron filas: 2 `vistas` de Pinterest, 1 `vista` del slide lento, 0 del rápido. Si no hay tenant Enterprise disponible, hacer tsc/eslint/build y reportar que la verificación de datos queda para Task 11.

- [ ] **Step 7: Commit**

```bash
git add src/pages/MenuPublico.tsx src/components/formatos/Pinterest.tsx src/components/formatos/Instagram.tsx src/components/formatos/TikTok.tsx src/components/menu/BotonAgregar.tsx
git commit -m "feat(analitica): captura de vistas y agregados en el menú público"
```

---

## Task 7: `useAnaliticaProducto` hook

**Files:**
- Create: `src/hooks/useAnaliticaProducto.ts`

**Interfaces:**
- Consumes: `supabase`; `useProductos` de `@/hooks/useCarta`; `rankingDesde`, `porHoraDe`, `serieDesde`, `ignoradosDesde`, `UMBRAL_IGNORADO`, `type FilaInteraccion` de `@/lib/analitica`.
- Produces: `useAnaliticaProducto(tenantId: string | undefined, opts: { dias: 7 | 30 | 90; sucursalId: string | "todas" })` → `UseQueryResult<{ ranking: FilaRanking[]; porHora: (id: string) => …[]; ignorados: …[]; serie: …[] }>`.

- [ ] **Step 1: Implementar**

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useProductos } from "@/hooks/useCarta";
import {
  ignoradosDesde,
  porHoraDe,
  rankingDesde,
  serieDesde,
  UMBRAL_IGNORADO,
  type FilaInteraccion,
  type FilaRanking,
} from "@/lib/analitica";

export type ResumenAnalitica = {
  ranking: FilaRanking[];
  porHora: (productoId: string) => { hora: number; vistas: number; agregados: number }[];
  ignorados: { productoId: string; nombre: string; vistas: number }[];
  serie: { dia: string; vistas: number; agregados: number }[];
};

function fechaLocal(desplazamientoDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + desplazamientoDias);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function useAnaliticaProducto(
  tenantId: string | undefined,
  opts: { dias: 7 | 30 | 90; sucursalId: string | "todas" },
) {
  const productosQ = useProductos(tenantId);

  return useQuery({
    queryKey: ["analitica-producto", tenantId, opts.dias, opts.sucursalId],
    enabled: Boolean(tenantId) && productosQ.isSuccess,
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<ResumenAnalitica> => {
      let q = supabase
        .from("interacciones_producto")
        .select("sucursal_id, producto_id, dia, hora, vistas, agregados")
        .eq("tenant_id", tenantId!)
        .gte("dia", fechaLocal(-(opts.dias - 1)));
      if (opts.sucursalId !== "todas") q = q.eq("sucursal_id", opts.sucursalId);

      const { data, error } = await q;
      if (error) throw error;
      const filas = (data ?? []) as FilaInteraccion[];

      const productos = productosQ.data ?? [];
      const nombres = new Map(productos.map((p) => [p.id, p.nombre]));
      const activos = productos.filter((p) => p.activo).map((p) => ({ id: p.id, nombre: p.nombre }));

      return {
        ranking: rankingDesde(filas, nombres),
        porHora: (id: string) => porHoraDe(filas, id),
        ignorados: ignoradosDesde(filas, activos, UMBRAL_IGNORADO),
        serie: serieDesde(filas, opts.dias, new Date()),
      };
    },
  });
}
```

- [ ] **Step 2: typecheck + lint + suite + commit**

```bash
bunx tsc --noEmit && bunx eslint src/hooks/useAnaliticaProducto.ts && bun test
git add src/hooks/useAnaliticaProducto.ts
git commit -m "feat(analitica): hook useAnaliticaProducto (select + agregación)"
```

---

## Task 8: Panel `/admin/analitica`

**Files:**
- Create: `src/routes/admin.analitica.tsx`
- Create: `src/pages/admin/Analitica.tsx`
- Modify: `src/components/layout/PillTabs.tsx`
- Modify: `src/components/layout/AdminLayout.tsx`

**Interfaces:**
- Consumes: `useAnaliticaProducto` (Task 7); `useTenantActual`; `useSucursales`; patrón de muro de `Reservaciones.tsx`.

- [ ] **Step 1: Ruta**

`src/routes/admin.analitica.tsx` (copia exacta de `src/routes/admin.reservaciones.tsx`):
```tsx
import { createFileRoute } from "@tanstack/react-router";
import Analitica from "@/pages/admin/Analitica";

export const Route = createFileRoute("/admin/analitica")({
  component: Analitica,
});
```

- [ ] **Step 2: Nav**

- `src/components/layout/PillTabs.tsx`: en `PESTANAS_NEGOCIO`, insertar `{ a: "/admin/analitica", etiqueta: "Analítica" }` **entre "Opiniones" y "Suscripción"**.
- `src/components/layout/AdminLayout.tsx`: en el item `{ a: "/admin/empresa", … }`, añadir `"/admin/analitica"` al array `cubre`.

- [ ] **Step 3: Página `src/pages/admin/Analitica.tsx`**

Modelar en `src/pages/admin/Reservaciones.tsx` (leerlo entero primero). Estructura:

```tsx
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import PillTabs, { PESTANAS_NEGOCIO } from "@/components/layout/PillTabs";
import { useTenantActual } from "@/hooks/useTenantActual";
import { useSucursales } from "@/hooks/useSucursales";
import { useAnaliticaProducto } from "@/hooks/useAnaliticaProducto";
import { cn } from "@/lib/utils";

export default function Analitica() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

// EJEMPLO difuminado para el muro (nunca datos reales) — 3-4 filas de ranking ficticio.

function Bloqueado() {
  // patrón Reservaciones.Bloqueado: <ul blur-sm> con EJEMPLO + card central con <Lock/> + CTA.
  // Copy: "La analítica por platillo es parte de Enterprise." /
  //       "Descubre qué se ve y qué se pide más, a qué hora y en qué sucursal."
}

function Contenido() {
  const { data: ctx } = useTenantActual();
  const tenantId = ctx?.tenant.id;
  const { data: sucursales } = useSucursales(tenantId);
  const [dias, setDias] = useState<7 | 30 | 90>(30);
  const [filtroSuc, setFiltroSuc] = useState<string | "todas">("todas");
  const [platilloSel, setPlatilloSel] = useState<string | null>(null);

  const { data, isLoading, isError } = useAnaliticaProducto(tenantId, { dias, sucursalId: filtroSuc });

  if (!ctx) return null;
  if (!ctx.plan.permite_analitica_platillo) {
    return (
      <>
        <PillTabs pestanas={PESTANAS_NEGOCIO} />
        <h1 className="text-2xl">Analítica por platillo</h1>
        <Bloqueado />
      </>
    );
  }

  // Controles: chips 7/30/90 (patrón Reservaciones `cuando`), <select> sucursal si >1.
  // 1. Ranking: tabla Platillo · Vistas · Agregados · Tasa (tasa null → "—"),
  //    encabezados clicables para reordenar.
  // 2. Curva por hora: <select> de platillo (de data.ranking); 24 barras CSS
  //    (0-23h) con data.porHora(platilloSel), tope relativo al máx de ese platillo,
  //    estilo `VisitasPorSucursal` del Dashboard (barra motion width).
  // 3. Ignorados: lista nombre + "N vistas" + <Link to="/admin/menu">editar</Link>.
  //    Nota: "Menos de 3 vistas en el rango. Revisa foto/descripción o considera quitarlo."
  // 4. Tendencia diaria: recharts vía <ChartContainer> de @/components/ui/chart —
  //    AreaChart con dos <Area> (vistas, agregados) sobre data.serie. Alto ~180px.
  //    Consultar la skill `dataviz` antes de escribir esta parte.

  // Vacío global (data.ranking.length === 0): "Aún no hay suficientes datos.
  // Comparte tu menú y vuelve en unos días."
  // isError: banner "No pudimos leer tu analítica. Intenta recargar." + hint pequeño
  //   sobre la migración.
}
```

Completar cada sección. Copy en español MX. Colores: `var(--vm-*)` tokens del admin (no `--menu-*`, eso es del menú público).

**Para la tendencia diaria (sección 4):** invocar la skill `dataviz` (colores accesibles, ejes, dark mode) antes de escribir el `AreaChart`. Si `<ChartContainer>` da problemas (nunca se ha usado en la app), **fallback: barras CSS finas** — una fila de ~`dias` barras de 2-3px de ancho, altura relativa al máximo, como una sparkline. Documentar la decisión en el reporte.

- [ ] **Step 4: routeTree**

`bun run build` regenera `src/routeTree.gen.ts` con `/admin/analitica`. Confirmar en `git status` que aparece modificado; commitearlo.

- [ ] **Step 5: typecheck + lint + build**

Run: `bunx tsc --noEmit && bunx eslint src/pages/admin/Analitica.tsx src/routes/admin.analitica.tsx src/components/layout/PillTabs.tsx src/components/layout/AdminLayout.tsx && bun run build && bun test`
Expected: PASS.

- [ ] **Step 6: Prueba manual**

`bun run dev` → `/admin/analitica`: sin sesión redirige a `/login` (no 500). Con un tenant Enterprise de prueba (bump del controlador): las 4 vistas renderizan; con un tenant no-Enterprise: el muro. Interacción admin completa queda para Task 11 / el usuario.

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/Analitica.tsx src/routes/admin.analitica.tsx src/components/layout/PillTabs.tsx src/components/layout/AdminLayout.tsx src/routeTree.gen.ts
git commit -m "feat(analitica): panel /admin/analitica (ranking, curva por hora, ignorados, tendencia)"
```

---

## Task 9: Cron de purga

**Files:**
- Create: `.github/workflows/purgar-interacciones-producto.yml`

**Interfaces:**
- Consumes: RPC `purgar_interacciones_producto()` (Task 1), `to service_role`.

- [ ] **Step 1: Escribir el workflow**

Copia de `.github/workflows/purgar-reservaciones.yml` (leerlo primero) con:
- `name: Purgar interacciones por platillo`
- `schedule: - cron: "45 4 * * *"` + `workflow_dispatch: {}`
- `curl --fail-with-body -sS -X POST "https://iaiiwtqqiaqxnzxjqcnt.supabase.co/rest/v1/rpc/purgar_interacciones_producto"` con `apikey: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}`, `Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}`, `Content-Type: application/json`, `-d '{}'`
- Comentario final sobre el correo de fallo al dueño del repo (como los peers).

- [ ] **Step 2: Validar YAML + commit**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/purgar-interacciones-producto.yml')); print('ok')"
git add .github/workflows/purgar-interacciones-producto.yml
git commit -m "feat(analitica): cron nocturno de purga a 180 días"
```

**NOTA controlador:** verificar la RPC vía PostgREST (`curl` con service_role → 200; con anon → 401 permission denied).

---

## Task 10: Documentación

**Files:**
- Modify: `src/pages/Privacidad.tsx`
- Modify: `src/docs/vibemenu_alcance.md`
- Modify: `src/docs/vibemenu_base-datos.md`

- [ ] **Step 1: `Privacidad.tsx`**

En la sección "Si escaneas un menú público" (la que dice "conteo agregado de visitas por sucursal y por día"), extender: "…y un conteo agregado de **interacciones por platillo** (cuántas veces se vio o se agregó al pedido cada platillo, por hora) — **sin identificarte, sin una fila por persona**." Mantener el tono; no contradecir el resto.

- [ ] **Step 2: `vibemenu_alcance.md`**

- Quitar de "Fuera del alcance (MVP)": "Analytics de escaneos/vistas por producto (fase 2)".
- Añadir descripción de feature: "**Analítica por platillo (Enterprise).** Contador de `vistas` (abrir el detalle en Pinterest/Instagram, o ≥2 s en un slide de TikTok) y `agregados` (al carrito de WhatsApp) por `(sucursal, platillo, día, hora)`. Panel `/admin/analitica`: ranking + tasa de conversión, curva por hora, platillos ignorados, tendencia diaria. Sin datos del comensal; dedup 1/platillo/sesión/hora. Purga a 180 días."
- Tabla de planes: fila/nota "Analítica por platillo → solo Enterprise".
- "Rutas y páginas": `| /admin/analitica | Analítica | Vistas y agregados por platillo | Owner/Encargado |`.

- [ ] **Step 3: `vibemenu_base-datos.md`**

Sección nueva (estilo `visitas_menu` / `reservaciones`, sección 15+): DDL de `interacciones_producto` **verbatim de `src/docs/vibemenu_migracion_analitica_platillo.sql`**, las policies, las dos RPCs (con sus grants reales: `registrar_interaccion_producto` a `anon, authenticated`; `purgar_interacciones_producto` a `service_role` only), y la nota en prosa: contador por `(tenant, sucursal, producto, día, hora)`, no fila por evento; el chequeo de plan (Enterprise) vive dentro de la RPC; sin insert público; dedup en el navegador; purga 180 días.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Privacidad.tsx src/docs/vibemenu_alcance.md src/docs/vibemenu_base-datos.md
git commit -m "docs(analitica): privacidad, alcance y esquema"
```

---

## Task 11: QA end-to-end y merge

**Files:** ninguno (verificación — controlador).

- [ ] **Step 1: Suite completa**

`bun test && bunx tsc --noEmit && bunx eslint . && bun run build` → todo PASS. (`eslint .` — atención a que no haya `.superpowers/` con `.ts` sin formato en el worktree; usar `eslint src` si lo hubiera.)

- [ ] **Step 2: Migración en prod**

Confirmar que la migración `analitica_platillo` está aplicada (`select nombre, permite_analitica_platillo from planes` por el conector). Si se aplicó al inicio del plan, solo confirmar.

- [ ] **Step 3: QA con tenant Enterprise de prueba (controlador)**

Bump temporal de un tenant a `enterprise` por el conector. Luego:
- Menú Pinterest → abrir 3 platillos → filas `vistas` en `interacciones_producto` con la hora correcta.
- Menú TikTok → deslizar despacio vs rápido → solo los lentos cuentan.
- Con carrito activo → agregar 2 platillos → `agregados` sube.
- `/admin/analitica` (requiere sesión — **hand-off al usuario** para el click-through del panel): ranking, curva por hora, ignorados, tendencia renderizan; muro para no-Enterprise.
- `select purgar_interacciones_producto();` por el conector → devuelve 0.
- Revertir: borrar las filas de prueba, bajar el tenant a su plan original.

- [ ] **Step 4: Merge**

Seguir `superpowers:finishing-a-development-branch`. Rama `feat/analitica-platillo` → `main`. Presentar el menú de opciones al usuario (el merge es decisión suya).

---

## Self-Review

**Spec coverage:**

| Sección del spec | Task |
|---|---|
| `planes.permite_analitica_platillo` | 1 |
| Tabla `interacciones_producto` + índices parciales + RLS | 1 |
| RPC `registrar_interaccion_producto` (tipo, plan, pertenencia, tz) | 1 |
| RPC `purgar_interacciones_producto` + grants service_role | 1 |
| Tipos `database.ts` + `demo.ts` | 2 |
| `src/lib/analitica.ts` dedup + agregación + tests | 3 |
| `AnaliticaProvider` + `useAnalitica` (no-op sin provider) | 4 |
| `useMenuPublico` flag | 5 |
| `AnaliticaProvider` en las 2 ramas de `MenuPublico` | 6 |
| `vista`: Pinterest/Instagram (setAbierto) | 6 |
| `vista`: TikTok (observer + 2 s) | 6 |
| `agregado`: `BotonAgregar` (3 call-sites) | 6 |
| `useAnaliticaProducto` (select + funciones puras) | 7 |
| Panel: muro de plan | 8 |
| Panel: ranking + tasa | 8 |
| Panel: curva por hora | 8 |
| Panel: platillos ignorados | 8 |
| Panel: tendencia diaria (recharts / fallback) | 8 |
| Nav (`PillTabs` + `AdminLayout` cubre) | 8 |
| `routeTree.gen.ts` | 8 |
| Cron de purga (`.yml`) | 9 |
| Privacidad + alcance + base-datos | 10 |
| QA + merge | 11 |

Sin huecos.

**Placeholder scan:** el panel (Task 8 Step 3) trae la estructura y los comentarios de cada sección pero no las 4 secciones escritas carácter por carácter — es la única parte "de diseño" que se deja al implementador, con el patrón de referencia (`Reservaciones.tsx`, `VisitasPorSucursal` del Dashboard) y la guía de `dataviz` para la gráfica. Todo lo demás (SQL, lib, hooks, provider, disparos) trae código literal. Los `<+3 días>` / "tenant Enterprise de prueba" en pasos de QA son valores del entorno del ejecutor, no placeholders de lógica.

**Type consistency:**
- `FilaInteraccion` — misma forma en Task 3 (def), 7 (`as FilaInteraccion[]`).
- `TipoInteraccion = "vista" | "agregado"` — Task 3 (def), 4 (`registrar(id, tipo)`).
- `claveDedup(tenantId, sucursalId, productoId, tipo, ahora)` — firma idéntica en 3 y 4.
- `useAnalitica()` → `{ registrarVista, registrarAgregado }` — Task 4 (def), 6 (Pinterest/Instagram/TikTok/BotonAgregar).
- `registrar_interaccion_producto(p_tenant_id, p_producto_id, p_tipo, p_sucursal_id)` — firma idéntica en 1 (SQL) y 4 (`.rpc`).
- `useAnaliticaProducto(tenantId, { dias, sucursalId })` — Task 7 (def), 8 (uso).
- `rankingDesde` / `porHoraDe` / `serieDesde` / `ignoradosDesde` — def en 3, consumidas en 7 con esos nombres y firmas.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-02-analitica-platillo.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
