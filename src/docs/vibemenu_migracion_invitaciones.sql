-- ============================================================================
--  VIBEMENU — migracion 012: invitaciones de equipo por correo (Resend)
--
--  Reemplaza el uso de auth.admin.inviteUserByEmail (sin marca, loguea al
--  invitado de inmediato con el template generico de Supabase) por una tabla
--  propia + un correo con diseño de Vibemenu enviado por Resend, resuelto en
--  la Edge Function `aceptar-invitacion` vía /invitacion/:token.
--
--  Tambien cierra un hueco de seguridad encontrado al revisar este flujo:
--  la policy `tenant_usuarios_insert` (migracion base) permitia
--  `user_id = auth.uid()` sin mas condicion. El comentario original ya
--  admitia que los dos casos legitimos (trg_crear_owner y la Edge Function
--  invitar-encargado) corren con SECURITY DEFINER / service_role, que
--  ignoran RLS de todas formas — asi que esa clausula no protegia nada
--  legitimo y en cambio dejaba que cualquier usuario autenticado se
--  auto-agregara como encargado de CUALQUIER tenant, porque tenant_id es
--  publico (viaja en el menu publico). Se quita.
--
--  Y refuerza la regla de producto "un usuario = un solo tenant": hoy es una
--  convencion de la app (useTenantActual usa maybeSingle y truena si deja de
--  ser cierto), no una garantia de la base. Se agrega el indice unico y un
--  trigger que la hace explicita con un slug de error traducible.
--
--  Requiere las migraciones 003 (equipo) y 009 (helpers/policies base).
--
--  ANTES DE CORRER ESTO: si ya hay tenants en produccion, verifica que ningun
--  usuario este repetido en tenant_usuarios, o el CREATE UNIQUE INDEX de abajo
--  truena a mitad de la transaccion:
--
--    select user_id, count(*) from tenant_usuarios group by user_id having count(*) > 1;
--
--  Si esa consulta devuelve filas, resuelvelas a mano (decide cual tenant se
--  queda cada usuario) antes de ejecutar el resto del archivo.
--
--  Ejecutar COMPLETO en el SQL Editor de Supabase.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Un usuario = un solo tenant, forzado de verdad
-- ----------------------------------------------------------------------------

-- Garantia dura a nivel de base. Sin esto, el "un usuario por tenant" es solo
-- una suposicion del frontend (useTenantActual.maybeSingle truena si se rompe).
create unique index if not exists uniq_tenant_por_usuario
  on tenant_usuarios (user_id);

create or replace function validar_un_tenant_por_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from tenant_usuarios where user_id = auth.uid()) then
    raise exception 'ya_perteneces_a_un_tenant'
      using detail = 'Tu cuenta ya administra un negocio en Vibemenu.';
  end if;
  return new;
end;
$$;

-- Antes de trg_tenants_10_plan_default (orden 05), para no crear el tenant
-- y fallar despues: si el usuario ya tiene negocio, ni siquiera se inserta.
drop trigger if exists trg_tenants_05_un_solo_tenant on tenants;
create trigger trg_tenants_05_un_solo_tenant
  before insert on tenants
  for each row execute function validar_un_tenant_por_usuario();

-- ----------------------------------------------------------------------------
-- 2. Cierra el insert abierto en tenant_usuarios
-- ----------------------------------------------------------------------------

drop policy if exists "tenant_usuarios_insert" on tenant_usuarios;
create policy "tenant_usuarios_insert" on tenant_usuarios for insert
  to authenticated with check (es_owner_de_tenant(tenant_id));
-- trg_crear_owner (SECURITY DEFINER) y las Edge Functions con service_role
-- siguen funcionando: ninguno de los dos pasa por RLS.

-- ----------------------------------------------------------------------------
-- 3. Tabla de invitaciones
-- ----------------------------------------------------------------------------

-- `email` siempre llega normalizado a minusculas desde la Edge Function
-- (nunca desde el navegador): asi el unique de abajo es un indice simple,
-- que es lo unico que el .upsert() de supabase-js sabe usar como arbitro de
-- ON CONFLICT (no soporta apuntar a un indice parcial ni a una expresion).
create table invitaciones (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  email        text not null,
  token        uuid not null default gen_random_uuid(),
  invitado_por uuid not null references auth.users(id),
  estado       text not null default 'pendiente'
    check (estado in ('pendiente', 'aceptada', 'cancelada')),
  expira_at    timestamptz not null default (now() + interval '7 days'),
  created_at   timestamptz not null default now(),
  aceptada_at  timestamptz
);

create unique index uniq_invitaciones_token on invitaciones (token);

-- Una sola fila por (tenant, correo) en toda su vida: reenviar o volver a
-- invitar tras remover a alguien hace upsert sobre la misma fila (nuevo
-- token, nueva vigencia) en vez de acumular historial suelto.
create unique index uniq_invitacion_por_tenant_correo on invitaciones (tenant_id, email);

create index idx_invitaciones_tenant on invitaciones (tenant_id);

alter table invitaciones enable row level security;

-- El owner ve y cancela sus invitaciones. Nadie mas lee esta tabla directo:
-- el invitado la consulta por token via la funcion invitacion_info() de abajo,
-- y el cambio de estado a "aceptada" solo lo hace la Edge Function con
-- service_role (no hay policy de update para authenticated).
create policy "invitaciones_select_owner" on invitaciones for select
  using (es_owner_de_tenant(tenant_id));
create policy "invitaciones_insert_owner" on invitaciones for insert
  to authenticated with check (es_owner_de_tenant(tenant_id) and invitado_por = auth.uid());
create policy "invitaciones_delete_owner" on invitaciones for delete
  using (es_owner_de_tenant(tenant_id));

revoke all on function validar_un_tenant_por_usuario() from public;

-- ----------------------------------------------------------------------------
-- 4. Lectura publica y segura de una invitacion por token
-- ----------------------------------------------------------------------------
--  El token es un uuid random (128 bits): conocerlo ES la prueba de que se
--  tiene el enlace del correo. No expone la tabla completa, solo esta fila y
--  solo los campos necesarios para pintar /invitacion/:token — incluye si el
--  correo ya tiene cuenta, para que el frontend decida "crea tu password" vs
--  "inicia sesion para aceptar".
create or replace function invitacion_info(p_token uuid)
returns table (
  tenant_nombre    text,
  email            text,
  estado           text,
  expira_at        timestamptz,
  cuenta_existente boolean
)
language sql
security definer
stable
set search_path = public, auth
as $$
  select
    t.nombre_negocio,
    i.email,
    i.estado,
    i.expira_at,
    exists (select 1 from auth.users u where lower(u.email) = lower(i.email))
    from invitaciones i
    join tenants t on t.id = i.tenant_id
   where i.token = p_token;
$$;

-- Debe poder llamarse SIN sesion: quien recibe el correo todavia puede no
-- tener cuenta. anon lo necesita, a diferencia de equipo_del_tenant.
revoke all on function invitacion_info(uuid) from public;
grant execute on function invitacion_info(uuid) to anon;
grant execute on function invitacion_info(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Slug reservado para la ruta /invitacion/:token
-- ----------------------------------------------------------------------------
insert into slugs_reservados (slug) values
  ('invitacion')
on conflict (slug) do nothing;

commit;

-- ============================================================================
--  Verificar:
--    select indexname from pg_indexes where tablename = 'tenant_usuarios';
--    -- debe incluir uniq_tenant_por_usuario
--
--    select polname, qual, with_check from pg_policies
--      where tablename = 'tenant_usuarios' and polname = 'tenant_usuarios_insert';
--    -- with_check ya NO debe contener "user_id"
--
--    select proname, prosecdef, proacl::text
--      from pg_proc where proname = 'invitacion_info';
--    -- proacl debe incluir anon=X (execute) y authenticated=X
-- ============================================================================
