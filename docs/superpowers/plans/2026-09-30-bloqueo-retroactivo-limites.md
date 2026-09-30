# Bloqueo retroactivo de límites de plan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando un tenant baja de plan (downgrade manual, trial vencido, o impago con gracia vencida), los productos/sucursales/encargados/grupos de modificadores que exceden el límite del plan nuevo se bloquean automáticamente — desaparecen del menú público, y un encargado de más pierde acceso — en vez de seguir funcionando gratis para siempre.

**Architecture:** Una columna `bloqueado_por_plan` en cada una de las 4 tablas + una función Postgres que recalcula ese flag por tenant (los N más antiguos por `created_at` sobreviven), disparada por triggers en cada alta/baja de esas tablas y en cada cambio de `tenants.plan_id`. El acceso de un encargado bloqueado se cierra con un solo cambio en `pertenece_a_tenant()` (la función que gatea casi todo el RLS de escritura del panel). El impago vencido deja de suspender el panel del todo y en su lugar baja a Free, reutilizando el mismo mecanismo que un downgrade manual.

**Tech Stack:** Postgres/PL-pgSQL (Supabase), Deno Edge Functions (Stripe webhook, cron), React + TanStack Query, Bun test.

**Spec:** `docs/superpowers/specs/2026-09-30-bloqueo-retroactivo-limites-design.md`

## Global Constraints

- El criterio de corte es SIEMPRE "los más antiguos por `created_at` sobreviven" — nunca se implementa una UI de elección manual (fuera de alcance del spec).
- `bloqueado_por_plan` lo escribe ÚNICAMENTE la función `security definer` `recalcular_bloqueos_plan` — cada tabla necesita un `revoke update (bloqueado_por_plan) ... from authenticated` explícito, porque las políticas RLS de escritura de este proyecto son "for all" a nivel de fila, no de columna.
- El owner de un tenant nunca se bloquea a sí mismo — solo los encargados entran al ranking de `tenant_usuarios`.
- `estado='suspendido'` y `PanelBloqueado` NO se borran del código — dejan de ser un destino automático, pero se conservan intactos para un uso manual futuro (incumplimiento de Términos), fuera de alcance de este plan.
- Todas las pruebas automatizadas de lógica pura van en `src/lib/*.test.ts`, corridas con `bun test src/lib --run` (228 tests hoy, deben seguir en 0 fail). Las migraciones y Edge Functions no tienen test automatizado en este repo — se verifican con SQL de prueba (`src/docs/vibemenu_pruebas_triggers.sql`, patrón `begin;...rollback;`) y QA manual, respectivamente.
- Migraciones se aplican con `mcp__claude_ai_Supabase__apply_migration` (proyecto `iaiiwtqqiaqxnzxjqcnt`), nunca pidiendo al usuario que corra SQL a mano.
- Cada commit sigue el estilo de mensajes ya usado en este repo (`feat(area): qué cambia`, `docs: qué documenta`) y termina con la línea de atribución que ya usa este proyecto.

---

## Task 1: Migración 020 — esquema, función de recálculo, triggers, RLS

**Files:**
- Create: `src/docs/vibemenu_migracion_bloqueo_limites.sql`
- Modify: `src/docs/vibemenu_pruebas_triggers.sql` (agrega las pruebas 12-17)

**Interfaces:**
- Produces: columna `bloqueado_por_plan boolean` en `productos`, `sucursales`, `tenant_usuarios`, `grupos_modificadores`; columna `created_at timestamptz` en `grupos_modificadores`; función `recalcular_bloqueos_plan(p_tenant_id uuid) returns void`; función `pertenece_a_tenant(check_tenant_id uuid) returns boolean` (reemplazada — excluye encargados bloqueados); función `equipo_del_tenant(p_tenant_id uuid)` con `bloqueado_por_plan` en su `returns table`.
- Consumes: nada de tareas anteriores (es la base de todo lo demás).

- [ ] **Step 1: Escribir la migración completa**

Crear `src/docs/vibemenu_migracion_bloqueo_limites.sql`:

```sql
-- ============================================================================
--  VIBEMENU — migracion 020: bloqueo retroactivo de limites de plan
--
--  Hasta ahora, limite_productos/limite_sucursales/limite_usuarios/
--  limite_grupos_modificadores solo se validaban en INSERT (before insert).
--  Si un tenant bajaba de plan, todo lo que ya tenia de mas seguia visible
--  en el menu publico y editable en el panel para siempre.
--
--  Ver docs/superpowers/specs/2026-09-30-bloqueo-retroactivo-limites-design.md
--
--  Aplicar via Supabase MCP (apply_migration) o SQL Editor completo.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Esquema
-- ---------------------------------------------------------------------------
alter table productos add column bloqueado_por_plan boolean not null default false;
alter table sucursales add column bloqueado_por_plan boolean not null default false;
alter table tenant_usuarios add column bloqueado_por_plan boolean not null default false;

-- grupos_modificadores no tenia created_at: se necesita para el corte por
-- antiguedad, igual que las otras 3 tablas.
alter table grupos_modificadores add column created_at timestamptz not null default now();
alter table grupos_modificadores add column bloqueado_por_plan boolean not null default false;

-- Defensa en profundidad: bloqueado_por_plan SOLO lo escribe la funcion
-- security definer de abajo. Sin este revoke, cualquier miembro del tenant
-- podria desbloquearse con un update directo desde el cliente (las policies
-- *_write_miembros son "for all" a nivel de fila, no de columna).
revoke update (bloqueado_por_plan) on productos from authenticated;
revoke update (bloqueado_por_plan) on sucursales from authenticated;
revoke update (bloqueado_por_plan) on tenant_usuarios from authenticated;
revoke update (bloqueado_por_plan) on grupos_modificadores from authenticated;

-- ---------------------------------------------------------------------------
-- 2. Funcion de recalculo (una por tenant, reutilizada por todos los triggers)
-- ---------------------------------------------------------------------------
create or replace function recalcular_bloqueos_plan(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limite_productos int;
  v_limite_sucursales int;
  v_limite_usuarios int;
  v_limite_grupos int;
  v_permite_multiusuario boolean;
begin
  perform pg_advisory_xact_lock(hashtext('bloqueos_plan:' || p_tenant_id::text));

  select p.limite_productos, p.limite_sucursales, p.limite_usuarios,
         p.limite_grupos_modificadores, p.permite_multiusuario
    into v_limite_productos, v_limite_sucursales, v_limite_usuarios,
         v_limite_grupos, v_permite_multiusuario
    from tenants t join planes p on p.id = t.plan_id
   where t.id = p_tenant_id;

  if not found then
    return;
  end if;

  -- Productos: solo compiten por cupo los visibles (activo=true). Uno que el
  -- dueno ya oculto no consume limite ni se marca bloqueado por esto.
  with rankeados as (
    select id, row_number() over (order by created_at, id) as rank
      from productos
     where tenant_id = p_tenant_id and activo = true
  )
  update productos p
     set bloqueado_por_plan = (r.rank > coalesce(v_limite_productos, r.rank))
    from rankeados r
   where p.id = r.id;

  update productos
     set bloqueado_por_plan = false
   where tenant_id = p_tenant_id and activo = false and bloqueado_por_plan;

  -- Sucursales: mismo patron con activa=true.
  with rankeadas as (
    select id, row_number() over (order by created_at, id) as rank
      from sucursales
     where tenant_id = p_tenant_id and activa = true
  )
  update sucursales s
     set bloqueado_por_plan = (r.rank > coalesce(v_limite_sucursales, r.rank))
    from rankeadas r
   where s.id = r.id;

  update sucursales
     set bloqueado_por_plan = false
   where tenant_id = p_tenant_id and activa = false and bloqueado_por_plan;

  -- Grupos de modificadores: sin bandera de visibilidad, cuentan todos.
  with rankeados as (
    select id, row_number() over (order by created_at, id) as rank
      from grupos_modificadores
     where tenant_id = p_tenant_id
  )
  update grupos_modificadores g
     set bloqueado_por_plan = (r.rank > coalesce(v_limite_grupos, r.rank))
    from rankeados r
   where g.id = r.id;

  -- Encargados: el owner nunca entra al ranking (nunca se bloquea a si
  -- mismo). limite_usuarios cuenta owner + encargados juntos (igual que
  -- validar_limite_usuarios), de ahi el "-1". Si el plan no permite
  -- multiusuario en absoluto, todos los encargados se bloquean sin importar
  -- el numero.
  with rankeados as (
    select id, row_number() over (order by created_at, id) as rank
      from tenant_usuarios
     where tenant_id = p_tenant_id and rol = 'encargado'
  )
  update tenant_usuarios u
     set bloqueado_por_plan = (
       not coalesce(v_permite_multiusuario, false)
       or r.rank > coalesce(v_limite_usuarios - 1, r.rank)
     )
    from rankeados r
   where u.id = r.id;
end;
$$;

revoke all on function recalcular_bloqueos_plan(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Triggers que disparan el recalculo
-- ---------------------------------------------------------------------------
create or replace function trg_recalcular_bloqueos_hijo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform recalcular_bloqueos_plan(coalesce(new.tenant_id, old.tenant_id));
  return null; -- AFTER: el valor de retorno se ignora
end;
$$;

create trigger trg_productos_40_bloqueo
  after insert or delete or update of activo on productos
  for each row execute function trg_recalcular_bloqueos_hijo();

create trigger trg_sucursales_40_bloqueo
  after insert or delete or update of activa on sucursales
  for each row execute function trg_recalcular_bloqueos_hijo();

create trigger trg_grupos_mod_40_bloqueo
  after insert or delete on grupos_modificadores
  for each row execute function trg_recalcular_bloqueos_hijo();

create trigger trg_tenant_usuarios_40_bloqueo
  after insert or delete on tenant_usuarios
  for each row execute function trg_recalcular_bloqueos_hijo();

create or replace function trg_recalcular_bloqueos_por_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan_id is distinct from old.plan_id then
    perform recalcular_bloqueos_plan(new.id);
  end if;
  return new;
end;
$$;

create trigger trg_tenants_30_bloqueos
  after update of plan_id on tenants
  for each row execute function trg_recalcular_bloqueos_por_plan();

-- ---------------------------------------------------------------------------
-- 4. Acceso de encargados: un encargado bloqueado deja de "pertenecer"
-- ---------------------------------------------------------------------------
create or replace function pertenece_a_tenant(check_tenant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from tenant_usuarios
    where tenant_id = check_tenant_id and user_id = auth.uid() and not bloqueado_por_plan
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. equipo_del_tenant: el owner necesita ver a los encargados bloqueados
--    para pintar el candado — create or replace no permite agregar columnas
--    a un returns table existente, hay que dropearla primero (mismo motivo
--    documentado en vibemenu_migracion_perfil_usuario.sql).
-- ---------------------------------------------------------------------------
drop function if exists equipo_del_tenant(uuid);

create function equipo_del_tenant(p_tenant_id uuid)
returns table (
  user_id            uuid,
  email              text,
  nombre             text,
  avatar_url         text,
  rol                text,
  created_at         timestamptz,
  bloqueado_por_plan boolean
)
language sql
security definer
stable
set search_path = public, auth
as $$
  select
    tu.user_id,
    u.email::text,
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
    tu.rol,
    tu.created_at,
    tu.bloqueado_por_plan
    from tenant_usuarios tu
    join auth.users u on u.id = tu.user_id
   where tu.tenant_id = p_tenant_id
     and pertenece_a_tenant(p_tenant_id)
   order by (tu.rol <> 'owner'), tu.created_at;
$$;

revoke all on function equipo_del_tenant(uuid) from public;
revoke execute on function equipo_del_tenant(uuid) from anon;
grant execute on function equipo_del_tenant(uuid) to authenticated;

commit;

-- ============================================================================
--  Verificar:
--
--    select column_name from information_schema.columns
--     where table_name in ('productos','sucursales','tenant_usuarios','grupos_modificadores')
--       and column_name = 'bloqueado_por_plan';
--    -- 4 filas.
--
--    select column_name from information_schema.column_privileges
--     where table_name in ('productos','sucursales','tenant_usuarios','grupos_modificadores')
--       and grantee = 'authenticated' and privilege_type = 'UPDATE'
--       and column_name = 'bloqueado_por_plan';
--    -- 0 filas: nadie autenticado puede escribir esta columna directo.
--
--    Correr src/docs/vibemenu_pruebas_triggers.sql completo (pruebas 12-17
--    nuevas al final).
-- ============================================================================
```

- [ ] **Step 2: Extender `src/docs/vibemenu_pruebas_triggers.sql` con las pruebas 12-17**

Dos cambios en el archivo existente.

Primero, agregar dos variables a la sección `declare` (justo después de `v_pasadas int := 0;`):

```sql
  v_pasadas    int := 0;
  v_otro_usuario uuid;
  v_encargado    uuid;
```

Segundo, insertar el siguiente bloque **inmediatamente después** de la prueba 11 (después de la línea `v_pasadas := v_pasadas + 1;` que cierra la prueba "Al bajar de plan, el tema se limpia solo") y **antes** de la línea `raise notice '───────────────────────────────';`:

```sql
  -- ── 12. bloqueo_por_plan: bajar de Pro a Free bloquea el exceso de productos ──
  update tenants set plan_id = v_pro where id = v_tenant;
  delete from productos where tenant_id = v_tenant;
  insert into productos (tenant_id, categoria_id, nombre, precio, created_at)
  select v_tenant, v_categoria, '_bp_' || i, 10, now() - (30 - i) * interval '1 minute'
    from generate_series(1, 30) i;

  update tenants set plan_id = v_free where id = v_tenant;

  if (select count(*) from productos where tenant_id = v_tenant and bloqueado_por_plan) <> 10 then
    raise exception 'FALLO: se esperaban 10 productos bloqueados al bajar a Free con 30, hay %',
      (select count(*) from productos where tenant_id = v_tenant and bloqueado_por_plan);
  end if;
  if exists (
    select 1 from productos
     where tenant_id = v_tenant and bloqueado_por_plan
       and nombre in (select '_bp_' || i from generate_series(1, 20) i)
  ) then
    raise exception 'FALLO: se bloqueo uno de los 20 productos mas viejos';
  end if;
  v_pasadas := v_pasadas + 1;

  -- ── 13. Subir de plan desbloquea todo ────────────────────────────────────
  update tenants set plan_id = v_pro where id = v_tenant;
  if (select count(*) from productos where tenant_id = v_tenant and bloqueado_por_plan) <> 0 then
    raise exception 'FALLO: subir a Pro deberia desbloquear los 30 productos';
  end if;
  v_pasadas := v_pasadas + 1;

  -- ── 14. bloqueo de sucursales al bajar de plan ───────────────────────────
  insert into sucursales (tenant_id, nombre, slug, created_at)
    values (v_tenant, '_bs2_', '_bs2_', now());
  update tenants set plan_id = v_free where id = v_tenant;
  if (select count(*) from sucursales where tenant_id = v_tenant and bloqueado_por_plan) <> 1 then
    raise exception 'FALLO: al bajar a Free (limite 1) deberia quedar 1 sucursal bloqueada';
  end if;
  if (select bloqueado_por_plan from sucursales where id = v_sucursal) then
    raise exception 'FALLO: se bloqueo la sucursal mas vieja, no la mas nueva';
  end if;
  v_pasadas := v_pasadas + 1;

  -- ── 15. Borrar un producto activo libera cupo para el bloqueado mas viejo ──
  update tenants set plan_id = v_pro where id = v_tenant; -- vuelve a caber todo
  update tenants set plan_id = v_free where id = v_tenant; -- 10 bloqueados de nuevo
  delete from productos where tenant_id = v_tenant and nombre = '_bp_1'; -- el mas viejo activo
  if (select bloqueado_por_plan from productos where tenant_id = v_tenant and nombre = '_bp_21') then
    raise exception 'FALLO: al borrar un activo, el bloqueado mas viejo deberia desbloquearse solo';
  end if;
  v_pasadas := v_pasadas + 1;

  -- ── 16. grupos_modificadores se bloquean igual al bajar de plan (limite 2) ──
  insert into grupos_modificadores (tenant_id, nombre, created_at) values (v_tenant, '_g3_', now());
  if (select count(*) from grupos_modificadores where tenant_id = v_tenant and bloqueado_por_plan) <> 1 then
    raise exception 'FALLO: con 3 grupos y limite 2 deberia quedar 1 bloqueado';
  end if;
  v_pasadas := v_pasadas + 1;

  -- ── 17. Encargados: se bloquean si el plan no permite multiusuario ───────
  select user_id into v_otro_usuario
    from tenant_usuarios where tenant_id <> v_tenant limit 1;

  if v_otro_usuario is null then
    raise notice 'Prueba 17 omitida: no hay un segundo usuario en la base para simular un encargado.';
    v_pasadas := v_pasadas + 1;
  else
    update tenants set plan_id = v_pro where id = v_tenant;
    insert into tenant_usuarios (tenant_id, user_id, rol) values (v_tenant, v_otro_usuario, 'encargado')
      returning id into v_encargado;
    update tenants set plan_id = v_free where id = v_tenant;
    if not (select bloqueado_por_plan from tenant_usuarios where id = v_encargado) then
      raise exception 'FALLO: Free no permite multiusuario, el encargado deberia quedar bloqueado';
    end if;
    delete from tenant_usuarios where id = v_encargado;
    v_pasadas := v_pasadas + 1;
  end if;

```

Tercero, cambiar las dos referencias a `11` en el cierre del archivo:

```sql
  raise notice '  % de 11 pruebas pasaron', v_pasadas;
```
→
```sql
  raise notice '  % de 17 pruebas pasaron', v_pasadas;
```

y

```sql
  if v_pasadas <> 11 then
```
→
```sql
  if v_pasadas <> 17 then
```

- [ ] **Step 3: Aplicar la migración**

Vía `mcp__claude_ai_Supabase__apply_migration` (proyecto `iaiiwtqqiaqxnzxjqcnt`), nombre `bloqueo_limites_plan`, con el contenido completo del Step 1.

- [ ] **Step 4: Correr las pruebas SQL y confirmar "17 de 17 pruebas pasaron"**

Vía `mcp__claude_ai_Supabase__execute_sql`, pegar el contenido completo de `src/docs/vibemenu_pruebas_triggers.sql` ya extendido. Si algo falla, el mensaje `FALLO: ...` dice qué trigger no se comportó como se esperaba — corregir la función `recalcular_bloqueos_plan` (no el test) y repetir.

- [ ] **Step 5: Verificar las dos consultas del bloque "Verificar" del Step 1**

Confirmar 4 filas en la primera y 0 filas en la segunda (columna `bloqueado_por_plan` no escribible por `authenticated`).

- [ ] **Step 6: Commit**

```bash
git add src/docs/vibemenu_migracion_bloqueo_limites.sql src/docs/vibemenu_pruebas_triggers.sql
git commit -m "feat(planes): bloqueo retroactivo de límites — esquema, recálculo y RLS

Migración 020: bloqueado_por_plan en productos/sucursales/tenant_usuarios/
grupos_modificadores, función recalcular_bloqueos_plan disparada por
trigger en cada alta/baja y en cada cambio de plan_id. pertenece_a_tenant()
excluye encargados bloqueados — cierra su acceso en cascada. Migración
aplicada a producción vía MCP; 17/17 pruebas en vibemenu_pruebas_triggers.sql.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Regenerar tipos y fixtures de demo

**Files:**
- Modify: `src/types/database.ts` (regenerado)
- Modify: `src/lib/demo.ts`

**Interfaces:**
- Consumes: columnas nuevas de Task 1 (`bloqueado_por_plan` en 4 tablas, `created_at` en `grupos_modificadores`).
- Produces: tipos `Producto`, `Sucursal`, `TenantUsuario`/equivalente y `GrupoModificador` con `bloqueado_por_plan: boolean` — todas las tareas de frontend dependen de esto para tener tipado correcto.

- [ ] **Step 1: Regenerar `src/types/database.ts`**

Vía `mcp__claude_ai_Supabase__generate_typescript_types` (proyecto `iaiiwtqqiaqxnzxjqcnt`). Reemplazar el archivo completo con la salida — trae solas `bloqueado_por_plan` en las 4 tablas y `created_at` en `grupos_modificadores`.

- [ ] **Step 2: Actualizar `src/lib/demo.ts`**

Tres cambios puntuales:

`SUCURSAL_DEMO` (línea 58-73) gana el campo al final:

```ts
export const SUCURSAL_DEMO: Sucursal = {
  id: "demo-sucursal",
  tenant_id: "demo-tenant",
  nombre: "Centro",
  slug: "centro",
  direccion: "5 de Mayo 120, Centro Histórico",
  maps_url: null,
  google_reviews_url: null,
  telefono: null,
  whatsapp: "+52 55 1234 5678",
  timezone: "America/Mexico_City",
  activa: true,
  acepta_reservaciones: false,
  reservaciones_email: null,
  created_at: new Date().toISOString(),
  bloqueado_por_plan: false,
};
```

`grupoTortilla` y `grupoExtras` (líneas 75-104) ganan `created_at` y `bloqueado_por_plan` cada uno, por ejemplo:

```ts
const grupoTortilla = {
  id: "g-tortilla",
  tenant_id: "demo-tenant",
  nombre: "Tortilla",
  tipo_seleccion: "unica",
  obligatorio: true,
  min_selecciones: 1,
  max_selecciones: 1,
  orden: 0,
  created_at: new Date().toISOString(),
  bloqueado_por_plan: false,
  opciones: [
    { id: "o-maiz", grupo_id: "g-tortilla", nombre: "Maíz", precio_extra: 0, orden: 0 },
    { id: "o-harina", grupo_id: "g-tortilla", nombre: "Harina", precio_extra: 4, orden: 1 },
  ],
};
```

(mismo cambio en `grupoExtras`: agregar `created_at: new Date().toISOString(), bloqueado_por_plan: false,` antes de `opciones:`).

El objeto compartido `base` (línea 106-113), del que todos los productos de `CATEGORIAS_DEMO` hacen `...base`, gana el campo una sola vez y cubre los 6 productos del fixture:

```ts
const base = {
  tenant_id: "demo-tenant",
  sucursal_id: null,
  activo: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  video_url: null,
  bloqueado_por_plan: false,
};
```

- [ ] **Step 3: Verificar que compila**

Run: `bun run typecheck`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts src/lib/demo.ts
git commit -m "chore(tipos): regenera database.ts con bloqueado_por_plan

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Excluir lo bloqueado del menú público

**Files:**
- Modify: `src/hooks/useMenuPublico.ts:130-174` (queries de `sucursales`, `productos`, `grupos_modificadores` dentro de `armarMenuPublico`)

**Interfaces:**
- Consumes: columna `bloqueado_por_plan` (Task 1/2).
- Produces: ningún tipo nuevo — mismo contrato de `obtenerMenuPublico`, solo cambia qué filas trae.

- [ ] **Step 1: Agregar el filtro a la query de sucursales**

En `src/hooks/useMenuPublico.ts`, la query (alrededor de la línea 130-138):

```ts
  const { data: sucursales, error: errorSuc } = await supabase
    .from("sucursales")
    .select(
      "id, tenant_id, nombre, slug, direccion, telefono, whatsapp, maps_url, google_reviews_url, timezone, activa, created_at, acepta_reservaciones",
    )
    .eq("tenant_id", tenant.id)
    .eq("activa", true)
    .order("created_at")
    .returns<Sucursal[]>();
```

Cambiar a:

```ts
  const { data: sucursales, error: errorSuc } = await supabase
    .from("sucursales")
    .select(
      "id, tenant_id, nombre, slug, direccion, telefono, whatsapp, maps_url, google_reviews_url, timezone, activa, created_at, acepta_reservaciones",
    )
    .eq("tenant_id", tenant.id)
    .eq("activa", true)
    .eq("bloqueado_por_plan", false)
    .order("created_at")
    .returns<Sucursal[]>();
```

- [ ] **Step 2: Agregar el filtro a las queries de productos y grupos_modificadores**

En el mismo archivo, el `Promise.all` (alrededor de la línea 153-174):

```ts
  const [catRes, prodRes, gruposRes, vinculosRes, preciosRes] = await Promise.all([
    supabase.from("categorias").select("*").eq("tenant_id", tenant.id).order("orden"),
    supabase
      .from("productos")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("activo", true)
      .order("orden"),
    supabase
      .from("grupos_modificadores")
      .select("*, opciones:opciones_modificador(*)")
      .eq("tenant_id", tenant.id)
      .order("orden"),
```

Cambiar a:

```ts
  const [catRes, prodRes, gruposRes, vinculosRes, preciosRes] = await Promise.all([
    supabase.from("categorias").select("*").eq("tenant_id", tenant.id).order("orden"),
    supabase
      .from("productos")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("activo", true)
      .eq("bloqueado_por_plan", false)
      .order("orden"),
    supabase
      .from("grupos_modificadores")
      .select("*, opciones:opciones_modificador(*)")
      .eq("tenant_id", tenant.id)
      .eq("bloqueado_por_plan", false)
      .order("orden"),
```

No hay que tocar el filtro de categorías vacías más abajo (`.filter((c) => c.productos.length > 0)`) — ya existe y hace que una categoría que se quedó sin productos visibles desaparezca sola.

- [ ] **Step 3: Verificar que compila**

Run: `bun run typecheck`
Expected: 0 errores.

- [ ] **Step 4: QA manual (no hay test automatizado para hooks de Supabase en este repo)**

En un tenant de prueba con más productos que el límite de su plan (usar el resultado de Task 1's pruebas, o crear datos a mano): abrir `/<slug>` y confirmar que solo aparecen los productos/sucursales/grupos NO bloqueados. Anotar el resultado en el mensaje de commit.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMenuPublico.ts
git commit -m "fix(menu-publico): excluye lo bloqueado por límite de plan

obtenerMenuPublico traía todos los productos/sucursales activos sin
aplicar el límite del plan — con el bloqueo retroactivo ya calculado en
la base (bloqueado_por_plan), solo falta no traerlo aquí.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: El cron de impago vencido baja a Free en vez de suspender

**Files:**
- Modify: `supabase/functions/procesar-trials-vencidos/index.ts:230-254` (sección 3 del cron)

**Interfaces:**
- Consumes: `planFree` (ya resuelto en la sección 2 del mismo archivo, línea 208: `const { data: planFree } = await db.from("planes").select("id").eq("nombre", "free").single();`).
- Produces: nada nuevo — mismo shape de respuesta del cron (`{ ok, avisados, bajados, suspendidos }`), aunque `suspendidos` ahora cuenta bajas a Free, no suspensiones (ver Step 2).

- [ ] **Step 1: Cambiar el update de la sección 3**

En `supabase/functions/procesar-trials-vencidos/index.ts`, localizar:

```ts
  let suspendidos = 0;
  for (const t of enGracia ?? []) {
    const { error } = await db.from("tenants").update({ estado: "suspendido" }).eq("id", t.id);
    if (!error) suspendidos++;
  }
```

Cambiar a:

```ts
  let suspendidos = 0;
  for (const t of enGracia ?? []) {
    if (!planFree) continue;
    const { error } = await db.from("tenants").update({ plan_id: planFree.id }).eq("id", t.id);
    if (!error) suspendidos++;
  }
```

(`suspendidos` se queda como nombre de variable y de campo en la respuesta — renombrarlo es opcional y no lo pide el spec; lo que importa es que ya no escribe `estado: 'suspendido'`.)

- [ ] **Step 2: Actualizar el comentario de la sección 3**

Localizar el bloque de comentario justo arriba (líneas 230-236):

```ts
  // ---- 3. Pago fallido: suspender tras 7 dias de gracia -----------------
  // stripe-webhook pone pago_fallido_desde en el PRIMER past_due/unpaid y lo
  // limpia si el tenant se pone al corriente. Aqui se corta a los que llevan
  // >= 7 dias sin regularizar. La suscripcion de Stripe NO se toca: sigue su
  // propio dunning; si al final Stripe la borra, cae en subscription.deleted
  // -> baja a Free. Ver docs/superpowers/specs/2026-08-27-endurecer-facturacion-design.md
```

Cambiar a:

```ts
  // ---- 3. Pago fallido: baja a Free tras 7 dias de gracia ----------------
  // stripe-webhook pone pago_fallido_desde en el PRIMER past_due/unpaid y lo
  // limpia si el tenant se pone al corriente. Aqui se corta a los que llevan
  // >= 7 dias sin regularizar -- igual que un downgrade manual, NO se
  // suspende el panel (el dueno sigue operando con lo que le cabe en Free).
  // pago_fallido_desde se queda puesto: todavia no ha pagado. Si Stripe
  // logra cobrar despues (sigue reintentando por su cuenta), invoice.paid
  // restaura el plan_id pagado -- ver stripe-webhook. Si al final Stripe
  // cancela la suscripcion del todo, cae en subscription.deleted -> bajarAFree
  // (no-op sobre plan_id, ya esta en Free). Ver
  // docs/superpowers/specs/2026-09-30-bloqueo-retroactivo-limites-design.md
```

- [ ] **Step 3: Verificar que compila**

Las Edge Functions corren en Deno y no forman parte del `tsconfig` que cubre `bun run typecheck` (ese comando solo revisa `src/`). Run: `deno check supabase/functions/procesar-trials-vencidos/index.ts` si el CLI de Deno está instalado; si no, revisión visual del diff basta — es un cambio de una línea sobre un archivo que ya compilaba.
Expected: sin errores de tipos (o diff revisado a mano, confirmando que `planFree.id` es el mismo identificador ya usado en la sección 2 del mismo archivo).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/procesar-trials-vencidos/index.ts
git commit -m "fix(cron): impago vencido baja a Free en vez de suspender

Con el bloqueo retroactivo de límites ya en la base, suspender el panel
entero es más duro de lo necesario -- ahora el corte por gracia vencida
se trata igual que cualquier otro downgrade: baja a Free, el dueño
conserva el panel operando con lo que le cabe.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Desplegar la función**

Vía `mcp__claude_ai_Supabase__deploy_edge_function`, función `procesar-trials-vencidos`, con el contenido actualizado del archivo.

---

## Task 5: `stripe-webhook` restaura el plan pagado si el impago se recupera tarde

**Files:**
- Modify: `supabase/functions/stripe-webhook/index.ts:481-524` (handler `invoice.paid`)

**Interfaces:**
- Consumes: nada de tareas anteriores directamente — depende del comportamiento de Task 4 (la fila `activa` de `suscripciones` nunca se toca cuando el cron fuerza `plan_id=Free`, así que sigue apuntando al plan pagado).
- Produces: nada nuevo — mismo contrato del webhook.

- [ ] **Step 1: Traer `plan_id` en la consulta de `fila`**

En `supabase/functions/stripe-webhook/index.ts`, dentro del `case "invoice.paid":`, localizar:

```ts
        const { data: fila } = await db
          .from("suscripciones")
          .select("id, tenant_id")
          .eq("stripe_subscription_id", suscripcionId)
          .order("fecha_inicio", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!fila) break;
```

Cambiar a:

```ts
        const { data: fila } = await db
          .from("suscripciones")
          .select("id, tenant_id, plan_id")
          .eq("stripe_subscription_id", suscripcionId)
          .order("fecha_inicio", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!fila) break;
```

- [ ] **Step 2: Restaurar `plan_id` si difiere, después del update existente**

Localizar el bloque final del mismo `case` (después del `upsert` a `pagos`):

```ts
        // Pago al corriente: si venia de un fallo, se limpia la gracia y se
        // reactiva el panel. Cubre el caso de que customer.subscription.updated
        // con status 'active' no llegue o llegue despues.
        await db
          .from("tenants")
          .update({ pago_fallido_desde: null, estado: "activo" })
          .eq("id", fila.tenant_id);
        break;
      }
```

Cambiar a:

```ts
        // Pago al corriente: si venia de un fallo, se limpia la gracia y se
        // reactiva el panel. Cubre el caso de que customer.subscription.updated
        // con status 'active' no llegue o llegue despues.
        await db
          .from("tenants")
          .update({ pago_fallido_desde: null, estado: "activo" })
          .eq("id", fila.tenant_id);

        // Recuperacion tardia: si el cron forzo una baja a Free por impago
        // (ver procesar-trials-vencidos), tenants.plan_id quedo por detras de
        // la fila `activa` de suscripciones -- esa fila nunca se toco, sigue
        // apuntando al plan pagado. Si difieren, se restaura. El .neq hace
        // que esto sea un no-op (0 filas) en el caso normal, sin disparar el
        // recalculo de bloqueos de mas en cada renovacion.
        if (fila.plan_id) {
          await db
            .from("tenants")
            .update({ plan_id: fila.plan_id })
            .eq("id", fila.tenant_id)
            .neq("plan_id", fila.plan_id);
        }
        break;
      }
```

- [ ] **Step 3: Verificar que compila**

Run: revisión visual del diff (cambio acotado a un `case` de un `switch`); si Deno está disponible, `deno check supabase/functions/stripe-webhook/index.ts`.
Expected: sin errores de tipos.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "fix(stripe-webhook): invoice.paid restaura el plan si hubo baja forzada

Si el cron bajó a Free por impago vencido y Stripe logra cobrar después
(sigue reintentando por su cuenta), tenants.plan_id se restaura al plan
pagado usando la fila activa de suscripciones como fuente de verdad —
nadie se queda atorado en Free habiendo pagado.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Desplegar la función**

Vía `mcp__claude_ai_Supabase__deploy_edge_function`, función `stripe-webhook`, con el contenido actualizado del archivo.

- [ ] **Step 6: QA manual con el guion de Stripe (modo test)**

Siguiendo `docs/pruebas-stripe-test.md`: en el Paso 4 (gracia vencida), confirmar que ahora el tenant queda con `estado='activo'` y `plan_id` = Free (no `'suspendido'`) y que el panel sigue accesible. Simular una recuperación tardía (pagar la factura pendiente después de que el cron ya bajó el plan) y confirmar que `plan_id` vuelve al plan pagado sin pasar por `/admin/suscripcion` a mano.

---

## Task 6: Helper puro `seBloquearianAlBajar`

**Files:**
- Modify: `src/lib/plan.ts` (agrega la función al final)
- Modify: `src/lib/plan.test.ts` (agrega los tests)

**Interfaces:**
- Consumes: tipo `Plan` de `@/types/database` (ya usado en todo `plan.ts`).
- Produces: `seBloquearianAlBajar(uso, planNuevo): { productos: number; sucursales: number; usuarios: number; gruposModificadores: number }` — lo consume Task 9 (`Suscripcion.tsx`).

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/lib/plan.test.ts` (después del último `describe`, antes del cierre del archivo):

```ts
describe("qué se bloquearía al bajar de plan", () => {
  test("nada se bloquea si todo cabe en el plan nuevo", () => {
    const nuevo = plan({ limite_productos: 20, limite_sucursales: 1, limite_usuarios: 1, permite_multiusuario: false, limite_grupos_modificadores: 2 });
    const resultado = seBloquearianAlBajar(
      { productos: 10, sucursales: 1, usuarios: 1, gruposModificadores: 2 },
      nuevo,
    );
    expect(resultado).toEqual({ productos: 0, sucursales: 0, usuarios: 0, gruposModificadores: 0 });
  });

  test("cuenta el exceso exacto de productos y sucursales", () => {
    const nuevo = plan({ limite_productos: 20, limite_sucursales: 1, limite_usuarios: 1, permite_multiusuario: false, limite_grupos_modificadores: 2 });
    const resultado = seBloquearianAlBajar(
      { productos: 35, sucursales: 3, usuarios: 1, gruposModificadores: 2 },
      nuevo,
    );
    expect(resultado.productos).toBe(15);
    expect(resultado.sucursales).toBe(2);
  });

  test("un plan ilimitado (null) nunca bloquea nada", () => {
    const nuevo = plan({ limite_productos: null, limite_sucursales: null, limite_usuarios: null, permite_multiusuario: true, limite_grupos_modificadores: null });
    const resultado = seBloquearianAlBajar(
      { productos: 500, sucursales: 20, usuarios: 10, gruposModificadores: 50 },
      nuevo,
    );
    expect(resultado).toEqual({ productos: 0, sucursales: 0, usuarios: 0, gruposModificadores: 0 });
  });

  test("si el plan nuevo no permite multiusuario, todos los encargados se bloquean", () => {
    const free = plan({ permite_multiusuario: false, limite_usuarios: 1 });
    // usuarios: 3 = 1 owner + 2 encargados
    const resultado = seBloquearianAlBajar(
      { productos: 0, sucursales: 0, usuarios: 3, gruposModificadores: 0 },
      free,
    );
    expect(resultado.usuarios).toBe(2);
  });

  test("el owner nunca cuenta como bloqueable, incluso con 1 solo usuario", () => {
    const free = plan({ permite_multiusuario: false, limite_usuarios: 1 });
    const resultado = seBloquearianAlBajar(
      { productos: 0, sucursales: 0, usuarios: 1, gruposModificadores: 0 },
      free,
    );
    expect(resultado.usuarios).toBe(0);
  });

  test("con multiusuario permitido, limite_usuarios cuenta owner + encargados", () => {
    // Basic: limite_usuarios 3 = 1 owner + 2 encargados caben.
    const basic = plan({ permite_multiusuario: true, limite_usuarios: 3 });
    const resultado = seBloquearianAlBajar(
      { productos: 0, sucursales: 0, usuarios: 5, gruposModificadores: 0 }, // 1 owner + 4 encargados
      basic,
    );
    expect(resultado.usuarios).toBe(2); // 4 encargados - 2 que caben = 2 bloqueados
  });
});
```

Y agregar `seBloquearianAlBajar` a los imports de `@/lib/plan` al inicio del archivo.

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `bun test src/lib/plan.test.ts`
Expected: FAIL — `seBloquearianAlBajar is not defined` (o error de import).

- [ ] **Step 3: Implementar la función**

Agregar al final de `src/lib/plan.ts`:

```ts
/* ── Bloqueo retroactivo de límites (migración 020) ────────────────── */

export type UsoDelTenant = {
  productos: number;
  sucursales: number;
  usuarios: number;
  gruposModificadores: number;
};

/**
 * Cuántos de cada tipo se bloquearían si el tenant bajara AHORA al plan dado,
 * con el mismo criterio de corte que `recalcular_bloqueos_plan` en la base:
 * los más antiguos sobreviven, el exceso se bloquea. Para el aviso previo en
 * el flujo de downgrade — el bloqueo real siempre lo hace el trigger.
 */
export function seBloquearianAlBajar(
  uso: UsoDelTenant,
  planNuevo: Pick<
    Plan,
    "limite_productos" | "limite_sucursales" | "limite_usuarios" | "permite_multiusuario" | "limite_grupos_modificadores"
  >,
): UsoDelTenant {
  const exceso = (limite: number | null, usados: number) =>
    limite === null ? 0 : Math.max(0, usados - limite);

  const encargados = Math.max(0, uso.usuarios - 1); // -1: el owner nunca se bloquea
  const cupoEncargados =
    planNuevo.limite_usuarios === null ? null : Math.max(0, planNuevo.limite_usuarios - 1);
  const usuariosBloqueados = !planNuevo.permite_multiusuario
    ? encargados
    : exceso(cupoEncargados, encargados);

  return {
    productos: exceso(planNuevo.limite_productos, uso.productos),
    sucursales: exceso(planNuevo.limite_sucursales, uso.sucursales),
    usuarios: usuariosBloqueados,
    gruposModificadores: exceso(planNuevo.limite_grupos_modificadores, uso.gruposModificadores),
  };
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `bun test src/lib/plan.test.ts`
Expected: PASS, todos los tests nuevos en verde.

- [ ] **Step 5: Correr la suite completa**

Run: `bun test src/lib --run`
Expected: 234 tests pasando (228 + 6 nuevos), 0 fail.

- [ ] **Step 6: Commit**

```bash
git add src/lib/plan.ts src/lib/plan.test.ts
git commit -m "feat(plan): helper puro seBloquearianAlBajar

Mismo criterio de corte que recalcular_bloqueos_plan en la base (los más
antiguos sobreviven), para el aviso previo en el flujo de downgrade de
Suscripcion.tsx. El bloqueo real lo sigue haciendo el trigger.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: `useUsoDelTenant` cuenta también los bloqueados

**Files:**
- Modify: `src/hooks/useTenantActual.ts:59-90` (`useUsoDelTenant`)

**Interfaces:**
- Consumes: columna `bloqueado_por_plan` (Task 1/2).
- Produces: `useUsoDelTenant` ahora resuelve `{ productos, sucursales, usuarios, gruposModificadores, productosBloqueados, sucursalesBloqueadas, usuariosBloqueados, gruposBloqueados }` — lo consumen Task 8 (candados) y Task 10 (SuperAdminDetalle).

- [ ] **Step 1: Extender la función**

En `src/hooks/useTenantActual.ts`, reemplazar:

```ts
export function useUsoDelTenant(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["uso-tenant", tenantId],
    enabled: Boolean(tenantId),
    staleTime: 10_000,
    queryFn: async () => {
      const contar = async (
        tabla: "productos" | "sucursales" | "tenant_usuarios" | "grupos_modificadores",
      ) => {
        const { count, error } = await supabase
          .from(tabla)
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId!);
        if (error) throw error;
        return count ?? 0;
      };

      const [productos, sucursales, usuarios, gruposModificadores] = await Promise.all([
        contar("productos"),
        contar("sucursales"),
        contar("tenant_usuarios"),
        contar("grupos_modificadores"),
      ]);

      return { productos, sucursales, usuarios, gruposModificadores };
    },
  });
}
```

con:

```ts
type TablaConLimite = "productos" | "sucursales" | "tenant_usuarios" | "grupos_modificadores";

/**
 * Conteos de uso del tenant, para pintar "2 de 3 sucursales" y deshabilitar
 * botones antes de que el trigger reviente. Usa head:true: cuenta sin traer filas.
 * Los *Bloqueados son lo que recalcular_bloqueos_plan (migración 020) ya marcó
 * bloqueado_por_plan=true — para el candado en las listas del panel.
 */
export function useUsoDelTenant(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["uso-tenant", tenantId],
    enabled: Boolean(tenantId),
    staleTime: 10_000,
    queryFn: async () => {
      const contar = async (tabla: TablaConLimite, soloBloqueados = false) => {
        let query = supabase
          .from(tabla)
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId!);
        if (soloBloqueados) query = query.eq("bloqueado_por_plan", true);
        const { count, error } = await query;
        if (error) throw error;
        return count ?? 0;
      };

      const [
        productos,
        sucursales,
        usuarios,
        gruposModificadores,
        productosBloqueados,
        sucursalesBloqueadas,
        usuariosBloqueados,
        gruposBloqueados,
      ] = await Promise.all([
        contar("productos"),
        contar("sucursales"),
        contar("tenant_usuarios"),
        contar("grupos_modificadores"),
        contar("productos", true),
        contar("sucursales", true),
        contar("tenant_usuarios", true),
        contar("grupos_modificadores", true),
      ]);

      return {
        productos,
        sucursales,
        usuarios,
        gruposModificadores,
        productosBloqueados,
        sucursalesBloqueadas,
        usuariosBloqueados,
        gruposBloqueados,
      };
    },
  });
}
```

- [ ] **Step 2: Verificar que compila**

Run: `bun run typecheck`
Expected: 0 errores. (`SuperAdminDetalle.tsx` ya consume `uso.productos` etc. de este hook — los campos nuevos son aditivos, no rompen nada existente.)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTenantActual.ts
git commit -m "feat(hooks): useUsoDelTenant cuenta también lo bloqueado por plan

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Candado en Menu.tsx, Sucursales.tsx y Equipo.tsx

**Files:**
- Modify: `src/pages/admin/Menu.tsx:360-426` (lista de productos)
- Modify: `src/pages/admin/Sucursales.tsx:82-137` (lista de sucursales)
- Modify: `src/pages/admin/Equipo.tsx:44-119` (`Tabla`, tipo `MiembroEquipo`)
- Modify: `src/hooks/useEquipo.ts:5-12` (tipo `MiembroEquipo`)

**Interfaces:**
- Consumes: `Producto.bloqueado_por_plan`, `Sucursal.bloqueado_por_plan` (Task 2); `equipo_del_tenant` ahora devuelve `bloqueado_por_plan` (Task 1).
- Produces: nada que otra tarea consuma — es la última capa visual.

- [ ] **Step 1: `Menu.tsx` — candado por producto**

En `src/pages/admin/Menu.tsx`, dentro del `<li>` de cada producto (líneas 366-423), el bloque `<div className="pointer-events-none relative min-w-0 flex-1">` gana, justo antes del cierre `</div>` (después del `<label data-tour="carta-activo-borrador">...</label>`), lo siguiente:

```tsx
                      {p.bloqueado_por_plan && (
                        <p className="mt-2 flex items-center gap-1 text-xs text-vm-warning">
                          <Lock className="size-3 shrink-0" aria-hidden />
                          Bloqueado por tu plan actual
                        </p>
                      )}
```

`Lock` ya está importado en este archivo (línea 4). También, en el `<li>` mismo, agregar `p.bloqueado_por_plan && "opacity-60"` a la clase existente:

```tsx
                    className="group relative flex gap-3 rounded-xl border p-3 transition-colors hover:border-vm-primary/40 hover:bg-vm-bg-soft/50"
```

cambia a:

```tsx
                    className={cn(
                      "group relative flex gap-3 rounded-xl border p-3 transition-colors hover:border-vm-primary/40 hover:bg-vm-bg-soft/50",
                      p.bloqueado_por_plan && "opacity-60",
                    )}
```

(`cn` ya está importado, línea 25.) El botón de editar (`absolute inset-0` que abre `EditorProducto`) no se toca — sigue habilitado, el bloqueo no restringe edición de contenido.

- [ ] **Step 2: `Sucursales.tsx` — candado por sucursal**

En `src/pages/admin/Sucursales.tsx`, agregar `Lock` y `cn` a los imports:

```tsx
import { ExternalLink, Lock, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
```

y

```tsx
import { cn } from "@/lib/utils";
```

En el `<li>` de cada sucursal (línea 84):

```tsx
            <li key={s.id} className="flex flex-col rounded-xl border p-4">
```

cambia a:

```tsx
            <li
              key={s.id}
              className={cn(
                "flex flex-col rounded-xl border p-4",
                s.bloqueado_por_plan && "opacity-60",
              )}
            >
```

Y justo después del bloque de `timezone` (después de la línea con `<span className="rounded-full bg-vm-bg-soft px-2 py-0.5">{s.timezone}</span>` y su `</p>` de cierre), agregar:

```tsx
                  {s.bloqueado_por_plan && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-vm-warning">
                      <Lock className="size-3 shrink-0" aria-hidden />
                      Bloqueada por tu plan actual
                    </p>
                  )}
```

El botón "Editar sucursal" no se toca — sigue habilitado.

- [ ] **Step 3: `useEquipo.ts` — el tipo `MiembroEquipo` gana el campo**

En `src/hooks/useEquipo.ts`:

```ts
export type MiembroEquipo = {
  user_id: string;
  email: string;
  /* Migración 011 — de raw_user_meta_data: null para quien entró con email/password. */
  nombre: string | null;
  avatar_url: string | null;
  rol: RolUsuario;
  created_at: string;
};
```

cambia a:

```ts
export type MiembroEquipo = {
  user_id: string;
  email: string;
  /* Migración 011 — de raw_user_meta_data: null para quien entró con email/password. */
  nombre: string | null;
  avatar_url: string | null;
  rol: RolUsuario;
  created_at: string;
  /* Migración 020 — true si el plan actual ya no permite este asiento. */
  bloqueado_por_plan: boolean;
};
```

Y en el fixture `EJEMPLO` de `Equipo.tsx` (líneas 25-42), agregar `bloqueado_por_plan: false` a los dos objetos.

- [ ] **Step 4: `Equipo.tsx` — candado por encargado bloqueado**

En la función `Tabla` (`src/pages/admin/Equipo.tsx`), dentro del `.map((m) => {...})` (línea 67), la celda del nombre (líneas 71-86):

```tsx
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <AvatarUsuario nombre={m.nombre || m.email} avatarUrl={m.avatar_url} />
                    <div className="min-w-0">
                      <p className="truncate text-vm-ink">
                        {m.nombre || m.email}
                        {m.user_id === userIdActual && (
                          <span className="ml-2 rounded-full bg-vm-bg-soft px-2 py-0.5 text-[11px] text-vm-body">
                            Tú
                          </span>
                        )}
                      </p>
                      {m.nombre && <p className="truncate text-xs text-vm-body">{m.email}</p>}
                    </div>
                  </div>
                </td>
```

cambia a:

```tsx
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <AvatarUsuario nombre={m.nombre || m.email} avatarUrl={m.avatar_url} />
                    <div className="min-w-0">
                      <p className="truncate text-vm-ink">
                        {m.nombre || m.email}
                        {m.user_id === userIdActual && (
                          <span className="ml-2 rounded-full bg-vm-bg-soft px-2 py-0.5 text-[11px] text-vm-body">
                            Tú
                          </span>
                        )}
                      </p>
                      {m.nombre && <p className="truncate text-xs text-vm-body">{m.email}</p>}
                      {m.bloqueado_por_plan && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-vm-warning">
                          <Lock className="size-3 shrink-0" aria-hidden />
                          Sin acceso — sube de plan para reactivarlo
                        </p>
                      )}
                    </div>
                  </div>
                </td>
```

`Equipo.tsx` no importa `cn` todavía — agregar `import { cn } from "@/lib/utils";` al bloque de imports. Luego cambiar la fila:

```tsx
              <tr key={m.user_id} className="border-t">
```

por:

```tsx
              <tr key={m.user_id} className={cn("border-t", m.bloqueado_por_plan && "opacity-60")}>
```

El texto es distinto al de productos/sucursales a propósito ("Sin acceso", no "Bloqueado") — para un encargado es pérdida de acceso, no solo de visibilidad.

- [ ] **Step 5: Verificar que compila**

Run: `bun run typecheck`
Expected: 0 errores.

- [ ] **Step 6: QA manual**

Con datos de prueba de Task 1 (o creando un tenant de prueba con excedente real): confirmar visualmente que las 3 páginas muestran el candado correcto, que los botones de editar en Menu/Sucursales siguen funcionando sobre un ítem bloqueado, y que un encargado bloqueado no aparece con opción de quitar duplicada ni rompe el layout.

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/Menu.tsx src/pages/admin/Sucursales.tsx src/pages/admin/Equipo.tsx src/hooks/useEquipo.ts
git commit -m "feat(panel): candado visual para lo bloqueado por plan

Productos y sucursales bloqueados quedan atenuados con candado y motivo,
pero siguen editables. Un encargado bloqueado se marca como 'sin acceso'
en vez de solo 'bloqueado' — para él es pérdida de acceso, no de visibilidad.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Aviso previo al bajar de plan en `Suscripcion.tsx`

**Files:**
- Modify: `src/pages/admin/Suscripcion.tsx` (import, hook de uso, estado nuevo, botón de cambio de plan, diálogo de confirmación)

**Interfaces:**
- Consumes: `seBloquearianAlBajar` (Task 6), `useUsoDelTenant` (Task 7), `DialogoConfirmar` (ya existe, usado en `Menu.tsx`/`Sucursales.tsx`).
- Produces: nada que otra tarea consuma.

- [ ] **Step 1: Imports**

En `src/pages/admin/Suscripcion.tsx`, el bloque de imports actual (líneas 1-25) es:

```ts
import { useEffect, useState } from "react";
import { ExternalLink, Info, Loader2 } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import PillTabs, { PESTANAS_NEGOCIO } from "@/components/layout/PillTabs";
import { useTenantActual } from "@/hooks/useTenantActual";
import { usePlanes } from "@/hooks/usePlanes";
import { useCheckout, usePortalStripe } from "@/hooks/useStripe";
import { trackEvent } from "@/lib/analytics";
import { suscripcionActiva, useHistorialSuscripciones } from "@/hooks/useSuscripciones";
import type { SuscripcionConPlan } from "@/hooks/useSuscripciones";
import { usePagos } from "@/hooks/usePagos";
import { useDatosFiscales, useGuardarDatosFiscales } from "@/hooks/useDatosFiscales";
import type { DatosFiscales as DatosFiscalesTipo, Pago } from "@/types/database";
import { formatearPrecio, porcentajeAhorroAnual, precioDelPlan, textoLimite } from "@/lib/plan";
import { BOTONES, FACTURACION, PRECIOS } from "@/lib/copy";
import { codigoPostalValido, REGIMENES_FISCALES, rfcValido, USOS_CFDI } from "@/lib/facturacion";
import { traducirError } from "@/lib/errores";
import { avisarExito } from "@/lib/avisos";
import {
  NOMBRE_PLAN,
  type EstadoSuscripcion,
  type IntervaloCobro,
  type MonedaCobro,
  type MotivoCambio,
  type NombrePlan,
} from "@/types/database";
import { cn } from "@/lib/utils";
```

Cambiar 4 líneas puntuales:

```ts
import { useTenantActual } from "@/hooks/useTenantActual";
```
→
```ts
import { useTenantActual, useUsoDelTenant } from "@/hooks/useTenantActual";
```

```ts
import type { DatosFiscales as DatosFiscalesTipo, Pago } from "@/types/database";
```
→
```ts
import type { DatosFiscales as DatosFiscalesTipo, Pago, Plan } from "@/types/database";
```

```ts
import { formatearPrecio, porcentajeAhorroAnual, precioDelPlan, textoLimite } from "@/lib/plan";
```
→
```ts
import {
  formatearPrecio,
  porcentajeAhorroAnual,
  precioDelPlan,
  seBloquearianAlBajar,
  textoLimite,
} from "@/lib/plan";
```

Y agregar, junto a los demás imports de componentes:

```ts
import { DialogoConfirmar } from "@/components/ui/dialogo";
```

- [ ] **Step 2: Hook de uso y estado del diálogo pendiente**

`useUsoDelTenant` debe llamarse ANTES del `if (!ctx) return null;` (línea 340), igual que los demás hooks de este componente — llamar un hook después de un `return` condicional rompe las Rules of Hooks. El patrón ya existe en este mismo archivo (`usePagos(ctx?.tenant.id, ...)`, `useDatosFiscales(ctx?.tenant.id, ...)` — ambos usan `ctx?.tenant.id` con optional chaining porque en el primer render `ctx` todavía es `undefined`).

Dentro de `function Contenido()`, junto a esos hooks (después de `const { data: pagos } = usePagos(ctx?.tenant.id, ctx?.esOwner ?? false);`):

```ts
  const { data: uso } = useUsoDelTenant(ctx?.tenant.id);
```

Junto a los demás `useState` (cerca de `const [errorCheckout, setErrorCheckout] = useState<string | null>(null);`):

```ts
  const [planABajar, setPlanABajar] = useState<Plan | null>(null);
```

- [ ] **Step 3: Interceptar el click en "Cambiar a este plan"**

Localizar el botón dentro del `.map` de planes:

```tsx
              <button
                type="button"
                disabled={esActual || sinStripe || checkout.isPending}
                onClick={() => {
                  setErrorCheckout(null);
                  checkout
                    .mutateAsync({ tenantId: tenant.id, planId: p.id, moneda, intervalo })
                    .catch((e: Error) => setErrorCheckout(e.message));
                }}
                title={sinStripe ? "Falta configurar Stripe para este plan." : undefined}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-xs font-medium text-white hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checkout.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                {esActual ? "Tu plan actual" : "Cambiar a este plan"}
              </button>
```

cambia a:

```tsx
              <button
                type="button"
                disabled={esActual || sinStripe || checkout.isPending}
                onClick={() => {
                  setErrorCheckout(null);
                  const bloqueos = uso
                    ? seBloquearianAlBajar(
                        {
                          productos: uso.productos,
                          sucursales: uso.sucursales,
                          usuarios: uso.usuarios,
                          gruposModificadores: uso.gruposModificadores,
                        },
                        p,
                      )
                    : { productos: 0, sucursales: 0, usuarios: 0, gruposModificadores: 0 };
                  const hayBloqueos = Object.values(bloqueos).some((n) => n > 0);
                  if (hayBloqueos) {
                    setPlanABajar(p);
                  } else {
                    checkout
                      .mutateAsync({ tenantId: tenant.id, planId: p.id, moneda, intervalo })
                      .catch((e: Error) => setErrorCheckout(e.message));
                  }
                }}
                title={sinStripe ? "Falta configurar Stripe para este plan." : undefined}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-xs font-medium text-white hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checkout.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                {esActual ? "Tu plan actual" : "Cambiar a este plan"}
              </button>
```

- [ ] **Step 4: El diálogo de confirmación**

Agregar, junto a los demás elementos de cierre del componente (cerca del `{errorCheckout && (...)}` existente, antes del cierre del fragment `</>`):

```tsx
      <DialogoConfirmar
        abierto={planABajar !== null}
        titulo={`¿Cambiar a ${planABajar ? NOMBRE_PLAN[planABajar.nombre as NombrePlan] : ""}?`}
        mensaje={(() => {
          if (!planABajar || !uso) return "";
          const b = seBloquearianAlBajar(
            {
              productos: uso.productos,
              sucursales: uso.sucursales,
              usuarios: uso.usuarios,
              gruposModificadores: uso.gruposModificadores,
            },
            planABajar,
          );
          const partes: string[] = [];
          if (b.productos > 0) partes.push(`${b.productos} productos`);
          if (b.sucursales > 0) partes.push(`${b.sucursales} sucursales`);
          if (b.usuarios > 0) partes.push(`${b.usuarios} usuarios`);
          if (b.gruposModificadores > 0) partes.push(`${b.gruposModificadores} grupos de modificadores`);
          return `Con este plan se bloquearán: ${partes.join(", ")}. No se borra nada — vuelven a estar disponibles en cuanto subas de plan.`;
        })()}
        textoConfirmar="Cambiar de plan"
        destructivo={false}
        alConfirmar={() => {
          if (!planABajar) return;
          setErrorCheckout(null);
          checkout
            .mutateAsync({ tenantId: tenant.id, planId: planABajar.id, moneda, intervalo })
            .catch((e: Error) => setErrorCheckout(e.message));
          setPlanABajar(null);
        }}
        alCancelar={() => setPlanABajar(null)}
      />
```

`destructivo={false}` quita el triángulo de advertencia rojo que `DialogoConfirmar` muestra por defecto (pensado para borrados) — cambiar de plan no es una acción destructiva.

- [ ] **Step 5: Verificar que compila**

Run: `bun run typecheck`
Expected: 0 errores.

- [ ] **Step 6: QA manual**

Con un tenant de prueba en Pro con excedente sobre Free/Basic: hacer clic en "Cambiar a este plan" hacia un plan menor y confirmar que aparece el diálogo con el resumen correcto antes de disparar el checkout. Hacer clic en un upgrade (o un downgrade sin excedente) y confirmar que va directo a checkout sin diálogo, como hoy.

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/Suscripcion.tsx
git commit -m "feat(suscripcion): aviso previo de lo que se bloquearía al bajar de plan

Antes de mandar a Stripe Checkout un downgrade que dejaría algo por
encima del límite del plan nuevo, se muestra un resumen de qué se
bloquearía. Sin resumen no hay diálogo -- upgrades y downgrades sin
excedente van directo a checkout, como hoy.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Visibilidad de lo bloqueado en `/superadmin`

**Files:**
- Modify: `src/pages/SuperAdminDetalle.tsx:61-78` (`FilaUso`), `:271-298` (bloque "Uso contra su plan")

**Interfaces:**
- Consumes: campos `*Bloqueados`/`*Bloqueadas` de `useUsoDelTenant` (Task 7).
- Produces: nada que otra tarea consuma — última tarea del plan.

- [ ] **Step 1: `FilaUso` gana un prop opcional `bloqueados`**

En `src/pages/SuperAdminDetalle.tsx`:

```tsx
function FilaUso({
  etiqueta,
  usados,
  limite,
}: {
  etiqueta: string;
  usados: number;
  limite: number | null;
}) {
  return (
    <div className="flex items-center justify-between border-t py-2.5 text-sm first:border-t-0 first:pt-0">
      <span className="text-vm-body">{etiqueta}</span>
      <span className="vm-data text-vm-ink">
        {limite === null ? `${usados}` : `${usados} de ${limite}`}
      </span>
    </div>
  );
}
```

cambia a:

```tsx
function FilaUso({
  etiqueta,
  usados,
  limite,
  bloqueados,
}: {
  etiqueta: string;
  usados: number;
  limite: number | null;
  bloqueados?: number;
}) {
  return (
    <div className="flex items-center justify-between border-t py-2.5 text-sm first:border-t-0 first:pt-0">
      <span className="text-vm-body">{etiqueta}</span>
      <span className="flex items-center gap-2">
        <span className="vm-data text-vm-ink">
          {limite === null ? `${usados}` : `${usados} de ${limite}`}
        </span>
        {Boolean(bloqueados) && (
          <span className="rounded-full bg-vm-warning-soft px-2 py-0.5 text-[11px] font-medium text-vm-warning">
            {bloqueados} bloqueado{bloqueados === 1 ? "" : "s"}
          </span>
        )}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Pasar los conteos de bloqueados en cada `FilaUso`**

```tsx
              <Bloque titulo="Uso contra su plan">
                {uso ? (
                  <div>
                    <FilaUso
                      etiqueta="Productos"
                      usados={uso.productos}
                      limite={detalle.plan?.limite_productos ?? null}
                    />
                    <FilaUso
                      etiqueta="Sucursales"
                      usados={uso.sucursales}
                      limite={detalle.plan?.limite_sucursales ?? null}
                    />
                    <FilaUso
                      etiqueta="Usuarios"
                      usados={uso.usuarios}
                      limite={detalle.plan?.limite_usuarios ?? null}
                    />
                    <FilaUso
                      etiqueta="Grupos de modificadores"
                      usados={uso.gruposModificadores}
                      limite={detalle.plan?.limite_grupos_modificadores ?? null}
                    />
                  </div>
                ) : (
                  <div className="h-24 animate-pulse rounded-lg bg-vm-bg-soft" />
                )}
              </Bloque>
```

cambia a:

```tsx
              <Bloque titulo="Uso contra su plan">
                {uso ? (
                  <div>
                    <FilaUso
                      etiqueta="Productos"
                      usados={uso.productos}
                      limite={detalle.plan?.limite_productos ?? null}
                      bloqueados={uso.productosBloqueados}
                    />
                    <FilaUso
                      etiqueta="Sucursales"
                      usados={uso.sucursales}
                      limite={detalle.plan?.limite_sucursales ?? null}
                      bloqueados={uso.sucursalesBloqueadas}
                    />
                    <FilaUso
                      etiqueta="Usuarios"
                      usados={uso.usuarios}
                      limite={detalle.plan?.limite_usuarios ?? null}
                      bloqueados={uso.usuariosBloqueados}
                    />
                    <FilaUso
                      etiqueta="Grupos de modificadores"
                      usados={uso.gruposModificadores}
                      limite={detalle.plan?.limite_grupos_modificadores ?? null}
                      bloqueados={uso.gruposBloqueados}
                    />
                  </div>
                ) : (
                  <div className="h-24 animate-pulse rounded-lg bg-vm-bg-soft" />
                )}
              </Bloque>
```

- [ ] **Step 3: Verificar que compila**

Run: `bun run typecheck`
Expected: 0 errores.

- [ ] **Step 4: QA manual**

Abrir `/superadmin/<tenant-de-prueba-con-excedente>` y confirmar que el badge "N bloqueado(s)" aparece junto a la fila correspondiente, y no aparece en tenants sin excedente.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SuperAdminDetalle.tsx
git commit -m "feat(superadmin): muestra cuántos recursos están bloqueados por plan

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Cierre: verificación final y merge

- [ ] **Step 1: Suite completa + build**

Run: `bun run test -- --run && bun run typecheck && bun run build`
Expected: 234 tests pasando, 0 errores de tipos, build exitoso.

- [ ] **Step 2: Revisión final**

Usar `superpowers:requesting-code-review` sobre el diff completo de la rama antes de proponer el merge a `main`.

- [ ] **Step 3: Merge**

Seguir `superpowers:finishing-a-development-branch` — merge `--no-ff` a `main`, borrar la rama `worktree-bloqueo-limites-plan`, y salir del worktree con `ExitWorktree` (`action: "remove"` una vez el merge esté confirmado en `main`).

- [ ] **Step 4: Actualizar memoria del proyecto**

Registrar en la memoria de auto-memory (tipo `project`) que el bloqueo retroactivo de límites quedó implementado y mergeado, con la fecha y el hash del merge — mismo patrón que las entregas anteriores de este proyecto.
