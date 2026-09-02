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

-- OJO: los ADD CONSTRAINT no llevan IF NOT EXISTS — un segundo apply de esta migración aborta la transacción. Es un one-shot ya aplicado.
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

-- ── helper: enmascara un contacto (correo/telefono) para proyecciones ───────
create or replace function _enmascarar_contacto(p_contacto text, p_tipo text)
returns text
language sql
immutable
security definer
set search_path = public
as $$
  select case
    when p_contacto is null then null
    when p_tipo = 'correo' and p_contacto like '%@%' then
      left(p_contacto, 1) || '●●●' || substr(p_contacto, position('@' in p_contacto))
    else
      '●●●' || right(regexp_replace(p_contacto, '\D', '', 'g'), 4)
  end;
$$;
revoke execute on function _enmascarar_contacto(text, text) from public, anon, authenticated;

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
  select t.lealtad_activa and coalesce(p.permite_lealtad, false)
    into v_activa
    from tenants t left join planes p on p.id = t.plan_id
   where t.id = p_tenant_id;
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
    _enmascarar_contacto(t.contacto, t.contacto_tipo)
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
-- La firma cambió (+ p_sucursal_id): la preview debe usar la misma tz que
-- sellar_tarjeta (la de la sucursal seleccionada), no la de la primera sucursal.
drop function if exists buscar_tarjeta(text);
create or replace function buscar_tarjeta(p_codigo text, p_sucursal_id uuid default null)
returns table (
  codigo text, sellos smallint, sellos_meta smallint, premio text,
  premios_canjeados smallint, listo_para_canje boolean, sello_repetido_hoy boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query select * from _vista_tarjeta(_tarjeta_del_encargado(p_codigo), p_sucursal_id);
end;
$$;
revoke execute on function buscar_tarjeta(text, uuid) from public, anon;
grant  execute on function buscar_tarjeta(text, uuid) to authenticated;

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
  select t.lealtad_activa and coalesce(p.permite_lealtad, false)
    into v_activa
    from tenants t left join planes p on p.id = t.plan_id
   where t.id = v_tarjeta.tenant_id;
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

  -- vía rápida / error claro
  if v_tarjeta.ultimo_sello_dia = v_hoy then
    raise exception 'sello_repetido_hoy';
  end if;

  -- UPDATE condicional: el tope 1/día se resuelve aquí, no en el check de arriba,
  -- para que dos llamadas concurrentes no puedan ganar ambas (TOCTOU).
  update tarjetas_lealtad
     set sellos = tarjetas_lealtad.sellos + 1,
         ultimo_sello_dia = v_hoy,
         ultima_actividad_at = now()
   where id = v_tarjeta.id
     and tarjetas_lealtad.ultimo_sello_dia is distinct from v_hoy
   returning * into v_tarjeta;
  if not found then
    raise exception 'sello_repetido_hoy';
  end if;

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
  -- SIN gate de plan a propósito: un negocio que bajó de plan debe poder honrar
  -- premios que sus clientes ya ganaron.
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
     set sellos = tarjetas_lealtad.sellos - v_meta,
         premios_canjeados = tarjetas_lealtad.premios_canjeados + 1,
         ultima_actividad_at = now()
   where id = v_tarjeta.id
     and tarjetas_lealtad.sellos >= v_meta
   returning * into v_tarjeta;
  if not found then
    raise exception 'sellos_insuficientes';
  end if;

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
    (select lealtad_sellos_meta from tenants where tenants.id = v_tenant),
    _enmascarar_contacto(t.contacto, t.contacto_tipo),
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
