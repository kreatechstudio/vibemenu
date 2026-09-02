# Vibemenu — Base de Datos y SQL

⚠️ TODO este SQL se ejecuta MANUALMENTE en Supabase SQL Editor.
NUNCA ejecutar desde Lovable Cloud. NUNCA editar Auth desde Lovable Cloud — usar Supabase Dashboard directamente.

**El script está en orden de ejecución.** Córrelo de arriba a abajo, sección por sección, sin saltarte ninguna.
`planes` se crea ANTES que `tenants` porque `tenants.plan_id` la referencia.

---

## Diagrama de tablas

```
planes (1) ──< tenants (1) ──< tenant_usuarios >── auth.users
tenants (1) ──< sucursales (1) ──< horarios
tenants (1) ──< categorias >── sucursales (nullable)
categorias (1) ──< productos >── sucursales (nullable)
tenants (1) ──< grupos_modificadores (1) ──< opciones_modificador
productos >──< grupos_modificadores   (vía producto_modificadores)
planes (1) ──< suscripciones >── tenants     (historial: N filas por tenant, 1 sola 'activa')
slugs_reservados (standalone)
```

---

## Conceptos clave

### Límites de plan

Todo límite vive en la tabla `planes` y se aplica con **triggers en la base de datos**, no solo en la UI.
Un `null` en cualquier columna `limite_*` significa **ilimitado**.
El frontend lee `planes` para mostrar/ocultar controles; la base de datos es la que realmente bloquea.

### Formatos: pool elegible + límite

- `planes.formatos_permitidos` = el **pool** entre los que el tenant puede elegir.
- `planes.limite_formatos` = **cuántos** puede tener desbloqueados a la vez (`null` = todos los del pool).
- `tenants.formatos_desbloqueados` = los que el tenant **eligió**.
- `tenants.formato_activo` = el que se está mostrando ahora (debe estar desbloqueado).

Así, Basic tiene pool de los 4 y `limite_formatos = 2`: siempre Clásico + **uno a elegir**.
`'clasico'` se fuerza siempre dentro de `formatos_desbloqueados`.

Al **cambiar de plan**, los formatos se reconcilian en silencio (se recortan al nuevo pool y límite,
y `formato_activo` cae a `'clasico'` si quedó fuera). Al **editar manualmente**, un formato fuera del
plan lanza error explícito.

### Menú compartido vs. independiente

`sucursal_id` nullable en `categorias` y `productos`:

- `NULL` → visible en **todas** las sucursales (menú compartido)
- `uuid` → exclusivo de **esa** sucursal (menú independiente)

Solo los planes con `menu_independiente_por_sucursal = true` pueden escribir un `sucursal_id` no nulo.
No existe tabla `menus`.

### Precio congelado

`suscripciones.precio_congelado_usd/mxn` se copian de `planes` en el momento del alta o del upgrade.
Subir el precio de lista en `planes` no afecta a suscripciones ya existentes.
Solo la Edge Function de webhooks (con `service_role_key`) escribe en `suscripciones`.

### Historial de suscripciones

`suscripciones` guarda **una fila por periodo de plan**, no una sola fila mutable.
Un índice único parcial garantiza **una sola fila `'activa'` por tenant**.
Al cambiar de plan, la fila anterior pasa a `'reemplazada'` con su `fecha_fin`, y se inserta una nueva.
El owner ve todo su historial. Los recibos/facturas fiscales son fase 2: colgarán de una tabla `pagos`
alimentada por el webhook `invoice.paid`, con FK a `suscripciones.id`.

---

## 1. Planes (primero — `tenants` lo referencia)

```sql
create table planes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique, -- 'free', 'basic', 'pro', 'enterprise'
  precio_usd numeric(10,2) not null,
  precio_mxn numeric(10,2) not null,

  -- Límites (null = ilimitado)
  limite_sucursales int,
  limite_productos int,
  limite_usuarios int,
  limite_grupos_modificadores int,
  limite_formatos int,

  -- Pool de formatos entre los que el tenant puede elegir
  formatos_permitidos text[] not null default array['clasico'],

  -- Capacidades
  menu_independiente_por_sucursal boolean not null default false,
  permite_multiusuario boolean not null default false,
  permite_dominio_propio boolean not null default false,
  marca_agua boolean not null default true,

  stripe_price_id_usd text,
  stripe_price_id_mxn text,

  constraint formatos_permitidos_validos
    check (formatos_permitidos <@ array['clasico','pinterest','instagram','tiktok'])
);

insert into planes (
  nombre, precio_usd, precio_mxn,
  limite_sucursales, limite_productos, limite_usuarios, limite_grupos_modificadores, limite_formatos,
  formatos_permitidos,
  menu_independiente_por_sucursal, permite_multiusuario, permite_dominio_propio, marca_agua
) values
  ('free',        0,   0,     1,    20,   1,    2,    1,
   array['clasico'],
   false, false, false, true),

  ('basic',       9,   169,   1,    null, 1,    5,    2,
   array['clasico','pinterest','instagram','tiktok'],
   false, false, false, false),

  ('pro',         19,  349,   3,    null, 2,    null, null,
   array['clasico','pinterest','instagram','tiktok'],
   true,  true,  true,  false),

  ('enterprise',  39,  699,   null, null, null, null, null,
   array['clasico','pinterest','instagram','tiktok'],
   true,  true,  true,  false);
```

---

## 2. Tenants y slugs reservados

```sql
create table tenants (
  id uuid primary key default gen_random_uuid(),
  nombre_negocio text not null,
  slug text unique not null,
  giro text,
  logo_url text,
  whatsapp text,
  telefono text,

  formato_activo text not null default 'clasico'
    check (formato_activo in ('clasico','pinterest','instagram','tiktok')),

  -- Formatos que el tenant eligió dentro del pool de su plan
  formatos_desbloqueados text[] not null default array['clasico'],

  tema jsonb not null default '{}'::jsonb, -- colores, tipografía, imagen_fondo por formato
  plan_id uuid references planes(id),      -- lo rellena el trigger a 'free' si viene null
  estado text not null default 'trial'
    check (estado in ('trial','activo','suspendido','cancelado')),
  trial_iniciado_at timestamptz not null default now(),
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint formatos_desbloqueados_validos
    check (formatos_desbloqueados <@ array['clasico','pinterest','instagram','tiktok']),
  constraint formatos_desbloqueados_no_vacio
    check (cardinality(formatos_desbloqueados) >= 1)
);

create table slugs_reservados (
  slug text primary key
);

insert into slugs_reservados (slug) values
  ('admin'), ('api'), ('app'), ('login'), ('registro'), ('precios'),
  ('demo'), ('docs'), ('blog'), ('soporte'), ('www'), ('mail'),
  ('help'), ('billing'), ('stripe'), ('webhook'), ('static'), ('assets');
```

---

## 3. Tenant_usuarios (owner + encargados)

```sql
create table tenant_usuarios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rol text not null default 'owner' check (rol in ('owner','encargado')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

-- Un solo owner por tenant
create unique index uniq_owner_por_tenant
  on tenant_usuarios (tenant_id) where rol = 'owner';
```

---

## 4. Sucursales y horarios

```sql
create table sucursales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  nombre text not null,
  slug text not null, -- único dentro del tenant, no global
  direccion text,
  telefono text,
  whatsapp text,

  -- Zona horaria IANA de la sucursal. Necesaria para el cálculo de abierto/cerrado:
  -- sin esto se usaría la hora del navegador del visitante, que puede estar en otro huso.
  timezone text not null default 'America/Mexico_City',

  activa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table horarios (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6), -- 0 = domingo
  hora_apertura time,
  hora_cierre time,
  cerrado boolean not null default false,
  unique (sucursal_id, dia_semana)
);
```

Convención de horarios:

- `cerrado = true` → ese día no abre, se ignoran las horas.
- `hora_cierre > hora_apertura` → turno normal (09:00 → 22:00).
- `hora_cierre < hora_apertura` → **cruza medianoche** (20:00 → 02:00).
- `hora_cierre = hora_apertura` → abierto 24 h.

---

## 5. Categorías y productos

```sql
create table categorias (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  sucursal_id uuid references sucursales(id) on delete cascade, -- null = todas las sucursales
  nombre text not null,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create table productos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  categoria_id uuid not null references categorias(id) on delete cascade,
  sucursal_id uuid references sucursales(id) on delete cascade, -- null = todas las sucursales
  nombre text not null,
  descripcion text,
  precio numeric(10,2) not null default 0 check (precio >= 0),
  imagen_url text, -- 1 foto por producto, todos los planes
  video_url text,  -- opcional: YouTube/Reel embed, usado en formato TikTok
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

## 6. Modificadores

```sql
create table grupos_modificadores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  nombre text not null, -- ej: "Tamaño de café", "Tipo de leche", "Extras"
  tipo_seleccion text not null default 'unica' check (tipo_seleccion in ('unica','multiple')),
  obligatorio boolean not null default false,
  min_selecciones int not null default 0 check (min_selecciones >= 0),
  max_selecciones int check (max_selecciones is null or max_selecciones >= min_selecciones),
  orden int not null default 0
);

create table opciones_modificador (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos_modificadores(id) on delete cascade,
  nombre text not null, -- ej: "Grande", "Leche de almendra"
  precio_extra numeric(10,2) not null default 0,
  orden int not null default 0
);

create table producto_modificadores (
  producto_id uuid not null references productos(id) on delete cascade,
  grupo_id uuid not null references grupos_modificadores(id) on delete cascade,
  primary key (producto_id, grupo_id)
);
```

---

## 7. Suscripciones (historial + precio congelado)

```sql
create table suscripciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  plan_id uuid not null references planes(id),

  -- Se congelan AMBAS monedas al momento del alta/upgrade, aunque se cobre solo una
  precio_congelado_usd numeric(10,2) not null,
  precio_congelado_mxn numeric(10,2) not null,
  moneda_cobro text not null default 'usd' check (moneda_cobro in ('usd','mxn')),

  stripe_subscription_id text,

  estado text not null
    check (estado in ('activa','cancelada','vencida','reemplazada'))
    default 'activa',

  -- Por qué nació esta fila del historial
  motivo_cambio text not null default 'alta'
    check (motivo_cambio in ('alta','upgrade','downgrade','reactivacion','cancelacion','vencimiento')),

  fecha_inicio timestamptz not null default now(),
  fecha_renovacion timestamptz,
  fecha_fin timestamptz, -- se llena cuando la fila deja de estar activa
  created_at timestamptz not null default now(),

  constraint fecha_fin_coherente
    check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

-- Una sola suscripción activa por tenant. El resto es historial.
create unique index uniq_suscripcion_activa_por_tenant
  on suscripciones (tenant_id) where estado = 'activa';
```

---

## 8. Habilitar RLS

```sql
alter table planes enable row level security;
alter table tenants enable row level security;
alter table slugs_reservados enable row level security;
alter table tenant_usuarios enable row level security;
alter table sucursales enable row level security;
alter table horarios enable row level security;
alter table categorias enable row level security;
alter table productos enable row level security;
alter table grupos_modificadores enable row level security;
alter table opciones_modificador enable row level security;
alter table producto_modificadores enable row level security;
alter table suscripciones enable row level security;
```

---

## 9. Funciones helper y políticas RLS

```sql
create or replace function pertenece_a_tenant(check_tenant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from tenant_usuarios
    where tenant_id = check_tenant_id and user_id = auth.uid()
  );
$$;

create or replace function es_owner_de_tenant(check_tenant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from tenant_usuarios
    where tenant_id = check_tenant_id and user_id = auth.uid() and rol = 'owner'
  );
$$;
```

```sql
-- PLANES: lectura pública (landing y /precios). Sin escritura desde el frontend.
create policy "planes_select_publico" on planes for select using (true);

-- SLUGS_RESERVADOS: lectura pública para validar en el registro.
create policy "slugs_reservados_select_publico" on slugs_reservados for select using (true);

-- TENANTS: lectura pública (menú público por slug), escritura solo miembros.
create policy "tenants_select_publico" on tenants for select using (true);
create policy "tenants_update_miembros" on tenants for update
  using (pertenece_a_tenant(id)) with check (pertenece_a_tenant(id));
-- Solo un usuario autenticado puede dar de alta un tenant (el trigger lo hace owner).
create policy "tenants_insert_autenticado" on tenants for insert
  to authenticated with check (auth.uid() is not null);

-- TENANT_USUARIOS
create policy "tenant_usuarios_select" on tenant_usuarios for select
  using (pertenece_a_tenant(tenant_id));
create policy "tenant_usuarios_insert" on tenant_usuarios for insert
  to authenticated with check (es_owner_de_tenant(tenant_id) or user_id = auth.uid());
create policy "tenant_usuarios_delete_owner" on tenant_usuarios for delete
  using (es_owner_de_tenant(tenant_id));

-- SUCURSALES
create policy "sucursales_select_publico" on sucursales for select using (true);
create policy "sucursales_write_miembros" on sucursales for all
  to authenticated using (pertenece_a_tenant(tenant_id));

-- HORARIOS
create policy "horarios_select_publico" on horarios for select using (true);
create policy "horarios_write_miembros" on horarios for all
  to authenticated using (
    pertenece_a_tenant((select tenant_id from sucursales where id = sucursal_id))
  );

-- CATEGORIAS / PRODUCTOS
create policy "categorias_select_publico" on categorias for select using (true);
create policy "categorias_write_miembros" on categorias for all
  to authenticated using (pertenece_a_tenant(tenant_id));

create policy "productos_select_publico" on productos for select using (true);
create policy "productos_write_miembros" on productos for all
  to authenticated using (pertenece_a_tenant(tenant_id));

-- MODIFICADORES
create policy "grupos_mod_select_publico" on grupos_modificadores for select using (true);
create policy "grupos_mod_write_miembros" on grupos_modificadores for all
  to authenticated using (pertenece_a_tenant(tenant_id));

create policy "opciones_mod_select_publico" on opciones_modificador for select using (true);
create policy "opciones_mod_write_miembros" on opciones_modificador for all
  to authenticated using (
    pertenece_a_tenant((select tenant_id from grupos_modificadores where id = grupo_id))
  );

create policy "producto_mod_select_publico" on producto_modificadores for select using (true);
create policy "producto_mod_write_miembros" on producto_modificadores for all
  to authenticated using (
    pertenece_a_tenant((select tenant_id from productos where id = producto_id))
  );

-- SUSCRIPCIONES: el owner ve TODO su historial. Nadie escribe desde el frontend.
-- Insert/update/delete solo vía Edge Function con service_role_key (bypassea RLS).
create policy "suscripciones_select_owner" on suscripciones for select
  using (es_owner_de_tenant(tenant_id));
```

### Privilegios de columna en `tenants` (crítico)

RLS deja que un miembro haga `update tenants`. Sin esto, cualquier usuario autenticado podría
ejecutar `update tenants set plan_id = <id de pro>` desde el navegador y desbloquear todos los
límites **sin pasar por Stripe**. El plan y el estado de facturación solo los toca la Edge Function
con `service_role_key`, que bypassea tanto RLS como estos grants.

```sql
revoke update on tenants from anon, authenticated;

grant update (
  nombre_negocio, slug, giro, logo_url, whatsapp, telefono,
  formato_activo, formatos_desbloqueados, tema
) on tenants to authenticated;
```

Quedan fuera del alcance del frontend, a propósito: `plan_id`, `estado`, `stripe_customer_id`,
`trial_iniciado_at`.

---

## 10. Índices

```sql
create index idx_tenants_slug on tenants(slug);
create index idx_tenants_plan on tenants(plan_id);
create index idx_tenant_usuarios_user on tenant_usuarios(user_id);
create index idx_sucursales_tenant on sucursales(tenant_id);
create index idx_horarios_sucursal on horarios(sucursal_id);
create index idx_categorias_tenant on categorias(tenant_id);
create index idx_categorias_sucursal on categorias(sucursal_id);
create index idx_productos_tenant on productos(tenant_id);
create index idx_productos_categoria on productos(categoria_id);
create index idx_productos_sucursal on productos(sucursal_id);
create index idx_grupos_mod_tenant on grupos_modificadores(tenant_id);
create index idx_opciones_mod_grupo on opciones_modificador(grupo_id);
create index idx_suscripciones_tenant_fecha on suscripciones(tenant_id, fecha_inicio desc);
```

---

## 11. Enforcement de límites de plan (triggers)

Los `raise exception` usan un **slug estable** como mensaje (`limite_productos_alcanzado`) y el número
real en `detail`. El frontend hace match sobre el slug y arma el copy de `copywriting.md`.

Los triggers toman un `pg_advisory_xact_lock` por tenant antes de contar, para que dos inserts
concurrentes no se salten el límite.

### 11.1 Plan por defecto y formatos

```sql
-- Normaliza una lista de formatos contra el pool y el límite de un plan:
-- quita duplicados y los que no están en el pool, fuerza 'clasico' al frente, recorta al límite.
create or replace function normalizar_formatos(
  p_formatos text[],
  p_pool text[],
  p_limite int
)
returns text[]
language sql
immutable
as $$
  with filtrados as (
    select distinct f
      from unnest(coalesce(p_formatos, array['clasico'])) as f
     where f = any(p_pool)
  ),
  con_clasico as (
    select f from filtrados
    union
    select 'clasico'::text where 'clasico' = any(p_pool)
  ),
  ordenados as (
    select f, row_number() over (order by (f <> 'clasico'), f) as rn
      from con_clasico
  )
  select coalesce(array_agg(f order by rn), array['clasico'])
    from ordenados
   where p_limite is null or rn <= p_limite;
$$;

-- Si no viene plan, el tenant nace en 'free'.
create or replace function set_plan_free_por_defecto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan_id is null then
    select id into new.plan_id from planes where nombre = 'free';
  end if;
  return new;
end;
$$;

create trigger trg_tenants_10_plan_default
  before insert on tenants
  for each row execute function set_plan_free_por_defecto();

-- Valida/reconcilia formatos_desbloqueados y formato_activo contra el plan.
create or replace function validar_formatos_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool   text[];
  v_limite int;
  v_cambio_de_plan boolean;
begin
  select formatos_permitidos, limite_formatos
    into v_pool, v_limite
    from planes where id = new.plan_id;

  if v_pool is null then
    raise exception 'plan_inexistente';
  end if;

  -- OJO: no se puede escribir esto como `tg_op = 'INSERT' or new.plan_id is distinct from old.plan_id`.
  -- PL/pgSQL no cortocircuita el OR y OLD no está asignado en un trigger de INSERT.
  if tg_op = 'INSERT' then
    v_cambio_de_plan := true;
  else
    v_cambio_de_plan := new.plan_id is distinct from old.plan_id;
  end if;

  if not v_cambio_de_plan then
    -- Edición manual: pedir algo fuera del plan es un error explícito.
    if not (new.formatos_desbloqueados <@ v_pool) then
      raise exception 'formato_no_permitido'
        using detail = format('Tu plan permite elegir entre: %s', array_to_string(v_pool, ', '));
    end if;
    if v_limite is not null and cardinality(new.formatos_desbloqueados) > v_limite then
      raise exception 'limite_formatos_alcanzado'
        using detail = format('Tu plan permite %s formatos desbloqueados.', v_limite);
    end if;
  end if;

  -- Alta o cambio de plan: se recorta en silencio al nuevo pool/límite.
  new.formatos_desbloqueados := normalizar_formatos(new.formatos_desbloqueados, v_pool, v_limite);

  if not (new.formato_activo = any(new.formatos_desbloqueados)) then
    if v_cambio_de_plan then
      new.formato_activo := 'clasico';
    else
      raise exception 'formato_activo_no_desbloqueado'
        using detail = 'Ese formato no está desbloqueado en tu plan.';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_tenants_20_formatos
  before insert or update on tenants
  for each row execute function validar_formatos_tenant();
```

### 11.2 Owner automático y límite de usuarios

```sql
create or replace function crear_owner_al_registrar_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into tenant_usuarios (tenant_id, user_id, rol)
  values (new.id, auth.uid(), 'owner');
  return new;
end;
$$;

create trigger trg_crear_owner
  after insert on tenants
  for each row execute function crear_owner_al_registrar_tenant();

create or replace function validar_limite_usuarios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_permite boolean;
  v_limite  int;
  v_count   int;
begin
  select p.permite_multiusuario, p.limite_usuarios
    into v_permite, v_limite
    from planes p join tenants t on t.plan_id = p.id
   where t.id = new.tenant_id;

  if new.rol = 'encargado' and not coalesce(v_permite, false) then
    raise exception 'multiusuario_no_permitido'
      using detail = 'Tu plan no permite agregar encargados.';
  end if;

  if v_limite is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('tenant_usuarios:' || new.tenant_id::text));

  select count(*) into v_count from tenant_usuarios where tenant_id = new.tenant_id;

  if v_count >= v_limite then
    raise exception 'limite_usuarios_alcanzado'
      using detail = format('Tu plan permite hasta %s usuarios.', v_limite);
  end if;

  return new;
end;
$$;

create trigger trg_limite_usuarios
  before insert on tenant_usuarios
  for each row execute function validar_limite_usuarios();
```

### 11.3 Límite de sucursales + zona horaria válida

```sql
create or replace function validar_limite_sucursales()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limite int;
  v_count  int;
begin
  select p.limite_sucursales into v_limite
    from planes p join tenants t on t.plan_id = p.id
   where t.id = new.tenant_id;

  if v_limite is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('sucursales:' || new.tenant_id::text));

  select count(*) into v_count from sucursales where tenant_id = new.tenant_id;

  if v_count >= v_limite then
    raise exception 'limite_sucursales_alcanzado'
      using detail = format('Tu plan actual permite hasta %s sucursales.', v_limite);
  end if;

  return new;
end;
$$;

create trigger trg_sucursales_20_limite
  before insert on sucursales
  for each row execute function validar_limite_sucursales();

create or replace function validar_timezone_sucursal()
returns trigger
language plpgsql
stable
as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'timezone_invalida'
      using detail = format('"%s" no es una zona horaria IANA válida.', new.timezone);
  end if;
  return new;
end;
$$;

create trigger trg_sucursales_10_timezone
  before insert or update on sucursales
  for each row execute function validar_timezone_sucursal();
```

### 11.4 Límite de productos y coherencia de sucursal

```sql
-- Solo los planes con menu_independiente_por_sucursal pueden fijar sucursal_id.
-- Sirve para categorias y productos (ambas tienen tenant_id y sucursal_id).
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

create trigger trg_categorias_10_sucursal
  before insert or update on categorias
  for each row execute function validar_sucursal_en_menu();

create trigger trg_productos_10_sucursal
  before insert or update on productos
  for each row execute function validar_sucursal_en_menu();

-- Un producto no puede colgar de una categoría de otro tenant,
-- ni ser "de todas las sucursales" si su categoría es exclusiva de una.
create or replace function validar_producto_categoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat_tenant   uuid;
  v_cat_sucursal uuid;
begin
  select tenant_id, sucursal_id into v_cat_tenant, v_cat_sucursal
    from categorias where id = new.categoria_id;

  if v_cat_tenant is distinct from new.tenant_id then
    raise exception 'categoria_de_otro_tenant';
  end if;

  if v_cat_sucursal is not null and new.sucursal_id is distinct from v_cat_sucursal then
    raise exception 'producto_sucursal_incoherente'
      using detail = 'La categoría es exclusiva de una sucursal; el producto debe pertenecer a la misma.';
  end if;

  return new;
end;
$$;

create trigger trg_productos_20_categoria
  before insert or update on productos
  for each row execute function validar_producto_categoria();

create or replace function validar_limite_productos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limite int;
  v_count  int;
begin
  select p.limite_productos into v_limite
    from planes p join tenants t on t.plan_id = p.id
   where t.id = new.tenant_id;

  if v_limite is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('productos:' || new.tenant_id::text));

  select count(*) into v_count from productos where tenant_id = new.tenant_id;

  if v_count >= v_limite then
    raise exception 'limite_productos_alcanzado'
      using detail = format('Tu plan permite hasta %s productos.', v_limite);
  end if;

  return new;
end;
$$;

create trigger trg_productos_30_limite
  before insert on productos
  for each row execute function validar_limite_productos();
```

### 11.5 Límite de grupos de modificadores

```sql
create or replace function validar_limite_grupos_modificadores()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limite int;
  v_count  int;
begin
  select p.limite_grupos_modificadores into v_limite
    from planes p join tenants t on t.plan_id = p.id
   where t.id = new.tenant_id;

  if v_limite is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('grupos_mod:' || new.tenant_id::text));

  select count(*) into v_count from grupos_modificadores where tenant_id = new.tenant_id;

  if v_count >= v_limite then
    raise exception 'limite_modificadores_alcanzado'
      using detail = format('Tu plan permite hasta %s grupos de modificadores.', v_limite);
  end if;

  return new;
end;
$$;

create trigger trg_limite_grupos_mod
  before insert on grupos_modificadores
  for each row execute function validar_limite_grupos_modificadores();
```

### 11.6 updated_at automático

```sql
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_tenants_30_updated_at before update on tenants
  for each row execute function set_updated_at();

create trigger trg_productos_40_updated_at before update on productos
  for each row execute function set_updated_at();
```

---

## 12. Abierto / cerrado con zona horaria

Se calcula **en el servidor**, con la `timezone` de la sucursal — nunca con la hora del navegador.
Maneja turnos que cruzan medianoche revisando también el horario del día anterior.

```sql
create or replace function sucursal_esta_abierta(p_sucursal_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_tz    text;
  v_local timestamp;
  v_dia   smallint;
  v_hora  time;
  r       record;
begin
  select timezone into v_tz from sucursales where id = p_sucursal_id and activa;
  if v_tz is null then
    return false;
  end if;

  v_local := now() at time zone v_tz;
  v_dia   := extract(dow from v_local)::smallint; -- 0 = domingo
  v_hora  := v_local::time;

  -- Turno que empieza hoy
  select * into r from horarios
   where sucursal_id = p_sucursal_id and dia_semana = v_dia;

  if found then
    if not r.cerrado and r.hora_apertura is not null and r.hora_cierre is not null then
      if r.hora_cierre > r.hora_apertura then
        if v_hora >= r.hora_apertura and v_hora < r.hora_cierre then
          return true;
        end if;
      else
        -- cruza medianoche (o 24 h si son iguales)
        if v_hora >= r.hora_apertura then
          return true;
        end if;
      end if;
    end if;
  end if;

  -- Turno que empezó ayer y sigue abierto pasada la medianoche
  select * into r from horarios
   where sucursal_id = p_sucursal_id and dia_semana = ((v_dia + 6) % 7)::smallint;

  if found then
    if not r.cerrado and r.hora_apertura is not null and r.hora_cierre is not null
       and r.hora_cierre < r.hora_apertura then
      if v_hora < r.hora_cierre then
        return true;
      end if;
    end if;
  end if;

  return false;
end;
$$;

grant execute on function sucursal_esta_abierta(uuid) to anon, authenticated;
```

Uso desde el frontend:

```ts
const { data } = await supabase.rpc("sucursal_esta_abierta", { p_sucursal_id: sucursalId });
```

---

## 13. Storage buckets

```sql
insert into storage.buckets (id, name, public)
values ('vibemenu-media', 'vibemenu-media', true)
on conflict (id) do nothing;

-- Path esperado: {tenant_id}/{lo-que-sea}. El regex evita que un path malformado
-- reviente el cast a uuid.
create policy "vibemenu_media_insert_miembros" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'vibemenu-media'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and pertenece_a_tenant(((storage.foldername(name))[1])::uuid)
  );

create policy "vibemenu_media_select_publico" on storage.objects for select
  using (bucket_id = 'vibemenu-media');

create policy "vibemenu_media_delete_miembros" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'vibemenu-media'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and pertenece_a_tenant(((storage.foldername(name))[1])::uuid)
  );
```

---

## 14. Notas sobre Auth y Stripe

- Auth: email/password vía Supabase Auth, configurado desde el Dashboard (nunca desde Lovable Cloud).
- El `service_role_key` de Supabase solo vive en la Edge Function que procesa webhooks de Stripe — nunca se expone al frontend.
- El precio mostrado en checkout depende de `moneda_cobro` elegida por el tenant: usa `stripe_price_id_usd` o `stripe_price_id_mxn` de `planes`.

### Qué hace la Edge Function `stripe-webhook`

Escribe siempre en `suscripciones` **insertando una fila nueva**, nunca mutando el historial.

| Evento de Stripe                | Acción                                                                                                                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkout.session.completed`    | Cierra la fila `activa` previa (`estado='reemplazada'`, `fecha_fin=now()`), inserta una nueva con `precio_congelado_*` copiado de `planes` y `motivo_cambio` = `'alta'` o `'upgrade'`/`'downgrade'`. Actualiza `tenants.plan_id` y `tenants.estado='activo'`. |
| `customer.subscription.updated` | Sincroniza `fecha_renovacion` y `estado` de la fila activa. Si cambió el plan, aplica el mismo cierre + inserción de arriba.                                                                                                                                  |
| `customer.subscription.deleted` | `estado='cancelada'`, `fecha_fin=now()` en la fila activa. `tenants.estado='suspendido'`.                                                                                                                                                                     |

Al bajar de plan, actualizar `tenants.plan_id` dispara `trg_tenants_20_formatos`, que recorta
`formatos_desbloqueados` automáticamente. **Lo que no se recorta solo** son productos y sucursales
que excedan el nuevo límite: los triggers solo bloquean `INSERT`, no borran lo existente.
Decidir en fase 2 si se ocultan o se fuerza al tenant a elegir cuáles conservar.

### Fase 2: recibos y facturación

`suscripciones` ya guarda historial. Cuando toque facturación, colgar de ahí:

```sql
-- NO EJECUTAR TODAVÍA — referencia para fase 2
-- create table pagos (
--   id uuid primary key default gen_random_uuid(),
--   suscripcion_id uuid not null references suscripciones(id),
--   stripe_invoice_id text unique not null,
--   monto numeric(10,2) not null,
--   moneda text not null,
--   pagado_at timestamptz not null,
--   recibo_url text
-- );
```

---

## 15. Reservaciones simples (migración 012)

### Capacidad de plan

Primero, añadir la columna de capacidad a `planes`:

```sql
alter table planes
  add column if not exists permite_reservaciones boolean not null default false;

update planes set permite_reservaciones = true where nombre in ('pro', 'enterprise');
```

### Opt-in por sucursal

Añadir dos columnas a `sucursales`:

```sql
alter table sucursales
  add column if not exists acepta_reservaciones boolean not null default false,
  add column if not exists reservaciones_email text
    constraint sucursal_reservaciones_email_valido
      check (reservaciones_email is null
             or reservaciones_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
```

La policy `sucursales_write_miembros` ya cubre la tabla entera: sin grant extra necesario.

### Tabla principal

```sql
create table reservaciones (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  sucursal_id       uuid not null references sucursales(id) on delete cascade,
  nombre            text not null check (length(btrim(nombre)) between 2 and 120),
  personas          int  not null check (personas between 1 and 99),
  fecha_hora        timestamptz not null,
  telefono          text not null check (length(btrim(telefono)) between 6 and 30),
  email             text check (email is null
                     or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  nota              text check (nota is null or length(nota) <= 500),
  estado            text not null default 'nueva'
                     check (estado in ('nueva','atendida','cancelada')),
  consentimiento_at timestamptz not null default now(),
  ip                inet,
  creada_en         timestamptz not null default now()
);

create index idx_reservaciones_tenant on reservaciones (tenant_id, fecha_hora desc);
create index idx_reservaciones_tenant_estado on reservaciones (tenant_id, estado);
create index idx_reservaciones_sucursal_estado on reservaciones (sucursal_id, estado);
create index idx_reservaciones_sucursal_creada on reservaciones (sucursal_id, creada_en desc);
create index idx_reservaciones_ip_creada on reservaciones (ip, creada_en desc) where ip is not null;

alter table reservaciones enable row level security;
```

### Políticas de RLS

Lectura: miembros del tenant leen todas las solicitudes del tenant. Cambio de estado: miembros del tenant pueden pasar `nueva → atendida | cancelada` (incluso si el tenant está suspendido — es gestión de contacto, no contenido público).

**Sin policy de insert**: nadie escribe directo. Solo la Edge Function `crear-reservacion` con `service_role` lo hace. Miembros **solo pueden actualizar el campo `estado`**, no otros datos de la solicitud.

```sql
create policy "reservaciones_select_miembros" on reservaciones for select
  to authenticated using (pertenece_a_tenant(tenant_id));

create policy "reservaciones_update_miembros" on reservaciones for update
  to authenticated using (pertenece_a_tenant(tenant_id))
  with check (pertenece_a_tenant(tenant_id));

revoke all on reservaciones from anon, authenticated;
grant select on reservaciones to authenticated;
grant update (estado) on reservaciones to authenticated;
```

### Trigger de validación

Enforcement en la base: la reservación debe respetar el plan del tenant, la sucursal debe aceptarlas, la fecha debe estar dentro de la ventana válida (no pasado, no más de 60 días adelante).

```sql
create or replace function validar_reservacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_permite boolean;
  v_acepta  boolean;
begin
  select p.permite_reservaciones into v_permite
    from planes p join tenants t on t.plan_id = p.id
   where t.id = new.tenant_id;

  if not coalesce(v_permite, false) then
    raise exception 'reservaciones_no_permitidas';
  end if;

  select s.acepta_reservaciones into v_acepta
    from sucursales s
   where s.id = new.sucursal_id and s.tenant_id = new.tenant_id;

  if v_acepta is null then
    raise exception 'sucursal_ajena';
  end if;
  if not v_acepta then
    raise exception 'sucursal_no_acepta_reservaciones';
  end if;

  if new.fecha_hora < now() then
    raise exception 'reservacion_en_pasado';
  end if;
  if new.fecha_hora > now() + interval '60 days' then
    raise exception 'reservacion_muy_lejana';
  end if;

  return new;
end;
$$;

create trigger trg_validar_reservacion
  before insert on reservaciones
  for each row execute function validar_reservacion();
```

### Funciones helper

**Combinar fecha y hora en zona horaria:** la Edge Function recibe `fecha` (YYYY-MM-DD) y `hora` (HH:MM) por separado; esta función las interpreta en la zona de la sucursal y devuelve un `timestamptz`.

```sql
create or replace function combinar_fecha_hora_sucursal(p_fecha date, p_hora time, p_tz text)
returns timestamptz
language sql
stable
as $$
  select ((p_fecha + p_hora) at time zone coalesce(nullif(p_tz, ''), 'UTC'));
$$;

revoke execute on function combinar_fecha_hora_sucursal(date, time, text) from public, anon, authenticated;
grant  execute on function combinar_fecha_hora_sucursal(date, time, text) to service_role;
```

**Purgar reservaciones antiguas:** cron diario ejecuta esta función. Purga por `fecha_hora` (no `creada_en`): una reserva solicitada con 2 meses de anticipación sigue siendo relevante hasta que pasa.

```sql
create or replace function purgar_reservaciones_viejas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_borradas integer;
begin
  delete from reservaciones where fecha_hora < now() - interval '90 days';
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$$;

revoke execute on function purgar_reservaciones_viejas() from public, anon, authenticated;
grant  execute on function purgar_reservaciones_viejas() to service_role;
```

### Nota de diseño

`reservaciones` es **una fila por solicitud** — a diferencia de `visitas_menu` que es un contador. El comensal (sin sesión) **no puede escribir directo**: la única puerta es la Edge Function `crear-reservacion` con `service_role_key`, que verifica Turnstile, rate-limit (20/sucursal/hora, 3/IP/hora), y valida la sucursal + plan + estado antes de insertar. Los miembros del tenant leen todas las solicitudes del tenant y pueden cambiar estado (`nueva → atendida | cancelada`). El restaurante recibe un aviso por correo vía Resend; si falla, la fila igual se crea y aparece en el panel. Consentimiento (aceptación de `/privacidad`) se registra en `consentimiento_at`.

## 16. Analítica por platillo (migración analitica_platillo)

### Capacidad de plan

```sql
alter table planes
  add column if not exists permite_analitica_platillo boolean not null default false;

update planes set permite_analitica_platillo = true where nombre = 'enterprise';
```

### Tabla

```sql
create table interacciones_producto (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  sucursal_id uuid references sucursales(id) on delete set null,
  producto_id uuid not null references productos(id) on delete cascade,
  dia         date     not null,
  hora        smallint not null check (hora between 0 and 23),
  vistas      integer  not null default 0 check (vistas >= 0),
  agregados   integer  not null default 0 check (agregados >= 0)
);

create unique index uq_interacciones_prod_sucursal
  on interacciones_producto (tenant_id, sucursal_id, producto_id, dia, hora)
  where sucursal_id is not null;

create unique index uq_interacciones_prod_general
  on interacciones_producto (tenant_id, producto_id, dia, hora)
  where sucursal_id is null;

create index idx_interacciones_prod_tenant_dia
  on interacciones_producto (tenant_id, dia desc);
```

### Políticas de RLS

```sql
alter table interacciones_producto enable row level security;

create policy "interacciones_prod_select_miembros" on interacciones_producto for select
  to authenticated using (pertenece_a_tenant(tenant_id));

revoke all on interacciones_producto from anon, authenticated;
grant select on interacciones_producto to authenticated;
```

### Funciones

**registrar_interaccion_producto:**

```sql
create or replace function registrar_interaccion_producto(
  p_tenant_id   uuid,
  p_producto_id uuid,
  p_tipo        text,
  p_sucursal_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_permite boolean;
  v_tz      text;
  v_dia     date;
  v_hora    smallint;
begin
  if p_tipo not in ('vista', 'agregado') then
    return;
  end if;

  select p.permite_analitica_platillo into v_permite
    from planes p join tenants t on t.plan_id = p.id
   where t.id = p_tenant_id;
  if not coalesce(v_permite, false) then
    return;
  end if;

  if not exists (
    select 1 from productos pr
     where pr.id = p_producto_id and pr.tenant_id = p_tenant_id
  ) then
    return;
  end if;

  if p_sucursal_id is not null and not exists (
    select 1 from sucursales s where s.id = p_sucursal_id and s.tenant_id = p_tenant_id
  ) then
    p_sucursal_id := null;
  end if;

  select s.timezone into v_tz
    from sucursales s
   where s.tenant_id = p_tenant_id
     and (p_sucursal_id is null or s.id = p_sucursal_id)
   order by s.created_at
   limit 1;

  v_dia  := (now() at time zone coalesce(v_tz, 'UTC'))::date;
  v_hora := extract(hour from (now() at time zone coalesce(v_tz, 'UTC')))::smallint;

  if p_sucursal_id is null then
    insert into interacciones_producto (tenant_id, sucursal_id, producto_id, dia, hora, vistas, agregados)
    values (p_tenant_id, null, p_producto_id, v_dia, v_hora,
            case when p_tipo = 'vista' then 1 else 0 end,
            case when p_tipo = 'agregado' then 1 else 0 end)
    on conflict (tenant_id, producto_id, dia, hora) where sucursal_id is null
    do update set
      vistas    = interacciones_producto.vistas    + case when p_tipo = 'vista'    then 1 else 0 end,
      agregados = interacciones_producto.agregados + case when p_tipo = 'agregado' then 1 else 0 end;
  else
    insert into interacciones_producto (tenant_id, sucursal_id, producto_id, dia, hora, vistas, agregados)
    values (p_tenant_id, p_sucursal_id, p_producto_id, v_dia, v_hora,
            case when p_tipo = 'vista' then 1 else 0 end,
            case when p_tipo = 'agregado' then 1 else 0 end)
    on conflict (tenant_id, sucursal_id, producto_id, dia, hora) where sucursal_id is not null
    do update set
      vistas    = interacciones_producto.vistas    + case when p_tipo = 'vista'    then 1 else 0 end,
      agregados = interacciones_producto.agregados + case when p_tipo = 'agregado' then 1 else 0 end;
  end if;
end;
$$;

revoke execute on function registrar_interaccion_producto(uuid, uuid, text, uuid) from public;
grant  execute on function registrar_interaccion_producto(uuid, uuid, text, uuid) to anon, authenticated;
```

**purgar_interacciones_producto:**

```sql
create or replace function purgar_interacciones_producto()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_borradas integer;
begin
  delete from interacciones_producto where dia < current_date - 180;
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$$;

revoke execute on function purgar_interacciones_producto() from public, anon, authenticated;
grant  execute on function purgar_interacciones_producto() to service_role;
```

### Nota de diseño

`interacciones_producto` es **un contador** por `(tenant, sucursal, producto, día, hora)` — no una fila por evento (patrón `visitas_menu`). El comensal (sin sesión) **no escribe directo**: la única puerta es la RPC `registrar_interaccion_producto` (`SECURITY DEFINER`, `to anon, authenticated`), que nunca lanza y hace `return` silencioso ante tipo inválido, plan no-Enterprise, producto ajeno o sucursal ajena. El chequeo de plan (`permite_analitica_platillo`, solo `enterprise`) vive dentro de la RPC. Los índices únicos son **parciales** por el `sucursal_id` nullable (`null` = menú general). Dedup 1/platillo/sesión/hora en el navegador (`sessionStorage`). Purga a 180 días (`purgar_interacciones_producto`, `service_role` only, cron nocturno `.github/workflows/purgar-interacciones-producto.yml`).

---

## 17. Tarjeta de lealtad (migración lealtad)

### Capacidad de plan

```sql
alter table planes
  add column if not exists permite_lealtad boolean not null default false;
update planes set permite_lealtad = true where nombre in ('pro', 'enterprise');
```

### Config del programa

```sql
alter table tenants
  add column if not exists lealtad_activa      boolean  not null default false,
  add column if not exists lealtad_sellos_meta smallint,
  add column if not exists lealtad_premio      text;

alter table tenants
  add constraint tenants_lealtad_meta_valida
    check (lealtad_sellos_meta is null or lealtad_sellos_meta between 2 and 50),
  add constraint tenants_lealtad_premio_valido
    check (lealtad_premio is null or length(lealtad_premio) <= 80),
  add constraint tenants_lealtad_completa
    check (not lealtad_activa or (lealtad_sellos_meta is not null and lealtad_premio is not null));
```

### Tablas

```sql
create table tarjetas_lealtad (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references tenants(id) on delete cascade,
  codigo                      text not null,
  sellos                      smallint not null default 0 check (sellos >= 0),
  premios_canjeados           smallint not null default 0 check (premios_canjeados >= 0),
  contacto                    text,
  contacto_tipo               text check (contacto_tipo in ('telefono', 'correo')),
  consentimiento_marketing_at timestamptz,
  ultimo_sello_dia            date,
  creada_at                   timestamptz not null default now(),
  ultima_actividad_at         timestamptz,
  constraint tarjeta_contacto_coherente
    check ((contacto is null) = (contacto_tipo is null))
);

create unique index uq_tarjetas_codigo_tenant on tarjetas_lealtad (tenant_id, upper(codigo));
create index idx_tarjetas_tenant on tarjetas_lealtad (tenant_id);
create index idx_tarjetas_contacto on tarjetas_lealtad (tenant_id, lower(contacto)) where contacto is not null;
create index idx_tarjetas_purga on tarjetas_lealtad (coalesce(ultima_actividad_at, creada_at));

create table movimientos_lealtad (
  id           bigint generated always as identity primary key,
  tarjeta_id   uuid not null references tarjetas_lealtad(id) on delete cascade,
  tenant_id    uuid not null references tenants(id) on delete cascade,
  sucursal_id  uuid references sucursales(id) on delete set null,
  tipo         text not null check (tipo in ('sello', 'canje')),
  encargado_id uuid references auth.users(id) on delete set null,
  creado_at    timestamptz not null default now()
);
create index idx_movimientos_tenant on movimientos_lealtad (tenant_id, creado_at desc);
create index idx_movimientos_tarjeta on movimientos_lealtad (tarjeta_id, creado_at desc);
```

### Políticas de RLS

```sql
alter table tarjetas_lealtad enable row level security;
create policy "tarjetas_select_miembros" on tarjetas_lealtad for select
  to authenticated using (pertenece_a_tenant(tenant_id));
revoke all on tarjetas_lealtad from anon, authenticated;
grant select on tarjetas_lealtad to authenticated;

alter table movimientos_lealtad enable row level security;
create policy "movimientos_select_miembros" on movimientos_lealtad for select
  to authenticated using (pertenece_a_tenant(tenant_id));
revoke all on movimientos_lealtad from anon, authenticated;
grant select on movimientos_lealtad to authenticated;
```

### Funciones

**_enmascarar_contacto:** Enmascara correo/teléfono en proyecciones públicas. `SECURITY DEFINER`, revoke anon/authenticated.

```sql
create or replace function _enmascarar_contacto(p_contacto text, p_tipo text)
returns text
language sql
immutable
security definer
set search_path = public
as $$
  select case
    when p_contacto is null then null
    when p_tipo = 'correo' then
      left(p_contacto, 1) || '●●●' || substr(p_contacto, position('@' in p_contacto))
    else
      '●●●' || right(regexp_replace(p_contacto, '\D', '', 'g'), 4)
  end;
$$;
revoke execute on function _enmascarar_contacto(text, text) from public, anon, authenticated;
```

**_gen_codigo_lealtad:** Genera código único de 6 caracteres para el tenant. Helper, revoke public/anon/authenticated.

```sql
create or replace function _gen_codigo_lealtad(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_codigo   text;
  v_intento  int := 0;
begin
  loop
    v_codigo := '';
    for i in 1..6 loop
      v_codigo := v_codigo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    end loop;
    exit when not exists (
      select 1 from tarjetas_lealtad
       where tenant_id = p_tenant_id and upper(codigo) = upper(v_codigo)
    );
    v_intento := v_intento + 1;
    if v_intento >= 8 then
      raise exception 'lealtad_error_interno';
    end if;
  end loop;
  return v_codigo;
end;
$$;
revoke execute on function _gen_codigo_lealtad(uuid) from public, anon, authenticated;
```

**_tarjeta_del_encargado:** Resuelve la tarjeta del tenant actual (auth.uid) por código. Helper, revoke public/anon/authenticated.

```sql
create or replace function _tarjeta_del_encargado(p_codigo text)
returns tarjetas_lealtad
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_fila   tarjetas_lealtad;
begin
  select tenant_id into v_tenant from tenant_usuarios where user_id = auth.uid();
  if v_tenant is null then
    raise exception 'sin_tenant';
  end if;

  select * into v_fila from tarjetas_lealtad
   where tenant_id = v_tenant and upper(codigo) = upper(trim(p_codigo));
  if v_fila.id is null then
    raise exception 'tarjeta_no_encontrada';
  end if;

  return v_fila;
end;
$$;
revoke execute on function _tarjeta_del_encargado(text) from public, anon, authenticated;
```

**_vista_tarjeta:** Proyección de tarjeta para panel de encargado (sin contacto en claro). Helper, revoke public/anon/authenticated.

**crear_tarjeta_lealtad:** El comensal (sin sesión) crea su tarjeta desde el menú público. Genera código único y valida lealtad_activa. Grant: `to anon, authenticated`.

```sql
create or replace function crear_tarjeta_lealtad(p_tenant_id uuid)
returns tarjetas_lealtad
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activa boolean;
  v_fila   tarjetas_lealtad;
begin
  select lealtad_activa into v_activa from tenants where id = p_tenant_id;
  if not coalesce(v_activa, false) then
    raise exception 'lealtad_no_disponible';
  end if;

  insert into tarjetas_lealtad (tenant_id, codigo, ultima_actividad_at)
  values (p_tenant_id, _gen_codigo_lealtad(p_tenant_id), now())
  returning * into v_fila;

  return v_fila;
end;
$$;
revoke execute on function crear_tarjeta_lealtad(uuid) from public;
grant  execute on function crear_tarjeta_lealtad(uuid) to anon, authenticated;
```

**obtener_tarjeta_lealtad:** Proyección pública segura de tarjeta (contacto enmascarado). Grant: `to anon, authenticated`.

**guardar_contacto_tarjeta:** Guarda/borra contacto en la tarjeta con consentimiento. Grant: `to anon, authenticated`.

```sql
create or replace function guardar_contacto_tarjeta(
  p_tarjeta_id uuid,
  p_contacto   text,
  p_tipo       text,
  p_consent    boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limpio text := nullif(trim(coalesce(p_contacto, '')), '');
begin
  if not exists (select 1 from tarjetas_lealtad where id = p_tarjeta_id) then
    raise exception 'tarjeta_no_encontrada';
  end if;

  -- borrar el contacto
  if v_limpio is null then
    update tarjetas_lealtad
       set contacto = null, contacto_tipo = null, consentimiento_marketing_at = null,
           ultima_actividad_at = now()
     where id = p_tarjeta_id;
    return;
  end if;

  if p_tipo not in ('telefono', 'correo') then
    raise exception 'datos_invalidos';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'consentimiento_requerido';
  end if;
  if p_tipo = 'correo' and v_limpio !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'datos_invalidos';
  end if;
  if p_tipo = 'telefono' and length(regexp_replace(v_limpio, '\D', '', 'g')) not between 10 and 15 then
    raise exception 'datos_invalidos';
  end if;

  update tarjetas_lealtad
     set contacto = v_limpio,
         contacto_tipo = p_tipo,
         consentimiento_marketing_at = now(),
         ultima_actividad_at = now()
   where id = p_tarjeta_id;
end;
$$;
revoke execute on function guardar_contacto_tarjeta(uuid, text, text, boolean) from public;
grant  execute on function guardar_contacto_tarjeta(uuid, text, text, boolean) to anon, authenticated;
```

**buscar_tarjeta:** El encargado busca una tarjeta por código (sin mutar). Grant: `to authenticated` (revoke anon).

**sellar_tarjeta:** El encargado sella la tarjeta (1/día por zona horaria de sucursal). Grant: `to authenticated` (revoke anon).

```sql
create or replace function sellar_tarjeta(p_codigo text, p_sucursal_id uuid default null)
returns table (
  codigo text, sellos smallint, sellos_meta smallint, premio text,
  premios_canjeados smallint, listo_para_canje boolean, sello_repetido_hoy boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tarjeta tarjetas_lealtad := _tarjeta_del_encargado(p_codigo);
  v_activa  boolean;
  v_suc     uuid := p_sucursal_id;
  v_tz      text;
  v_hoy     date;
begin
  select lealtad_activa into v_activa from tenants where id = v_tarjeta.tenant_id;
  if not coalesce(v_activa, false) then
    raise exception 'lealtad_no_disponible';
  end if;

  if v_suc is not null and not exists (
    select 1 from sucursales where id = v_suc and tenant_id = v_tarjeta.tenant_id
  ) then
    v_suc := null;
  end if;

  select s.timezone into v_tz from sucursales s
   where s.tenant_id = v_tarjeta.tenant_id
     and (v_suc is null or s.id = v_suc)
   order by s.created_at limit 1;
  v_hoy := (now() at time zone coalesce(v_tz, 'UTC'))::date;

  if v_tarjeta.ultimo_sello_dia = v_hoy then
    raise exception 'sello_repetido_hoy';
  end if;

  update tarjetas_lealtad
     set sellos = tarjetas_lealtad.sellos + 1,
         ultimo_sello_dia = v_hoy,
         ultima_actividad_at = now()
   where id = v_tarjeta.id
   returning * into v_tarjeta;

  insert into movimientos_lealtad (tarjeta_id, tenant_id, sucursal_id, tipo, encargado_id)
  values (v_tarjeta.id, v_tarjeta.tenant_id, v_suc, 'sello', auth.uid());

  return query select * from _vista_tarjeta(v_tarjeta, v_suc);
end;
$$;
revoke execute on function sellar_tarjeta(text, uuid) from public, anon;
grant  execute on function sellar_tarjeta(text, uuid) to authenticated;
```

**canjear_premio:** El encargado canjea un premio (resta N sellos). Grant: `to authenticated` (revoke anon).

```sql
create or replace function canjear_premio(p_codigo text, p_sucursal_id uuid default null)
returns table (
  codigo text, sellos smallint, sellos_meta smallint, premio text,
  premios_canjeados smallint, listo_para_canje boolean, sello_repetido_hoy boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tarjeta tarjetas_lealtad := _tarjeta_del_encargado(p_codigo);
  v_meta    smallint;
  v_suc     uuid := p_sucursal_id;
begin
  select lealtad_sellos_meta into v_meta from tenants where id = v_tarjeta.tenant_id;
  if v_meta is null or v_tarjeta.sellos < v_meta then
    raise exception 'sellos_insuficientes';
  end if;

  if v_suc is not null and not exists (
    select 1 from sucursales where id = v_suc and tenant_id = v_tarjeta.tenant_id
  ) then
    v_suc := null;
  end if;

  update tarjetas_lealtad
     set sellos = tarjetas_lealtad.sellos - v_meta,
         premios_canjeados = tarjetas_lealtad.premios_canjeados + 1,
         ultima_actividad_at = now()
   where id = v_tarjeta.id
   returning * into v_tarjeta;

  insert into movimientos_lealtad (tarjeta_id, tenant_id, sucursal_id, tipo, encargado_id)
  values (v_tarjeta.id, v_tarjeta.tenant_id, v_suc, 'canje', auth.uid());

  return query select * from _vista_tarjeta(v_tarjeta, v_suc);
end;
$$;
revoke execute on function canjear_premio(text, uuid) from public, anon;
grant  execute on function canjear_premio(text, uuid) to authenticated;
```

**buscar_tarjetas_por_contacto:** El encargado busca tarjetas por teléfono/correo (sin leer contacto en claro). Grant: `to authenticated` (revoke anon).

**purgar_tarjetas_lealtad:** Borra tarjetas sin sellos/premios >14 días o inactivas >365 días. Grant: `to service_role` (revoke all anon/authenticated).

```sql
create or replace function purgar_tarjetas_lealtad()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_borradas integer;
begin
  delete from tarjetas_lealtad
   where (sellos = 0 and premios_canjeados = 0 and creada_at < now() - interval '14 days')
      or coalesce(ultima_actividad_at, creada_at) < now() - interval '365 days';
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$$;
revoke execute on function purgar_tarjetas_lealtad() from public, anon, authenticated;
grant  execute on function purgar_tarjetas_lealtad() to service_role;
```

### Nota de diseño

La tarjeta = un UUID en `localStorage` del comensal (el `id` de `tarjetas_lealtad`). Sin escritura pública directa a las tablas: solo las RPC. `crear` / `obtener` / `guardar_contacto` son del comensal (sin sesión, `SECURITY DEFINER`, lanzan slugs del contrato). `buscar` / `sellar` / `canjear` / `recuperar` exigen sesión y resuelven el tenant con `tenant_usuarios.user_id = auth.uid()` — nunca cruzan tenants. Tope 1 sello/tarjeta/día en la zona horaria de la sucursal que sella. `contacto` (teléfono/correo, opcional, con `consentimiento_marketing_at`) nunca sale en claro por RPC pública — solo `_enmascarar_contacto`. Purga: 0 sellos > 14 días, o `coalesce(ultima_actividad_at, creada_at)` > 12 meses.

Cualquiera puede llamar la RPC repetidamente para inflar los contadores de su propio tenant Enterprise; el conteo de **filas** está acotado por el grano `(tenant, sucursal, producto, día, hora)`, así que es ruido en las métricas, no un vector de crecimiento — misma exposición aceptada que `registrar_visita`.
