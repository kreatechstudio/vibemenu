-- ============================================================================
--  VIBEMENU — migracion 006: editar productos exclusivos tras bajar de plan
--
--  El problema, con nombre y apellido:
--
--    Un tenant Pro crea "Desayuno Centro" con sucursal_id = <Centro>.
--    Baja a Basic. `productos.sucursal_id` sigue apuntando a Centro — el
--    downgrade no lo limpia, y a proposito: borrarlo cambiaria en silencio
--    lo que se vende en cada local.
--
--    Ahora el dueno intenta corregirle una falta de ortografia al nombre.
--    `trg_productos_10_sucursal` corre en CADA update, ve un sucursal_id no
--    nulo, consulta el plan, y levanta 'menu_independiente_no_permitido'.
--
--    Resultado: el producto queda congelado. No se puede editar ni siquiera
--    para desactivarlo. Y el mensaje habla de un menu independiente que el
--    dueno ni estaba tocando.
--
--  El arreglo: el trigger valida el plan solo cuando `sucursal_id` CAMBIA.
--  Sigue bloqueando que un plan compartido asigne una sucursal (que es lo que
--  se paga), pero deja en paz a las filas que ya la traian.
--
--  Ejecutar COMPLETO en el SQL Editor. Va en una transaccion.
--  Requiere el schema base aplicado.
-- ============================================================================

begin;

create or replace function validar_sucursal_en_menu()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_permite boolean;
begin
  if new.sucursal_id is null then
    return new;
  end if;

  -- `and` NO hace cortocircuito en PL/pgSQL: si esto fuera
  -- `if tg_op = 'UPDATE' and new.sucursal_id is not distinct from old.sucursal_id`
  -- el insert reventaria con "record old is not assigned yet". Va anidado.
  if tg_op = 'UPDATE' then
    if new.sucursal_id is not distinct from old.sucursal_id then
      return new;
    end if;
  end if;

  select p.menu_independiente_por_sucursal into v_permite
    from planes p join tenants t on t.plan_id = p.id
   where t.id = new.tenant_id;

  if not coalesce(v_permite, false) then
    raise exception 'menu_independiente_no_permitido'
      using detail = 'Tu plan solo admite un menú compartido entre sucursales.';
  end if;

  if not exists (
    select 1 from sucursales s
     where s.id = new.sucursal_id and s.tenant_id = new.tenant_id
  ) then
    raise exception 'sucursal_de_otro_tenant';
  end if;

  return new;
end;
$$;

commit;

-- ============================================================================
--  Los triggers `trg_categorias_10_sucursal` y `trg_productos_10_sucursal` ya
--  apuntan a esta funcion: `create or replace` basta, no hay que recrearlos.
--
--  Verificar (con un tenant en un plan SIN menu independiente y un producto
--  que ya traiga sucursal_id):
--
--    -- debe pasar: no toca sucursal_id
--    update productos set nombre = nombre || ' ' where sucursal_id is not null;
--
--    -- debe fallar con 'menu_independiente_no_permitido': intenta asignarla
--    update productos set sucursal_id = (select id from sucursales limit 1)
--     where sucursal_id is null;
-- ============================================================================
