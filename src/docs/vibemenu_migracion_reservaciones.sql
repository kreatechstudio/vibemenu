-- ============================================================================
--  VIBEMENU — migracion: reservaciones simples (sub-proyecto #4)
--
--  1. planes.permite_reservaciones  → gatea la feature (Pro+).
--  2. sucursales.acepta_reservaciones + reservaciones_email → opt-in por local.
--  3. reservaciones → una fila por solicitud. El comensal no tiene sesion:
--     NADIE inserta directo, solo la Edge Function `crear-reservacion` con
--     service_role. RLS solo cubre lectura y cambio de estado (miembros).
--  4. trigger validar_reservacion → coherencia + plan + opt-in + ventana de fecha.
--  5. combinar_fecha_hora_sucursal → arma el timestamptz en la zona del local.
--  6. purgar_reservaciones_viejas → la llama un workflow nocturno.
--
--  Aplicar con apply_migration del conector Supabase (project_id
--  iaiiwtqqiaqxnzxjqcnt, name: reservaciones) EN UN BRANCH primero.
--
--  APLICAR ANTES del deploy de la rama: EditorSucursal manda
--  acepta_reservaciones/reservaciones_email en cada upsert de sucursal; sin la
--  columna, PostgREST rechaza (PGRST204) y ningun guardado de sucursal funciona.
-- ============================================================================

begin;

-- 1. Capacidad de plan ------------------------------------------------------
alter table planes
  add column if not exists permite_reservaciones boolean not null default false;

update planes set permite_reservaciones = true where nombre in ('pro', 'enterprise');

-- 2. Opt-in por sucursal --------------------------------------------------
alter table sucursales
  add column if not exists acepta_reservaciones boolean not null default false,
  add column if not exists reservaciones_email text
    constraint sucursal_reservaciones_email_valido
      check (reservaciones_email is null
             or reservaciones_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
-- policy sucursales_write_miembros ya cubre la tabla entera: sin grant extra.

-- 3. Tabla reservaciones -------------------------------------------------
create table reservaciones (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  sucursal_id       uuid not null references sucursales(id) on delete cascade,
  nombre            text not null check (length(btrim(nombre)) between 2 and 120),
  personas          int  not null check (personas between 1 and 99),
  fecha_hora        timestamptz not null,
  telefono          text not null check (length(btrim(telefono)) between 6 and 30),
  email             text check (email is null
                     or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  nota              text check (nota is null or length(nota) <= 500),
  estado            text not null default 'nueva'
                     check (estado in ('nueva','atendida','cancelada')),
  consentimiento_at timestamptz not null default now(),
  ip                inet,
  creada_en         timestamptz not null default now()
);

create index idx_reservaciones_tenant on reservaciones (tenant_id, fecha_hora desc);
create index idx_reservaciones_tenant_estado on reservaciones (tenant_id, estado);
create index idx_reservaciones_sucursal_estado on reservaciones (sucursal_id, estado);
create index idx_reservaciones_sucursal_creada on reservaciones (sucursal_id, creada_en desc);
create index idx_reservaciones_ip_creada on reservaciones (ip, creada_en desc) where ip is not null;

alter table reservaciones enable row level security;

create policy "reservaciones_select_miembros" on reservaciones for select
  to authenticated using (pertenece_a_tenant(tenant_id));

create policy "reservaciones_update_miembros" on reservaciones for update
  to authenticated using (pertenece_a_tenant(tenant_id))
  with check (pertenece_a_tenant(tenant_id));

-- Sin policy de insert: solo la Edge Function con service_role escribe.
revoke all on reservaciones from anon, authenticated;
grant select on reservaciones to authenticated;
grant update (estado) on reservaciones to authenticated;

-- 4. Enforcement --------------------------------------------------------
create or replace function validar_reservacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_permite boolean;
  v_acepta  boolean;
begin
  select p.permite_reservaciones into v_permite
    from planes p join tenants t on t.plan_id = p.id
   where t.id = new.tenant_id;

  if not coalesce(v_permite, false) then
    raise exception 'reservaciones_no_permitidas';
  end if;

  select s.acepta_reservaciones into v_acepta
    from sucursales s
   where s.id = new.sucursal_id and s.tenant_id = new.tenant_id;

  if v_acepta is null then
    raise exception 'sucursal_ajena';
  end if;
  if not v_acepta then
    raise exception 'sucursal_no_acepta_reservaciones';
  end if;

  if new.fecha_hora < now() then
    raise exception 'reservacion_en_pasado';
  end if;
  if new.fecha_hora > now() + interval '60 days' then
    raise exception 'reservacion_muy_lejana';
  end if;

  return new;
end;
$$;

create trigger trg_validar_reservacion
  before insert on reservaciones
  for each row execute function validar_reservacion();

-- 5. Combinar fecha + hora en la zona de la sucursal --------------------
--    El comensal manda fecha (date) y hora (time) "de reloj de pared". Esto
--    las fija a la zona del local, igual que registrar_visita calcula el dia.
create or replace function combinar_fecha_hora_sucursal(p_fecha date, p_hora time, p_tz text)
returns timestamptz
language sql
stable
as $$
  select ((p_fecha + p_hora) at time zone coalesce(nullif(p_tz, ''), 'UTC'));
$$;

-- Revoke default Supabase grants to anon/authenticated (implicit via ALTER DEFAULT PRIVILEGES).
revoke execute on function combinar_fecha_hora_sucursal(date, time, text) from public, anon, authenticated;
grant  execute on function combinar_fecha_hora_sucursal(date, time, text) to service_role;

-- 6. Purga nocturna ----------------------------------------------------
--    Por fecha_hora, no creada_en: una reserva pedida con 2 meses de
--    anticipacion sigue siendo relevante hasta que pasa.
create or replace function purgar_reservaciones_viejas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_borradas integer;
begin
  delete from reservaciones where fecha_hora < now() - interval '90 days';
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$$;

-- Revoke default Supabase grants to anon/authenticated (implicit via ALTER DEFAULT PRIVILEGES).
revoke execute on function purgar_reservaciones_viejas() from public, anon, authenticated;
grant  execute on function purgar_reservaciones_viejas() to service_role;

commit;

-- ============================================================================
--  Verificar:
--    select nombre, permite_reservaciones from planes order by precio_usd;
--    -- free=false, basic=false, pro=true, enterprise=true
--
--    select column_name from information_schema.columns
--     where table_name = 'sucursales'
--       and column_name in ('acepta_reservaciones','reservaciones_email');
--    -- 2 filas
--
--    select combinar_fecha_hora_sucursal(current_date, time '20:00', 'America/Mexico_City');
--    -- devuelve un timestamptz ~6h por delante de la lectura naive UTC
-- ============================================================================
