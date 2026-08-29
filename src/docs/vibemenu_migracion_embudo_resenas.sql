begin;

-- ── flag de plan ────────────────────────────────────────────────────────────
alter table planes
  add column permite_embudo_resenas boolean not null default false;

update planes set permite_embudo_resenas = true where nombre <> 'free';

-- ── tabla de opiniones privadas ─────────────────────────────────────────────
create table feedback_privado (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  -- on delete set null (no cascade): una queja no se pierde porque borren
  -- o renombren una sucursal. null = menú general, sin sucursal en la ruta.
  sucursal_id uuid references sucursales(id) on delete set null,
  sentimiento text not null check (sentimiento in ('regular','mal')),
  comentario  text check (comentario is null or length(comentario) <= 500),
  resuelto    boolean not null default false,
  creado_at   timestamptz not null default now()
);

create index idx_feedback_tenant on feedback_privado (tenant_id, creado_at desc);

alter table feedback_privado enable row level security;

-- Lectura: cualquier miembro del tenant.
create policy "feedback_select_miembros" on feedback_privado for select
  to authenticated using (pertenece_a_tenant(tenant_id));

-- Escritura desde el panel: solo marcar resuelto. La columna se restringe con
-- el grant de abajo; la policy cubre la fila.
create policy "feedback_update_miembros" on feedback_privado for update
  to authenticated using (pertenece_a_tenant(tenant_id))
  with check (pertenece_a_tenant(tenant_id));

revoke all on feedback_privado from anon, authenticated;
grant select on feedback_privado to authenticated;
grant update (resuelto) on feedback_privado to authenticated;

-- ── registrar_feedback: único camino de escritura del comensal ──────────────
-- El comensal no tiene sesión. Igual que registrar_visita: SECURITY DEFINER,
-- valida pertenencia, y NUNCA revienta — un menú público no se rompe por esto.
-- Orden de params: los que tienen default van al final (regla de Postgres).
-- El cliente llama con params nombrados, así que el orden no le afecta.
create or replace function registrar_feedback(
  p_tenant_id   uuid,
  p_sentimiento text,
  p_sucursal_id uuid default null,
  p_comentario  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comentario text := nullif(btrim(p_comentario), '');
begin
  if p_sentimiento not in ('regular','mal') then
    return;
  end if;

  if not exists (select 1 from tenants t where t.id = p_tenant_id) then
    return;
  end if;

  -- Sucursal de otro tenant (o inexistente) → se guarda como menú general.
  if p_sucursal_id is not null and not exists (
    select 1 from sucursales s where s.id = p_sucursal_id and s.tenant_id = p_tenant_id
  ) then
    p_sucursal_id := null;
  end if;

  -- Recorte defensivo: el check de columna es 500, pero no queremos que un
  -- payload gigante llegue siquiera a evaluarse.
  if v_comentario is not null then
    v_comentario := left(v_comentario, 500);
  end if;

  insert into feedback_privado (tenant_id, sucursal_id, sentimiento, comentario)
  values (p_tenant_id, p_sucursal_id, p_sentimiento, v_comentario);
end;
$$;

revoke execute on function registrar_feedback(uuid, text, uuid, text) from public;
grant  execute on function registrar_feedback(uuid, text, uuid, text) to anon, authenticated;

commit;

-- ── Verificar ──────────────────────────────────────────────────────────────
--   select nombre, permite_embudo_resenas from planes order by precio_usd;
--   -- free=false, resto=true
--
--   select registrar_feedback(t.id, null, 'mal', '  el café llegó frío  ')
--     from tenants t limit 1;
--   select tenant_id, sentimiento, comentario, resuelto from feedback_privado;
--   -- comentario trim-eado, resuelto=false
--
--   select registrar_feedback('00000000-0000-0000-0000-000000000000'::uuid, null, 'mal', 'x');
--   -- void, sin fila nueva
--
--   select registrar_feedback(t.id, null, 'bien', 'x') from tenants t limit 1;
--   -- void, sin fila nueva (bien no se guarda)
