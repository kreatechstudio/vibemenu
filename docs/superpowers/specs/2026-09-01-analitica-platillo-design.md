# Analítica por platillo — Diseño

**Fecha:** 2026-09-01
**Rama:** dev
**Origen:** Auditoría Vibemenu (artifact `8d645623`), sección 04 "Extras vendibles" → "Analítica por platillo" y sección 07 "Por dónde empezar" → **P2**.
**Alcance de este documento:** sub-proyecto **#5** del artifact (continúa la numeración de contacto/reseñas #1–#3 y reservaciones #4). El sub-proyecto #6 (Lealtad con QR) tiene su propio ciclo, después de este.

## Contexto: qué pidió el usuario

Saber **qué platillos se ven más, a qué hora, en qué sucursal** — el upsell natural de Enterprise para entender el menú. Hoy `visitas_menu` cuenta a nivel tenant/sucursal/día; esto lo lleva a nivel producto. El alcance (`vibemenu_alcance.md`) ya lo marca como fase 2, exclusivo de Enterprise.

### Decisiones tomadas con el usuario (2026-09-01)

1. **Señal:** **dos contadores por platillo** — `vistas` (interacción deliberada) y `agregados` (metió el platillo al carrito de WhatsApp). No un observador de viewport genérico.
2. **Qué cuenta como `vista`:**
   - Pinterest / Instagram: abrir el detalle del producto (`setAbierto`).
   - TikTok: quedarse ≥ 2 s con el slide del producto > 50 % visible.
   - Clásico: **nada** — una lista de texto no tiene interacción por platillo. Un tenant Clásico solo verá `agregados` (si tiene carrito) y las métricas de `visitas_menu` que ya existen.
3. **`agregado`:** se dispara donde el carrito llama `c.agregar(producto)` — en los 4 formatos. Solo existe si el plan tiene `permite_pedidos_whatsapp` y hay WhatsApp resoluble; si no, `agregados` queda en 0 para ese tenant, sin gate extra.
4. **Granularidad de tiempo:** **hora exacta 0–23**, en la zona horaria de la sucursal.
5. **Dedup:** **1 por platillo por sesión de navegador por hora** — `sessionStorage`, patrón de `useRegistrarVisita`. No colapsa el tiempo (mira a las 14 h y otra vez a las 20 h → cuenta en ambas horas).
6. **Plan:** **Enterprise** (`planes.permite_analitica_platillo`).
7. **Panel `/admin/analitica`** con **las 4 vistas** en la misma página: ranking, curva por hora de un platillo, platillos ignorados, tendencia diaria.
8. **Retención:** purga a 180 días por cron nocturno. El panel muestra hasta 90 días.

### Juicios del diseñador (revertibles)

- `interacciones_producto.producto_id` con `on delete cascade`: si borran el platillo, su analítica se va. Un ranking de un producto que ya no existe no aporta.
- `interacciones_producto.sucursal_id` con `on delete set null`: un local borrado no tira la historia; `null` = menú general.
- El chequeo de plan vive **dentro de la RPC** (además del gate del frontend): los tenants no-Enterprise no acumulan filas que no pueden ver.
- La **tendencia diaria** usa `recharts` (ya es dependencia; wrapper `src/components/ui/chart.tsx` sin estrenar). Las otras 3 vistas son tablas / barras CSS, estilo casa.
- Retención 180 días (dos temporadas para decisiones de menú). El panel llega a 90.

## Fuera de alcance

- Observador de viewport en Clásico ("visto" = "pasé haciendo scroll" = ruido).
- Google/Apple Wallet, exportar a CSV, alertas ("tu platillo estrella bajó 20 %").
- Analítica de modificadores (qué extras se piden más).
- Integración con GA4 para este dato (GA4 per-producto exigiría eventos custom + la API de GA4 en el panel; el patrón `visitas_menu` — contador propio en Postgres — es el correcto y consistente).
- Sub-proyecto #6 (Lealtad).

## Lo que ya existe (contexto, no se reescribe)

- **`planes`** — columnas de capacidad booleanas (`permite_embudo_resenas`, `permite_pedidos_whatsapp`, `permite_reservaciones`, …). El frontend las lee para mostrar/ocultar; los triggers/RPCs en Postgres son el enforcement real. `null` en `limite_*` = ilimitado.
- **`visitas_menu`** (migración 007) + `registrar_visita(p_tenant_id, p_sucursal_id)` — **el patrón a copiar**: contador `(tenant, sucursal, día)`, no fila por evento; RPC `SECURITY DEFINER` `to anon, authenticated` que valida pertenencia y **nunca revienta**; el día se calcula con `now() at time zone coalesce(sucursal.timezone, 'UTC')` (o la de la primera sucursal del tenant si `p_sucursal_id` es null). Dos índices únicos **parciales** por el `sucursal_id` nullable (`where sucursal_id is not null` / `where sucursal_id is null`). Se llama **desde el navegador**, nunca desde el loader.
- **`src/hooks/useVisitas.ts`** — `useVisitas(tenantId)` (`useQuery`, `retry: false`, agrega en cliente: `hoy`/`ultimos7`/`ultimos30`/`porSucursal`/`serie`) y `useRegistrarVisita(tenantId, sucursalId)` (efecto que llama la RPC una vez por sesión; `yaContada(clave)` sobre `sessionStorage`, tolera que Safari privado lance). **Patrón para `useAnaliticaProducto` y para el helper de dedup.**
- **`registrar_feedback`** (embudo) — precedente de una RPC `SECURITY DEFINER` del comensal con un parámetro de tipo (`p_sentimiento`) que hace `return` silencioso si el valor no está en el set; y de "sucursal de otro tenant → se trata como null".
- **`reservaciones`** (sub-proyecto #4, recién mergeado) — precedente completo y fresco de: flag de plan nuevo, purga por cron (`.github/workflows/purgar-reservaciones.yml` → `/rest/v1/rpc/purgar_reservaciones_viejas` con `SUPABASE_SERVICE_ROLE_KEY`), función `purgar_*` `security definer` `to service_role`, panel con muro de plan (`src/pages/admin/Reservaciones.tsx`, patrón `EJEMPLO` difuminado + `Lock` + CTA a `/admin/suscripcion`), pestaña en `PillTabs` + `cubre` en `AdminLayout`, ruta file-based, docs en `alcance.md`/`base-datos.md`. **Reusar todos estos patrones.**
- **`src/hooks/useMenuPublico.ts`** — `armarMenuPublico` con `select` de **columnas explícitas** de `sucursales` (post-#4) y join `plan:planes(marca_agua, menu_independiente_por_sucursal, permite_embudo_resenas, permite_pedidos_whatsapp, permite_reservaciones)` en 3 sitios (`obtenerMenuPublico`, `obtenerMenuPublicoPorDominio`, `obtenerSucursalPublicaPorDominio`). El tipo `MenuPublico` expone `permiteEmbudoResenas` / `permitePedidosWhatsApp` / `permiteReservaciones`; el `Pick<Plan, …>` del parámetro los lista. **Añadir `permite_analitica_platillo` a los 3 joins + el `Pick` + el tipo + el `return` (`?? false`).**
- **`src/pages/MenuPublico.tsx`** — arma `propsFormato: PropsFormato = { categorias, logoUrl, inicial }` y `<Formato {...propsFormato} />`. **Dos ramas de render:** TikTok (early return, `<main>` + `<Formato/>` + `BotonPedidoTikTok`) y el resto (`cuerpo`, envuelto en `<CarritoWhatsAppProvider key={sucursal} habilitado={pedidosOn}>`). `useRegistrarVisita(...)` ya se llama aquí, arriba de los returns.
- **`src/components/formatos/*.tsx`:**
  - `Pinterest.tsx` / `Instagram.tsx` — grid; `const [abierto, setAbierto] = useState(...)`; `onClick={() => setAbierto(producto)}`; `{abierto && <Detalle|Post producto={abierto} .../>}`.
  - `TikTok.tsx` — `Slide` por producto (`<section class="h-dvh ... snap-start">`), swipe vertical con scroll-snap. Sin modal de detalle; una hoja "Ver opciones" si el producto tiene modificadores.
  - `Clasico.tsx` — lista; sin detalle.
- **`src/components/menu/BotonAgregar.tsx`** — `useCarritoWhatsApp()`; `if (!c.habilitado) return null`. Llama `c.agregar(producto)` en varios `onClick` (variantes `badge` y `stepper`). Se monta sin condicional en los formatos.
- **`src/hooks/useCarritoWhatsApp.tsx`** — `CarritoWhatsAppProvider({ habilitado, children })` con `createContext` + `useContext` (`useCarritoWhatsApp()` — **lanza o devuelve null si no hay provider**; confirmar al implementar). Estado efímero, no toca `localStorage`, `key` por sucursal en `MenuPublico`. **Patrón para `AnaliticaProvider`.**
- **`src/lib/analytics.ts`** — GA4 (`trackEvent`). No se usa para este dato.
- **`src/pages/admin/Reservaciones.tsx`** / **`Opiniones.tsx`** — patrón de página de panel con muro de plan. `src/routes/admin.reservaciones.tsx` — ruta file-based (`createFileRoute("/admin/x")({ component })`). `src/routeTree.gen.ts` es **TRACKED** y lo regenera `vite build`/`vite dev`.
- **`src/components/layout/PillTabs.tsx`** — `PESTANAS_NEGOCIO` (Perfil / Sucursales / Equipo / Reservaciones / Opiniones / Suscripción). **`AdminLayout.tsx`** — item "Mi negocio" con `cubre: ["/admin/sucursales", "/admin/equipo", "/admin/reservaciones", "/admin/suscripcion"]` (confirmar la lista actual).
- **`src/components/ui/chart.tsx`** — wrapper shadcn de `recharts`, presente y **sin usar**. `recharts@^2.15.4` en `package.json`.
- **`src/lib/plan.ts` / `plan.test.ts`** — lógica de plan pura, suite en CI. El Dashboard hoy pinta `visitas` con barras CSS animadas (framer-motion `width`), no con `recharts`.
- **Migraciones** — se aplican con el conector `claude.ai Supabase` (proyecto `iaiiwtqqiaqxnzxjqcnt`, **producción**; Supabase Free = sin branching, `apply_migration` directo, aditivo, transaccional). El `.sql` se guarda en `src/docs/vibemenu_migracion_*.sql` como registro. Ver la migración de #4 para el estilo. **Ojo:** Supabase concede `EXECUTE` a `anon`/`authenticated` por defecto en funciones de `public`; para `service_role`-only hay que `revoke execute ... from public, anon, authenticated` explícito.
- **Tests** — solo `src/lib/*.test.ts`, `bun:test`. CI: `src/lib` + `tsc` + `eslint .` (0 errores; hay ~14 warnings `react-refresh` preexistentes). Componentes: verificación por `tsc`+`eslint`+`build`+prueba manual. `src/types/database.ts` se **regenera** con el conector tras la migración (conservando el bloque de alias manual al pie).

## Arquitectura

### A. Datos (`src/docs/vibemenu_migracion_analitica_platillo.sql`)

Una transacción. Aplicar **antes** del deploy de la rama (el frontend llamará la RPC y leerá la tabla; sin ellas, errores en consola / panel roto).

```sql
begin;

-- 1. Capacidad de plan
alter table planes
  add column if not exists permite_analitica_platillo boolean not null default false;

update planes set permite_analitica_platillo = true where nombre = 'enterprise';

-- 2. Contador de interacciones por platillo
create table interacciones_producto (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  -- null = el menú general del negocio (ruta /:slug sin sucursal).
  sucursal_id uuid references sucursales(id) on delete set null,
  producto_id uuid not null references productos(id) on delete cascade,
  dia         date     not null,
  hora        smallint not null check (hora between 0 and 23),
  vistas      integer  not null default 0 check (vistas >= 0),
  agregados   integer  not null default 0 check (agregados >= 0)
);

-- Dos índices únicos parciales por el sucursal_id nullable (patrón visitas_menu):
-- en un UNIQUE, null <> null, así que el menú general insertaría fila nueva cada vez.
create unique index uq_interacciones_prod_sucursal
  on interacciones_producto (tenant_id, sucursal_id, producto_id, dia, hora)
  where sucursal_id is not null;

create unique index uq_interacciones_prod_general
  on interacciones_producto (tenant_id, producto_id, dia, hora)
  where sucursal_id is null;

create index idx_interacciones_prod_tenant_dia
  on interacciones_producto (tenant_id, dia desc);

alter table interacciones_producto enable row level security;

-- Los números son del negocio. Sin policy de insert/update: nadie escribe directo,
-- ni el owner. Solo la RPC (SECURITY DEFINER).
create policy "interacciones_prod_select_miembros" on interacciones_producto for select
  to authenticated using (pertenece_a_tenant(tenant_id));

revoke all on interacciones_producto from anon, authenticated;
grant select on interacciones_producto to authenticated;

-- 3. Registrar una interacción (único camino del comensal, sin sesión)
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

  -- Plan: solo Enterprise acumula. Silencioso si no.
  select p.permite_analitica_platillo into v_permite
    from planes p join tenants t on t.plan_id = p.id
   where t.id = p_tenant_id;
  if not coalesce(v_permite, false) then
    return;
  end if;

  -- El producto debe ser del tenant.
  if not exists (
    select 1 from productos pr
     where pr.id = p_producto_id and pr.tenant_id = p_tenant_id
  ) then
    return;
  end if;

  -- Sucursal de otro tenant (o inexistente) → menú general.
  if p_sucursal_id is not null and not exists (
    select 1 from sucursales s where s.id = p_sucursal_id and s.tenant_id = p_tenant_id
  ) then
    p_sucursal_id := null;
  end if;

  -- Día + hora en la zona de la sucursal (o la primera del tenant).
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

-- 4. Purga nocturna (180 días)
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
```

Verificación al pie (patrón de las otras migraciones): plan enterprise `true` / resto `false`; `registrar_interaccion_producto` con un producto real incrementa una fila; con un tenant no-Enterprise no crea nada; `set role anon; select registrar_interaccion_producto(...)` funciona (no lanza); `set role anon; select purgar_interacciones_producto()` → `permission denied`.

### B. Captura en el frontend

**`src/lib/analitica.ts`** (+ `analitica.test.ts`, CI):
- `type TipoInteraccion = "vista" | "agregado"`
- `claveDedup(tenantId, sucursalId: string | null, productoId, tipo: TipoInteraccion, ahora: Date): string` — `vm:ip:{tenant}:{sucursal|general}:{producto}:{tipo}:{YYYY-MM-DD-HH}` (hora local del navegador; el servidor recalcula con la zona de la sucursal, pero para dedup basta la del navegador — un comensal está en la zona de la sucursal en la práctica).
- `yaRegistrada(clave: string): boolean` — lee/escribe `sessionStorage`, `try/catch` (Safari privado lanza), patrón `yaContada` de `useVisitas`.
- Tests: la clave cambia al cambiar de hora / de tipo / de producto / de sucursal; `yaRegistrada` devuelve `false` la primera vez y `true` la segunda; no lanza sin `sessionStorage`.

**`src/hooks/useAnalitica.tsx`** — `AnaliticaProvider({ tenantId, sucursalId, habilitado, children })`:
- `createContext` con `{ registrarVista(productoId): void; registrarAgregado(productoId): void }`.
- Cada función: si `!habilitado` o `!tenantId` → no-op. Si `yaRegistrada(claveDedup(...))` → no-op. Si no: `void supabase.rpc("registrar_interaccion_producto", { p_tenant_id, p_producto_id, p_tipo, p_sucursal_id: sucursalId ?? undefined })` — fire-and-forget, sin `await`, sin manejar error (un menú público no se rompe por una métrica).
- `useAnalitica()` — `useContext`; **si no hay provider, devuelve un objeto de no-ops** (para `/demo` y tests, que renderizan formatos sin provider).

**`MenuPublico.tsx`** — envolver **las dos ramas** de render con `<AnaliticaProvider tenantId={data.tenant.id} sucursalId={data.sucursalActiva?.id ?? null} habilitado={data.permiteAnaliticaPlatillo}>`:
- rama TikTok: envolver el `<>…</>` que se retorna.
- rama `cuerpo`: envolver por fuera de `<CarritoWhatsAppProvider>` (o por dentro, da igual; el dedup ya incluye sucursal).
- `MenuPublico` gana el dato `permiteAnaliticaPlatillo` de `useMenuPublico` (ver sección A del "Lo que ya existe").

**Disparo de `vista`:**
- `Pinterest.tsx` / `Instagram.tsx`: en el `onClick={() => setAbierto(producto)}` añadir `analitica.registrarVista(producto.id)` (o un `useEffect` sobre `abierto?.id` — preferir el `onClick`, más directo).
- `TikTok.tsx` — en `Slide`: `IntersectionObserver` (`threshold: 0.5`) + `setTimeout(2000)`. Al entrar >50 %: arranca el timer; al cumplirse, `analitica.registrarVista(producto.id)`. Al salir <50 % antes de los 2 s: `clearTimeout`. Un solo observer por slide, limpiado en el `useEffect` cleanup.
- `Clasico.tsx`: sin cambios.

**Disparo de `agregado`:** en `BotonAgregar.tsx`, en cada `onClick` que llama `c.agregar(producto)` (variantes `badge` y `stepper`, ~3 sitios), añadir `analitica.registrarAgregado(producto.id)` justo después. `useAnalitica()` en el cuerpo del componente. (En TikTok el `c.agregar` puede vivir en `BotonPedidoTikTok` / la hoja de opciones del `Slide` — enumerar los call-sites de `c.agregar` en el plan y cubrirlos todos.)

**`src/lib/demo.ts` / `/demo`** — no monta `AnaliticaProvider`; `useAnalitica()` cae a no-ops. Nada que tocar.

### C. Panel `/admin/analitica`

**Ruta:** `src/routes/admin.analitica.tsx` → `src/pages/admin/Analitica.tsx`. Añadir `{ a: "/admin/analitica", etiqueta: "Analítica" }` a `PESTANAS_NEGOCIO` y `/admin/analitica` al `cubre` de "Mi negocio" en `AdminLayout`. `bun run build` regenera `src/routeTree.gen.ts` (TRACKED) — commitear.

**Muro de plan:** si `!ctx.plan.permite_analitica_platillo` → `EJEMPLO` difuminado tras `<Lock/>` + CTA a `/admin/suscripcion` (patrón `Reservaciones.tsx`).

**`src/hooks/useAnaliticaProducto.ts`:**
- `useAnaliticaProducto(tenantId, { dias, sucursalId })` (`useQuery`, `retry: false`, `enabled: Boolean(tenantId)`):
  - `select("sucursal_id, producto_id, dia, hora, vistas, agregados").eq("tenant_id", …).gte("dia", <hoy - dias>)` (+ `.eq("sucursal_id", sucursalId)` si se filtra).
  - Junta nombres: `select` sobre `productos` (`id, nombre, categoria_id, activo`) del tenant — o un hook `useProductos` si ya existe (revisar).
  - Deriva y devuelve:
    - `ranking: { productoId, nombre, vistas, agregados, tasa }[]` ordenado por vistas desc por defecto. `tasa` = `agregados / vistas` **solo cuando `vistas >= agregados`**; si `vistas === 0` o `agregados > vistas` (posible en TikTok: agregar sin ver 2 s) → `tasa = null`, y el panel muestra "—".
    - `porHora(productoId): { hora: number, vistas: number, agregados: number }[]` — exactamente 24 entradas (0..23), relleno con ceros, sumadas sobre el rango.
    - `ignorados: { productoId, nombre, vistas }[]` — productos `activo` con `vistas < UMBRAL` (UMBRAL configurable, p. ej. 3) en el rango.
    - `serie: { dia: string, vistas: number, agregados: number }[]` — total del menú por día, relleno de días sin datos, del más viejo al más nuevo (patrón `useVisitas.serie`).
- Hook de mutación: ninguno (solo lectura).

**Página** (`Analitica.tsx`), secciones en orden:
1. **Controles:** selector de rango (`7 / 30 / 90 días`, chips como en `Reservaciones.tsx`) + `<select>` de sucursal (solo si `sucursales.length > 1`).
2. **Ranking** — tabla: Platillo · Vistas · Agregados · Tasa. Encabezados clicables para ordenar. Vacío → "Aún no hay suficientes datos. Comparte tu menú y vuelve en unos días."
3. **Curva por hora** — `<select>` de platillo (los del ranking); debajo, 24 barras CSS (0–23 h) con `vistas` y `agregados` apiladas o lado a lado, tope relativo al máximo de ese platillo (como `VisitasPorSucursal`). Etiqueta cada 3-4 horas para no saturar.
4. **Platillos ignorados** — lista simple: nombre + "N vistas" + link a `/admin/menu` (editar el producto). Nota: "Con menos de 3 vistas en el rango. Revisa la foto y la descripción, o considera quitarlo."
5. **Tendencia diaria** — `recharts` `AreaChart` (dos áreas: vistas y agregados) usando `src/components/ui/chart.tsx`. **Al construirlo, consultar la skill `dataviz`** (colores, ejes, dark mode). Alto fijo ~180 px, `ResponsiveContainer`.

**Sin badge** en `PillTabs` para esta pestaña (no hay trabajo pendiente que atender).

### D. Cron de purga

La función `purgar_interacciones_producto()` ya va en la migración (sección A). Falta solo el workflow que la llama:
- `.github/workflows/purgar-interacciones-producto.yml` — copia de `purgar-reservaciones.yml`: `schedule: - cron: "45 4 * * *"`, `workflow_dispatch: {}`, `curl --fail-with-body -sS -X POST` a `https://iaiiwtqqiaqxnzxjqcnt.supabase.co/rest/v1/rpc/purgar_interacciones_producto` con `apikey` + `Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}`, body `{}`, comentario final sobre el correo de fallo a GitHub.

### E. Tipos y docs

- `src/types/database.ts` — regenerar con el conector tras la migración (conservar el bloque de alias manual al pie; sin añadir alias `Interaccion*` a menos que el panel lo necesite y no colisione).
- `src/docs/vibemenu_alcance.md` — quitar "Analytics de escaneos/vistas por producto (fase 2)" de "Fuera del alcance"; añadir descripción de feature (Enterprise) + fila en la tabla de planes + ruta `/admin/analitica` en "Rutas y páginas".
- `src/docs/vibemenu_base-datos.md` — sección nueva (estilo `visitas_menu` / `reservaciones`): DDL de `interacciones_producto`, RLS, las dos RPCs, y la nota en prosa (contador por `(tenant, sucursal, producto, día, hora)`; sin insert público; solo Enterprise cuenta; dedup 1/producto/sesión/hora en el navegador).

## Flujo de datos (resumen)

```
Comensal (sin sesión)
  └─ MenuPublico → AnaliticaProvider(tenantId, sucursalId, habilitado=permiteAnaliticaPlatillo)
       ├─ Pinterest/Instagram: setAbierto(p) → useAnalitica().registrarVista(p.id)
       ├─ TikTok Slide: IntersectionObserver + 2s → registrarVista(p.id)
       └─ BotonAgregar: c.agregar(p) → useAnalitica().registrarAgregado(p.id)
            └─ dedup (sessionStorage, clave con hora) → supabase.rpc("registrar_interaccion_producto")
                 └─ RPC SECURITY DEFINER: valida tipo + plan(Enterprise) + producto∈tenant + sucursal∈tenant
                    → día/hora en tz de la sucursal → upsert incrementa vistas | agregados

Owner / encargado (con sesión)
  └─ /admin/analitica → useAnaliticaProducto(tenantId, {dias, sucursalId})  [RLS select]
       → ranking / curva por hora / ignorados / tendencia diaria

Cron diario → purgar_interacciones_producto()  (dia < hoy - 180)
```

## Pruebas

**Unitarias (CI, `bun:test`):**
- `analitica.test.ts` — `claveDedup` (cambia por hora/tipo/producto/sucursal; menú general usa `general`), `yaRegistrada` (false→true, no lanza sin `sessionStorage`).
- Si `useAnaliticaProducto` lleva lógica de agregación no trivial (tasa, relleno de horas/días, umbral de ignorados), **extraerla a `src/lib/analitica.ts` como funciones puras** (`rankingDesde(filas, nombres)`, `porHoraDe(filas, productoId)`, `serieDesde(filas, dias)`, `ignoradosDesde(...)`) y testearlas. El hook solo hace `select` + llama a esas funciones.

**SQL (manual, al pie de la migración):**
- Enterprise cuenta; Free/Basic/Pro no crean fila.
- `p_tipo` basura → sin fila.
- Producto de otro tenant → sin fila.
- Sucursal de otro tenant → fila con `sucursal_id null`.
- Dos `vista` seguidas en la misma hora sobre el mismo `(tenant, sucursal, producto)` → `vistas = 2` en **una** fila (upsert).
- `set role anon` puede `registrar_interaccion_producto`, no `purgar_interacciones_producto`.

**Manual (navegador):**
- Tenant Enterprise, formato Pinterest → abrir 3 platillos → `/admin/analitica` los muestra con `vistas ≥ 1` tras ~1 min (staleTime).
- Formato TikTok → deslizar despacio (≥2 s por slide) vs. rápido → los lentos cuentan, los rápidos no.
- Con carrito activo → agregar 2 platillos → `agregados` sube; la tasa aparece.
- Bajar el tenant a Pro → `/admin/analitica` muestra el muro; la RPC deja de contar (verificar por el conector que no entran filas nuevas).
- Curva por hora de un platillo; tendencia diaria renderiza el area chart en claro y oscuro.

## Orden de implementación (para el plan)

1. Migración SQL + aplicar al proyecto prod por el conector (branch de verificación no disponible en Free → aplicar directo, aditivo). Regenerar `database.ts`.
2. `src/lib/analitica.ts` (dedup + funciones puras de agregación) + tests (TDD).
3. `src/hooks/useAnalitica.tsx` (`AnaliticaProvider` + `useAnalitica`).
4. `useMenuPublico.ts`: `permite_analitica_platillo` en los 3 joins + `Pick` + tipo + return.
5. `MenuPublico.tsx`: montar `AnaliticaProvider` en las dos ramas.
6. Disparos: `Pinterest`, `Instagram` (vista en `setAbierto`); `TikTok` (observer + 2 s); `BotonAgregar` (agregado en cada `c.agregar`); enumerar y cubrir todos los `c.agregar` de TikTok.
7. `useAnaliticaProducto.ts` (select + funciones puras de #2).
8. Panel: ruta, `Analitica.tsx` (4 vistas), `PillTabs` + `AdminLayout`, muro de plan, `routeTree.gen.ts`. La tendencia diaria consulta `dataviz`.
9. Cron de purga (`.yml`).
10. Docs (`alcance.md`, `base-datos.md`).
11. QA manual end-to-end (tenant Enterprise de prueba; revertir al terminar).

## Riesgos y mitigaciones

- **Volumen de filas** — grano por hora × producto × sucursal es el más fino del sistema. Mitigado: solo filas con interacción real se crean (un platillo no visto esa hora = sin fila); solo tenants Enterprise cuentan; purga a 180 días; índice `(tenant_id, dia desc)` para el rango del panel. Revisar el tamaño de `interacciones_producto` cuando haya varios tenants Enterprise activos; si crece, agregar (rollup diario) los tramos > 90 días.
- **TikTok observer + scroll-snap** — el `IntersectionObserver` con `threshold: 0.5` sobre un contenedor con `snap` puede disparar de más al hacer scroll rápido. El timer de 2 s es justo el filtro: un swipe rápido nunca cumple. Probar en móvil real.
- **Doble conteo vista+agregado** — abrir el detalle **y** agregar cuenta 1 vista + 1 agregado (correcto: son señales distintas, y la "tasa" vive de esa diferencia). En TikTok agregar sin "ver 2 s" cuenta agregado sin vista → `agregados > vistas` posible; resuelto arriba: `tasa = null` → "—" en esos casos, `vistas`/`agregados` siempre crudos.
- **`useCarritoWhatsApp` vs `AnaliticaProvider` en TikTok** — TikTok hoy no monta `CarritoWhatsAppProvider` (usa `BotonPedidoTikTok`). Confirmar de dónde sale el estado del carrito en TikTok y asegurar que `AnaliticaProvider` envuelve ese árbol también.
- **Migración antes del deploy** — igual que #4: aplicar el SQL antes de mergear/desplegar, o el panel y las RPC fallan.
- **Privacidad** — `interacciones_producto` **no guarda nada del comensal** (ni IP, ni identificador): es un contador agregado por hora. El aviso `/privacidad` ya cubre "conteo agregado de visitas" — extender esa frase para incluir "y de interacciones por platillo (agregado, sin identificarte)". Una línea.
