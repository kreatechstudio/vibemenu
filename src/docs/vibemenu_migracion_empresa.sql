-- ============================================================================
--  VIBEMENU — migracion 004: datos del negocio
--
--  Dos columnas nuevas:
--    tenants.descripcion    lo que vende el negocio, en una o dos frases.
--                           Se muestra en el header del menu publico.
--    sucursales.maps_url    enlace directo al punto exacto en un mapa.
--                           Si es null, el menu deriva una busqueda de Google
--                           Maps a partir de `direccion`.
--
--  Ambas quedan disponibles para el rol `authenticated`: son cosmeticas y no
--  tocan la sesion, el plan ni la facturacion.
--
--  Ejecutar COMPLETO en el SQL Editor de Supabase.
-- ============================================================================

begin;

alter table tenants
  add column descripcion text
    constraint descripcion_razonable check (descripcion is null or length(descripcion) <= 280);

alter table sucursales
  add column maps_url text
    constraint maps_url_es_https check (maps_url is null or maps_url ~* '^https://');

-- La migracion 001 revoco UPDATE sobre `tenants` y lo devolvio columna por
-- columna. Una columna nueva NO hereda ese grant: hay que darlo explicitamente,
-- o el dueno del negocio no puede escribir su propia descripcion.
grant update (descripcion) on tenants to authenticated;

-- `sucursales` nunca tuvo revoke de columna: su policy `sucursales_write_miembros`
-- ya cubre la tabla entera. maps_url no necesita grant extra.

commit;

-- ============================================================================
--  Verificar:
--
--    select column_name from information_schema.columns
--      where table_name = 'tenants' and column_name = 'descripcion';
--
--    -- El dueno debe poder escribir descripcion, y NO plan_id:
--    select column_name, privilege_type
--      from information_schema.column_privileges
--     where table_name = 'tenants' and grantee = 'authenticated'
--       and privilege_type = 'UPDATE'
--     order by column_name;
--    -- Debe listar descripcion, formato_activo, formatos_desbloqueados, giro,
--    -- logo_url, nombre_negocio, slug, tema, telefono, whatsapp.
--    -- NO debe listar plan_id, estado, stripe_customer_id ni trial_iniciado_at.
-- ============================================================================
