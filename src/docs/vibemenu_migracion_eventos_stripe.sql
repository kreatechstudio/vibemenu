-- ============================================================================
--  VIBEMENU — migracion: eventos_stripe (idempotencia de webhooks)
--
--  Stripe entrega cada webhook "al menos una vez": un mismo evento puede llegar
--  2+ veces. Hoy solo invoice.paid deduplica (por stripe_invoice_id). Esta
--  tabla deduplica TODOS los eventos por su id (evt_...): stripe-webhook
--  inserta la fila al inicio; si choca con la PK, ya lo procesamos y responde
--  200 sin volver a ejecutar el handler.
--
--  Sin policies de RLS: solo el service_role_key (que ya usa stripe-webhook)
--  la toca. Ver supabase/functions/stripe-webhook/index.ts.
--
--  Aplicar con apply_migration del MCP de Supabase (project_id
--  iaiiwtqqiaqxnzxjqcnt, name: eventos_stripe).
-- ============================================================================

begin;

create table eventos_stripe (
  id          text primary key,
  tipo        text not null,
  recibido_at timestamptz not null default now()
);

alter table eventos_stripe enable row level security;

commit;

-- ============================================================================
--  Verificar:
--    select tablename, rowsecurity from pg_tables where tablename = 'eventos_stripe';
--    -- una fila, rowsecurity = true
--
--    select count(*) from pg_policies where tablename = 'eventos_stripe';
--    -- 0 (ninguna policy: solo service_role escribe/lee)
-- ============================================================================
