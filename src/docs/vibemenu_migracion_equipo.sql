-- ============================================================================
--  VIBEMENU — migracion 003: leer el equipo del tenant
--
--  `tenant_usuarios` guarda `user_id`, no el correo. El correo vive en
--  `auth.users`, que NO es legible desde el navegador (y no debe serlo).
--
--  Esta funcion lo expone con SECURITY DEFINER, pero solo para el tenant al que
--  pertenece quien llama. Sin el guard `pertenece_a_tenant`, cualquier usuario
--  autenticado podria leer los correos de todos los negocios de la plataforma.
--
--  Ejecutar en el SQL Editor de Supabase. Independiente de la migracion 002.
-- ============================================================================

begin;

create or replace function equipo_del_tenant(p_tenant_id uuid)
returns table (
  user_id    uuid,
  email      text,
  rol        text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public, auth
as $$
  select tu.user_id, u.email::text, tu.rol, tu.created_at
    from tenant_usuarios tu
    join auth.users u on u.id = tu.user_id
   where tu.tenant_id = p_tenant_id
     -- Sin esto, la funcion filtraria correos de otros tenants.
     and pertenece_a_tenant(p_tenant_id)
   order by (tu.rol <> 'owner'), tu.created_at;
$$;

-- OJO: `revoke ... from public` NO alcanza. Supabase le concede EXECUTE a `anon`
-- de forma explicita (default privileges), no a traves de PUBLIC. Hay que
-- revocarselo por nombre o la funcion queda invocable sin sesion.
-- (No filtra nada, porque auth.uid() es null y el guard devuelve cero filas,
--  pero no hay razon para dejarla expuesta.)
revoke all on function equipo_del_tenant(uuid) from public;
revoke execute on function equipo_del_tenant(uuid) from anon;
grant execute on function equipo_del_tenant(uuid) to authenticated;

commit;

-- ============================================================================
--  Verificar:
--    select proname, prosecdef, proacl::text
--      from pg_proc where proname = 'equipo_del_tenant';
--
--    -- prosecdef debe ser true
--    -- proacl NO debe contener `anon=X`
-- ============================================================================
