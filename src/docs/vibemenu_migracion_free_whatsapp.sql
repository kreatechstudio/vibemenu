-- Migración: "Pedir por WhatsApp" también en el plan Free
-- Aplicada a prod (iaiiwtqqiaqxnzxjqcnt) como `free_permite_pedidos_whatsapp`.
--
-- "Pedir por WhatsApp" es solo un enlace wa.me armado en el cliente — no pega a
-- ningún servicio de terceros ni escribe en la base. `useMenuPublico` lee
-- `permite_pedidos_whatsapp` para mostrar u ocultar el botón/carrito en el menú
-- público. Con esto, un negocio Free con WhatsApp configurado ya lo muestra.
--
-- Es un cambio de dato (UPDATE), idempotente: correrlo dos veces no rompe nada.

begin;

update public.planes
set permite_pedidos_whatsapp = true
where nombre = 'free';

commit;
