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
-- SIN gate de deploy: si la columna falta, la feature no aparece y nada se rompe.
