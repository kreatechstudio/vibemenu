-- ============================================================================
--  VIBEMENU — migracion 014: panel de super-admin V1
--
--  Cuatro piezas para la ficha de detalle de un negocio y sus acciones de
--  soporte. Todo gated por `es_super_admin()` (migracion 009) — nada de esto
--  lo puede tocar un tenant normal, ni siquiera el dueño de su propio negocio.
--
--  1. RLS de solo lectura para super-admin en tenant_usuarios, invitaciones y
--     visitas_menu. `pagos` y `suscripciones` ya la tenian (migraciones 009 y
--     010) — aqui solo se completa lo que faltaba.
--
--  2. `super_admin_equipo(p_tenant_id)`: igual que `equipo_del_tenant`
--     (migracion 011), pero para CUALQUIER tenant, no solo el propio. No se
--     reusa esa funcion porque su `where` exige `pertenece_a_tenant`, y un
--     super-admin casi nunca pertenece al tenant que esta soportando.
--
--  3. Tabla `notas_internas`: bitacora de soporte por negocio. Solo insert +
--     select, sin policy de update/delete — es un registro historico, no un
--     campo editable.
--
--  4. `cambiar_estado_tenant(p_tenant_id, p_estado)`: mueve un negocio entre
--     trial/activo/suspendido/cancelado a mano, fuera del webhook de Stripe.
--     SECURITY DEFINER bypassea la policy normal de `tenants` (que exige
--     `pertenece_a_tenant`), asi que el chequeo de `es_super_admin()' va
--     DENTRO de la funcion — es la unica puerta.
--
--  Ejecutar COMPLETO en el SQL Editor de Supabase. Requiere la migracion 009.
-- ============================================================================

begin;

-- 1. RLS de solo lectura para super-admin ------------------------------------

create policy "tenant_usuarios_select_super_admin" on tenant_usuarios for select
  using (es_super_admin());

create policy "invitaciones_select_super_admin" on invitaciones for select
  using (es_super_admin());

create policy "visitas_menu_select_super_admin" on visitas_menu for select
  using (es_super_admin());

-- 2. Equipo de cualquier tenant, para quien da soporte ------------------------

create function super_admin_equipo(p_tenant_id uuid)
returns table (
  user_id    uuid,
  email      text,
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
     and es_super_admin()
   order by (tu.rol <> 'owner'), tu.created_at;
$$;

revoke all on function super_admin_equipo(uuid) from public;
revoke execute on function super_admin_equipo(uuid) from anon;
grant execute on function super_admin_equipo(uuid) to authenticated;

-- 3. Notas internas de soporte -------------------------------------------------

create table notas_internas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  autor_id uuid not null references auth.users(id),
  texto text not null check (length(trim(texto)) > 0 and length(texto) <= 2000),
  created_at timestamptz not null default now()
);

alter table notas_internas enable row level security;

create policy "notas_internas_select_super_admin" on notas_internas for select
  using (es_super_admin());

create policy "notas_internas_insert_super_admin" on notas_internas for insert
  to authenticated with check (es_super_admin() and autor_id = auth.uid());

create index idx_notas_internas_tenant on notas_internas(tenant_id, created_at desc);

-- 4. Cambiar estado a mano ----------------------------------------------------

create function cambiar_estado_tenant(p_tenant_id uuid, p_estado text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_super_admin() then
    raise exception 'no_autorizado';
  end if;

  if p_estado not in ('trial','activo','suspendido','cancelado') then
    raise exception 'estado_invalido';
  end if;

  update tenants set estado = p_estado where id = p_tenant_id;

  if not found then
    raise exception 'tenant_inexistente';
  end if;
end;
$$;

revoke all on function cambiar_estado_tenant(uuid, text) from public;
revoke execute on function cambiar_estado_tenant(uuid, text) from anon;
grant execute on function cambiar_estado_tenant(uuid, text) to authenticated;

commit;

-- ============================================================================
--  Verificar:
--
--    -- Las tres policies nuevas deben aparecer:
--    select tablename, policyname from pg_policies
--     where policyname like '%_select_super_admin' order by tablename;
--
--    -- Sin ser super-admin, esto debe devolver 0 filas (RLS silenciosa) o
--    -- 'no_autorizado' si se llama directo:
--    select cambiar_estado_tenant('<cualquier-tenant-id>', 'activo');
--
--    -- Con tu cuenta de super-admin, esto SI debe mover el estado:
--    select cambiar_estado_tenant('<tenant-de-prueba>', 'suspendido');
--    select estado from tenants where id = '<tenant-de-prueba>';
-- ============================================================================
