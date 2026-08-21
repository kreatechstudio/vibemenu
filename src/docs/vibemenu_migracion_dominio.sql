-- ============================================================================
--  VIBEMENU — migracion 013: dominio personalizado (plan Pro)
--
--  Una columna nueva: tenants.dominio_personalizado. Guarda el host tal cual
--  (p.ej. "menu.tunegocio.com"), sin protocolo ni ruta. NULL = el negocio sigue
--  usando vibemenu.com.mx/<slug>.
--
--  El trigger valida solo cuando la columna CAMBIA (mismo patron que
--  validar_sucursal_en_menu en la migracion 006): asi un downgrade no deja el
--  resto del formulario de Empresa congelado, solo bloquea ASIGNAR uno nuevo
--  sin el plan que lo permite.
--
--  Lo que valida:
--    - Formato de host (regex, sin protocolo ni ruta).
--    - No puede ser vibemenu.com.mx ni un subdominio (reservado).
--    - El plan del tenant debe traer permite_dominio_propio.
--
--  IMPORTANTE — esto NO enruta trafico por si solo. Ademas de guardarse aqui,
--  cada dominio debe agregarse a mano en Vercel (Project → Settings → Domains)
--  para que Vercel emita el certificado SSL y le mande el trafico a la app. Es
--  gratis, pero manual por cliente: no hay API de Vercel conectada para
--  automatizarlo todavia.
--
--  Ejecutar COMPLETO en el SQL Editor de Supabase. Ya se aplico via MCP el
--  2026-08-21.
-- ============================================================================

begin;

alter table tenants
  add column dominio_personalizado text
    constraint dominio_formato_valido check (
      dominio_personalizado is null or
      dominio_personalizado ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
    );

alter table tenants
  add constraint tenants_dominio_personalizado_key unique (dominio_personalizado);

create or replace function validar_dominio_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_permite boolean;
  v_dominio text;
begin
  if tg_op = 'UPDATE' then
    if new.dominio_personalizado is not distinct from old.dominio_personalizado then
      return new;
    end if;
  end if;

  v_dominio := nullif(lower(trim(new.dominio_personalizado)), '');
  new.dominio_personalizado := v_dominio;

  if v_dominio is null then
    return new;
  end if;

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

  return new;
end;
$$;

create trigger trg_tenants_27_dominio
  before insert or update on tenants
  for each row execute function validar_dominio_tenant();

-- La 004 revoco UPDATE columna por columna sobre `tenants`: una columna nueva
-- no hereda el grant, hay que darlo explicitamente.
grant update (dominio_personalizado) on tenants to authenticated;

commit;

-- ============================================================================
--  Verificar:
--
--    select column_name from information_schema.columns
--      where table_name = 'tenants' and column_name = 'dominio_personalizado';
--
--    select column_name from information_schema.column_privileges
--     where table_name = 'tenants' and grantee = 'authenticated'
--       and privilege_type = 'UPDATE' and column_name = 'dominio_personalizado';
--
--    -- Un tenant en plan free debe fallar con 'dominio_propio_no_permitido':
--    update tenants set dominio_personalizado = 'menu.prueba.com'
--     where id = '<tenant-en-plan-free>';
--
--    -- Debe fallar con 'dominio_reservado':
--    update tenants set dominio_personalizado = 'algo.vibemenu.com.mx'
--     where id = '<cualquier-tenant>';
-- ============================================================================
