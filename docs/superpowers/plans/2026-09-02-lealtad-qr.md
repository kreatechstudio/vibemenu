# Lealtad con QR — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un negocio Pro+ ofrece una tarjeta de sellos digital: el comensal la crea desde el menú (UUID en `localStorage`, URL propia), el encargado sella/canjea desde `/admin/lealtad` con un código o QR, tope 1 sello por día.

**Architecture:** Config del programa en 3 columnas de `tenants`. `tarjetas_lealtad` (el `id` ES el UUID de `localStorage`) + `movimientos_lealtad` (auditoría). El comensal escribe solo por RPC `SECURITY DEFINER` `to anon` (`crear_tarjeta_lealtad`, `obtener_tarjeta_lealtad`, `guardar_contacto_tarjeta`); el encargado por RPC `authenticated` (`buscar_tarjeta`, `sellar_tarjeta`, `canjear_premio`, `buscar_tarjetas_por_contacto`). Purga por cron. Sin Edge Function.

**Tech Stack:** React + TanStack Router (file-based) + TanStack Query + Tailwind + shadcn/ui + framer-motion; `react-qr-code` (ya dependencia) para el QR; `html5-qrcode` (nueva, `import()` dinámico) para el escáner del admin; Supabase (Postgres + RLS + RPC); Bun test; GitHub Actions (cron).

**Spec:** `docs/superpowers/specs/2026-09-02-lealtad-qr-design.md`

## Global Constraints

- **Proyecto Supabase:** `vibemenu`, ref `iaiiwtqqiaqxnzxjqcnt` (**producción**; Supabase Free = sin branching). Todo SQL con el conector `claude.ai Supabase` (`mcp__claude_ai_Supabase__*`) — **los subagentes NO tienen el conector**: el controlador ejecuta migración, regeneración de tipos y verificación SQL. Migración aditiva y transaccional (`begin; … commit;`).
- **Plan:** `permite_lealtad = true` solo en `pro` y `enterprise` (idéntico a `permite_reservaciones`).
- **Escritura sin sesión:** el comensal no tiene sesión. RPC `SECURITY DEFINER` `set search_path = public`. `crear_tarjeta_lealtad` / `obtener_tarjeta_lealtad` / `guardar_contacto_tarjeta` = `to anon, authenticated`. Estas RPC **sí lanzan** `raise exception '<slug>'` con slugs del contrato (a diferencia de los contadores fire-and-forget de #5) porque son acciones deliberadas del comensal con feedback en pantalla.
- **Escritura del encargado:** `buscar_tarjeta` / `sellar_tarjeta` / `canjear_premio` / `buscar_tarjetas_por_contacto` = `SECURITY DEFINER`, **`revoke execute … from anon`**, `grant … to authenticated`. Resuelven el tenant con `(select tenant_id from tenant_usuarios where user_id = auth.uid())` y nunca cruzan tenants.
- **Supabase concede `EXECUTE` a `anon`/`authenticated` por defecto** en funciones de `public`. Para `service_role`-only (`purgar_tarjetas_lealtad`) hace falta `revoke execute … from public, anon, authenticated` explícito. Para `anon`-excluidas hace falta `revoke execute … from anon` explícito.
- **`codigo`:** 6 caracteres del alfabeto `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (sin `0O1I`). Único por tenant sobre `upper(codigo)`. La RPC lo genera con retry.
- **Tope 1 sello/día:** `tarjetas_lealtad.ultimo_sello_dia` comparado con `(now() at time zone coalesce(tz,'UTC'))::date`, tz de la sucursal que sella (o la 1ª del tenant) — mismo camino que `registrar_visita`.
- **Zona horaria:** patrón `registrar_visita` — `select s.timezone from sucursales where tenant_id = … and (p_sucursal_id is null or id = p_sucursal_id) order by created_at limit 1`.
- **`tenants.*` es público** (`tenants_select_publico` `using (true)`) → las 3 columnas `lealtad_*` son legibles sin sesión, lo cual es correcto (se pintan en el banner). NO hay que ocultarlas.
- **Config del admin** se guarda con el hook existente `useActualizarTenant` (RLS `tenant_puede_escribir(id)` = miembro de tenant no suspendido; los `lealtad_*` heredan el grant de UPDATE a `authenticated` a nivel tabla).
- **`obtener_tarjeta_lealtad` NUNCA devuelve `contacto` en claro** — solo `contacto_enmascarado` + `tiene_contacto`. (Lección #4: el grant a nivel tabla hace no-op los revokes por columna → se usa una RPC con proyección.)
- **`useAnalitica()`/otros contextos:** no aplican. `/demo` no monta el banner de lealtad (`data.lealtad` es null ahí).
- **Tests:** solo `src/lib/*.test.ts`, `bun:test` (`import { describe, expect, test } from "bun:test"`). CI: `src/lib` + `bunx tsc --noEmit` + `bunx eslint .` (0 errores; ~15 warnings `react-refresh` preexistentes OK). Componentes/hooks: `tsc` + `eslint` + `bun run build` + prueba manual.
- **`src/types/database.ts`** es generado; se **regenera** con `mcp__claude_ai_Supabase__generate_typescript_types` tras la migración, **conservando el bloque de alias manual al pie** (de `/* Aliases de dominio */` a EOF).
- **`src/routeTree.gen.ts`** es TRACKED; lo regenera `bun run build`. Commitear el cambio (tareas 7 y 8 añaden rutas).
- **Copy:** español de México, tono directo (`src/lib/copy.ts`). Tokens del admin `var(--vm-*)` / clases `vm-*`; tokens del menú público `var(--menu-*)`.
- **`html5-qrcode`:** añadir a `package.json` (`bun add html5-qrcode`), pero importar SOLO con `await import("html5-qrcode")` dentro del handler del botón "Escanear" — nunca en el top-level de un módulo que cargue en el bundle principal.

---

## File Structure

**Nuevos:**

| Archivo | Responsabilidad |
|---|---|
| `src/docs/vibemenu_migracion_lealtad.sql` | Registro de la migración (se aplica por el conector). |
| `src/lib/lealtad.ts` | Puro: alfabeto/validación de `codigo`, validación de teléfono/correo, `progresoLealtad`, `rejillaSellos`, `puedeSellarHoy`, helpers de `localStorage`. Sin React, sin red. |
| `src/lib/lealtad.test.ts` | Suite de lo anterior (CI). |
| `src/hooks/useLealtad.ts` | Comensal: `useTarjetaLocal`, `useTarjeta`, `useCrearTarjeta`, `useGuardarContacto`. |
| `src/components/menu/LealtadMenu.tsx` | Banner en el menú público (patrón `ReservarMenu`). |
| `src/routes/$slug.lealtad.$tarjetaId.tsx` | Ruta file-based de la tarjeta del comensal. |
| `src/pages/TarjetaLealtad.tsx` | Página de la tarjeta: rejilla de sellos, código, QR, formulario de contacto. |
| `src/hooks/useAdminLealtad.ts` | Admin: `useGuardarConfigLealtad` (vía `useActualizarTenant`), `useBuscarTarjeta`, `useSellar`, `useCanjear`, `useRecuperarTarjetas`, `useMovimientosLealtad`. |
| `src/routes/admin.lealtad.tsx` | Ruta file-based del panel. |
| `src/pages/admin/Lealtad.tsx` | Panel: muro de plan + config + sellar/canjear + recuperar + actividad. |
| `src/components/admin/EscanerCodigo.tsx` | Modal de cámara, `import()` dinámico de `html5-qrcode`. |
| `.github/workflows/purgar-tarjetas-lealtad.yml` | Cron diario de purga. |

**Modificados:**

| Archivo | Cambio |
|---|---|
| `src/types/database.ts` | Regenerado (columnas `tenants.lealtad_*` + `planes.permite_lealtad` + 2 tablas + 8 RPCs). |
| `src/lib/errores.ts` | 7 slugs nuevos en `SlugErrorDb` + `MENSAJES`. |
| `src/hooks/useMenuPublico.ts` | `permite_lealtad` en los 3 joins de plan + `Pick<Plan,…>` + `MenuPublico.lealtad: { meta, premio } | null` + el `return`. |
| `src/pages/MenuPublico.tsx` | Monta `<LealtadMenu>` en `cuerpo`, junto a `<ReservarMenu>`. |
| `src/components/layout/PillTabs.tsx` | Pestaña "Lealtad" en `PESTANAS_NEGOCIO` (entre "Analítica" y "Suscripción"). |
| `src/components/layout/AdminLayout.tsx` | `/admin/lealtad` en el `cubre` de "Mi negocio". |
| `src/pages/Privacidad.tsx` + `src/lib/legal.ts` | Sección nueva: contacto opcional de lealtad + consentimiento de marketing + retención. |
| `src/docs/vibemenu_alcance.md` | Feature (Pro+), tabla de planes, rutas. |
| `src/docs/vibemenu_base-datos.md` | Sección nueva (DDL + RLS + RPCs + nota). |
| `package.json` | `html5-qrcode`. |

---

## Task 1: Migración de esquema

**Files:**
- Create: `src/docs/vibemenu_migracion_lealtad.sql`

**Interfaces:**
- Produces: `planes.permite_lealtad boolean`; `tenants.lealtad_activa boolean`, `tenants.lealtad_sellos_meta smallint`, `tenants.lealtad_premio text`; tabla `tarjetas_lealtad`; tabla `movimientos_lealtad`; RPCs `crear_tarjeta_lealtad(uuid)`, `obtener_tarjeta_lealtad(uuid)`, `guardar_contacto_tarjeta(uuid,text,text,boolean)`, `buscar_tarjeta(text)`, `sellar_tarjeta(text,uuid)`, `canjear_premio(text,uuid)`, `buscar_tarjetas_por_contacto(text)`, `purgar_tarjetas_lealtad()`.

- [ ] **Step 1: Escribir `src/docs/vibemenu_migracion_lealtad.sql`**

Contenido exacto:

```sql
-- ============================================================================
--  VIBEMENU — migracion: lealtad con QR (sub-proyecto #6)
--
--  1. planes.permite_lealtad → gatea la feature (Pro+).
--  2. tenants.lealtad_activa / lealtad_sellos_meta / lealtad_premio → config,
--     uno por negocio. Check: no se puede activar sin meta y premio.
--  3. tarjetas_lealtad → una fila por tarjeta. El id ES el UUID de localStorage.
--  4. movimientos_lealtad → fila por sello/canje (auditoria + sucursal + encargado).
--  5. RPCs: el comensal (sin sesion) solo crea / lee / guarda contacto;
--     el encargado (authenticated) busca / sella / canjea / recupera.
--  6. purgar_tarjetas_lealtad → cron nocturno.
--
--  Aplicar con apply_migration del conector Supabase (project_id
--  iaiiwtqqiaqxnzxjqcnt, name: lealtad). APLICAR ANTES del deploy de la rama.
-- ============================================================================

begin;

-- 1. Capacidad de plan
alter table planes
  add column if not exists permite_lealtad boolean not null default false;
update planes set permite_lealtad = true where nombre in ('pro', 'enterprise');

-- 2. Config del programa (uno por negocio, columnas en tenants — ya son publicas
--    por tenants_select_publico, y eso es lo correcto: se pintan en el banner)
alter table tenants
  add column if not exists lealtad_activa      boolean  not null default false,
  add column if not exists lealtad_sellos_meta smallint,
  add column if not exists lealtad_premio      text;

alter table tenants
  add constraint tenants_lealtad_meta_valida
    check (lealtad_sellos_meta is null or lealtad_sellos_meta between 2 and 50),
  add constraint tenants_lealtad_premio_valido
    check (lealtad_premio is null or length(lealtad_premio) <= 80),
  add constraint tenants_lealtad_completa
    check (not lealtad_activa or (lealtad_sellos_meta is not null and lealtad_premio is not null));

-- 3. Tarjetas
create table tarjetas_lealtad (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references tenants(id) on delete cascade,
  codigo                      text not null,
  sellos                      smallint not null default 0 check (sellos >= 0),
  premios_canjeados           smallint not null default 0 check (premios_canjeados >= 0),
  contacto                    text,
  contacto_tipo               text check (contacto_tipo in ('telefono', 'correo')),
  consentimiento_marketing_at timestamptz,
  ultimo_sello_dia            date,
  creada_at                   timestamptz not null default now(),
  ultima_actividad_at         timestamptz,
  constraint tarjeta_contacto_coherente
    check ((contacto is null) = (contacto_tipo is null))
);

create unique index uq_tarjetas_codigo_tenant on tarjetas_lealtad (tenant_id, upper(codigo));
create index idx_tarjetas_tenant on tarjetas_lealtad (tenant_id);
create index idx_tarjetas_contacto on tarjetas_lealtad (tenant_id, lower(contacto)) where contacto is not null;
create index idx_tarjetas_purga on tarjetas_lealtad (coalesce(ultima_actividad_at, creada_at));

alter table tarjetas_lealtad enable row level security;
create policy "tarjetas_select_miembros" on tarjetas_lealtad for select
  to authenticated using (pertenece_a_tenant(tenant_id));
revoke all on tarjetas_lealtad from anon, authenticated;
grant select on tarjetas_lealtad to authenticated;

-- 4. Movimientos
create table movimientos_lealtad (
  id           bigint generated always as identity primary key,
  tarjeta_id   uuid not null references tarjetas_lealtad(id) on delete cascade,
  tenant_id    uuid not null references tenants(id) on delete cascade,
  sucursal_id  uuid references sucursales(id) on delete set null,
  tipo         text not null check (tipo in ('sello', 'canje')),
  encargado_id uuid references auth.users(id) on delete set null,
  creado_at    timestamptz not null default now()
);
create index idx_movimientos_tenant on movimientos_lealtad (tenant_id, creado_at desc);
create index idx_movimientos_tarjeta on movimientos_lealtad (tarjeta_id, creado_at desc);

alter table movimientos_lealtad enable row level security;
create policy "movimientos_select_miembros" on movimientos_lealtad for select
  to authenticated using (pertenece_a_tenant(tenant_id));
revoke all on movimientos_lealtad from anon, authenticated;
grant select on movimientos_lealtad to authenticated;

-- ── helper: genera un codigo unico para el tenant ───────────────────────────
create or replace function _gen_codigo_lealtad(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_codigo   text;
  v_intento  int := 0;
begin
  loop
    v_codigo := '';
    for i in 1..6 loop
      v_codigo := v_codigo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    end loop;
    exit when not exists (
      select 1 from tarjetas_lealtad
       where tenant_id = p_tenant_id and upper(codigo) = upper(v_codigo)
    );
    v_intento := v_intento + 1;
    if v_intento >= 8 then
      raise exception 'lealtad_error_interno';
    end if;
  end loop;
  return v_codigo;
end;
$$;
revoke execute on function _gen_codigo_lealtad(uuid) from public, anon, authenticated;

-- ── crear_tarjeta_lealtad ──────────────────────────────────────────────────
create or replace function crear_tarjeta_lealtad(p_tenant_id uuid)
returns tarjetas_lealtad
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activa boolean;
  v_fila   tarjetas_lealtad;
begin
  select lealtad_activa into v_activa from tenants where id = p_tenant_id;
  if not coalesce(v_activa, false) then
    raise exception 'lealtad_no_disponible';
  end if;

  insert into tarjetas_lealtad (tenant_id, codigo, ultima_actividad_at)
  values (p_tenant_id, _gen_codigo_lealtad(p_tenant_id), now())
  returning * into v_fila;

  return v_fila;
end;
$$;
revoke execute on function crear_tarjeta_lealtad(uuid) from public;
grant  execute on function crear_tarjeta_lealtad(uuid) to anon, authenticated;

-- ── obtener_tarjeta_lealtad (proyeccion segura, sin contacto en claro) ──────
create or replace function obtener_tarjeta_lealtad(p_tarjeta_id uuid)
returns table (
  sellos            smallint,
  sellos_meta       smallint,
  premio            text,
  codigo            text,
  premios_canjeados smallint,
  tenant_nombre     text,
  tenant_slug       text,
  tiene_contacto    boolean,
  contacto_enmascarado text
)
language sql
security definer
set search_path = public
as $$
  select
    t.sellos,
    tn.lealtad_sellos_meta,
    tn.lealtad_premio,
    t.codigo,
    t.premios_canjeados,
    tn.nombre_negocio,
    tn.slug,
    (t.contacto is not null),
    case
      when t.contacto is null then null
      when t.contacto_tipo = 'correo' then
        left(t.contacto, 1) || '●●●' || substr(t.contacto, position('@' in t.contacto))
      else
        '●●●' || right(regexp_replace(t.contacto, '\D', '', 'g'), 4)
    end
  from tarjetas_lealtad t
  join tenants tn on tn.id = t.tenant_id
  where t.id = p_tarjeta_id;
$$;
revoke execute on function obtener_tarjeta_lealtad(uuid) from public;
grant  execute on function obtener_tarjeta_lealtad(uuid) to anon, authenticated;

-- ── guardar_contacto_tarjeta ───────────────────────────────────────────────
create or replace function guardar_contacto_tarjeta(
  p_tarjeta_id uuid,
  p_contacto   text,
  p_tipo       text,
  p_consent    boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limpio text := nullif(trim(coalesce(p_contacto, '')), '');
begin
  if not exists (select 1 from tarjetas_lealtad where id = p_tarjeta_id) then
    raise exception 'tarjeta_no_encontrada';
  end if;

  -- borrar el contacto
  if v_limpio is null then
    update tarjetas_lealtad
       set contacto = null, contacto_tipo = null, consentimiento_marketing_at = null,
           ultima_actividad_at = now()
     where id = p_tarjeta_id;
    return;
  end if;

  if p_tipo not in ('telefono', 'correo') then
    raise exception 'datos_invalidos';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'consentimiento_requerido';
  end if;
  if p_tipo = 'correo' and v_limpio !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'datos_invalidos';
  end if;
  if p_tipo = 'telefono' and length(regexp_replace(v_limpio, '\D', '', 'g')) not between 10 and 15 then
    raise exception 'datos_invalidos';
  end if;

  update tarjetas_lealtad
     set contacto = v_limpio,
         contacto_tipo = p_tipo,
         consentimiento_marketing_at = now(),
         ultima_actividad_at = now()
   where id = p_tarjeta_id;
end;
$$;
revoke execute on function guardar_contacto_tarjeta(uuid, text, text, boolean) from public;
grant  execute on function guardar_contacto_tarjeta(uuid, text, text, boolean) to anon, authenticated;

-- ── helper: resuelve la tarjeta del tenant del auth.uid() por codigo ────────
create or replace function _tarjeta_del_encargado(p_codigo text)
returns tarjetas_lealtad
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_fila   tarjetas_lealtad;
begin
  select tenant_id into v_tenant from tenant_usuarios where user_id = auth.uid();
  if v_tenant is null then
    raise exception 'sin_tenant';
  end if;

  select * into v_fila from tarjetas_lealtad
   where tenant_id = v_tenant and upper(codigo) = upper(trim(p_codigo));
  if v_fila.id is null then
    raise exception 'tarjeta_no_encontrada';
  end if;

  return v_fila;
end;
$$;
revoke execute on function _tarjeta_del_encargado(text) from public, anon, authenticated;

-- ── vista de tarjeta para el panel del encargado ───────────────────────────
create or replace function _vista_tarjeta(p_tarjeta tarjetas_lealtad, p_sucursal_id uuid)
returns table (
  codigo             text,
  sellos             smallint,
  sellos_meta        smallint,
  premio             text,
  premios_canjeados  smallint,
  listo_para_canje   boolean,
  sello_repetido_hoy boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta smallint;
  v_tz   text;
  v_hoy  date;
begin
  select lealtad_sellos_meta into v_meta from tenants where id = p_tarjeta.tenant_id;

  select s.timezone into v_tz from sucursales s
   where s.tenant_id = p_tarjeta.tenant_id
     and (p_sucursal_id is null or s.id = p_sucursal_id)
   order by s.created_at limit 1;
  v_hoy := (now() at time zone coalesce(v_tz, 'UTC'))::date;

  return query select
    p_tarjeta.codigo,
    p_tarjeta.sellos,
    v_meta,
    (select lealtad_premio from tenants where id = p_tarjeta.tenant_id),
    p_tarjeta.premios_canjeados,
    (p_tarjeta.sellos >= coalesce(v_meta, 2147483647)),
    coalesce(p_tarjeta.ultimo_sello_dia = v_hoy, false);
end;
$$;
revoke execute on function _vista_tarjeta(tarjetas_lealtad, uuid) from public, anon, authenticated;

-- ── buscar_tarjeta (no muta) ───────────────────────────────────────────────
create or replace function buscar_tarjeta(p_codigo text)
returns table (
  codigo text, sellos smallint, sellos_meta smallint, premio text,
  premios_canjeados smallint, listo_para_canje boolean, sello_repetido_hoy boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query select * from _vista_tarjeta(_tarjeta_del_encargado(p_codigo), null::uuid);
end;
$$;
revoke execute on function buscar_tarjeta(text) from public, anon;
grant  execute on function buscar_tarjeta(text) to authenticated;

-- ── sellar_tarjeta ─────────────────────────────────────────────────────────
create or replace function sellar_tarjeta(p_codigo text, p_sucursal_id uuid default null)
returns table (
  codigo text, sellos smallint, sellos_meta smallint, premio text,
  premios_canjeados smallint, listo_para_canje boolean, sello_repetido_hoy boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tarjeta tarjetas_lealtad := _tarjeta_del_encargado(p_codigo);
  v_activa  boolean;
  v_suc     uuid := p_sucursal_id;
  v_tz      text;
  v_hoy     date;
begin
  select lealtad_activa into v_activa from tenants where id = v_tarjeta.tenant_id;
  if not coalesce(v_activa, false) then
    raise exception 'lealtad_no_disponible';
  end if;

  if v_suc is not null and not exists (
    select 1 from sucursales where id = v_suc and tenant_id = v_tarjeta.tenant_id
  ) then
    v_suc := null;
  end if;

  select s.timezone into v_tz from sucursales s
   where s.tenant_id = v_tarjeta.tenant_id
     and (v_suc is null or s.id = v_suc)
   order by s.created_at limit 1;
  v_hoy := (now() at time zone coalesce(v_tz, 'UTC'))::date;

  if v_tarjeta.ultimo_sello_dia = v_hoy then
    raise exception 'sello_repetido_hoy';
  end if;

  update tarjetas_lealtad
     set sellos = sellos + 1, ultimo_sello_dia = v_hoy, ultima_actividad_at = now()
   where id = v_tarjeta.id
   returning * into v_tarjeta;

  insert into movimientos_lealtad (tarjeta_id, tenant_id, sucursal_id, tipo, encargado_id)
  values (v_tarjeta.id, v_tarjeta.tenant_id, v_suc, 'sello', auth.uid());

  return query select * from _vista_tarjeta(v_tarjeta, v_suc);
end;
$$;
revoke execute on function sellar_tarjeta(text, uuid) from public, anon;
grant  execute on function sellar_tarjeta(text, uuid) to authenticated;

-- ── canjear_premio ─────────────────────────────────────────────────────────
create or replace function canjear_premio(p_codigo text, p_sucursal_id uuid default null)
returns table (
  codigo text, sellos smallint, sellos_meta smallint, premio text,
  premios_canjeados smallint, listo_para_canje boolean, sello_repetido_hoy boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tarjeta tarjetas_lealtad := _tarjeta_del_encargado(p_codigo);
  v_meta    smallint;
  v_suc     uuid := p_sucursal_id;
begin
  select lealtad_sellos_meta into v_meta from tenants where id = v_tarjeta.tenant_id;
  if v_meta is null or v_tarjeta.sellos < v_meta then
    raise exception 'sellos_insuficientes';
  end if;

  if v_suc is not null and not exists (
    select 1 from sucursales where id = v_suc and tenant_id = v_tarjeta.tenant_id
  ) then
    v_suc := null;
  end if;

  update tarjetas_lealtad
     set sellos = sellos - v_meta,
         premios_canjeados = premios_canjeados + 1,
         ultima_actividad_at = now()
   where id = v_tarjeta.id
   returning * into v_tarjeta;

  insert into movimientos_lealtad (tarjeta_id, tenant_id, sucursal_id, tipo, encargado_id)
  values (v_tarjeta.id, v_tarjeta.tenant_id, v_suc, 'canje', auth.uid());

  return query select * from _vista_tarjeta(v_tarjeta, v_suc);
end;
$$;
revoke execute on function canjear_premio(text, uuid) from public, anon;
grant  execute on function canjear_premio(text, uuid) to authenticated;

-- ── buscar_tarjetas_por_contacto ───────────────────────────────────────────
create or replace function buscar_tarjetas_por_contacto(p_contacto text)
returns table (
  id uuid, codigo text, sellos smallint, sellos_meta smallint,
  contacto_enmascarado text, creada_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_q      text := nullif(trim(coalesce(p_contacto, '')), '');
  v_digitos text := regexp_replace(coalesce(p_contacto, ''), '\D', '', 'g');
begin
  select tenant_id into v_tenant from tenant_usuarios where user_id = auth.uid();
  if v_tenant is null then
    raise exception 'sin_tenant';
  end if;
  if v_q is null then
    return;
  end if;

  return query
  select
    t.id, t.codigo, t.sellos,
    (select lealtad_sellos_meta from tenants where id = v_tenant),
    case
      when t.contacto_tipo = 'correo' then
        left(t.contacto, 1) || '●●●' || substr(t.contacto, position('@' in t.contacto))
      else '●●●' || right(regexp_replace(t.contacto, '\D', '', 'g'), 4)
    end,
    t.creada_at
  from tarjetas_lealtad t
  where t.tenant_id = v_tenant
    and t.contacto is not null
    and (
      lower(t.contacto) = lower(v_q)
      or (length(v_digitos) >= 7 and regexp_replace(t.contacto, '\D', '', 'g') like '%' || v_digitos || '%')
    )
  order by t.ultima_actividad_at desc nulls last
  limit 25;
end;
$$;
revoke execute on function buscar_tarjetas_por_contacto(text) from public, anon;
grant  execute on function buscar_tarjetas_por_contacto(text) to authenticated;

-- ── purgar_tarjetas_lealtad (cron) ─────────────────────────────────────────
create or replace function purgar_tarjetas_lealtad()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_borradas integer;
begin
  delete from tarjetas_lealtad
   where (sellos = 0 and premios_canjeados = 0 and creada_at < now() - interval '14 days')
      or coalesce(ultima_actividad_at, creada_at) < now() - interval '365 days';
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$$;
revoke execute on function purgar_tarjetas_lealtad() from public, anon, authenticated;
grant  execute on function purgar_tarjetas_lealtad() to service_role;

commit;

-- ============================================================================
--  Verificar:
--    select nombre, permite_lealtad from planes order by precio_usd;
--      -- free/basic = false ; pro/enterprise = true
--
--    -- activar sin meta/premio falla:
--    update tenants set lealtad_activa = true where id = '<algún tenant>';  -- ERROR tenants_lealtad_completa
--
--    -- anon puede crear/leer, no sellar/purgar:
--    set role anon;
--    select crear_tarjeta_lealtad('<tenant con lealtad_activa>');           -- fila
--    select * from obtener_tarjeta_lealtad('<uuid>');                       -- proyeccion
--    select sellar_tarjeta('ABC234');                                       -- ERROR permission denied
--    select purgar_tarjetas_lealtad();                                      -- ERROR permission denied
--    reset role;
--
--    select proname, prosecdef from pg_proc
--     where proname like '%lealtad%' or proname like '%tarjeta%' or proname in ('sellar_tarjeta','canjear_premio');
-- ============================================================================
```

- [ ] **Step 2: Verificar contra los peers**

Abrir `src/docs/vibemenu_migracion_reservaciones.sql` y `src/docs/vibemenu_migracion_analitica_platillo.sql`: confirmar el estilo de cabecera, `begin;/commit;`, verificación al pie, y que `pertenece_a_tenant(check_tenant_id uuid)`, `tenant_usuarios(user_id, tenant_id)`, `sucursales.timezone`, `sucursales.created_at`, `tenants.nombre_negocio`, `tenants.slug` existen (el schema doc los lista). Si algo no cuadra → STOP, reportar BLOCKED.

- [ ] **Step 3: Commit**

```bash
git add src/docs/vibemenu_migracion_lealtad.sql
git commit -m "feat(lealtad): migración de esquema (tarjetas, movimientos, RPCs, flag de plan)"
```

**NOTA controlador:** aplicar por el conector (`apply_migration`, name `lealtad`), correr las queries de verificación, probar el ciclo completo con un tenant real (activar lealtad, crear tarjeta como anon, sellar como definer, canjear, purgar), revertir (borrar tarjetas de prueba, `lealtad_activa=false`, quitar meta/premio). Luego regenerar `database.ts` (Task 2).

---

## Task 2: Regenerar tipos de base de datos

**Files:**
- Modify: `src/types/database.ts`

**Interfaces:**
- Consumes: el esquema de Task 1 aplicado a prod.
- Produces: `Tables<"tarjetas_lealtad">`, `Tables<"movimientos_lealtad">`, `Plan.permite_lealtad`, `Tenant.lealtad_activa|lealtad_sellos_meta|lealtad_premio`, y las 8 firmas de RPC en `Database["public"]["Functions"]`.

- [ ] **Step 1: (controlador) regenerar**

`mcp__claude_ai_Supabase__generate_typescript_types` con `project_id: "iaiiwtqqiaqxnzxjqcnt"`. El controlador guarda la salida cruda a `.superpowers/sdd/<plan>/task-2-generated.ts` y compone un `task-2-delta.md` con los bloques exactos a insertar (patrón #5).

- [ ] **Step 2: splice**

`src/types/database.ts` = [salida generada, de `export type Json` a `export const Constants = {…} as const`] + línea en blanco + [bloque manual existente desde `/* Aliases de dominio */` a EOF, **sin cambios**]. No añadir alias nuevos salvo que el panel lo pida sin colisión.

- [ ] **Step 3: formato + typecheck + lint + commit**

```
bunx prettier --write src/types/database.ts
bunx tsc --noEmit          # PASS. Si demo.ts arma un Plan/Tenant literal, añadir los campos nuevos ahí.
bunx eslint src/types/database.ts
git add src/types/database.ts src/lib/demo.ts   # demo.ts solo si cambió
git commit -m "feat(lealtad): regenera tipos de base de datos"
```

---

## Task 3: Biblioteca pura `src/lib/lealtad.ts`

**Files:**
- Create: `src/lib/lealtad.ts`
- Test: `src/lib/lealtad.test.ts`

**Interfaces:**
- Consumes: nada (solo `Date`, `localStorage`).
- Produces:
  - `export const ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"`
  - `export const LARGO_CODIGO = 6`
  - `normalizarCodigo(s: string): string` — `toUpperCase`, quita todo lo que no esté en el alfabeto, recorta a `LARGO_CODIGO`.
  - `codigoValido(s: string): boolean` — `normalizarCodigo(s).length === LARGO_CODIGO`.
  - `validarTelefono(s: string): { ok: boolean; e164: string | null }` — dígitos: si 10 → `+52`+dígitos; si 11-15 → `+`+dígitos; si empieza con `+` respeta; otro → `{ ok: false, e164: null }`.
  - `validarCorreo(s: string): boolean` — regex `^[^@\s]+@[^@\s]+\.[^@\s]+$`.
  - `type Progreso = { hechos: number; faltan: number; completa: boolean; pct: number }`
  - `progresoLealtad(sellos: number, meta: number): Progreso` — `hechos = min(sellos, meta)` para el texto; `faltan = max(0, meta - sellos)`; `completa = sellos >= meta`; `pct = meta > 0 ? Math.min(1, sellos / meta) : 0`.
  - `rejillaSellos(sellos: number, meta: number): boolean[]` — longitud `max(0, meta)`, `i < sellos`.
  - `puedeSellarHoy(ultimoSelloDia: string | null, hoyISO: string): boolean` — `ultimoSelloDia !== hoyISO`.
  - `type TarjetaLocal = { uuid: string }`
  - `claveLocal(slug: string): string` → `vm:lealtad:${slug}`
  - `leerTarjetaLocal(slug: string): string | null` (try/catch, valida forma UUID mínima)
  - `guardarTarjetaLocal(slug: string, uuid: string): void` (try/catch)
  - `olvidarTarjetaLocal(slug: string): void` (try/catch)

- [ ] **Step 1: Escribir los tests que fallan** — `src/lib/lealtad.test.ts`:

```ts
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import {
  codigoValido,
  guardarTarjetaLocal,
  leerTarjetaLocal,
  normalizarCodigo,
  olvidarTarjetaLocal,
  progresoLealtad,
  puedeSellarHoy,
  rejillaSellos,
  validarCorreo,
  validarTelefono,
} from "@/lib/lealtad";

let previo: unknown;
beforeAll(() => {
  previo = (globalThis as Record<string, unknown>).localStorage;
  if (typeof (globalThis as Record<string, unknown>).localStorage === "undefined") {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    };
  }
});
afterAll(() => {
  if (previo === undefined) delete (globalThis as Record<string, unknown>).localStorage;
  else (globalThis as Record<string, unknown>).localStorage = previo;
});

describe("normalizarCodigo / codigoValido", () => {
  test("mayúsculas, quita ambiguos y separadores, recorta a 6", () => {
    expect(normalizarCodigo(" abc-234 z")).toBe("ABC234"); // 'z' fuera del alfabeto? Z sí está
    expect(normalizarCodigo("abc234z9")).toBe("ABC234"); // recorta a 6
    expect(normalizarCodigo("a1b0c")).toBe("ABC"); // 1 y 0 no están en el alfabeto
  });
  test("codigoValido exige 6 chars del alfabeto", () => {
    expect(codigoValido("ABC234")).toBe(true);
    expect(codigoValido("ABC23")).toBe(false);
    expect(codigoValido("ABC2O1")).toBe(false); // O y 1 fuera
  });
});

describe("validarTelefono", () => {
  test("10 dígitos → +52", () => {
    expect(validarTelefono("8112345678")).toEqual({ ok: true, e164: "+528112345678" });
  });
  test("con lada explícita", () => {
    expect(validarTelefono("+1 415 555 1234")).toEqual({ ok: true, e164: "+14155551234" });
  });
  test("basura", () => {
    expect(validarTelefono("123").ok).toBe(false);
    expect(validarTelefono("abcdef").ok).toBe(false);
  });
});

describe("validarCorreo", () => {
  test("acepta y rechaza", () => {
    expect(validarCorreo("a@b.com")).toBe(true);
    expect(validarCorreo("a@b")).toBe(false);
    expect(validarCorreo("sin arroba")).toBe(false);
  });
});

describe("progresoLealtad", () => {
  test("a medias", () => {
    expect(progresoLealtad(3, 8)).toEqual({ hechos: 3, faltan: 5, completa: false, pct: 3 / 8 });
  });
  test("completa y con extras", () => {
    const p = progresoLealtad(9, 8);
    expect(p.completa).toBe(true);
    expect(p.faltan).toBe(0);
    expect(p.pct).toBe(1);
    expect(p.hechos).toBe(8);
  });
});

describe("rejillaSellos", () => {
  test("longitud meta, llenos los primeros", () => {
    expect(rejillaSellos(2, 5)).toEqual([true, true, false, false, false]);
    expect(rejillaSellos(7, 5)).toEqual([true, true, true, true, true]);
  });
});

describe("puedeSellarHoy", () => {
  test("mismo día no; otro día o null sí", () => {
    expect(puedeSellarHoy("2026-09-02", "2026-09-02")).toBe(false);
    expect(puedeSellarHoy("2026-09-01", "2026-09-02")).toBe(true);
    expect(puedeSellarHoy(null, "2026-09-02")).toBe(true);
  });
});

describe("localStorage helpers", () => {
  test("guardar / leer / olvidar", () => {
    const slug = "taqueria-" + Math.random().toString(36).slice(2);
    expect(leerTarjetaLocal(slug)).toBeNull();
    guardarTarjetaLocal(slug, "11111111-2222-3333-4444-555555555555");
    expect(leerTarjetaLocal(slug)).toBe("11111111-2222-3333-4444-555555555555");
    olvidarTarjetaLocal(slug);
    expect(leerTarjetaLocal(slug)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr, ver fallar** — `bun test src/lib/lealtad.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar `src/lib/lealtad.ts`**

```ts
/**
 * Lógica pura de lealtad. Sin React, sin red.
 *
 * `codigo`: 6 caracteres de un alfabeto sin ambigüedad. El servidor lo genera;
 * aquí solo se normaliza lo que teclea el encargado y se valida la forma.
 * `progresoLealtad` / `rejillaSellos`: pintan la tarjeta del comensal.
 * Los helpers de `localStorage` guardan el UUID de la tarjeta por slug de negocio.
 */

export const ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const LARGO_CODIGO = 6;

export function normalizarCodigo(s: string): string {
  return [...(s ?? "").toUpperCase()]
    .filter((c) => ALFABETO_CODIGO.includes(c))
    .join("")
    .slice(0, LARGO_CODIGO);
}

export function codigoValido(s: string): boolean {
  return normalizarCodigo(s).length === LARGO_CODIGO;
}

export function validarTelefono(s: string): { ok: boolean; e164: string | null } {
  const bruto = (s ?? "").trim();
  const digitos = bruto.replace(/\D/g, "");
  if (bruto.startsWith("+")) {
    return digitos.length >= 8 && digitos.length <= 15
      ? { ok: true, e164: "+" + digitos }
      : { ok: false, e164: null };
  }
  if (digitos.length === 10) return { ok: true, e164: "+52" + digitos };
  if (digitos.length >= 11 && digitos.length <= 15) return { ok: true, e164: "+" + digitos };
  return { ok: false, e164: null };
}

const RE_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export function validarCorreo(s: string): boolean {
  return RE_CORREO.test((s ?? "").trim());
}

export type Progreso = { hechos: number; faltan: number; completa: boolean; pct: number };

export function progresoLealtad(sellos: number, meta: number): Progreso {
  const m = Math.max(0, meta);
  return {
    hechos: Math.min(sellos, m),
    faltan: Math.max(0, m - sellos),
    completa: sellos >= m && m > 0,
    pct: m > 0 ? Math.min(1, sellos / m) : 0,
  };
}

export function rejillaSellos(sellos: number, meta: number): boolean[] {
  return Array.from({ length: Math.max(0, meta) }, (_, i) => i < sellos);
}

export function puedeSellarHoy(ultimoSelloDia: string | null, hoyISO: string): boolean {
  return ultimoSelloDia !== hoyISO;
}

export const claveLocal = (slug: string) => `vm:lealtad:${slug}`;

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function leerTarjetaLocal(slug: string): string | null {
  try {
    const uuid = localStorage.getItem(claveLocal(slug));
    return uuid && RE_UUID.test(uuid) ? uuid : null;
  } catch {
    return null;
  }
}

export function guardarTarjetaLocal(slug: string, uuid: string): void {
  try {
    localStorage.setItem(claveLocal(slug), uuid);
  } catch {
    /* Safari privado */
  }
}

export function olvidarTarjetaLocal(slug: string): void {
  try {
    localStorage.removeItem(claveLocal(slug));
  } catch {
    /* Safari privado */
  }
}
```

- [ ] **Step 4: Correr los tests** — `bun test src/lib/lealtad.test.ts` → PASS. (Nota: el test de `normalizarCodigo(" abc-234 z")` espera `"ABC234"` porque `Z` **sí** está en el alfabeto — corregir la aserción a `"ABC234Z".slice(0,6)` = `"ABC234"` si hace falta; la intención: filtra separadores y minúsculas, recorta a 6.)

- [ ] **Step 5: Suite + lint + typecheck + commit**

```bash
bun test && bunx eslint src/lib/lealtad.ts src/lib/lealtad.test.ts && bunx tsc --noEmit
git add src/lib/lealtad.ts src/lib/lealtad.test.ts
git commit -m "feat(lealtad): biblioteca pura (código, validación, progreso, localStorage)"
```

---

## Task 4: Slugs de error en `src/lib/errores.ts`

**Files:**
- Modify: `src/lib/errores.ts`

**Interfaces:**
- Produces: `traducirError` reconoce `lealtad_no_disponible`, `sello_repetido_hoy`, `tarjeta_no_encontrada`, `sellos_insuficientes`, `consentimiento_requerido`, `sin_tenant`, `lealtad_error_interno`.

- [ ] **Step 1: Añadir al union `SlugErrorDb`** (tras `dominio_propio_no_permitido`):

```ts
  // Migración lealtad (#6): RPCs de tarjetas de sellos
  | "lealtad_no_disponible"
  | "sello_repetido_hoy"
  | "tarjeta_no_encontrada"
  | "sellos_insuficientes"
  | "consentimiento_requerido"
  | "sin_tenant"
  | "lealtad_error_interno";
```

- [ ] **Step 2: Añadir a `MENSAJES`** (no a `SLUGS_DE_LIMITE` — no son límites de plan):

```ts
  lealtad_no_disponible: "Este negocio no tiene un programa de sellos activo ahora mismo.",
  sello_repetido_hoy: "Esta tarjeta ya recibió su sello de hoy. Vuelve mañana.",
  tarjeta_no_encontrada: "No encontramos una tarjeta con ese código.",
  sellos_insuficientes: "Esta tarjeta todavía no junta los sellos para el premio.",
  consentimiento_requerido: "Marca la casilla de consentimiento para guardar tu dato.",
  sin_tenant: "Tu sesión no está ligada a un negocio. Vuelve a entrar.",
  lealtad_error_interno: "No pudimos crear tu tarjeta. Intenta de nuevo.",
```

- [ ] **Step 3: typecheck + lint + commit**

```bash
bunx tsc --noEmit && bunx eslint src/lib/errores.ts
git add src/lib/errores.ts
git commit -m "feat(lealtad): slugs de error de las RPC de lealtad"
```

---

## Task 5: `useMenuPublico` — flag y config de lealtad

**Files:**
- Modify: `src/hooks/useMenuPublico.ts`

**Interfaces:**
- Produces: `MenuPublico` gana `lealtad: { meta: number; premio: string } | null` (null cuando el plan no lo permite o `lealtad_activa` es false o falta meta/premio).

- [ ] **Step 1: Editar los 4 puntos**

1. Los **3** strings `.select("*, plan:planes(marca_agua, …, permite_analitica_platillo)")` → añadir `, permite_lealtad`.
2. El `Pick<Plan, | "marca_agua" | … | "permite_analitica_platillo">` → añadir `| "permite_lealtad"`.
3. El tipo `MenuPublico` → tras `permiteAnaliticaPlatillo: boolean;` añadir:
   ```ts
   /** Config viva del programa de sellos, o null si no aplica (plan/opt-in). */
   lealtad: { meta: number; premio: string } | null;
   ```
4. En el `return` de `armarMenuPublico`, tras `permiteAnaliticaPlatillo: …,`:
   ```ts
   lealtad:
     (plan?.permite_lealtad ?? false) &&
     tenant.lealtad_activa &&
     tenant.lealtad_sellos_meta != null &&
     tenant.lealtad_premio != null
       ? { meta: tenant.lealtad_sellos_meta, premio: tenant.lealtad_premio }
       : null,
   ```
   (`tenant` aquí es `tenantRow` sin `plan`; sus columnas `lealtad_*` ya vienen del `select("*")`.)

- [ ] **Step 2: typecheck + lint + build**

```
bunx tsc --noEmit && bunx eslint src/hooks/useMenuPublico.ts && bun run build
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMenuPublico.ts
git commit -m "feat(lealtad): expone la config de lealtad en useMenuPublico"
```

---

## Task 6: Hooks del comensal + banner en el menú

**Files:**
- Create: `src/hooks/useLealtad.ts`
- Create: `src/components/menu/LealtadMenu.tsx`
- Modify: `src/pages/MenuPublico.tsx`

**Interfaces:**
- Consumes: `supabase`; `src/lib/lealtad.ts`; `traducirError` de `src/lib/errores.ts`; `MenuPublico.lealtad` (Task 5).
- Produces:
  - `useTarjetaLocal(slug): { uuid: string | null; guardar: (u: string) => void; olvidar: () => void }`
  - `useTarjeta(slug: string, uuid: string | null)` → `UseQueryResult<TarjetaPublica | null>` donde `TarjetaPublica = { sellos: number; sellosMeta: number; premio: string; codigo: string; premiosCanjeados: number; tenantNombre: string; tenantSlug: string; tieneContacto: boolean; contactoEnmascarado: string | null }`
  - `useCrearTarjeta(tenantId: string | undefined, slug: string)` → `useMutation<string>` (devuelve el uuid; guarda en localStorage en `onSuccess`)
  - `useGuardarContacto(uuid: string | null)` → `useMutation<void, Error, { contacto: string; tipo: "telefono" | "correo"; consent: boolean }>`

- [ ] **Step 1: `src/hooks/useLealtad.ts`**

```ts
import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { traducirError } from "@/lib/errores";
import { guardarTarjetaLocal, leerTarjetaLocal, olvidarTarjetaLocal } from "@/lib/lealtad";

export type TarjetaPublica = {
  sellos: number;
  sellosMeta: number;
  premio: string;
  codigo: string;
  premiosCanjeados: number;
  tenantNombre: string;
  tenantSlug: string;
  tieneContacto: boolean;
  contactoEnmascarado: string | null;
};

export function useTarjetaLocal(slug: string) {
  const [uuid, setUuid] = useState<string | null>(() => leerTarjetaLocal(slug));
  useEffect(() => setUuid(leerTarjetaLocal(slug)), [slug]);

  const guardar = useCallback(
    (u: string) => {
      guardarTarjetaLocal(slug, u);
      setUuid(u);
    },
    [slug],
  );
  const olvidar = useCallback(() => {
    olvidarTarjetaLocal(slug);
    setUuid(null);
  }, [slug]);

  return { uuid, guardar, olvidar };
}

export function useTarjeta(slug: string, uuid: string | null) {
  return useQuery({
    queryKey: ["tarjeta-lealtad", uuid],
    enabled: Boolean(uuid),
    retry: false,
    staleTime: 15_000,
    queryFn: async (): Promise<TarjetaPublica | null> => {
      const { data, error } = await supabase.rpc("obtener_tarjeta_lealtad", {
        p_tarjeta_id: uuid!,
      });
      if (error) throw error;
      const fila = (data ?? [])[0];
      if (!fila) return null;
      return {
        sellos: fila.sellos,
        sellosMeta: fila.sellos_meta,
        premio: fila.premio,
        codigo: fila.codigo,
        premiosCanjeados: fila.premios_canjeados,
        tenantNombre: fila.tenant_nombre,
        tenantSlug: fila.tenant_slug,
        tieneContacto: fila.tiene_contacto,
        contactoEnmascarado: fila.contacto_enmascarado,
      };
    },
  });
}

export function useCrearTarjeta(tenantId: string | undefined, slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc("crear_tarjeta_lealtad", {
        p_tenant_id: tenantId!,
      });
      if (error) throw new Error(traducirError(error).mensaje);
      const fila = Array.isArray(data) ? data[0] : data;
      if (!fila?.id) throw new Error("No pudimos crear tu tarjeta.");
      return fila.id as string;
    },
    onSuccess: (uuid) => {
      guardarTarjetaLocal(slug, uuid);
      void qc.invalidateQueries({ queryKey: ["tarjeta-lealtad", uuid] });
    },
  });
}

export function useGuardarContacto(uuid: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { contacto: string; tipo: "telefono" | "correo"; consent: boolean }) => {
      const { error } = await supabase.rpc("guardar_contacto_tarjeta", {
        p_tarjeta_id: uuid!,
        p_contacto: v.contacto,
        p_tipo: v.tipo,
        p_consent: v.consent,
      });
      if (error) throw new Error(traducirError(error).mensaje);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tarjeta-lealtad", uuid] }),
  });
}
```

- [ ] **Step 2: `src/components/menu/LealtadMenu.tsx`**

Patrón `ReservarMenu` (banner + tarjeta compacta). Props: `{ tenantId: string; slug: string; lealtad: { meta: number; premio: string } | null }`. `if (!lealtad) return null;`

```tsx
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Stamp } from "lucide-react";
import { useCrearTarjeta, useTarjeta, useTarjetaLocal } from "@/hooks/useLealtad";
import { progresoLealtad } from "@/lib/lealtad";

export default function LealtadMenu({
  tenantId,
  slug,
  lealtad,
}: {
  tenantId: string;
  slug: string;
  lealtad: { meta: number; premio: string } | null;
}) {
  const navigate = useNavigate();
  const { uuid } = useTarjetaLocal(slug);
  const tarjeta = useTarjeta(slug, uuid);
  const crear = useCrearTarjeta(tenantId, slug);

  if (!lealtad) return null;

  const irATarjeta = (u: string) =>
    navigate({ to: "/$slug/lealtad/$tarjetaId", params: { slug, tarjetaId: u } });

  // Con tarjeta local: resumen + link. Sin tarjeta: CTA que crea y navega.
  const conTarjeta = uuid && tarjeta.data;
  const prog = conTarjeta
    ? progresoLealtad(tarjeta.data!.sellos, tarjeta.data!.sellosMeta)
    : null;

  return (
    <section
      className="mx-4 my-6 rounded-2xl border p-5"
      style={{ borderColor: "var(--menu-borde)", background: "var(--menu-fondo-alt)" }}
    >
      <div className="flex items-center gap-3">
        <Stamp className="size-5 shrink-0" style={{ color: "var(--menu-acento)" }} aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: "var(--menu-texto)" }}>
            {conTarjeta ? `Tu tarjeta · ${prog!.hechos}/${lealtad.meta}` : `Junta sellos`}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--menu-texto-suave)" }}>
            {conTarjeta
              ? prog!.completa
                ? `¡Listo! Enseña tu tarjeta para tu ${lealtad.premio}.`
                : `Te faltan ${prog!.faltan} para ${lealtad.premio}.`
              : `${lealtad.meta} sellos = ${lealtad.premio}.`}
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={crear.isPending}
        onClick={() => {
          if (uuid) return irATarjeta(uuid);
          crear.mutate(undefined, { onSuccess: (u) => irATarjeta(u) });
        }}
        className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium"
        style={{ background: "var(--menu-acento)", color: "var(--menu-acento-texto)" }}
      >
        {crear.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {conTarjeta ? "Ver mi tarjeta" : "Crear mi tarjeta"}
      </button>
      {crear.isError && (
        <p className="mt-2 text-xs" style={{ color: "var(--menu-error, #b91c1c)" }}>
          {(crear.error as Error).message}
        </p>
      )}
    </section>
  );
}
```

(Ajustar los tokens `--menu-*` a los que existan de verdad — revisar `ReservarMenu.tsx` / `ContactoMenu.tsx` para los nombres exactos.)

- [ ] **Step 3: Montar en `MenuPublico.tsx`**

Tras `<ReservarMenu … />` (dentro de `cuerpo`), añadir:

```tsx
<LealtadMenu tenantId={data.tenant.id} slug={data.tenant.slug} lealtad={data.lealtad} />
```

Import: `import LealtadMenu from "@/components/menu/LealtadMenu";`. Solo en `cuerpo` — TikTok no lleva banner de lealtad en v1.

- [ ] **Step 4: typecheck + lint + build + commit**

```bash
bunx tsc --noEmit && bunx eslint src/hooks/useLealtad.ts src/components/menu/LealtadMenu.tsx src/pages/MenuPublico.tsx && bun run build
git add src/hooks/useLealtad.ts src/components/menu/LealtadMenu.tsx src/pages/MenuPublico.tsx
git commit -m "feat(lealtad): banner de sellos en el menú público"
```

---

## Task 7: Página de la tarjeta del comensal

**Files:**
- Create: `src/routes/$slug.lealtad.$tarjetaId.tsx`
- Create: `src/pages/TarjetaLealtad.tsx`

**Interfaces:**
- Consumes: `useTarjeta`, `useTarjetaLocal`, `useGuardarContacto` (Task 6); `progresoLealtad`, `rejillaSellos`, `validarTelefono`, `validarCorreo` (Task 3); `QRCode` de `react-qr-code`; `PhoneInput` de `@/components/ui/phone-input`.

- [ ] **Step 1: Ruta** — `src/routes/$slug.lealtad.$tarjetaId.tsx`

```tsx
import { createFileRoute } from "@tanstack/react-router";
import TarjetaLealtad from "@/pages/TarjetaLealtad";

export const Route = createFileRoute("/$slug/lealtad/$tarjetaId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { slug, tarjetaId } = Route.useParams();
  return <TarjetaLealtad slug={slug} tarjetaId={tarjetaId} />;
}
```

(Client-only: no `loader`. La tarjeta es privada del comensal, no necesita SSR ni SEO.)

- [ ] **Step 2: `src/pages/TarjetaLealtad.tsx`** — completar según esta estructura (copy español MX, tokens `--menu-*`):

```tsx
// Imports: useState, QRCode from "react-qr-code", iconos lucide (ArrowLeft, Check, QrCode, Phone, Mail),
// useTarjeta/useTarjetaLocal/useGuardarContacto, progresoLealtad/rejillaSellos/validarTelefono/validarCorreo,
// Link de @tanstack/react-router, PhoneInput.

export default function TarjetaLealtad({ slug, tarjetaId }: { slug: string; tarjetaId: string }) {
  const { uuid, guardar, olvidar } = useTarjetaLocal(slug);
  const { data: tarjeta, isLoading, isError } = useTarjeta(slug, tarjetaId);
  const guardarContacto = useGuardarContacto(tarjetaId);

  // Estados:
  //  isLoading → skeleton
  //  isError || (!isLoading && !tarjeta) → "No encontramos esta tarjeta." + <Link to menú>
  //  ok:
  //   - Header: nombre del negocio (tarjeta.tenantNombre), <Link to="/$slug"> "← Volver al menú"
  //   - Rejilla de sellos: rejillaSellos(tarjeta.sellos, tarjeta.sellosMeta).map → círculo lleno/vacío
  //     (grid, wrap). Debajo: progresoLealtad → "Te faltan N para {premio}" / "¡Listo para tu {premio}!"
  //   - Bloque "Enséñale esto al mesero": <QRCode value={tarjeta.codigo} size={160} /> + el código
  //     en grande (letra monoespaciada, tracking). Texto: "El mesero teclea o escanea este código
  //     para darte tu sello."
  //   - Bloque "Guarda tu tarjeta":
  //       si uuid !== tarjetaId (abrió por link ajeno / recuperación) → botón "Guardar en este teléfono"
  //         → guardar(tarjetaId)
  //       si uuid === tarjetaId → nota "Guardada en este teléfono ✓" + botón sutil "Quitar de este teléfono" (olvidar)
  //   - Bloque "Respaldo" (colapsable):
  //       si !tarjeta.tieneContacto → formulario:
  //         toggle teléfono/correo; input (PhoneInput para teléfono, <input type=email> para correo);
  //         checkbox obligatorio: "Acepto que {tarjeta.tenantNombre} guarde este dato para recuperar
  //         mi tarjeta y enviarme promociones" con <a href="/privacidad" target="_blank">Aviso de privacidad</a>;
  //         validación cliente con validarTelefono/validarCorreo antes de enviar;
  //         submit → guardarContacto.mutate({ contacto, tipo, consent: true })
  //       si tarjeta.tieneContacto → "Respaldo: {tarjeta.contactoEnmascarado}" + "Cambiar" (reabre form) +
  //         "Quitar" → guardarContacto.mutate({ contacto: "", tipo: "telefono", consent: false })
  //       Errores: (guardarContacto.error as Error).message
  //   - "Cómo funciona" (3 bullets): junta 1 sello por visita (máx 1 al día) · al llegar a {meta} enseña
  //     tu tarjeta para tu {premio} · si borras el navegador y no dejaste respaldo, empiezas de cero.
}
```

Completar cada bloque. Reusar el patrón de hoja/tarjeta de `ReservarMenu.tsx` para el estilo. La rejilla: círculos `size-8 rounded-full border-2`, llenos con `background: var(--menu-acento)`.

- [ ] **Step 3: routeTree + typecheck + lint + build**

```
bun run build   # regenera src/routeTree.gen.ts con /$slug/lealtad/$tarjetaId
bunx tsc --noEmit && bunx eslint src/routes/$slug.lealtad.$tarjetaId.tsx src/pages/TarjetaLealtad.tsx
```

- [ ] **Step 4: Prueba manual (dev)** — `bun run dev`. Con un tenant Pro + `lealtad_activa`, meta 5, premio "Café": abrir el menú → "Crear mi tarjeta" → cae en `/{slug}/lealtad/{uuid}` con 0/5, QR, código. Dejar un teléfono con el checkbox → aparece enmascarado. Abrir la URL en una ventana privada (sin el uuid en localStorage) → "Guardar en este teléfono".

- [ ] **Step 5: Commit**

```bash
git add src/routes/$slug.lealtad.$tarjetaId.tsx src/pages/TarjetaLealtad.tsx src/routeTree.gen.ts
git commit -m "feat(lealtad): página de la tarjeta del comensal (rejilla, QR, respaldo)"
```

---

## Task 8: Panel `/admin/lealtad`

**Files:**
- Create: `src/hooks/useAdminLealtad.ts`
- Create: `src/routes/admin.lealtad.tsx`
- Create: `src/pages/admin/Lealtad.tsx`
- Create: `src/components/admin/EscanerCodigo.tsx`
- Modify: `src/components/layout/PillTabs.tsx`
- Modify: `src/components/layout/AdminLayout.tsx`
- Modify: `package.json` (`bun add html5-qrcode`)

**Interfaces:**
- Consumes: `useTenantActual`, `useActualizarTenant`, `useSucursales`; `supabase`; `traducirError`; `normalizarCodigo`, `codigoValido` (Task 3); patrón muro `Reservaciones.tsx`.

- [ ] **Step 1: `bun add html5-qrcode`** — confirma que entra en `dependencies` de `package.json`. NO importarlo en top-level en ningún módulo.

- [ ] **Step 2: `src/hooks/useAdminLealtad.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { traducirError } from "@/lib/errores";
import { useActualizarTenant } from "@/hooks/useActualizarTenant";

export type VistaTarjeta = {
  codigo: string;
  sellos: number;
  sellosMeta: number;
  premio: string;
  premiosCanjeados: number;
  listoParaCanje: boolean;
  selloRepetidoHoy: boolean;
};

const mapVista = (f: Record<string, unknown>): VistaTarjeta => ({
  codigo: f.codigo as string,
  sellos: f.sellos as number,
  sellosMeta: f.sellos_meta as number,
  premio: f.premio as string,
  premiosCanjeados: f.premios_canjeados as number,
  listoParaCanje: f.listo_para_canje as boolean,
  selloRepetidoHoy: f.sello_repetido_hoy as boolean,
});

const primera = (data: unknown): Record<string, unknown> | null =>
  Array.isArray(data) ? (data[0] ?? null) : ((data as Record<string, unknown>) ?? null);

export function useGuardarConfigLealtad(tenantId: string | undefined) {
  return useActualizarTenant(tenantId); // update { lealtad_activa, lealtad_sellos_meta, lealtad_premio }
}

export function useBuscarTarjeta() {
  return useMutation({
    mutationFn: async (codigo: string): Promise<VistaTarjeta> => {
      const { data, error } = await supabase.rpc("buscar_tarjeta", { p_codigo: codigo });
      if (error) throw new Error(traducirError(error).mensaje);
      const f = primera(data);
      if (!f) throw new Error("No encontramos una tarjeta con ese código.");
      return mapVista(f);
    },
  });
}

export function useSellar(tenantId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { codigo: string; sucursalId: string | null }): Promise<VistaTarjeta> => {
      const { data, error } = await supabase.rpc("sellar_tarjeta", {
        p_codigo: v.codigo,
        p_sucursal_id: v.sucursalId ?? undefined,
      });
      if (error) throw new Error(traducirError(error).mensaje);
      return mapVista(primera(data)!);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["movimientos-lealtad", tenantId] }),
  });
}

export function useCanjear(tenantId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { codigo: string; sucursalId: string | null }): Promise<VistaTarjeta> => {
      const { data, error } = await supabase.rpc("canjear_premio", {
        p_codigo: v.codigo,
        p_sucursal_id: v.sucursalId ?? undefined,
      });
      if (error) throw new Error(traducirError(error).mensaje);
      return mapVista(primera(data)!);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["movimientos-lealtad", tenantId] }),
  });
}

export function useRecuperarTarjetas() {
  return useMutation({
    mutationFn: async (contacto: string) => {
      const { data, error } = await supabase.rpc("buscar_tarjetas_por_contacto", {
        p_contacto: contacto,
      });
      if (error) throw new Error(traducirError(error).mensaje);
      return (data ?? []) as {
        id: string;
        codigo: string;
        sellos: number;
        sellos_meta: number;
        contacto_enmascarado: string;
        creada_at: string;
      }[];
    },
  });
}

export function useMovimientosLealtad(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["movimientos-lealtad", tenantId],
    enabled: Boolean(tenantId),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimientos_lealtad")
        .select("id, tipo, creado_at, sucursal_id, tarjeta:tarjetas_lealtad(codigo), sucursal:sucursales(nombre)")
        .eq("tenant_id", tenantId!)
        .order("creado_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}
```

- [ ] **Step 3: `src/components/admin/EscanerCodigo.tsx`** — modal con cámara, `import()` dinámico:

```tsx
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export default function EscanerCodigo({
  onCodigo,
  onCerrar,
}: {
  onCodigo: (texto: string) => void;
  onCerrar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let vivo = true;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!vivo || !ref.current) return;
        const inst = new Html5Qrcode(ref.current.id);
        scanner = inst as unknown as { stop: () => Promise<void>; clear: () => void };
        await inst.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          (texto: string) => {
            onCodigo(texto);
            void inst.stop().then(() => inst.clear());
          },
          () => {},
        );
      } catch {
        if (vivo) setError("No pudimos abrir la cámara. Teclea el código.");
      }
    })();
    return () => {
      vivo = false;
      scanner?.stop().then(() => scanner?.clear()).catch(() => {});
    };
  }, [onCodigo]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-vm-ink">Escanear código</h3>
          <button type="button" onClick={onCerrar} aria-label="Cerrar">
            <X className="size-5 text-vm-body" />
          </button>
        </div>
        <div id="escaner-lealtad" ref={ref} className="mt-3 overflow-hidden rounded-xl" />
        {error && <p className="mt-2 text-xs text-vm-danger">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `src/routes/admin.lealtad.tsx`** (copia de `admin.reservaciones.tsx`):

```tsx
import { createFileRoute } from "@tanstack/react-router";
import Lealtad from "@/pages/admin/Lealtad";

export const Route = createFileRoute("/admin/lealtad")({
  component: Lealtad,
});
```

- [ ] **Step 5: Nav**

- `PillTabs.tsx` `PESTANAS_NEGOCIO`: insertar `{ a: "/admin/lealtad", etiqueta: "Lealtad" }` **entre "Analítica" y "Suscripción"**.
- `AdminLayout.tsx`: añadir `"/admin/lealtad"` al `cubre` del item "Mi negocio".

- [ ] **Step 6: `src/pages/admin/Lealtad.tsx`** — modelar en `Reservaciones.tsx` (leerlo entero). Estructura:

```tsx
// export default function Lealtad() → <AdminLayout><Contenido /></AdminLayout>
// EJEMPLO difuminado para el muro (tarjeta ficticia).
// function Bloqueado() → patrón Reservaciones.Bloqueado:
//   h2 "La tarjeta de lealtad es parte de los planes Pro y Enterprise."
//   p  "Tus clientes juntan sellos desde el menú y tú los validas aquí."
//   Link /admin/suscripcion.
//
// function Contenido():
//   const { data: ctx } = useTenantActual();
//   if (!ctx) return null;
//   if (!ctx.plan.permite_lealtad) → <PillTabs> + h1 + <Bloqueado/>
//
//   const { data: sucursales } = useSucursales(ctx.tenant.id);
//   const guardarConfig = useGuardarConfigLealtad(ctx.tenant.id);
//   const buscar = useBuscarTarjeta(); const sellar = useSellar(ctx.tenant.id);
//   const canjear = useCanjear(ctx.tenant.id);
//   const recuperar = useRecuperarTarjetas();
//   const movimientos = useMovimientosLealtad(ctx.tenant.id);
//
//   Estado local: form config (activa, meta, premio) inicializado de ctx.tenant.*;
//     codigo (string, normalizado al teclear), sucursalSel, escanerAbierto,
//     tarjetaActiva: VistaTarjeta | null (resultado de buscar/sellar/canjear).
//
//   Secciones:
//   1. Configuración — <form>: checkbox lealtad_activa (disabled si !meta || !premio),
//      input number sellos_meta (2–50), input text premio (maxLength 80). Botón Guardar
//      → guardarConfig.mutate({ lealtad_activa, lealtad_sellos_meta, lealtad_premio }).
//      Nota: "Actívalo cuando el premio esté listo. Si lo apagas, las tarjetas se conservan."
//   2. Sellar / canjear —
//      input de código (value=codigo, onChange normalizarCodigo) + botón "Escanear"
//        → setEscanerAbierto(true); {escanerAbierto && <EscanerCodigo onCodigo={t => {
//           setCodigo(normalizarCodigo(t)); setEscanerAbierto(false); }} onCerrar={...} />}
//      si sucursales.length > 1 → <select> sucursalSel (default sucursales[0].id)
//      botón "Buscar" (disabled si !codigoValido(codigo)) → buscar.mutate(codigo, { onSuccess: setTarjetaActiva })
//      {tarjetaActiva && (
//         card: "{sellos}/{sellosMeta} · {premiosCanjeados} premios"
//         botón "Sellar" disabled={tarjetaActiva.selloRepetidoHoy}
//           → sellar.mutate({ codigo, sucursalId: sucursalSel }, { onSuccess: setTarjetaActiva })
//           (si selloRepetidoHoy → texto "Ya recibió su sello de hoy")
//         botón "Canjear premio" disabled={!tarjetaActiva.listoParaCanje}
//           → canjear.mutate({ codigo, sucursalId: sucursalSel }, { onSuccess: setTarjetaActiva })
//      )}
//      Errores de buscar/sellar/canjear traducidos (ya vienen como Error.message).
//   3. Recuperar tarjeta — input contacto + botón Buscar → recuperar.mutate(contacto).
//      Lista recuperar.data: cada item → código, "{sellos}/{sellos_meta}", contacto_enmascarado,
//      <QRCode value={item.codigo} size={90} />, y la URL `${origin}/${ctx.tenant.slug}/lealtad/${item.id}`
//      con botón "Copiar enlace" (navigator.clipboard). Nota: "Muéstrale el QR o pásale el enlace
//      para que abra su tarjeta en su teléfono."
//   4. Actividad — movimientos.data en tabla: fecha (toLocaleString es-MX), tipo (sello/canje),
//      código (mov.tarjeta?.codigo ?? "—"), sucursal (mov.sucursal?.nombre ?? "General").
//      Vacío → "Aún no has sellado ninguna tarjeta."
```

Completar. Tokens `vm-*`. Copy español MX.

- [ ] **Step 7: routeTree + typecheck + lint + build + test**

```
bun run build
bunx tsc --noEmit && bunx eslint src/hooks/useAdminLealtad.ts src/routes/admin.lealtad.tsx src/pages/admin/Lealtad.tsx src/components/admin/EscanerCodigo.tsx src/components/layout/PillTabs.tsx src/components/layout/AdminLayout.tsx && bun test
```
Expected: PASS. `bun run build` debe incluir `html5-qrcode` solo en un chunk aparte (lazy) — si aparece en el bundle principal, el `import()` está mal puesto.

- [ ] **Step 8: Prueba manual** — `bun run dev` → `/admin/lealtad`: sin sesión → `/login`. Con tenant no-Pro → muro. Con tenant Pro: configurar (meta 5, premio "Café", activar), teclear el código de la tarjeta de la Task 7 → Buscar → Sellar → 1/5; Sellar otra vez → "ya recibió su sello de hoy". Botón Escanear → apuntar a un QR con el código → llena el campo. Llegar a 5/5 (sellar 5 días simulados vía conector por el controlador, o bajar meta a 1) → Canjear. Recuperar por el teléfono dejado en la Task 7.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useAdminLealtad.ts src/routes/admin.lealtad.tsx src/pages/admin/Lealtad.tsx src/components/admin/EscanerCodigo.tsx src/components/layout/PillTabs.tsx src/components/layout/AdminLayout.tsx src/routeTree.gen.ts package.json
git add "$(ls bun.lock bun.lockb 2>/dev/null)"   # el lockfile que use el repo
git commit -m "feat(lealtad): panel /admin/lealtad (config, sellar/canjear, recuperar, actividad)"
```

---

## Task 9: Cron de purga

**Files:**
- Create: `.github/workflows/purgar-tarjetas-lealtad.yml`

- [ ] **Step 1: Escribir el workflow** — copia de `.github/workflows/purgar-reservaciones.yml` (leerlo primero) con:
- `name: Purgar tarjetas de lealtad`
- comentario: borra tarjetas sin uso (0 sellos > 14 días) e inactivas > 12 meses; ver `src/docs/vibemenu_migracion_lealtad.sql` (`purgar_tarjetas_lealtad`)
- `schedule: - cron: "15 4 * * *"` + `workflow_dispatch: {}`
- step `Llamar a purgar_tarjetas_lealtad`
- `curl … "https://iaiiwtqqiaqxnzxjqcnt.supabase.co/rest/v1/rpc/purgar_tarjetas_lealtad"` con `apikey` + `Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}`, `Content-Type: application/json`, `-d '{}'`, `--fail-with-body -sS -X POST`
- comentario final sobre el correo de fallo al dueño del repo (adaptar referencias a los peers)

- [ ] **Step 2: Validar YAML + commit**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/purgar-tarjetas-lealtad.yml')); print('ok')"
git add .github/workflows/purgar-tarjetas-lealtad.yml
git commit -m "feat(lealtad): cron nocturno de purga de tarjetas"
```

**NOTA controlador:** verificar por el conector que `anon` no puede llamar `purgar_tarjetas_lealtad` y `service_role` sí.

---

## Task 10: Documentación

**Files:**
- Modify: `src/pages/Privacidad.tsx`
- Modify: `src/lib/legal.ts`
- Modify: `src/docs/vibemenu_alcance.md`
- Modify: `src/docs/vibemenu_base-datos.md`

- [ ] **Step 1: `Privacidad.tsx`** — en `SECCIONES`, añadir un `<p>` a la sección del menú público (o una sección nueva "Si juntas sellos"):
"**Si usas la tarjeta de sellos de un negocio:** creamos una tarjeta identificada por un código aleatorio en tu navegador — sin cuenta, sin perfil. Si **decides** dejar un teléfono o correo, lo guardamos para que el negocio pueda recuperar tu tarjeta si cambias de teléfono **y para que te contacte con promociones**; marcas una casilla de consentimiento antes de guardarlo. Puedes quitar ese dato en cualquier momento desde tu tarjeta. Si no dejas contacto y borras el navegador, la tarjeta se pierde. Las tarjetas sin actividad por 12 meses se eliminan."
Mantener el tono; no contradecir el resto.

- [ ] **Step 2: `src/lib/legal.ts`** — si hay una lista de datos personales tratados o de finalidades, añadir: "teléfono/correo de la tarjeta de lealtad (opcional, con consentimiento) — finalidad: recuperación de la tarjeta y comunicaciones promocionales del negocio". Si hay `Proveedor[]` no aplica (no entra un proveedor nuevo).

- [ ] **Step 3: `vibemenu_alcance.md`**
- Quitar de "Fuera del alcance (MVP)" la línea de tarjeta de lealtad si existe.
- Añadir sección de feature:
  "**Tarjeta de lealtad (Pro/Enterprise, migración lealtad).** Programa de sellos, uno por negocio. El comensal crea su tarjeta desde un banner en el menú (UUID en `localStorage`, URL `/{slug}/lealtad/{uuid}`); el encargado la sella o canjea desde `/admin/lealtad` con un código de 6 caracteres o su QR, **tope 1 sello por tarjeta por día** (zona horaria de la sucursal). Premio de un solo nivel (`N sellos = premio`). Campo de contacto opcional (teléfono/correo, con consentimiento) para recuperar la tarjeta y para promociones futuras. `movimientos_lealtad` guarda cada sello/canje (sucursal, encargado). Purga: tarjetas sin uso a 14 días, inactivas a 12 meses. Sin Edge Function; sin Wallet en v1."
- Tabla de planes: fila/nota "Tarjeta de lealtad → Pro y Enterprise".
- "Rutas y páginas": `| /admin/lealtad | Lealtad | Configurar y validar sellos | Owner/Encargado |` y `| /{slug}/lealtad/{uuid} | Tarjeta de sellos | La tarjeta del comensal | Público |`.

- [ ] **Step 4: `vibemenu_base-datos.md`** — sección nueva (estilo secciones 15/16), DDL **verbatim de `src/docs/vibemenu_migracion_lealtad.sql`**: columnas de `tenants`, `tarjetas_lealtad` + índices, `movimientos_lealtad`, las 8 RPC con sus grants reales (comensal `to anon,authenticated`; encargado `to authenticated` con `revoke anon`; helpers `_*` sin grant público; `purgar_*` `service_role` only), y nota en prosa: tarjeta = UUID de `localStorage`; sin escritura pública directa salvo `crear`/`obtener`/`guardar_contacto`; sellado/canje autenticado y siempre dentro del tenant del `auth.uid()`; tope 1/día por tz de sucursal; `contacto` nunca sale en claro por RPC pública; purga.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Privacidad.tsx src/lib/legal.ts src/docs/vibemenu_alcance.md src/docs/vibemenu_base-datos.md
git commit -m "docs(lealtad): privacidad, alcance y esquema"
```

---

## Task 11: QA end-to-end y merge

**Files:** ninguno (verificación — controlador).

- [ ] **Step 1: Suite completa** — `bun test && bunx tsc --noEmit && bunx eslint . && bun run build` → todo PASS.

- [ ] **Step 2: Migración en prod** — confirmar `lealtad` aplicada (`select nombre, permite_lealtad from planes`). Si se aplicó al inicio, solo confirmar.

- [ ] **Step 3: QA con tenant Pro de prueba (controlador + usuario)**
- Bump temporal de un tenant a `pro`, `lealtad_activa=true`, meta 3, premio "Postre".
- Menú → "Crear mi tarjeta" → fila en `tarjetas_lealtad`, `localStorage` con el uuid.
- `/admin/lealtad` (**hand-off al usuario** para el click-through con sesión): Buscar el código → Sellar (1/3) → Sellar de nuevo → `sello_repetido_hoy`. Por el conector: `update tarjetas_lealtad set ultimo_sello_dia = null, sellos = 2 where codigo = '…'` para simular; Sellar → 3/3; Canjear → 0/3, `premios_canjeados=1`.
- Dejar contacto en la tarjeta → `/admin/lealtad` Recuperar por ese dato → sale la tarjeta.
- Bajar el tenant a Basic → muro en `/admin/lealtad`, banner desaparece del menú, `crear_tarjeta_lealtad` → `lealtad_no_disponible`.
- `select purgar_tarjetas_lealtad();` → borra la tarjeta de prueba con 0 sellos si tiene > 14 días (si no, 0 — correcto).
- Revertir: borrar tarjetas y movimientos de prueba, `lealtad_activa=false`, `lealtad_sellos_meta=null`, `lealtad_premio=null`, plan original.

- [ ] **Step 4: Merge** — `superpowers:finishing-a-development-branch`. Rama `feat/lealtad-qr` → `main`. Menú de opciones al usuario.

---

## Self-Review

**Spec coverage:**

| Sección del spec | Task |
|---|---|
| `planes.permite_lealtad` (Pro+) | 1 |
| `tenants.lealtad_*` + checks | 1 |
| `tarjetas_lealtad` + índices + RLS | 1 |
| `movimientos_lealtad` + RLS | 1 |
| `crear_tarjeta_lealtad` / `obtener_tarjeta_lealtad` / `guardar_contacto_tarjeta` (anon) | 1 |
| `buscar_tarjeta` / `sellar_tarjeta` / `canjear_premio` / `buscar_tarjetas_por_contacto` (authenticated) | 1 |
| `purgar_tarjetas_lealtad` (service_role) | 1 |
| Tipos `database.ts` | 2 |
| `src/lib/lealtad.ts` (código, teléfono/correo, progreso, rejilla, puedeSellarHoy, localStorage) + tests | 3 |
| Slugs de error | 4 |
| `useMenuPublico` — `lealtad` field | 5 |
| `useLealtad.ts` (comensal) | 6 |
| `LealtadMenu.tsx` banner + montaje en `MenuPublico` | 6 |
| `/{slug}/lealtad/{uuid}` ruta + `TarjetaLealtad.tsx` (rejilla, código, QR, respaldo) | 7 |
| `useAdminLealtad.ts` | 8 |
| `/admin/lealtad` ruta + `Lealtad.tsx` (config, sellar/canjear, recuperar, actividad) | 8 |
| `EscanerCodigo.tsx` (`html5-qrcode` lazy) | 8 |
| Nav (`PillTabs` + `AdminLayout`) + `routeTree.gen.ts` | 7, 8 |
| Cron de purga | 9 |
| Privacidad + legal + alcance + base-datos | 10 |
| QA + merge | 11 |

Sin huecos.

**Placeholder scan:** Tasks 7 y 8 (`TarjetaLealtad.tsx` y `Lealtad.tsx`) traen estructura + comentarios por bloque, no carácter por carácter — es la parte "de diseño" (UI del comensal y del panel), con `ReservarMenu.tsx` / `Reservaciones.tsx` como referencia. Todo lo demás (SQL, lib, hooks, errores, `useMenuPublico`, banner, escáner, cron, docs) trae código literal.

**Type consistency:**
- `VistaTarjeta` — misma forma que devuelven `buscar_tarjeta`/`sellar_tarjeta`/`canjear_premio` (Task 1 SQL: `codigo, sellos, sellos_meta, premio, premios_canjeados, listo_para_canje, sello_repetido_hoy`) mapeada en Task 8 `mapVista`.
- `TarjetaPublica` (Task 6) — misma forma que `obtener_tarjeta_lealtad` (Task 1 SQL: `sellos, sellos_meta, premio, codigo, premios_canjeados, tenant_nombre, tenant_slug, tiene_contacto, contacto_enmascarado`).
- `crear_tarjeta_lealtad` devuelve `tarjetas_lealtad` (fila) → Task 6 lee `.id`.
- `MenuPublico.lealtad: { meta, premio } | null` — Task 5 lo produce, Task 6 (`LealtadMenu`) lo consume.
- `normalizarCodigo` / `codigoValido` — Task 3 def, Task 8 uso.
- RPC param names: `p_tenant_id`, `p_tarjeta_id`, `p_contacto`, `p_tipo`, `p_consent`, `p_codigo`, `p_sucursal_id` — idénticos entre Task 1 (SQL) y Tasks 6/8 (`.rpc`).
- Ruta `/$slug/lealtad/$tarjetaId` — Task 7 la crea, Task 6 (`navigate`) y Task 8 (URL de recuperación) la referencian con esos nombres de params.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-02-lealtad-qr.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
