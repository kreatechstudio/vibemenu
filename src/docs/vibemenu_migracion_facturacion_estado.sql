-- ============================================================================
--  VIBEMENU — migracion: facturacion_estado
--
--  1. tenants.pago_fallido_desde  -> inicio del periodo de gracia de 7 dias
--     cuando Stripe reporta past_due/unpaid. null = al corriente.
--  2. tenants.cancela_al_terminar -> el tenant pidio cancelar; conserva su plan
--     hasta el fin del periodo ya cobrado (Stripe: cancel_at_period_end).
--  3. tenant_puede_escribir()     -> helper de RLS: miembro del tenant Y no
--     suspendido. Reemplaza a pertenece_a_tenant() SOLO en las policies de
--     ESCRITURA de contenido (no en las de lectura publica del menu).
--
--  Un tenant suspendido por impago con gracia vencida NO puede editar su
--  contenido ni por llamada directa a Supabase -- no solo por bloqueo de UI.
--  El menu publico sigue sirviendo: las policies *_select_publico no cambian.
--
--  Las columnas nuevas NO se agregan al grant update (...) de `authenticated`:
--  solo stripe-webhook (service_role) las escribe.
--
--  Aplicar con apply_migration del MCP (project_id iaiiwtqqiaqxnzxjqcnt,
--  name: facturacion_estado). Ver docs/superpowers/specs/2026-08-27-endurecer-facturacion-design.md
-- ============================================================================

begin;

alter table tenants
  add column pago_fallido_desde timestamptz,
  add column cancela_al_terminar boolean not null default false;

create or replace function tenant_puede_escribir(check_tenant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from tenant_usuarios tu
    join tenants t on t.id = tu.tenant_id
    where tu.tenant_id = check_tenant_id
      and tu.user_id = auth.uid()
      and t.estado <> 'suspendido'
  );
$$;

-- SUCURSALES
alter policy "sucursales_write_miembros" on sucursales
  using (tenant_puede_escribir(tenant_id));

-- HORARIOS (via subquery a sucursales)
alter policy "horarios_write_miembros" on horarios
  using (
    tenant_puede_escribir((select tenant_id from sucursales where id = sucursal_id))
  );

-- CATEGORIAS / PRODUCTOS
alter policy "categorias_write_miembros" on categorias
  using (tenant_puede_escribir(tenant_id));
alter policy "productos_write_miembros" on productos
  using (tenant_puede_escribir(tenant_id));

-- MODIFICADORES
alter policy "grupos_mod_write_miembros" on grupos_modificadores
  using (tenant_puede_escribir(tenant_id));
alter policy "opciones_mod_write_miembros" on opciones_modificador
  using (
    tenant_puede_escribir((select tenant_id from grupos_modificadores where id = grupo_id))
  );
alter policy "producto_mod_write_miembros" on producto_modificadores
  using (
    tenant_puede_escribir((select tenant_id from productos where id = producto_id))
  );

-- TENANTS (update): un tenant suspendido tampoco edita los datos del negocio.
alter policy "tenants_update_miembros" on tenants
  using (tenant_puede_escribir(id))
  with check (tenant_puede_escribir(id));

commit;

-- ============================================================================
--  Verificar:
--    select column_name, data_type, column_default
--      from information_schema.columns
--     where table_name = 'tenants'
--       and column_name in ('pago_fallido_desde','cancela_al_terminar');
--    -- 2 filas: pago_fallido_desde (timestamptz, null), cancela_al_terminar (boolean, false)
--
--    select proname from pg_proc where proname = 'tenant_puede_escribir';
--    -- 1 fila
--
--    select polname, qual from pg_policies
--     where tablename in ('sucursales','productos','categorias','tenants')
--       and polname like '%write%' or polname = 'tenants_update_miembros';
--    -- las qual deben mencionar tenant_puede_escribir, no pertenece_a_tenant
--
--    -- Las columnas nuevas NO deben tener grant update a authenticated:
--    select column_name from information_schema.column_privileges
--     where table_name = 'tenants' and grantee = 'authenticated'
--       and privilege_type = 'UPDATE'
--       and column_name in ('pago_fallido_desde','cancela_al_terminar');
--    -- 0 filas
-- ============================================================================
