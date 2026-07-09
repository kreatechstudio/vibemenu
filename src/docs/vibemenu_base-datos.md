# Vibemenu — Base de Datos y SQL

⚠️ TODO este SQL se ejecuta MANUALMENTE en Supabase SQL Editor.
NUNCA ejecutar desde Lovable Cloud. NUNCA editar Auth desde Lovable Cloud — usar Supabase Dashboard directamente.

Orden de ejecución: 1) tablas → 2) RLS on → 3) políticas → 4) índices → 5) funciones/triggers → 6) storage buckets.

---

## Diagrama de tablas

```
tenants (1) ──< tenant_usuarios >── auth.users
tenants (1) ──< sucursales
sucursales (1) ──< horarios
tenants (1) ──< categorias
categorias (1) ──< productos >── sucursales (nullable)
tenants (1) ──< grupos_modificadores (1) ──< opciones_modificador
productos >──< grupos_modificadores   (vía producto_modificadores)
planes (1) ──< suscripciones >── tenants
slugs_reservados (standalone)
```

---

## 1. Tablas

```sql
-- ═══════════════════════════════════════
-- TENANTS (negocios registrados)
-- ═══════════════════════════════════════
create table tenants (
  id uuid primary key default gen_random_uuid(),
  nombre_negocio text not null,
  slug text unique not null,
  giro text,
  logo_url text,
  whatsapp text,
  telefono text,
  formato_activo text not null default 'clasico'
    check (formato_activo in ('clasico', 'pinterest', 'instagram', 'tiktok')),
  tema jsonb default '{}'::jsonb, -- colores, tipografia, imagen_fondo por formato
  plan_id uuid references planes(id),
  estado text not null default 'trial'
    check (estado in ('trial', 'activo', 'suspendido', 'cancelado')),
  trial_iniciado_at timestamptz default now(),
  stripe_customer_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ═══════════════════════════════════════
-- SLUGS RESERVADOS (no se pueden registrar)
-- ═══════════════════════════════════════
create table slugs_reservados (
  slug text primary key
);

insert into slugs_reservados (slug) values
  ('admin'), ('api'), ('app'), ('login'), ('registro'), ('precios'),
  ('demo'), ('docs'), ('blog'), ('soporte'), ('www'), ('mail'),
  ('help'), ('billing'), ('stripe'), ('webhook'), ('static'), ('assets');

-- ═══════════════════════════════════════
-- TENANT_USUARIOS (owner + encargados)
-- ═══════════════════════════════════════
create table tenant_usuarios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rol text not null default 'owner' check (rol in ('owner', 'encargado')),
  created_at timestamptz default now(),
  unique (tenant_id, user_id)
);

-- ═══════════════════════════════════════
-- SUCURSALES
-- ═══════════════════════════════════════
create table sucursales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  nombre text not null,
  slug text not null, -- único dentro del tenant, no global
  direccion text,
  telefono text,
  whatsapp text,
  activa boolean default true,
  created_at timestamptz default now(),
  unique (tenant_id, slug)
);

-- ═══════════════════════════════════════
-- HORARIOS (por sucursal)
-- ═══════════════════════════════════════
create table horarios (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references sucursales(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6), -- 0=domingo
  hora_apertura time,
  hora_cierre time,
  cerrado boolean default false,
  unique (sucursal_id, dia_semana)
);

-- ═══════════════════════════════════════
-- CATEGORIAS
-- ═══════════════════════════════════════
create table categorias (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  sucursal_id uuid references sucursales(id) on delete cascade, -- null = todas las sucursales
  nombre text not null,
  orden int default 0,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════
-- PRODUCTOS
-- ═══════════════════════════════════════
create table productos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  categoria_id uuid not null references categorias(id) on delete cascade,
  sucursal_id uuid references sucursales(id) on delete cascade, -- null = todas las sucursales
  nombre text not null,
  descripcion text,
  precio numeric(10,2) not null default 0,
  imagen_url text, -- 1 foto por producto, todos los planes
  video_url text,  -- opcional: YouTube/Reel embed, usado en formato TikTok
  activo boolean default true,
  orden int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ═══════════════════════════════════════
-- GRUPOS DE MODIFICADORES (catálogo reutilizable por tenant)
-- ═══════════════════════════════════════
create table grupos_modificadores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  nombre text not null, -- ej: "Tamaño de café", "Tipo de leche", "Extras"
  tipo_seleccion text not null default 'unica' check (tipo_seleccion in ('unica', 'multiple')),
  obligatorio boolean default false,
  min_selecciones int default 0,
  max_selecciones int,
  orden int default 0
);

-- ═══════════════════════════════════════
-- OPCIONES DE MODIFICADOR
-- ═══════════════════════════════════════
create table opciones_modificador (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos_modificadores(id) on delete cascade,
  nombre text not null, -- ej: "Grande", "Leche de almendra"
  precio_extra numeric(10,2) default 0,
  orden int default 0
);

-- ═══════════════════════════════════════
-- PRODUCTO ↔ GRUPOS DE MODIFICADORES (muchos a muchos)
-- ═══════════════════════════════════════
create table producto_modificadores (
  producto_id uuid not null references productos(id) on delete cascade,
  grupo_id uuid not null references grupos_modificadores(id) on delete cascade,
  primary key (producto_id, grupo_id)
);

-- ═══════════════════════════════════════
-- PLANES (catálogo de precios de lista)
-- ═══════════════════════════════════════
create table planes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique, -- 'free', 'basic', 'pro', 'enterprise'
  precio_usd numeric(10,2) not null,
  precio_mxn numeric(10,2) not null,
  limite_sucursales int, -- null = ilimitado
  limite_productos int,  -- null = ilimitado
  menu_independiente_por_sucursal boolean default false,
  formatos_permitidos text[] not null default array['clasico'],
  permite_multiusuario boolean default false,
  permite_dominio_propio boolean default false,
  marca_agua boolean default true,
  stripe_price_id_usd text,
  stripe_price_id_mxn text
);

insert into planes (nombre, precio_usd, precio_mxn, limite_sucursales, limite_productos, menu_independiente_por_sucursal, formatos_permitidos, permite_multiusuario, permite_dominio_propio, marca_agua) values
  ('free',       0,  0,   1,    20,   false, array['clasico'],                                       false, false, true),
  ('basic',      9,  169, 1,    null, false, array['clasico','pinterest'],                            false, false, false),
  ('pro',        19, 349, 3,    null, true,  array['clasico','pinterest','instagram','tiktok'],       true,  true,  false),
  ('enterprise', 39, 699, null, null, true,  array['clasico','pinterest','instagram','tiktok'],       true,  true,  false);

-- ═══════════════════════════════════════
-- SUSCRIPCIONES (precio congelado por tenant)
-- ═══════════════════════════════════════
create table suscripciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  plan_id uuid not null references planes(id),
  precio_congelado_usd numeric(10,2) not null,
  precio_congelado_mxn numeric(10,2) not null,
  moneda_cobro text not null default 'usd' check (moneda_cobro in ('usd','mxn')),
  stripe_subscription_id text,
  estado text not null default 'activa' check (estado in ('activa','cancelada','vencida')),
  fecha_inicio timestamptz default now(),
  fecha_renovacion timestamptz,
  created_at timestamptz default now()
);
```

---

## 2. Habilitar RLS

```sql
alter table tenants enable row level security;
alter table tenant_usuarios enable row level security;
alter table sucursales enable row level security;
alter table horarios enable row level security;
alter table categorias enable row level security;
alter table productos enable row level security;
alter table grupos_modificadores enable row level security;
alter table opciones_modificador enable row level security;
alter table producto_modificadores enable row level security;
alter table planes enable row level security;
alter table suscripciones enable row level security;
alter table slugs_reservados enable row level security;
```

---

## 3. Políticas RLS

```sql
-- Función helper: ¿el usuario actual pertenece a este tenant?
create or replace function pertenece_a_tenant(check_tenant_id uuid)
returns boolean as $$
  select exists (
    select 1 from tenant_usuarios
    where tenant_id = check_tenant_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- Función helper: ¿el usuario actual es owner de este tenant?
create or replace function es_owner_de_tenant(check_tenant_id uuid)
returns boolean as $$
  select exists (
    select 1 from tenant_usuarios
    where tenant_id = check_tenant_id and user_id = auth.uid() and rol = 'owner'
  );
$$ language sql security definer stable;

-- TENANTS: lectura pública (para menú público por slug), escritura solo miembros
create policy "tenants_select_publico" on tenants for select using (true);
create policy "tenants_update_miembros" on tenants for update using (pertenece_a_tenant(id));
create policy "tenants_insert_propio" on tenants for insert with check (true); -- alta controlada por app + trigger de tenant_usuarios

-- TENANT_USUARIOS: solo miembros del mismo tenant ven la lista; solo owner administra
create policy "tenant_usuarios_select" on tenant_usuarios for select using (pertenece_a_tenant(tenant_id));
create policy "tenant_usuarios_insert_owner" on tenant_usuarios for insert with check (es_owner_de_tenant(tenant_id) or user_id = auth.uid());
create policy "tenant_usuarios_delete_owner" on tenant_usuarios for delete using (es_owner_de_tenant(tenant_id));

-- SUCURSALES: lectura pública, escritura miembros
create policy "sucursales_select_publico" on sucursales for select using (true);
create policy "sucursales_write_miembros" on sucursales for all using (pertenece_a_tenant(tenant_id));

-- HORARIOS: lectura pública, escritura miembros del tenant dueño de la sucursal
create policy "horarios_select_publico" on horarios for select using (true);
create policy "horarios_write_miembros" on horarios for all using (
  pertenece_a_tenant((select tenant_id from sucursales where id = sucursal_id))
);

-- CATEGORIAS / PRODUCTOS: lectura pública, escritura miembros
create policy "categorias_select_publico" on categorias for select using (true);
create policy "categorias_write_miembros" on categorias for all using (pertenece_a_tenant(tenant_id));

create policy "productos_select_publico" on productos for select using (true);
create policy "productos_write_miembros" on productos for all using (pertenece_a_tenant(tenant_id));

-- MODIFICADORES: lectura pública, escritura miembros
create policy "grupos_mod_select_publico" on grupos_modificadores for select using (true);
create policy "grupos_mod_write_miembros" on grupos_modificadores for all using (pertenece_a_tenant(tenant_id));

create policy "opciones_mod_select_publico" on opciones_modificador for select using (true);
create policy "opciones_mod_write_miembros" on opciones_modificador for all using (
  pertenece_a_tenant((select tenant_id from grupos_modificadores where id = grupo_id))
);

create policy "producto_mod_select_publico" on producto_modificadores for select using (true);
create policy "producto_mod_write_miembros" on producto_modificadores for all using (
  pertenece_a_tenant((select tenant_id from productos where id = producto_id))
);

-- PLANES: lectura pública (para mostrar precios), sin escritura desde frontend
create policy "planes_select_publico" on planes for select using (true);

-- SUSCRIPCIONES: solo el owner del tenant ve/gestiona su suscripción
create policy "suscripciones_select_owner" on suscripciones for select using (es_owner_de_tenant(tenant_id));
-- Insert/update de suscripciones SOLO vía Edge Function con service role key (webhooks de Stripe)
-- NO se crea policy de insert/update para el rol authenticated — se bloquea a nivel RLS por defecto

-- SLUGS_RESERVADOS: lectura pública para validar en el registro
create policy "slugs_reservados_select_publico" on slugs_reservados for select using (true);
```

---

## 4. Índices

```sql
create index idx_tenants_slug on tenants(slug);
create index idx_sucursales_tenant on sucursales(tenant_id);
create index idx_categorias_tenant on categorias(tenant_id);
create index idx_productos_tenant on productos(tenant_id);
create index idx_productos_categoria on productos(categoria_id);
create index idx_productos_sucursal on productos(sucursal_id);
create index idx_grupos_mod_tenant on grupos_modificadores(tenant_id);
create index idx_opciones_mod_grupo on opciones_modificador(grupo_id);
create index idx_suscripciones_tenant on suscripciones(tenant_id);
```

---

## 5. Funciones y triggers

```sql
-- Trigger: al crear un tenant, el usuario que lo crea queda como owner automáticamente
create or replace function crear_owner_al_registrar_tenant()
returns trigger as $$
begin
  insert into tenant_usuarios (tenant_id, user_id, rol)
  values (new.id, auth.uid(), 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_crear_owner
  after insert on tenants
  for each row execute function crear_owner_al_registrar_tenant();

-- Trigger: updated_at automático
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_tenants_updated_at before update on tenants
  for each row execute function set_updated_at();

create trigger trg_productos_updated_at before update on productos
  for each row execute function set_updated_at();
```

---

## 6. Storage buckets

```sql
-- Bucket para logos de tenants y fotos de productos (público, 1 foto por producto)
insert into storage.buckets (id, name, public) values ('vibemenu-media', 'vibemenu-media', true);

-- Política: solo miembros del tenant pueden subir a su propia carpeta (path: {tenant_id}/...)
create policy "vibemenu_media_insert_miembros" on storage.objects for insert
  with check (
    bucket_id = 'vibemenu-media'
    and pertenece_a_tenant((storage.foldername(name))[1]::uuid)
  );

create policy "vibemenu_media_select_publico" on storage.objects for select
  using (bucket_id = 'vibemenu-media');

create policy "vibemenu_media_delete_miembros" on storage.objects for delete
  using (
    bucket_id = 'vibemenu-media'
    and pertenece_a_tenant((storage.foldername(name))[1]::uuid)
  );
```

---

## 7. Notas sobre Auth y Stripe

- Auth: email/password vía Supabase Auth, configurado desde el Dashboard (nunca desde Lovable Cloud).
- El `service_role_key` de Supabase solo vive en la Edge Function que procesa webhooks de Stripe — nunca se expone al frontend.
- Edge Function `stripe-webhook`: recibe `checkout.session.completed` → crea/actualiza `suscripciones` con el precio congelado del momento; `customer.subscription.updated` → sincroniza estado; `customer.subscription.deleted` → marca `suscripciones.estado = 'cancelada'` y `tenants.estado = 'suspendido'`.
- El precio mostrado en checkout depende de `moneda_cobro` elegida por el tenant (USD o MXN) — usa `stripe_price_id_usd` o `stripe_price_id_mxn` de la tabla `planes` según corresponda.
