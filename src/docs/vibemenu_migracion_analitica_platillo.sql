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
