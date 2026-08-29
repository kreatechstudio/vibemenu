begin;

alter table planes
  add column permite_pedidos_whatsapp boolean not null default false;

update planes set permite_pedidos_whatsapp = true where nombre <> 'free';

commit;

-- Verificar:
--   select nombre, permite_pedidos_whatsapp from planes order by precio_usd;
--   -- free=false, basic/pro/enterprise=true
--
-- Aplicar vía MCP `apply_migration` (name: "pedidos_whatsapp") o el SQL Editor.
--
-- GATE DE DEPLOY: esta migración es requisito para desplegar la rama de la feature
-- (aplicarla antes o junto con el deploy). `useMenuPublico` selecciona
-- `permite_pedidos_whatsapp` en tres consultas (`plan:planes(...)`), así que si la
-- columna falta PostgREST responde 400 a TODA la consulta del menú y cada menú
-- público se cae. Es seguro aplicarla temprano (`not null default false`, nada
-- del código viejo la lee).
