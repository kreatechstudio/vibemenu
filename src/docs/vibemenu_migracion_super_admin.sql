-- ============================================================================
--  VIBEMENU — migracion 009: panel de super-admin (KreaTech)
--
--  Tabla `super_admins`: lista de usuarios con acceso al panel interno en
--  `/superadmin`. A proposito NO tiene policy de insert/update/delete para
--  `authenticated` — el unico camino para agregar a alguien es correr un
--  insert manual en el SQL Editor (con service role, bypassea RLS). Ver el
--  insert comentado al final de este archivo.
--
--  `es_super_admin()` sigue el mismo molde que `es_owner_de_tenant` (migracion
--  base, seccion 9): security definer, para poder consultarla desde una policy
--  sin que la RLS de `super_admins` se muerda la cola a si misma.
--
--  `tenants` y `planes` ya son de lectura publica (`using (true)`) — el panel
--  los lee sin ninguna policy nueva. Solo `suscripciones` necesita una policy
--  adicional, porque hoy solo la ve el owner del tenant.
--
--  Ejecutar COMPLETO en el SQL Editor de Supabase.
-- ============================================================================

begin;

create table super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table super_admins enable row level security;

-- Cada quien solo puede leer su propia fila — es lo unico que necesita el
-- frontend para preguntar "¿soy admin?" (select y compara con el propio uid).
create policy "super_admins_select_propio" on super_admins for select
  using (user_id = auth.uid());

create or replace function es_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from super_admins where user_id = auth.uid());
$$;

create policy "suscripciones_select_super_admin" on suscripciones for select
  using (es_super_admin());

commit;

-- ----------------------------------------------------------------------------
-- Para darte acceso al panel, descomenta y corre esto con tu correo real:
-- ----------------------------------------------------------------------------
-- insert into super_admins (user_id)
-- select id from auth.users where email = 'carloseugenio024@gmail.com';
