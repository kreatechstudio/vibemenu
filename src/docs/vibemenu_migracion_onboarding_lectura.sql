-- Migración: lectura de onboarding_respuestas para el super-admin
-- Aplicada a prod (iaiiwtqqiaqxnzxjqcnt) como `onboarding_respuestas_lectura_super_admin`.
--
-- Contexto: `onboarding_respuestas` guarda las 3 preguntas del registro
-- ("¿cómo manejas tu menú?", dolor principal, cómo nos conociste). Hasta ahora
-- la tabla solo tenía policy de INSERT (el owner al registrarse), así que nadie
-- podía leerla — ni el propio dueño, ni el super-admin. La ficha de
-- /superadmin/:id necesita mostrarlas.
--
-- Mismo patrón que `suscripciones_select_super_admin` y
-- `visitas_menu_select_super_admin`: SELECT abierto a `public` con guard
-- `es_super_admin()`, que solo es true para las filas de `super_admins`.
--
-- OJO: el CREATE POLICY no lleva IF NOT EXISTS — un segundo apply aborta por
-- nombre duplicado. Es un one-shot ya aplicado.

begin;

create policy onboarding_respuestas_select_super_admin
  on public.onboarding_respuestas
  for select
  to public
  using (public.es_super_admin());

commit;
