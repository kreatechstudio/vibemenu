-- ============================================================================
--  VIBEMENU — migracion 011: slugs reservados para las paginas legales
--
--  Aviso de Privacidad y Cookies se agregaron como rutas estaticas
--  (`/privacidad`, `/cookies`). Sin esto, un negocio podria registrar su slug
--  como "privacidad" y dejar esa ruta de sistema inalcanzable para el resto
--  de la plataforma (su propio menu seguiria funcionando: las rutas estaticas
--  de TanStack Router ganan sobre `/:slug`).
--
--  Mismo patron que la migracion 008 (slugs de las rutas de auth).
--
--  Ejecutar COMPLETO en el SQL Editor de Supabase.
-- ============================================================================

begin;

insert into slugs_reservados (slug) values
  ('privacidad'),
  ('cookies')
on conflict (slug) do nothing;

commit;
