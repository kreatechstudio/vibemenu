-- ============================================================================
--  VIBEMENU — migracion 002: personalizacion de tema por plan
--
--  Agrega a `planes` las columnas que gobiernan cuanto puede personalizar cada
--  tenant, y un trigger que valida `tenants.tema` contra esas columnas.
--
--  Ejecutar COMPLETO en el SQL Editor de Supabase. Va en una transaccion.
--  Requiere que la migracion 001 (vibemenu_schema.sql) ya este aplicada.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Catalogo de fuentes y modos de imagen
-- ---------------------------------------------------------------------------
-- Las claves de fuente viven tambien en src/lib/fuentes.ts. Si se agrega una,
-- hay que agregarla en los dos lados.
--
-- modo_imagen:
--   'ninguno'  sin imagen de fondo
--   'marco'    la imagen enmarca; el menu va en una tarjeta al centro
--   'completo' la imagen ocupa todo el fondo, a sangre

alter table planes
  add column fuentes_permitidas text[] not null default array['fraunces', 'inter'],
  add column permite_color_modificadores boolean not null default false,
  add column modos_imagen_permitidos text[] not null default array[]::text[],
  add column permite_desenfoque boolean not null default false;

alter table planes
  add constraint fuentes_permitidas_validas check (
    fuentes_permitidas <@ array[
      'fraunces', 'playfair', 'lora', 'cormorant',
      'inter', 'manrope', 'outfit', 'dm-sans',
      'space-grotesk', 'bebas', 'caveat', 'anton'
    ]
  ),
  add constraint modos_imagen_validos check (
    modos_imagen_permitidos <@ array['marco', 'completo']
  );

-- ---------------------------------------------------------------------------
-- 2. Reparto por plan (esquema "equilibrado")
-- ---------------------------------------------------------------------------

update planes set
  fuentes_permitidas          = array['fraunces', 'inter'],
  permite_color_modificadores = false,
  modos_imagen_permitidos     = array[]::text[],
  permite_desenfoque          = false
where nombre = 'free';

update planes set
  fuentes_permitidas          = array['fraunces', 'playfair', 'inter', 'manrope', 'space-grotesk', 'caveat'],
  permite_color_modificadores = true,
  modos_imagen_permitidos     = array['marco'],
  permite_desenfoque          = false
where nombre = 'basic';

update planes set
  fuentes_permitidas          = array[
    'fraunces', 'playfair', 'lora', 'cormorant',
    'inter', 'manrope', 'outfit', 'dm-sans',
    'space-grotesk', 'bebas', 'caveat', 'anton'
  ],
  permite_color_modificadores = true,
  modos_imagen_permitidos     = array['marco', 'completo'],
  permite_desenfoque          = true
where nombre in ('pro', 'enterprise');

-- ---------------------------------------------------------------------------
-- 3. Validacion del tema contra el plan
-- ---------------------------------------------------------------------------
-- Mismo contrato que el resto: slug estable como mensaje, texto para el usuario
-- en `detail`. Al CAMBIAR DE PLAN se reconcilia en silencio (se limpia lo que ya
-- no se permite); al editar a mano, se lanza error explicito.

create or replace function validar_tema_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fuentes    text[];
  v_color      boolean;
  v_modos      text[];
  v_desenfoque boolean;
  v_tema       jsonb;
  v_fuente     text;
  v_modo       text;
  v_cambio_de_plan boolean;
begin
  select fuentes_permitidas, permite_color_modificadores, modos_imagen_permitidos, permite_desenfoque
    into v_fuentes, v_color, v_modos, v_desenfoque
    from planes where id = new.plan_id;

  if v_fuentes is null then
    raise exception 'plan_inexistente';
  end if;

  -- OJO: OLD no existe en un trigger de INSERT y PL/pgSQL no cortocircuita el OR.
  if tg_op = 'INSERT' then
    v_cambio_de_plan := true;
  else
    v_cambio_de_plan := new.plan_id is distinct from old.plan_id;
  end if;

  v_tema   := coalesce(new.tema, '{}'::jsonb);
  v_fuente := v_tema ->> 'fuente';
  v_modo   := coalesce(v_tema ->> 'modo_imagen', 'ninguno');

  if v_cambio_de_plan then
    if v_fuente is not null and not (v_fuente = any(v_fuentes)) then
      v_tema := v_tema - 'fuente';
    end if;
    if v_modo <> 'ninguno' and not (v_modo = any(v_modos)) then
      v_tema := v_tema || jsonb_build_object('modo_imagen', 'ninguno');
    end if;
    if not v_color then
      v_tema := v_tema - 'color_modificadores';
    end if;
    if not v_desenfoque then
      v_tema := v_tema - 'desenfoque_texto';
    end if;

    new.tema := v_tema;
    return new;
  end if;

  if v_fuente is not null and not (v_fuente = any(v_fuentes)) then
    raise exception 'fuente_no_permitida'
      using detail = 'Esa tipografía no está incluida en tu plan.';
  end if;

  if v_modo <> 'ninguno' and not (v_modo = any(v_modos)) then
    raise exception 'modo_imagen_no_permitido'
      using detail = 'La imagen de fondo no está incluida en tu plan.';
  end if;

  if not v_color and (v_tema ? 'color_modificadores') then
    raise exception 'color_modificadores_no_permitido'
      using detail = 'Darle color a los modificadores es parte de Basic.';
  end if;

  if not v_desenfoque and coalesce((v_tema ->> 'desenfoque_texto')::boolean, false) then
    raise exception 'desenfoque_no_permitido'
      using detail = 'El desenfoque detrás del texto es parte de Pro.';
  end if;

  return new;
end;
$$;

-- Corre despues de trg_tenants_20_formatos: los BEFORE se disparan en orden alfabetico.
create trigger trg_tenants_25_tema
  before insert or update on tenants
  for each row execute function validar_tema_tenant();

commit;

-- ============================================================================
--  Verificar despues de ejecutar:
--    select nombre, fuentes_permitidas, modos_imagen_permitidos,
--           permite_color_modificadores, permite_desenfoque
--      from planes order by precio_usd;
--
--    select tgname from pg_trigger
--     where tgrelid = 'tenants'::regclass and not tgisinternal;
--    -- deben salir 4: 10_plan_default, 20_formatos, 25_tema, 30_updated_at
--                     (mas trg_crear_owner, que es AFTER)
-- ============================================================================
