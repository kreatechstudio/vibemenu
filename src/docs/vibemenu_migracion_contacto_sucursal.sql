-- ============================================================================
--  VIBEMENU — migracion: enlace de resenas por sucursal
--
--  Una columna: sucursales.google_reviews_url. El enlace de "Pedir resenas" de
--  la ficha de Google de ESA sucursal. Si es null, el menu cae al de la empresa
--  (tenants.google_reviews_url).
--
--  La policy sucursales_write_miembros ya cubre la tabla entera: sin grant extra
--  (a diferencia de tenants, donde el UPDATE esta revocado columna por columna).
--
--  Ejecutar COMPLETO en el SQL Editor de Supabase.
-- ============================================================================

begin;

alter table sucursales
  add column google_reviews_url text
    constraint sucursal_reviews_es_https
      check (google_reviews_url is null or google_reviews_url ~* '^https://');

commit;

-- ============================================================================
--  Verificar:
--
--    select column_name from information_schema.columns
--      where table_name = 'sucursales' and column_name = 'google_reviews_url';
--    -- 1 fila
--
--    -- Un miembro del tenant puede escribirla (misma policy que el resto):
--    update sucursales set google_reviews_url = 'https://g.page/r/x/review'
--      where id = '<una sucursal propia>';
-- ============================================================================
