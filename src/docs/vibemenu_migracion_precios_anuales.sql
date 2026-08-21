-- ============================================================================
--  VIBEMENU — migracion 015: precios anuales (2 meses gratis, ~17%)
--
--  Agrega el precio y el stripe_price_id anual a cada plan de pago, junto al
--  ya existente mensual. `crear-checkout` decide cual usar segun el
--  `intervalo` que mande el frontend; nada de esto toca el precio congelado
--  de quien ya esta suscrito (`suscripciones.precio_congelado_*` sigue
--  siendo el precio de lista MENSUAL al momento del alta, sin importar si
--  paga mensual o anual -- Stripe ya protege el monto real de la
--  suscripcion existente por su cuenta: cambiar un Price en Stripe nunca
--  altera retroactivamente una suscripcion ya creada).
--
--  Montos: 10 meses por 12 (2 meses gratis), sobre el precio mensual actual.
--  Ejecutar en el SQL Editor de Supabase.
-- ============================================================================

begin;

alter table planes
  add column if not exists precio_usd_anual numeric(10, 2),
  add column if not exists precio_mxn_anual numeric(10, 2),
  add column if not exists stripe_price_id_usd_anual text,
  add column if not exists stripe_price_id_mxn_anual text;

update planes set precio_usd_anual = precio_usd * 10, precio_mxn_anual = precio_mxn * 10
 where precio_usd > 0;

commit;

-- ============================================================================
--  Verificar:
--    select nombre, precio_usd, precio_usd_anual, precio_mxn, precio_mxn_anual
--      from planes order by precio_usd;
--
--  Despues de esto, correr vibemenu_stripe_price_ids_anuales.sql con los ids
--  reales que devuelva la creacion de los Price en Stripe.
-- ============================================================================
