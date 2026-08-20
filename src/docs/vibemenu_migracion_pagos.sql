-- ============================================================================
--  VIBEMENU — migracion 010: recibos de pago (tabla `pagos`)
--
--  Recibos, NO facturacion fiscal (sin CFDI). Un pago es un evento `invoice.paid`
--  de Stripe: guarda el link al recibo/factura hospedado por Stripe
--  (`hosted_invoice_url`) para que el dueño lo vea desde /admin/suscripcion.
--  Ver vibemenu_stripe.md, seccion "Lo que NO existe todavia" — esta migracion
--  es justo lo que ese documento anticipaba.
--
--  Igual que `suscripciones`: cuelga de un tenant, una fila por pago, y SOLO
--  la Edge Function de webhooks (service role) escribe. Sin policy de
--  insert/update/delete para authenticated.
--
--  Ejecutar COMPLETO en el SQL Editor de Supabase, despues de la migracion 009
--  (usa la funcion `es_super_admin()` que esa migracion crea).
-- ============================================================================

begin;

create table pagos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  -- on delete set null: si algun dia se purga historial de suscripciones, el
  -- recibo del pago se conserva igual (es el comprobante de que se cobro).
  suscripcion_id uuid references suscripciones(id) on delete set null,

  monto numeric(10,2) not null check (monto >= 0),
  moneda text not null check (moneda in ('usd','mxn')),

  -- unique: el webhook hace upsert con onConflict sobre esta columna, para
  -- que un reintento de Stripe (entrega al menos una vez) no duplique el recibo.
  stripe_invoice_id text unique not null,
  stripe_hosted_invoice_url text,

  fecha_pago timestamptz not null default now()
);

alter table pagos enable row level security;

create policy "pagos_select_owner" on pagos for select
  using (es_owner_de_tenant(tenant_id));

create policy "pagos_select_super_admin" on pagos for select
  using (es_super_admin());

create index idx_pagos_tenant on pagos(tenant_id);
create index idx_pagos_suscripcion on pagos(suscripcion_id);

commit;
