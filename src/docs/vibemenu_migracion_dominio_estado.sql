-- ============================================================================
--  VIBEMENU — migracion: dominio_estado
--
--  Agrega tenants.dominio_estado ('pendiente' | 'verificado' | null) y hace
--  que el trigger validar_dominio_tenant() lo mantenga solo: 'pendiente' en
--  cuanto se asigna un dominio nuevo, null si se quita el dominio. Ninguna
--  otra transicion es valida desde el cliente -- solo las Edge Functions
--  agregar-dominio-vercel / verificar-dominios-pendientes (con service_role)
--  pueden poner 'verificado'. Ver src/docs/vibemenu_dominio_personalizado.md.
--
--  Ejecutar via Supabase MCP (apply_migration). No otorga UPDATE de
--  dominio_estado a `authenticated` a proposito.
-- ============================================================================

begin;

alter table tenants
  add column dominio_estado text
    constraint dominio_estado_valido check (
      dominio_estado is null or dominio_estado in ('pendiente', 'verificado')
    );

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
    new.dominio_estado := null;
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

  new.dominio_estado := 'pendiente';
  return new;
end;
$$;

commit;

-- ============================================================================
--  Verificar:
--
--    select column_name, data_type from information_schema.columns
--     where table_name = 'tenants' and column_name = 'dominio_estado';
--
--    -- El cliente NO debe poder tocarlo directo (columna sin GRANT):
--    select column_name from information_schema.column_privileges
--     where table_name = 'tenants' and grantee = 'authenticated'
--       and privilege_type = 'UPDATE' and column_name = 'dominio_estado';
--    -- debe devolver 0 filas.
--
--    -- Asignar un dominio debe poner 'pendiente' solo:
--    update tenants set dominio_personalizado = 'menu.pruebaqa.com'
--     where id = '<tenant-pro>';
--    select dominio_personalizado, dominio_estado from tenants where id = '<tenant-pro>';
--    -- dominio_estado = 'pendiente'
--
--    -- Quitar el dominio debe limpiar el estado:
--    update tenants set dominio_personalizado = null where id = '<tenant-pro>';
--    select dominio_estado from tenants where id = '<tenant-pro>';
--    -- dominio_estado = null
-- ============================================================================
