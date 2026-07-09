-- ============================================================================
--  VIBEMENU — price_id de Stripe (MODO PRUEBA)
--
--  Productos y precios creados el 2026-07-09 en la cuenta de prueba.
--  Verificados uno por uno: monto correcto, recurrentes mensuales, activos,
--  livemode = false.
--
--  ⚠️ Estos ids son de TEST. Al pasar a producción hay que crear el catálogo
--     otra vez con la llave `sk_live_` y volver a correr este UPDATE con los
--     ids nuevos. Los `price_id` de test NO funcionan en live.
--
--  Ejecutar en el SQL Editor de Supabase.
-- ============================================================================

begin;

-- Vibemenu Basic — prod_Ur3t2RdivMtBau
update planes set
  stripe_price_id_usd = 'price_1TrLm6I3n8XuTKrPouXmwc3m',  --   $9.00 USD / mes
  stripe_price_id_mxn = 'price_1TrLm7I3n8XuTKrPFj1xyfLX'   -- $169.00 MXN / mes
where nombre = 'basic';

-- Vibemenu Pro — prod_Ur3thZ5PDt8HuB
update planes set
  stripe_price_id_usd = 'price_1TrLm7I3n8XuTKrPXIuNSZcl',  --  $19.00 USD / mes
  stripe_price_id_mxn = 'price_1TrLm8I3n8XuTKrPHdgY8cs5'   -- $349.00 MXN / mes
where nombre = 'pro';

-- Vibemenu Enterprise — prod_Ur3tjthLSaF4bO
update planes set
  stripe_price_id_usd = 'price_1TrLm9I3n8XuTKrPpzphAthc',  --  $39.00 USD / mes
  stripe_price_id_mxn = 'price_1TrLm9I3n8XuTKrPaFDbz2SX'   -- $699.00 MXN / mes
where nombre = 'enterprise';

-- El plan free no se cobra: sus price_id se quedan en null a propósito.
-- `crear-checkout` rechaza cualquier intento de cobrarlo.

commit;

-- ============================================================================
--  Verificar: los 3 planes de pago con sus dos ids, free sin ninguno.
--
--    select nombre, precio_usd, precio_mxn, stripe_price_id_usd, stripe_price_id_mxn
--      from planes order by precio_usd;
--
--  Después de esto, los botones "Cambiar a este plan" de /admin/suscripcion
--  dejan de estar deshabilitados: su estado se deriva de estas columnas.
-- ============================================================================
