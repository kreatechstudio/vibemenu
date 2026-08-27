-- ============================================================================
--  VIBEMENU — migracion 019: respuestas de onboarding (metricas de producto)
--
--  Tabla de solo escritura para las 3 preguntas rapidas que el registro
--  asistido hace al final (como maneja su menu hoy, su dolor principal, como
--  nos conocio). Es dato de producto, no operativo: nadie la lee desde el
--  cliente, se consulta desde el dashboard de Supabase o con service_role.
--
--  jsonb en vez de columnas fijas: si las preguntas cambian mas adelante no
--  hace falta otra migracion.
--
--  Ejecutar COMPLETO en el SQL Editor de Supabase.
-- ============================================================================

begin;

create table onboarding_respuestas (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null unique references tenants(id) on delete cascade,
  respuestas jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_onboarding_respuestas_tenant on onboarding_respuestas (tenant_id);

alter table onboarding_respuestas enable row level security;

-- Insert-only: el owner puede crear (una vez, por el unique de arriba) la fila
-- de su propio tenant. Sin policy de select/update/delete para authenticated
-- ni anon — nadie del lado del cliente vuelve a leer esto.
create policy "onboarding_respuestas_insert_owner" on onboarding_respuestas for insert
  to authenticated with check (es_owner_de_tenant(tenant_id));

commit;

-- ============================================================================
--  Verificar:
--    select tablename, rowsecurity from pg_tables where tablename = 'onboarding_respuestas';
--    -- rowsecurity debe ser true
--
--    select polname, cmd, with_check from pg_policies
--      where tablename = 'onboarding_respuestas';
--    -- debe listar solo "onboarding_respuestas_insert_owner", cmd = 'INSERT'
-- ============================================================================
