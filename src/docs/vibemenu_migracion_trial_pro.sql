-- ============================================================================
--  VIBEMENU — migracion 016: trial de 14 dias con Pro
--
--  Hasta ahora `estado='trial'` no vencia nunca: era solo "todavia no
--  pagaste", y el tenant nacia directo en el plan Free (perpetuo, sin
--  limite de tiempo). Esto lo cambia: todo tenant nuevo nace en el plan
--  PRO por 14 dias (sin pedir tarjeta -- sigue siendo el mismo insert de
--  siempre desde el navegador), y una tarea diaria (Edge Function
--  `procesar-trials-vencidos`, disparada por
--  .github/workflows/procesar-trials.yml) lo baja a Free en cuanto pasan
--  los 14 dias sin que haya pagado. El downgrade reutiliza los triggers
--  que YA recortan formatos/tema en silencio (trg_tenants_20_formatos,
--  trg_tenants_25_tema) -- el mismo mecanismo que un downgrade manual.
--
--  `estado` sigue siendo 'trial' despues del downgrade: nunca pago, asi
--  que sigue siendo verdad. Lo unico que cambia es `plan_id`.
--
--  Ejecutar en el SQL Editor de Supabase.
-- ============================================================================

begin;

-- Marca si ya se mando el aviso de "tu trial vence pronto", para no repetirlo
-- cada dia durante la ventana de 3 dias antes del vencimiento.
alter table tenants add column if not exists aviso_trial_enviado_at timestamptz;

create or replace function set_plan_trial_por_defecto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan_id is null then
    select id into new.plan_id from planes where nombre = 'pro';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tenants_10_plan_default on tenants;
create trigger trg_tenants_10_plan_default
  before insert on tenants
  for each row execute function set_plan_trial_por_defecto();

-- La funcion vieja se queda sin trigger que la use. Se borra para no dejar
-- dos funciones con el mismo proposito confundiendo a quien lea el schema.
drop function if exists set_plan_free_por_defecto();

commit;

-- ============================================================================
--  Verificar:
--    select tgname, proname from pg_trigger
--      join pg_proc on pg_proc.oid = pg_trigger.tgfoid
--     where tgrelid = 'tenants'::regclass and tgname = 'trg_tenants_10_plan_default';
--    -- proname debe ser set_plan_trial_por_defecto
--
--    select column_name from information_schema.columns
--     where table_name = 'tenants' and column_name = 'aviso_trial_enviado_at';
-- ============================================================================
