-- ============================================================================
--  VIBEMENU — migracion 008: slugs reservados para las rutas de auth nuevas
--
--  Login con Google necesita tres rutas nuevas (`/auth/completar`, `/onboarding`)
--  y el panel de super-admin una mas (`/superadmin`). Ademas, `/recuperar` y
--  `/restablecer` (recuperacion de contrasena) se agregaron en el codigo sin
--  reservarlas en su momento — se corrige aqui.
--
--  Sin esto, un negocio podria registrar su slug como "onboarding" y dejar esa
--  ruta de sistema inalcanzable (las rutas estaticas de TanStack Router ganan
--  sobre `/:slug`, asi que el negocio no perderia su menu, pero es una trampa
--  esperando a pasar y el resto de rutas de sistema ya viven en esta tabla).
--
--  Ejecutar COMPLETO en el SQL Editor de Supabase.
-- ============================================================================

begin;

insert into slugs_reservados (slug) values
  ('onboarding'),
  ('auth'),
  ('superadmin'),
  ('recuperar'),
  ('restablecer')
on conflict (slug) do nothing;

commit;
