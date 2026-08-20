-- ============================================================================
--  VIBEMENU — migracion 007: redes sociales + visitas al menu
--
--  1. Cuatro enlaces en `tenants` (Facebook, Instagram, TikTok, resenas de
--     Google). Se pintan en la cabecera del menu con los colores del tema.
--
--  2. `visitas_menu`: cuantas veces se abrio el menu, por dia y por sucursal.
--     NO se guarda una fila por visita — eso crece sin techo y no aporta nada.
--     Se guarda un contador por (tenant, sucursal, dia) y se incrementa.
--
--     El comensal no tiene sesion, asi que no puede escribir en la tabla. El
--     unico camino es la funcion `registrar_visita`, SECURITY DEFINER, que
--     valida que la sucursal sea del tenant antes de contar.
--
--  Ejecutar COMPLETO en el SQL Editor. Va en una transaccion.
--  Requiere el schema base y la migracion 004 aplicados.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Redes sociales del negocio
-- ---------------------------------------------------------------------------
-- Van en `tenants` y no en `sucursales`: una cafeteria tiene UN Instagram,
-- aunque tenga cinco locales. El mapa si es por sucursal (`sucursales.maps_url`).

alter table tenants
  add column facebook_url       text,
  add column instagram_url      text,
  add column tiktok_url         text,
  add column google_reviews_url text;

-- `update` esta revocado en la tabla entera para `authenticated` (ver seccion de
-- privilegios): cada columna editable se concede a mano. Sin esto, guardar falla.
grant update (facebook_url, instagram_url, tiktok_url, google_reviews_url)
  on tenants to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Visitas al menu
-- ---------------------------------------------------------------------------

create table visitas_menu (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  -- null = el menu general del negocio, sin sucursal en la ruta.
  sucursal_id uuid references sucursales(id) on delete cascade,
  dia         date not null,
  visitas     integer not null default 0 check (visitas >= 0)
);

/*
 * Dos indices unicos parciales en vez de una PK compuesta.
 *
 * En una PK, `sucursal_id` nulo no colisiona consigo mismo (null <> null), asi
 * que el menu general insertaria una fila nueva en cada visita. Postgres 15 trae
 * `nulls not distinct`, pero esto funciona en cualquier version y ademas le da a
 * cada caso su propio indice.
 */
create unique index uq_visitas_menu_sucursal
  on visitas_menu (tenant_id, sucursal_id, dia) where sucursal_id is not null;

create unique index uq_visitas_menu_general
  on visitas_menu (tenant_id, dia) where sucursal_id is null;

create index idx_visitas_menu_tenant_dia on visitas_menu (tenant_id, dia desc);

alter table visitas_menu enable row level security;

-- Los numeros son del negocio. No hay policy de insert ni de update: nadie
-- escribe directo, ni siquiera el owner. Solo `registrar_visita`.
create policy "visitas_menu_select_miembros" on visitas_menu for select
  to authenticated using (pertenece_a_tenant(tenant_id));

revoke all on visitas_menu from anon, authenticated;
grant select on visitas_menu to authenticated;

/*
 * Incrementa el contador del dia. Silenciosa a proposito: si el tenant no
 * existe, o la sucursal es de otro negocio, no cuenta y no revienta. Un menu
 * publico jamas debe romperse por una metrica.
 *
 * El dia se calcula con la zona horaria de la sucursal (o la de la primera
 * sucursal del tenant). Con `current_date` a secas, un negocio en Mexico veria
 * las visitas de las 18:00 contadas en el dia siguiente, que es UTC.
 */
create or replace function registrar_visita(p_tenant_id uuid, p_sucursal_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz  text;
  v_dia date;
begin
  if not exists (select 1 from tenants t where t.id = p_tenant_id) then
    return;
  end if;

  if p_sucursal_id is not null then
    if not exists (
      select 1 from sucursales s
       where s.id = p_sucursal_id and s.tenant_id = p_tenant_id
    ) then
      return;
    end if;
  end if;

  select s.timezone into v_tz
    from sucursales s
   where s.tenant_id = p_tenant_id
     and (p_sucursal_id is null or s.id = p_sucursal_id)
   order by s.created_at
   limit 1;

  v_dia := (now() at time zone coalesce(v_tz, 'UTC'))::date;

  if p_sucursal_id is null then
    insert into visitas_menu (tenant_id, sucursal_id, dia, visitas)
    values (p_tenant_id, null, v_dia, 1)
    on conflict (tenant_id, dia) where sucursal_id is null
    do update set visitas = visitas_menu.visitas + 1;
  else
    insert into visitas_menu (tenant_id, sucursal_id, dia, visitas)
    values (p_tenant_id, p_sucursal_id, v_dia, 1)
    on conflict (tenant_id, sucursal_id, dia) where sucursal_id is not null
    do update set visitas = visitas_menu.visitas + 1;
  end if;
end;
$$;

-- `revoke ... from public` no le quita el EXECUTE que Supabase concede explicito
-- a `anon` y `authenticated`. Aqui si los queremos: el comensal no tiene sesion.
revoke execute on function registrar_visita(uuid, uuid) from public;
grant execute on function registrar_visita(uuid, uuid) to anon, authenticated;

commit;

-- ============================================================================
--  Verificar:
--
--    select column_name from information_schema.columns
--     where table_name = 'tenants'
--       and column_name in ('facebook_url','instagram_url','tiktok_url','google_reviews_url');
--    -- 4 filas
--
--    select has_column_privilege('authenticated', 'tenants', 'instagram_url', 'update');
--    -- t
--
--    -- Cuenta dos visitas al menu general y una a una sucursal:
--    select registrar_visita(t.id) from tenants t limit 1;
--    select registrar_visita(t.id) from tenants t limit 1;
--    select registrar_visita(s.tenant_id, s.id) from sucursales s limit 1;
--
--    select sucursal_id, dia, visitas from visitas_menu order by dia desc;
--    -- el menu general debe decir 2, no dos filas de 1
--
--    -- Una sucursal de otro tenant no cuenta:
--    select registrar_visita('00000000-0000-0000-0000-000000000000'::uuid);
--    -- devuelve void, sin fila nueva
-- ============================================================================
