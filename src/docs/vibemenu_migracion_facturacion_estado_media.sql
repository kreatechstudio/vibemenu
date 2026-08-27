-- ============================================================================
--  VIBEMENU — migracion: facturacion_estado_media
--
--  Cierra el ultimo hueco de escritura de un tenant suspendido: el bucket
--  publico `vibemenu-media`. La policy de INSERT sobre storage.objects seguia
--  en pertenece_a_tenant(), asi que un tenant suspendido por impago podia
--  seguir subiendo imagenes al CDN (hosting y almacenamiento gratis a costa
--  nuestra). Las imagenes son contenido del menu y la spec §4 dice que un
--  tenant suspendido "no puede escribir contenido": se pasa SOLO el INSERT a
--  tenant_puede_escribir() (miembro del tenant Y no suspendido), definida en
--  vibemenu_migracion_facturacion_estado.sql.
--
--  La policy de DELETE (vibemenu_media_delete_miembros) se deja DELIBERADAMENTE
--  en pertenece_a_tenant(): borrar tus propias imagenes no es un vector de
--  abuso, y bloquearlo solo deja archivos huerfanos ocupando storage.
--
--  El menu publico sigue sirviendo imagenes: vibemenu_media_select_publico no
--  cambia.
--
--  Aplicar con apply_migration del MCP (project_id iaiiwtqqiaqxnzxjqcnt,
--  name: facturacion_estado_media). Ver docs/superpowers/specs/2026-08-27-endurecer-facturacion-design.md
-- ============================================================================

begin;

alter policy "vibemenu_media_insert_miembros" on storage.objects
  with check (
    bucket_id = 'vibemenu-media'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and tenant_puede_escribir(((storage.foldername(name))[1])::uuid)
  );

commit;

-- ============================================================================
--  Verificar:
--    select policyname, cmd, qual, with_check from pg_policies
--     where tablename = 'objects' and policyname like 'vibemenu_media%';
--    -- vibemenu_media_insert_miembros: with_check menciona tenant_puede_escribir
--    -- vibemenu_media_delete_miembros: qual sigue en pertenece_a_tenant
--    -- vibemenu_media_select_publico: sin cambios
-- ============================================================================
