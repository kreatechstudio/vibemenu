-- ============================================================================
--  VIBEMENU — migracion 011: nombre y foto de perfil de Google en el equipo
--
--  Quien entra con Google ya trae `raw_user_meta_data` con su nombre y foto —
--  Supabase lo guarda solo, sin config extra. Para el usuario propio, el
--  frontend lo lee directo de la sesion (supabase.auth.getSession().user);
--  para ver al resto del equipo hace falta pasar por `equipo_del_tenant`
--  (SECURITY DEFINER), porque `auth.users` no es legible desde el navegador.
--
--  `create or replace function` no permite agregar columnas a un RETURNS TABLE
--  existente — hay que dropearla primero.
--
--  Ejecutar en el SQL Editor de Supabase. Requiere la migracion 003 (equipo).
-- ============================================================================

begin;

drop function if exists equipo_del_tenant(uuid);

create function equipo_del_tenant(p_tenant_id uuid)
returns table (
  user_id    uuid,
  email      text,
  -- Google normaliza a full_name/avatar_url; se cae a name/picture (el dato
  -- crudo que manda Google) si el proveedor no trae la version normalizada.
  nombre     text,
  avatar_url text,
  rol        text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public, auth
as $$
  select
    tu.user_id,
    u.email::text,
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
    tu.rol,
    tu.created_at
    from tenant_usuarios tu
    join auth.users u on u.id = tu.user_id
   where tu.tenant_id = p_tenant_id
     and pertenece_a_tenant(p_tenant_id)
   order by (tu.rol <> 'owner'), tu.created_at;
$$;

-- El drop se lleva los grants con el; hay que volver a ponerlos (ver migracion 003).
revoke all on function equipo_del_tenant(uuid) from public;
revoke execute on function equipo_del_tenant(uuid) from anon;
grant execute on function equipo_del_tenant(uuid) to authenticated;

commit;
