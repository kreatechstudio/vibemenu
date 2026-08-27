-- ============================================================================
--  VIBEMENU — migracion: facturacion_estado_precios
--
--  Complemento de vibemenu_migracion_facturacion_estado.sql: esa migracion
--  cambio 8 policies de escritura de contenido de pertenece_a_tenant() a
--  tenant_puede_escribir() (= miembro y no suspendido), pero se salto
--  precios_sucursal. Los precios por sucursal son contenido de menu igual que
--  productos: un tenant suspendido tampoco debe poder editarlos por llamada
--  directa. Ver docs/superpowers/specs/2026-08-27-endurecer-facturacion-design.md §4
--
--  Aplicar con apply_migration del MCP (project_id iaiiwtqqiaqxnzxjqcnt,
--  name: facturacion_estado_precios).
-- ============================================================================

begin;

alter policy "precios_sucursal_write_miembros" on precios_sucursal
  using (
    tenant_puede_escribir((select tenant_id from productos where id = producto_id))
  );

commit;

-- ============================================================================
--  Verificar:
--    select polname, qual from pg_policies
--     where tablename = 'precios_sucursal' and polname = 'precios_sucursal_write_miembros';
--    -- qual debe mencionar tenant_puede_escribir, no pertenece_a_tenant
-- ============================================================================
