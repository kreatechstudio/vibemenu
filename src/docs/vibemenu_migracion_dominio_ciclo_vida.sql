-- ============================================================================
--  VIBEMENU — migracion 019: ciclo de vida del dominio propio
--
--  Endurece la base de las migraciones 013 y 018. Ver
--  docs/superpowers/specs/2026-08-28-endurecer-dominios-design.md
--
--    - dominio_estado gana el valor 'listo' (HTTPS confirmado).
--    - dominio_diagnostico jsonb: lo ultimo que dijo Vercel (registros DNS
--      recomendados + misconfigured + reasons). Lo escriben SOLO las Edge
--      Functions con service_role.
--    - dominio_asignado_at: cuando se asigno el dominio actual (mide las 72h
--      para el correo de recordatorio).
--    - dominio_aviso_error_at: cuando se mando ese correo (una sola vez).
--    - dominio_revocado_por_plan: lo prende el trigger cuando un downgrade
--      quita el dominio; lo lee limpiar-dominios-huerfanos para el correo.
--    - dominios_huerfanos: cola de dominios a borrar del proyecto de Vercel.
--
--  Aplicar via Supabase MCP (apply_migration) o SQL Editor completo.
-- ============================================================================

begin;

alter table tenants drop constraint if exists dominio_estado_valido;
alter table tenants add constraint dominio_estado_valido check (
  dominio_estado is null or dominio_estado in ('pendiente', 'verificado', 'listo')
);

alter table tenants add column dominio_diagnostico jsonb;
alter table tenants add column dominio_asignado_at timestamptz;
alter table tenants add column dominio_aviso_error_at timestamptz;
alter table tenants add column dominio_revocado_por_plan boolean not null default false;

create table dominios_huerfanos (
  dominio text primary key,
  tenant_id uuid references tenants(id) on delete set null,
  creado_at timestamptz not null default now(),
  borrado_at timestamptz
);
alter table dominios_huerfanos enable row level security;
-- Sin policies: solo service_role entra.

create or replace function validar_dominio_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_permite boolean;
  v_permite_nuevo boolean;
  v_dominio text;
begin
  -- 1. Revocacion por downgrade: el plan cambio y el nuevo no permite dominio propio.
  if tg_op = 'UPDATE'
     and new.plan_id is distinct from old.plan_id
     and old.dominio_personalizado is not null then
    select p.permite_dominio_propio into v_permite_nuevo
      from planes p where p.id = new.plan_id;
    if not coalesce(v_permite_nuevo, false) then
      new.dominio_personalizado := null;
      new.dominio_revocado_por_plan := true;
    end if;
  end if;

  -- 2. Nada que hacer si el dominio no cambio.
  if tg_op = 'UPDATE'
     and new.dominio_personalizado is not distinct from old.dominio_personalizado then
    return new;
  end if;

  -- 3. Encolar el dominio viejo como huerfano (cambio o limpieza).
  if tg_op = 'UPDATE' and old.dominio_personalizado is not null then
    insert into dominios_huerfanos (dominio, tenant_id)
      values (old.dominio_personalizado, old.id)
      on conflict (dominio) do update
        set borrado_at = null, creado_at = now(), tenant_id = excluded.tenant_id;
  end if;

  v_dominio := nullif(lower(trim(new.dominio_personalizado)), '');
  new.dominio_personalizado := v_dominio;

  -- 4. Limpieza: sin dominio nuevo.
  if v_dominio is null then
    new.dominio_estado := null;
    new.dominio_asignado_at := null;
    new.dominio_aviso_error_at := null;
    new.dominio_diagnostico := null;
    return new;
  end if;

  -- 5. Asignacion de un dominio nuevo: validar como antes.
  if v_dominio = 'vibemenu.com.mx' or v_dominio like '%.vibemenu.com.mx' then
    raise exception 'dominio_reservado'
      using detail = 'Ese dominio está reservado para Vibemenu.';
  end if;

  select p.permite_dominio_propio into v_permite
    from planes p where p.id = new.plan_id;
  if not coalesce(v_permite, false) then
    raise exception 'dominio_propio_no_permitido'
      using detail = 'El dominio personalizado es parte de Pro.';
  end if;

  new.dominio_estado := 'pendiente';
  new.dominio_asignado_at := now();
  new.dominio_aviso_error_at := null;
  new.dominio_diagnostico := null;
  new.dominio_revocado_por_plan := false;
  return new;
end;
$$;

commit;

-- ============================================================================
--  Verificar:
--
--    select column_name from information_schema.columns
--     where table_name = 'tenants'
--       and column_name in ('dominio_diagnostico','dominio_asignado_at',
--                           'dominio_aviso_error_at','dominio_revocado_por_plan');
--    -- 4 filas.
--
--    select conname from pg_constraint where conname = 'dominio_estado_valido';
--    -- 1 fila; probar que acepta 'listo':
--    -- update tenants set dominio_estado = 'listo' where id = '<tenant-prueba>';  -- OK
--
--    select column_name from information_schema.column_privileges
--     where table_name = 'tenants' and grantee = 'authenticated'
--       and privilege_type = 'UPDATE'
--       and column_name like 'dominio_%';
--    -- SOLO debe salir dominio_personalizado (de la migracion 013).
--
--    -- Asignar dominio a un tenant Pro de prueba pone asignado_at:
--    update tenants set dominio_personalizado = 'menu.pruebaqa.com' where id = '<tenant-pro-prueba>';
--    select dominio_estado, dominio_asignado_at from tenants where id = '<tenant-pro-prueba>';
--
--    -- Cambiarlo encola el viejo:
--    update tenants set dominio_personalizado = 'menu2.pruebaqa.com' where id = '<tenant-pro-prueba>';
--    select * from dominios_huerfanos where dominio = 'menu.pruebaqa.com';
--
--    -- Bajar de plan revoca:
--    update tenants set plan_id = '<plan-free>' where id = '<tenant-pro-prueba>';
--    select dominio_personalizado, dominio_estado, dominio_revocado_por_plan
--      from tenants where id = '<tenant-pro-prueba>';
--    -- dominio_personalizado = null, dominio_estado = null, dominio_revocado_por_plan = true
--    select * from dominios_huerfanos where dominio = 'menu2.pruebaqa.com';
-- ============================================================================
