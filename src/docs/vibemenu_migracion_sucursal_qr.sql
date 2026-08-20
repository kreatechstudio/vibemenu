-- ============================================================================
--  VIBEMENU — migracion 005: precios por sucursal + QR personalizado
--
--  1. `precios_sucursal`: un producto, varios precios. Si una sucursal no tiene
--     fila, cobra el precio base de `productos.precio`. Un solo producto que
--     mantener, en vez de duplicarlo por local.
--
--  2. Dos columnas en `planes` para escalonar el QR imprimible.
--
--  Ejecutar COMPLETO en el SQL Editor. Va en una transaccion.
--  Requiere las migraciones 001 y 002 aplicadas.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Precios por sucursal
-- ---------------------------------------------------------------------------
-- Sin tenant_id: se deriva de `productos`. Duplicarlo aqui abriria la puerta a
-- que una fila apunte a un producto de un tenant y una sucursal de otro.

create table precios_sucursal (
  producto_id uuid not null references productos(id) on delete cascade,
  sucursal_id uuid not null references sucursales(id) on delete cascade,
  precio numeric(10,2) not null check (precio >= 0),
  created_at timestamptz not null default now(),
  primary key (producto_id, sucursal_id)
);

create index idx_precios_sucursal_sucursal on precios_sucursal(sucursal_id);

alter table precios_sucursal enable row level security;

-- Lectura publica: el menu de un comensal necesita el precio de su sucursal.
create policy "precios_sucursal_select_publico" on precios_sucursal for select using (true);

create policy "precios_sucursal_write_miembros" on precios_sucursal for all
  to authenticated using (
    pertenece_a_tenant((select tenant_id from productos where id = producto_id))
  );

/*
 * Dos garantias que la RLS sola no da:
 *   - el plan debe permitir menu independiente por sucursal;
 *   - el producto y la sucursal deben ser del MISMO tenant. Sin esto, un tenant
 *     podria fijarle precio a su propio producto en la sucursal de otro negocio.
 */
create or replace function validar_precio_sucursal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_permite boolean;
  v_tenant_producto uuid;
  v_tenant_sucursal uuid;
begin
  select pr.tenant_id into v_tenant_producto from productos pr where pr.id = new.producto_id;
  select s.tenant_id into v_tenant_sucursal from sucursales s where s.id = new.sucursal_id;

  if v_tenant_producto is null or v_tenant_producto is distinct from v_tenant_sucursal then
    raise exception 'sucursal_de_otro_tenant';
  end if;

  select p.menu_independiente_por_sucursal into v_permite
    from planes p join tenants t on t.plan_id = p.id
   where t.id = v_tenant_producto;

  if not coalesce(v_permite, false) then
    raise exception 'precio_por_sucursal_no_permitido'
      using detail = 'Los precios distintos por sucursal son parte de Pro.';
  end if;

  return new;
end;
$$;

create trigger trg_precios_sucursal_validar
  before insert or update on precios_sucursal
  for each row execute function validar_precio_sucursal();

-- ---------------------------------------------------------------------------
-- 2. QR personalizado, escalonado por plan
-- ---------------------------------------------------------------------------
--   qr_color    -> nombre del negocio y de la sucursal, colores del tema
--   qr_avanzado -> tipografia del tema, logo dentro del QR, imagen de fondo
--
-- La marca "Hecho con Vibemenu" en el QR impreso ya la gobierna `marca_agua`.

alter table planes
  add column qr_color boolean not null default false,
  add column qr_avanzado boolean not null default false;

update planes set qr_color = false, qr_avanzado = false where nombre = 'free';
update planes set qr_color = true,  qr_avanzado = false where nombre = 'basic';
update planes set qr_color = true,  qr_avanzado = true  where nombre in ('pro', 'enterprise');

commit;

-- ============================================================================
--  Verificar:
--
--    select nombre, menu_independiente_por_sucursal, qr_color, qr_avanzado
--      from planes order by precio_usd;
--
--    select tgname from pg_trigger
--     where tgrelid = 'precios_sucursal'::regclass and not tgisinternal;
--
--  Y que el precio base sigue mandando cuando no hay fila:
--    select pr.nombre, pr.precio as base, ps.precio as en_sucursal
--      from productos pr
--      left join precios_sucursal ps on ps.producto_id = pr.id;
-- ============================================================================
