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
-- security definer de abajo. Sin esto, cualquier miembro del tenant podria
-- desbloquearse con un update directo desde el cliente (las policies
-- *_write_miembros son "for all" a nivel de fila, no de columna).
--
-- `authenticated` ya tiene UPDATE a nivel de TABLA en estas 4 tablas (grant
-- heredado del setup inicial). Un `revoke update (columna)` no alcanza ahí:
-- en Postgres un revoke de columna no resta privilegios de un grant de tabla
-- completa ya existente — has_column_privilege() sigue devolviendo true.
-- Mismo problema ya resuelto para `tenants` mas abajo en vibemenu_schema.sql:
-- hay que revocar la tabla completa y volver a otorgar columna por columna,
-- excluyendo bloqueado_por_plan. La lista de abajo es exactamente el resto
-- de columnas de cada tabla — ningun privilegio previo se pierde, solo se
-- cierra el nuevo.
revoke update on productos from authenticated;
grant update (
  tenant_id, categoria_id, sucursal_id, nombre, descripcion, precio,
  imagen_url, video_url, activo, orden, created_at, updated_at
) on productos to authenticated;

revoke update on sucursales from authenticated;
grant update (
  tenant_id, nombre, slug, direccion, telefono, whatsapp, timezone, activa,
  created_at, maps_url, google_reviews_url, acepta_reservaciones, reservaciones_email
) on sucursales to authenticated;

revoke update on tenant_usuarios from authenticated;
grant update (tenant_id, user_id, rol, created_at) on tenant_usuarios to authenticated;

revoke update on grupos_modificadores from authenticated;
grant update (
  tenant_id, nombre, tipo_seleccion, obligatorio, min_selecciones, max_selecciones,
  orden, created_at
) on grupos_modificadores to authenticated;

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
