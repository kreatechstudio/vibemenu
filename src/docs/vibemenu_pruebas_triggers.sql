-- ============================================================================
--  VIBEMENU — pruebas de los triggers de límite de plan
--
--  Los límites son la pieza donde un bug cuesta dinero: si un trigger deja de
--  disparar, un tenant de Free carga 500 productos y nadie se entera.
--
--  Todo corre dentro de una transacción que termina en ROLLBACK. No persiste
--  NADA: ni los productos de prueba, ni el cambio de plan, ni la sucursal.
--  Se puede correr en producción sin miedo, aunque conviene hacerlo en un
--  branch de Supabase.
--
--  Ejecutar COMPLETO en el SQL Editor. Si algo sale mal, la salida dice cuál.
-- ============================================================================

begin;

-- Se trabaja sobre el primer tenant que exista. Nada se guarda.
create temp table _ctx on commit drop as
select t.id as tenant_id,
       (select id from planes where nombre = 'free')  as plan_free,
       (select id from planes where nombre = 'pro')   as plan_pro
  from tenants t
 order by t.created_at
 limit 1;

do $$
declare
  v_tenant     uuid;
  v_free       uuid;
  v_pro        uuid;
  v_categoria  uuid;
  v_sucursal   uuid;
  v_grupo      uuid;
  v_fallo      text;
  v_pasadas    int := 0;
begin
  select tenant_id, plan_free, plan_pro into v_tenant, v_free, v_pro from _ctx;
  if v_tenant is null then
    raise exception 'No hay ningún tenant. Registra un negocio antes de correr esto.';
  end if;

  -- Punto de partida limpio: plan free, sin productos ni sucursales de prueba.
  update tenants set plan_id = v_free where id = v_tenant;
  delete from productos where tenant_id = v_tenant;
  delete from sucursales where tenant_id = v_tenant;
  delete from grupos_modificadores where tenant_id = v_tenant;
  delete from categorias where tenant_id = v_tenant;

  insert into categorias (tenant_id, nombre) values (v_tenant, '_prueba_')
    returning id into v_categoria;

  -- ── 1. limite_productos: Free permite 20 ────────────────────────────────
  insert into productos (tenant_id, categoria_id, nombre, precio)
  select v_tenant, v_categoria, '_p_' || i, 10 from generate_series(1, 20) i;

  begin
    insert into productos (tenant_id, categoria_id, nombre, precio)
    values (v_tenant, v_categoria, '_p_21', 10);
    raise exception 'FALLO: el producto 21 se insertó en un plan Free de 20';
  exception when others then
    if sqlerrm not like '%limite_productos_alcanzado%' then
      raise exception 'FALLO: se esperaba limite_productos_alcanzado, llegó: %', sqlerrm;
    end if;
    v_pasadas := v_pasadas + 1;
  end;

  -- ── 2. El mismo insert SÍ pasa en Pro (limite null = ilimitado) ─────────
  update tenants set plan_id = v_pro where id = v_tenant;
  insert into productos (tenant_id, categoria_id, nombre, precio)
  values (v_tenant, v_categoria, '_p_21', 10);
  v_pasadas := v_pasadas + 1;
  update tenants set plan_id = v_free where id = v_tenant;

  -- ── 3. limite_sucursales: Free permite 1 ────────────────────────────────
  insert into sucursales (tenant_id, nombre, slug) values (v_tenant, '_s1_', '_s1_')
    returning id into v_sucursal;

  begin
    insert into sucursales (tenant_id, nombre, slug) values (v_tenant, '_s2_', '_s2_');
    raise exception 'FALLO: la segunda sucursal se insertó en un plan Free de 1';
  exception when others then
    if sqlerrm not like '%limite_sucursales_alcanzado%' then
      raise exception 'FALLO: se esperaba limite_sucursales_alcanzado, llegó: %', sqlerrm;
    end if;
    v_pasadas := v_pasadas + 1;
  end;

  -- ── 4. menu_independiente: Free no puede fijar sucursal_id ──────────────
  begin
    insert into productos (tenant_id, categoria_id, sucursal_id, nombre, precio)
    values (v_tenant, v_categoria, v_sucursal, '_exclusivo_', 10);
    raise exception 'FALLO: Free pudo crear un producto exclusivo de sucursal';
  exception when others then
    if sqlerrm not like '%menu_independiente_no_permitido%' then
      raise exception 'FALLO: se esperaba menu_independiente_no_permitido, llegó: %', sqlerrm;
    end if;
    v_pasadas := v_pasadas + 1;
  end;

  -- ── 5. limite_grupos_modificadores: Free permite 2 ──────────────────────
  insert into grupos_modificadores (tenant_id, nombre) values (v_tenant, '_g1_');
  insert into grupos_modificadores (tenant_id, nombre) values (v_tenant, '_g2_');

  begin
    insert into grupos_modificadores (tenant_id, nombre) values (v_tenant, '_g3_');
    raise exception 'FALLO: el tercer grupo se insertó en un plan Free de 2';
  exception when others then
    if sqlerrm not like '%limite_modificadores_alcanzado%' then
      raise exception 'FALLO: se esperaba limite_modificadores_alcanzado, llegó: %', sqlerrm;
    end if;
    v_pasadas := v_pasadas + 1;
  end;

  -- ── 6. timezone inválida ────────────────────────────────────────────────
  begin
    update sucursales set timezone = 'America/Xanadu' where id = v_sucursal;
    raise exception 'FALLO: aceptó una zona horaria inexistente';
  exception when others then
    if sqlerrm not like '%timezone_invalida%' then
      raise exception 'FALLO: se esperaba timezone_invalida, llegó: %', sqlerrm;
    end if;
    v_pasadas := v_pasadas + 1;
  end;

  -- ── 7. formatos: Free solo puede tener Clásico ──────────────────────────
  begin
    update tenants set formatos_desbloqueados = array['clasico','tiktok'] where id = v_tenant;
    raise exception 'FALLO: Free desbloqueó TikTok';
  exception when others then
    if sqlerrm not like '%formato_no_permitido%' then
      raise exception 'FALLO: se esperaba formato_no_permitido, llegó: %', sqlerrm;
    end if;
    v_pasadas := v_pasadas + 1;
  end;

  -- ── 8. Al SUBIR de plan, los formatos se reconcilian sin error ──────────
  update tenants set plan_id = v_pro, formatos_desbloqueados = array['clasico','tiktok']
   where id = v_tenant;
  v_pasadas := v_pasadas + 1;

  -- ── 9. Al BAJAR de plan, se recortan en silencio (no explota) ───────────
  update tenants set plan_id = v_free where id = v_tenant;
  select array_to_string(formatos_desbloqueados, ',') into v_fallo
    from tenants where id = v_tenant;
  if v_fallo <> 'clasico' then
    raise exception 'FALLO: al bajar a Free los formatos quedaron en "%"', v_fallo;
  end if;
  v_pasadas := v_pasadas + 1;

  -- ── 10. tema: Free no puede pedir una fuente que no está en su pool ─────
  begin
    update tenants set tema = '{"fuente":"anton"}'::jsonb where id = v_tenant;
    raise exception 'FALLO: Free eligió una fuente fuera de su plan';
  exception when others then
    if sqlerrm not like '%fuente_no_permitida%' then
      raise exception 'FALLO: se esperaba fuente_no_permitida, llegó: %', sqlerrm;
    end if;
    v_pasadas := v_pasadas + 1;
  end;

  -- ── 11. Al bajar de plan, el tema se limpia solo ────────────────────────
  update tenants set plan_id = v_pro,
                     tema = '{"fuente":"anton","desenfoque_texto":true}'::jsonb
   where id = v_tenant;
  update tenants set plan_id = v_free where id = v_tenant;

  select tema::text into v_fallo from tenants where id = v_tenant;
  if v_fallo like '%anton%' or v_fallo like '%desenfoque_texto%' then
    raise exception 'FALLO: al bajar a Free el tema conservó "%"', v_fallo;
  end if;
  v_pasadas := v_pasadas + 1;

  raise notice '───────────────────────────────';
  raise notice '  % de 11 pruebas pasaron', v_pasadas;
  raise notice '───────────────────────────────';

  if v_pasadas <> 11 then
    raise exception 'Faltaron pruebas por pasar';
  end if;
end;
$$;

-- NADA de lo anterior se guarda.
rollback;

-- ============================================================================
--  Si ves "11 de 11 pruebas pasaron" en los mensajes, los triggers están vivos.
--  Cualquier "FALLO:" nombra exactamente qué trigger dejó de proteger.
--
--  Después del rollback, comprueba que tu tenant quedó intacto:
--    select nombre_negocio, estado, formatos_desbloqueados,
--           (select nombre from planes where id = plan_id) as plan
--      from tenants;
-- ============================================================================
