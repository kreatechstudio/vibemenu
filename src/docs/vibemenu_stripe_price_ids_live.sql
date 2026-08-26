-- ============================================================================
--  ✅ APLICADO el 2026-08-23 directo en producción (vía Supabase MCP).
--     Este archivo queda como registro histórico de la migración.
--
--  VIBEMENU — price_id de Stripe MENSUALES, cuenta LIVE (producción)
--
--  Los Price ya existen en Stripe en modo live (creados 2026-08-19, cuenta
--  acct_1T6GdmEWXMEt3EVb, verificados uno por uno vía API: monto correcto,
--  recurrentes mensuales, activos, livemode = true). Lo que faltaba era
--  escribir sus ids en `planes`: la tabla seguía apuntando a los price_id de
--  TEST creados el 2026-07-09 (ver vibemenu_stripe_price_ids.sql), que no
--  existen en modo live -- por eso el checkout mensual solo podía completarse
--  si STRIPE_SECRET_KEY seguía siendo la llave de prueba.
--
--  Los price_id ANUALES ya estaban correctamente en live desde el
--  2026-08-21 (vibemenu_migracion_precios_anuales.sql) -- esta migración
--  solo corrige los MENSUALES.
--
--  ⚠️ Antes de correr esto, confirma en Supabase Dashboard → Edge Functions →
--     Secrets que STRIPE_SECRET_KEY ya es la llave LIVE (sk_live_... o
--     rk_live_... con los mismos 5 permisos que la de prueba). Si sigue
--     siendo la de test, correr este UPDATE rompe el checkout mensual
--     (el precio ya no existiría en el modo que la llave usa).
--
--  Ejecutar en el SQL Editor de Supabase.
-- ============================================================================

begin;

-- Vibemenu Basic — prod_Ur3t2RdivMtBau
update planes set
  stripe_price_id_usd = 'price_1U6dmIEWXMEt3EVb9YguPLb8',  --   $9.00 USD / mes (live)
  stripe_price_id_mxn = 'price_1U6dmIEWXMEt3EVbzfgCFizf'   -- $169.00 MXN / mes (live)
where nombre = 'basic';

-- Vibemenu Pro — prod_Ur3thZ5PDt8HuB
update planes set
  stripe_price_id_usd = 'price_1U6dmIEWXMEt3EVbCqVT1hf5',  --  $19.00 USD / mes (live)
  stripe_price_id_mxn = 'price_1U6dmIEWXMEt3EVb5MdaPfhf'   -- $349.00 MXN / mes (live)
where nombre = 'pro';

-- Vibemenu Enterprise — prod_Ur3tjthLSaF4bO
update planes set
  stripe_price_id_usd = 'price_1U6dmIEWXMEt3EVbf7yk9fNt',  --  $39.00 USD / mes (live)
  stripe_price_id_mxn = 'price_1U6dmHEWXMEt3EVbgSfu0Zda'   -- $699.00 MXN / mes (live)
where nombre = 'enterprise';

-- El plan free no se cobra: sus price_id se quedan en null a propósito.

-- El tenant "Cafe Charly" (id 960ce569-bcae-459e-a564-e66c6e6509fe) tiene un
-- stripe_customer_id de TEST (cus_Ur4ZazcMRkt4oN, no existe en modo live).
-- Con STRIPE_SECRET_KEY ya en live, cualquier checkout/portal para este
-- tenant fallaría con "No such customer" mientras esta columna no se limpie.
-- Descomenta la siguiente línea solo si Cafe Charly es un tenant de prueba
-- (no un cliente real que ya pagó de verdad):
--
-- update tenants set stripe_customer_id = null
--   where id = '960ce569-bcae-459e-a564-e66c6e6509fe';

commit;

-- ============================================================================
--  Verificar después de correr:
--
--    select nombre, precio_usd, stripe_price_id_usd, stripe_price_id_mxn,
--           stripe_price_id_usd_anual, stripe_price_id_mxn_anual
--      from planes order by precio_usd;
--
--  Todos los price_id (mensual y anual) deben pertenecer ya al modo live.
-- ============================================================================
