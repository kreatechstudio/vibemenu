-- ============================================================================
--  VIBEMENU — migracion 017: datos fiscales (preparacion para CFDI real)
--
--  Todavia NO se timbra ningun CFDI: no hay PAC (Facturapi, Facturama, etc.)
--  conectado, y eso requiere que KreaTech Studio tenga su propio RFC con
--  actividad empresarial, e.firma y un PAC contratado — pasos fuera de este
--  repo. Esta migracion solo junta los datos del NEGOCIO RECEPTOR (el tenant
--  que paga la suscripcion) para que, el dia que se conecte un PAC, no haya
--  que perseguir a cada cliente por su RFC.
--
--  Tabla NUEVA (no columnas en `tenants`): `tenants` tiene
--  `tenants_select_publico using (true)` porque el menu publico la lee sin
--  autenticacion — un RFC ahi quedaria visible para cualquiera con el anon
--  key. `datos_fiscales` es su propia tabla, sin policy publica, solo el
--  owner del tenant puede leerla o escribirla.
--
--  Ejecutar COMPLETO en el SQL Editor de Supabase.
-- ============================================================================

begin;

create table datos_fiscales (
  tenant_id uuid primary key references tenants(id) on delete cascade,

  rfc text
    constraint datos_fiscales_rfc_formato check (
      rfc is null or rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'
    ),
  razon_social text,
  -- Domicilio fiscal del receptor: CFDI 4.0 lo exige para timbrar.
  codigo_postal text
    constraint datos_fiscales_cp_formato check (
      codigo_postal is null or codigo_postal ~ '^[0-9]{5}$'
    ),
  -- Claves del catalogo SAT (c_RegimenFiscal / c_UsoCFDI). La lista completa
  -- vive en src/lib/facturacion.ts — el dropdown del formulario ya solo deja
  -- elegir de ahi, este check es la segunda linea de defensa.
  regimen_fiscal text
    constraint datos_fiscales_regimen_valido check (
      regimen_fiscal is null or regimen_fiscal in (
        '601', '603', '605', '606', '607', '608', '610', '611', '612', '614',
        '615', '616', '620', '621', '622', '623', '624', '625', '626'
      )
    ),
  uso_cfdi text
    constraint datos_fiscales_uso_valido check (
      uso_cfdi is null or uso_cfdi in (
        'G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07',
        'I08', 'P01', 'S01', 'CP01'
      )
    ),
  -- Puede ser distinto al correo de la cuenta (p. ej. el de contabilidad).
  email text,

  updated_at timestamptz not null default now()
);

-- Normaliza mayusculas/espacios antes de que el check de formato evalue la
-- fila. Mismo patron que validar_dominio_tenant en la migracion 013.
create or replace function normalizar_datos_fiscales()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.rfc := nullif(upper(trim(new.rfc)), '');
  new.razon_social := nullif(trim(new.razon_social), '');
  new.codigo_postal := nullif(trim(new.codigo_postal), '');
  new.email := nullif(lower(trim(new.email)), '');
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_datos_fiscales_10_normalizar
  before insert or update on datos_fiscales
  for each row execute function normalizar_datos_fiscales();

alter table datos_fiscales enable row level security;

-- Sin policy publica. Solo el owner del tenant — ni encargados, que ya estan
-- excluidos de "administrar facturacion" en el resto de la app (ver
-- AdminLayout.tsx, portal-stripe/index.ts).
create policy "datos_fiscales_owner" on datos_fiscales for all
  to authenticated
  using (es_owner_de_tenant(tenant_id))
  with check (es_owner_de_tenant(tenant_id));

commit;

-- ============================================================================
--  Verificar:
--
--    select * from information_schema.tables where table_name = 'datos_fiscales';
--
--    select policyname, cmd from pg_policies where tablename = 'datos_fiscales';
--    -- debe salir SOLO 'datos_fiscales_owner', nunca algo con "publico".
--
--    -- Un RFC mal formado debe fallar con datos_fiscales_rfc_formato:
--    insert into datos_fiscales (tenant_id, rfc)
--      values ('<tenant-id>', 'NO-VALIDO');
-- ============================================================================
