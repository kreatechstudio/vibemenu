# Lealtad con QR — Diseño

**Fecha:** 2026-09-02
**Rama:** `feat/lealtad-qr`
**Origen:** Auditoría Vibemenu (artifact `8d645623`), sección 04 "Extras vendibles" → "Tarjeta de lealtad" y sección 07 "Por dónde empezar" → **P2**.
**Alcance de este documento:** sub-proyecto **#6** del artifact (continúa la numeración de contacto/reseñas #1–#3, reservaciones #4, analítica por platillo #5). Es el último de P2.

## Contexto: qué pidió el usuario

Una tarjeta de sellos digital para el comensal, **sin registrar clientes** y **de lo más sencillo posible de guardar**. Decisiones tomadas con el usuario (2026-08-28 y 2026-09-02):

1. **Plan Pro+** (`planes.permite_lealtad`, `true` en `pro` y `enterprise`).
2. **La tarjeta = un UUID en `localStorage`** del navegador del comensal (no `sessionStorage`), con URL propia `/{slug}/lealtad/{uuid}`; el estado (sellos) vive en Postgres.
3. **Self-service:** un banner "Junta sellos" en el menú público crea la tarjeta.
4. **Anti-fraude:** el encargado valida desde `/admin/lealtad` (el comensal enseña un código de 6 caracteres o un QR). **Tope 1 sello por tarjeta por día.**
5. **Sellado = "ambos":** campo de código tecleado (siempre) + botón "Escanear" opcional (cámara del encargado, librería cargada bajo demanda).
6. **Premio de un solo nivel:** el tenant configura "N sellos = 1 premio". Al canjear, `sellos -= N`; el contador no se pierde si había extras.
7. **Canje:** el encargado lo marca en `/admin/lealtad` (no hay código de canje aparte).
8. **Programa uno por negocio:** una sola tarjeta junta sellos en cualquier sucursal del tenant; se registra qué sucursal selló.
9. **Campo de respaldo opcional:** el comensal puede dejar **teléfono (con lada) o correo** (él elige) en su tarjeta, con **consentimiento explícito** para (a) recuperar la tarjeta en mostrador y (b) contacto promocional futuro. Sin login, sin contraseña. El UUID en `localStorage` sigue siendo el camino normal; el contacto es el respaldo.
10. **Google/Apple Wallet:** fuera de v1 (Apple cuesta $99/año). Mejora posterior.

## Juicios del diseñador (revertibles)

- **Config del programa en columnas de `tenants`**, no una tabla 1:1. Son 3 campos y `tenants` ya se lee en cada carga de menú (`useMenuPublico`) y del admin (`useTenantActual`); `tenants.*` ya los incluye.
- **Sin Edge Function en v1.** La creación de tarjeta es una RPC `SECURITY DEFINER` `to anon` (patrón `registrar_feedback`). El riesgo de spam se mitiga con purga agresiva (tarjetas con 0 sellos > 14 días) y filas mínimas. Si se abusa, se añade una Edge Function con Turnstile después (como #4).
- **El QR de la tarjeta codifica solo el `codigo`** (string de 6 caracteres), no una URL. Así la cámara nativa del encargado no navega a la vista del comensal; el escáner in-app lee el string y llena el campo.
- **`html5-qrcode`** (~200 KB) se carga con `import()` dinámico solo al tocar "Escanear" en `/admin/lealtad`.
- **`movimientos_lealtad`** (fila por sello/canje) existe para auditoría, atribución por sucursal e investigación de fraude. Volumen bajo: un sello es una acción humana en barra.
- **`codigo` de 6 caracteres** de un alfabeto sin ambigüedad (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`, sin `0O1I`), único por tenant, generado con retry ante colisión. ~30^6 ≈ 7·10^8 combinaciones por tenant.
- **Retención:** purga a 12 meses de inactividad (`coalesce(ultima_actividad_at, creada_at)`), y a 14 días para tarjetas nunca usadas (0 sellos y 0 canjes).

## Fuera de alcance

- Google/Apple Wallet, notificaciones push/correo al comensal ("te falta 1 sello").
- La función de campañas de marketing en sí (solo se captura el consentimiento y el dato para habilitarla después).
- Varios niveles de premio (5 sellos = bebida, 10 = postre).
- Código de canje de un solo uso.
- Dedupe de tarjetas por contacto (una persona con dos dispositivos = dos tarjetas en v1).
- Fraude del propio encargado (queda el rastro `encargado_id`, sin más control).
- Mínimo de compra por sello (lo juzga el encargado en barra).

## Lo que ya existe (contexto, no se reescribe)

- **`planes`** — columnas booleanas de capacidad (`permite_reservaciones`, `permite_analitica_platillo`, …). El frontend las lee para mostrar/ocultar; los triggers/RPC en Postgres son el enforcement real.
- **`registrar_feedback` / `registrar_visita` / `registrar_interaccion_producto`** — precedentes de RPC `SECURITY DEFINER` `to anon` del comensal sin sesión: `set search_path = public`, valida pertenencia, y patrón "sucursal de otro tenant → null". `registrar_feedback` además tiene un `RETURNS` y params con default al final.
- **`reservaciones` (#4)** — precedente completo y fresco de: flag de plan nuevo, tabla con RLS solo-miembros, RPC de escritura, **panel con muro de plan** (`src/pages/admin/Reservaciones.tsx`: `EJEMPLO` difuminado + `<Lock/>` + CTA a `/admin/suscripcion`), pestaña en `PillTabs` `PESTANAS_NEGOCIO` + `cubre` en `AdminLayout`, ruta file-based, **cron de purga** (`.github/workflows/purgar-reservaciones.yml` → `/rest/v1/rpc/...` con `SUPABASE_SERVICE_ROLE_KEY`), función `purgar_*` `security definer` `to service_role`, actualización de `/privacidad` + `legal.ts`. **Reusar todo.**
- **`analitica-platillo` (#5, recién mergeado)** — precedente de contador + panel de 4 secciones con barras CSS, `useTenantActual` que ya trae `plan:planes(*)`.
- **`src/lib/errores.ts`** — traduce los `raise exception '<slug>'` de los triggers/RPC de Postgres a mensajes en español. **`src/lib/erroresEdge.ts`** — lo mismo para el `{ error: "<slug>" }` de las Edge Functions. Lealtad usa el de Postgres.
- **`src/hooks/useMenuPublico.ts`** — `armarMenuPublico` con `tenantRow` (`tenants.*` + `plan:planes(...)` en 3 sitios) y columnas explícitas de `sucursales`. El tipo `MenuPublico` expone `permiteReservaciones` / `permiteAnaliticaPlatillo` / etc. **Añadir el join de `permite_lealtad` + los 3 campos `lealtad_*` de `tenants` (ya vienen en `tenants.*`, solo el tipo y el `return`) + `MenuPublico.lealtad: { activa, meta, premio } | null`.**
- **`src/pages/MenuPublico.tsx`** — dos ramas de render (TikTok early-return y `cuerpo`). Los banners `<ReservarMenu>` / `<EmbudoResenas>` viven dentro de `cuerpo`, cada uno con su `habilitado`. El de lealtad va junto a ellos. TikTok: sin banner de lealtad en v1 (igual que reservaciones no lo tiene en TikTok — confirmar en el plan).
- **`src/components/menu/ReservarMenu.tsx`** — patrón de banner + hoja inferior (bottom-sheet `HojaPedido`). El banner de lealtad y el formulario de contacto pueden reusar ese patrón.
- **`react-qr-code`** (`^2.2.0`) — ya es dependencia; lo usa `src/components/admin/TarjetaQR.tsx` (`<QRCode value=... />`). Se reusa para el QR de la tarjeta del comensal.
- **`src/routes/$slug.index.tsx` / `$slug.sucursal.$sucursalSlug.tsx`** — rutas públicas file-based bajo `/{slug}`. La tarjeta va en `$slug.lealtad.$tarjetaId.tsx`.
- **`src/routes/admin.reservaciones.tsx`** + **`src/pages/admin/Reservaciones.tsx`** — plantilla exacta de ruta + página de panel. `src/routeTree.gen.ts` es TRACKED, lo regenera `bun run build`.
- **`src/components/layout/PillTabs.tsx`** (`PESTANAS_NEGOCIO`) + **`AdminLayout.tsx`** (`cubre` del item "Mi negocio").
- **Migraciones** — se aplican con el conector `claude.ai Supabase` (proyecto `iaiiwtqqiaqxnzxjqcnt`, **producción**, Supabase Free = sin branching → `apply_migration` directo, aditivo, transaccional). El `.sql` se guarda en `src/docs/vibemenu_migracion_*.sql` como registro. **Ojo:** Supabase concede `EXECUTE` a `anon`/`authenticated` por defecto en funciones de `public`; para `service_role`-only hay que `revoke execute ... from public, anon, authenticated` explícito. Y el grant a nivel tabla a `anon` hace no-op los revokes por columna (lección de #4) → para proyecciones seguras se usa una RPC, no RLS pública.
- **Tests** — solo `src/lib/*.test.ts`, `bun:test`. CI: `src/lib` + `bunx tsc --noEmit` + `bunx eslint .` (0 errores; ~15 warnings `react-refresh` preexistentes OK). Componentes/hooks: `tsc` + `eslint` + `bun run build` + prueba manual. `src/types/database.ts` se **regenera** con el conector tras la migración (conservando el bloque de alias manual al pie).
- **Copy:** español de México, tono directo (`src/lib/copy.ts`).

## Arquitectura

### A. Datos (`src/docs/vibemenu_migracion_lealtad.sql`)

Una transacción (`begin; … commit;`). Aditiva. Aplicar **antes** del deploy de la rama.

```sql
begin;

-- 1. Capacidad de plan
alter table planes
  add column if not exists permite_lealtad boolean not null default false;
update planes set permite_lealtad = true where nombre in ('pro', 'enterprise');

-- 2. Config del programa (uno por negocio)
alter table tenants
  add column if not exists lealtad_activa       boolean  not null default false,
  add column if not exists lealtad_sellos_meta  smallint,
  add column if not exists lealtad_premio       text,
  add constraint tenants_lealtad_meta_valida
    check (lealtad_sellos_meta is null or lealtad_sellos_meta between 2 and 50),
  add constraint tenants_lealtad_premio_valido
    check (lealtad_premio is null or length(lealtad_premio) <= 80),
  -- para poder activar hace falta meta y premio:
  add constraint tenants_lealtad_completa
    check (not lealtad_activa or (lealtad_sellos_meta is not null and lealtad_premio is not null));

-- 3. Tarjetas (el id ES el UUID de localStorage)
create table tarjetas_lealtad (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references tenants(id) on delete cascade,
  codigo                    text not null,
  sellos                    smallint not null default 0 check (sellos >= 0),
  premios_canjeados         smallint not null default 0 check (premios_canjeados >= 0),
  contacto                  text,
  contacto_tipo             text check (contacto_tipo in ('telefono', 'correo')),
  consentimiento_marketing_at timestamptz,
  ultimo_sello_dia          date,
  creada_at                 timestamptz not null default now(),
  ultima_actividad_at       timestamptz,
  constraint tarjeta_contacto_coherente
    check ((contacto is null) = (contacto_tipo is null))
);

create unique index uq_tarjetas_codigo_tenant on tarjetas_lealtad (tenant_id, upper(codigo));
create index idx_tarjetas_tenant on tarjetas_lealtad (tenant_id);
create index idx_tarjetas_contacto on tarjetas_lealtad (tenant_id, lower(contacto)) where contacto is not null;
create index idx_tarjetas_purga on tarjetas_lealtad (coalesce(ultima_actividad_at, creada_at));

alter table tarjetas_lealtad enable row level security;
create policy "tarjetas_select_miembros" on tarjetas_lealtad for select
  to authenticated using (pertenece_a_tenant(tenant_id));
revoke all on tarjetas_lealtad from anon, authenticated;
grant select on tarjetas_lealtad to authenticated;

-- 4. Movimientos (auditoría + sucursal)
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

alter table movimientos_lealtad enable row level security;
create policy "movimientos_select_miembros" on movimientos_lealtad for select
  to authenticated using (pertenece_a_tenant(tenant_id));
revoke all on movimientos_lealtad from anon, authenticated;
grant select on movimientos_lealtad to authenticated;

-- 5. RPCs  (detalle abajo — todas set search_path = public, security definer)
--    crear_tarjeta_lealtad(p_tenant_id uuid) returns tarjetas_lealtad               → anon, authenticated
--    obtener_tarjeta_lealtad(p_tarjeta_id uuid) returns <projection>                → anon, authenticated
--    guardar_contacto_tarjeta(p_tarjeta_id uuid, p_contacto text, p_tipo text, p_consent bool) → anon, authenticated
--    buscar_tarjeta(p_codigo text) returns <card view>                             → authenticated (revoke anon)
--    sellar_tarjeta(p_codigo text, p_sucursal_id uuid default null) returns …       → authenticated (revoke anon)
--    canjear_premio(p_codigo text, p_sucursal_id uuid default null) returns …       → authenticated (revoke anon)
--    buscar_tarjetas_por_contacto(p_contacto text) returns setof …                 → authenticated (revoke anon)
--    purgar_tarjetas_lealtad() returns integer                                     → service_role only

commit;
```

**RPCs — semántica:**

- **`crear_tarjeta_lealtad(p_tenant_id uuid) returns tarjetas_lealtad`** — `security definer`, `to anon, authenticated`.
  Si el tenant no existe o `not lealtad_activa` → `raise exception 'lealtad_no_disponible'`.
  Genera `codigo` (6 chars del alfabeto sin ambigüedad) en un loop con retry sobre el unique `(tenant_id, upper(codigo))` (máx ~5 intentos, si no `raise 'lealtad_error_interno'`).
  Inserta `(tenant_id, codigo, ultima_actividad_at => now())` y devuelve la fila.
  *Nota:* devuelve `contacto`/`contacto_tipo` como null recién creada; el cliente solo usa `id` y `codigo`.

- **`obtener_tarjeta_lealtad(p_tarjeta_id uuid)`** — `security definer`, `to anon, authenticated`. Devuelve una fila con:
  `sellos, sellos_meta (de tenants), premio, codigo, premios_canjeados, tenant_nombre, tenant_slug, tiene_contacto boolean, contacto_enmascarado text` (p. ej. `55●●●●1234` o `a●●●@gmail.com`).
  Si el UUID no existe → devuelve 0 filas (el cliente muestra "tarjeta no encontrada").
  **No** expone `contacto` en claro ni `consentimiento_marketing_at`.

- **`guardar_contacto_tarjeta(p_tarjeta_id uuid, p_contacto text, p_tipo text, p_consent boolean)`** — `security definer`, `to anon, authenticated`.
  Valida formato (teléfono `^\+?[0-9 ]{8,18}$` normalizado a dígitos con lada; correo regex estándar); `p_tipo in ('telefono','correo')`; `p_consent` debe ser `true` (si no → `raise 'consentimiento_requerido'`).
  Setea `contacto`, `contacto_tipo`, `consentimiento_marketing_at = now()`, `ultima_actividad_at = now()`. Permite sobreescribir (cambiar de número). Para borrar: `p_contacto` vacío → limpia los 3 campos.

- **`buscar_tarjeta(p_codigo text) returns <card view>`** — `security definer`, `authenticated` only. Resuelve la tarjeta por `codigo` dentro del tenant del `auth.uid()` **sin mutar**, para que el panel muestre sellos/meta/premio/`listo_para_canje`/`sello_repetido_hoy` antes de que el encargado decida sellar o canjear. `tarjeta_no_encontrada` si no hay match.

- **`sellar_tarjeta(p_codigo text, p_sucursal_id uuid default null) returns <card view>`** — `security definer`; `revoke execute from anon`, `grant to authenticated`.
  `v_tenant := (select tenant_id from tenant_usuarios where user_id = auth.uid())`. Si null → `raise 'sin_tenant'`.
  Busca la tarjeta por `tenant_id = v_tenant and upper(codigo) = upper(p_codigo)`. Si no → `raise 'tarjeta_no_encontrada'`.
  Si `not tenants.lealtad_activa` → `raise 'lealtad_no_disponible'`.
  `p_sucursal_id` de otro tenant → se trata como null. Zona horaria: `sucursal.timezone` (o la 1ª del tenant) — `v_hoy := (now() at time zone coalesce(tz,'UTC'))::date`.
  Si `ultimo_sello_dia = v_hoy` → `raise 'sello_repetido_hoy'`.
  `update … set sellos = sellos + 1, ultimo_sello_dia = v_hoy, ultima_actividad_at = now()`; `insert movimientos_lealtad (tipo 'sello', encargado_id auth.uid(), sucursal_id)`. Devuelve la vista de la tarjeta (sellos, meta, premio, listo_para_canje boolean).

- **`canjear_premio(p_codigo text, p_sucursal_id uuid default null) returns <card view>`** — igual que `sellar_tarjeta` para resolución de tarjeta.
  Si `sellos < tenants.lealtad_sellos_meta` → `raise 'sellos_insuficientes'`.
  `update … set sellos = sellos - meta, premios_canjeados = premios_canjeados + 1, ultima_actividad_at = now()`; movimiento `canje`. (No toca `ultimo_sello_dia` → se puede sellar y canjear el mismo día.)

- **`buscar_tarjetas_por_contacto(p_contacto text) returns setof <recovery view>`** — `authenticated` only.
  Del tenant del `auth.uid()`, `where lower(contacto) = lower(trim(p_contacto)) or contacto like '%'||regexp_replace(p_contacto,'\D','','g')` (match laxo por dígitos para teléfono).
  Devuelve `id, codigo, sellos, sellos_meta, contacto_enmascarado, creada_at`. El front arma la URL `/{slug}/lealtad/{id}` y su QR.

- **`purgar_tarjetas_lealtad() returns integer`** — `security definer`, `revoke execute from public, anon, authenticated`, `grant to service_role`.
  `delete from tarjetas_lealtad where (sellos = 0 and premios_canjeados = 0 and creada_at < now() - interval '14 days') or coalesce(ultima_actividad_at, creada_at) < now() - interval '365 days'`. `get diagnostics` → count.

Verificación al pie (patrón peers): `permite_lealtad` pro/enterprise `true`; `set role anon` puede `crear_tarjeta_lealtad` / `obtener_tarjeta_lealtad` pero **no** `sellar_tarjeta` / `purgar_tarjetas_lealtad`; el unique de código funciona; el check `tenants_lealtad_completa` bloquea activar sin meta/premio.

### B. Frontend — comensal

**`src/lib/lealtad.ts`** (+ `.test.ts`, CI), puro:
- `ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"`, `LARGO_CODIGO = 6`.
- `normalizarCodigo(s: string): string` — mayúsculas, quita espacios/guiones, mapea `0→O`? no — el alfabeto no tiene O/0; solo trim+upper y filtra a `[A-Z0-9]`.
- `codigoValido(s: string): boolean` — largo 6, todos los chars en el alfabeto.
- `validarTelefono(s): { ok: boolean; e164?: string }` — normaliza a dígitos, exige 10–15, antepone `+` si falta lada (default `+52` si son 10 dígitos).
- `validarCorreo(s): boolean`.
- `progresoLealtad(sellos, meta): { hechos: number; faltan: number; completa: boolean; pct: number }`.
- `rejillaSellos(sellos, meta): boolean[]` — array de longitud `meta`, `true` los llenos (para pintar la rejilla).
- `puedeSellarHoy(ultimoSelloDia: string | null, hoyISO: string): boolean`.
- `clave LocalStorage`: `vm:lealtad:{slug}` → guarda `{ uuid }`. Helpers `leerTarjetaLocal(slug)` / `guardarTarjetaLocal(slug, uuid)` / `olvidarTarjetaLocal(slug)` con `try/catch` (Safari privado).

**`src/hooks/useLealtad.ts`** — hooks TanStack Query:
- `useTarjetaLocal(slug)` — lee `localStorage`, devuelve `uuid | null` (estado React, revalida en focus).
- `useTarjeta(slug, uuid)` — `useQuery` → `supabase.rpc("obtener_tarjeta_lealtad", { p_tarjeta_id })`. `enabled: Boolean(uuid)`, `retry: false`.
- `useCrearTarjeta(slug, tenantId)` — `useMutation` → `crear_tarjeta_lealtad`; onSuccess guarda el uuid en `localStorage` e invalida.
- `useGuardarContacto(uuid)` — `useMutation` → `guardar_contacto_tarjeta`.
Errores traducidos con `traducirError` de `src/lib/errores.ts` (añadir los slugs nuevos ahí).

**`src/components/menu/LealtadMenu.tsx`** — banner en `MenuPublico.tsx` (junto a `ReservarMenu`), `habilitado={Boolean(data.lealtad?.activa)}`:
- sin uuid local → botón "Junta sellos — {premio}" → `useCrearTarjeta` → navega a `/{slug}/lealtad/{uuid}`.
- con uuid → mini-resumen "{sellos}/{meta} sellos" → `<Link>` a la tarjeta.
- Solo en `cuerpo` (Clásico/Pinterest/Instagram). En TikTok, sin banner en v1.

**`src/routes/$slug.lealtad.$tarjetaId.tsx`** + **`src/pages/TarjetaLealtad.tsx`**:
- Header con nombre del negocio, link "← al menú".
- Rejilla de sellos (`rejillaSellos`), progreso, "Te faltan N para {premio}" / "¡Listo! Enseña esta tarjeta para tu {premio}".
- `codigo` grande + `<QRCode value={codigo} />` (de `react-qr-code`), con "Enséñaselo al mesero para tu sello".
- Bloque "Guarda tu tarjeta": si el uuid **no** está en `localStorage` → "Guardar en este teléfono" (llama `guardarTarjetaLocal`). Si ya está → nota "Guardada en este teléfono ✓".
- Formulario de contacto (opcional, colapsable): teléfono/correo + checkbox "Acepto que **{negocio}** guarde este dato para recuperar mi tarjeta y enviarme promociones" con link a `/privacidad`. Estado: sin contacto → formulario; con contacto → "Respaldo: {contacto_enmascarado} · cambiar · quitar".
- "Cómo funciona" (3 líneas).
- Tarjeta no encontrada (`useTarjeta` devuelve vacío) → mensaje + link al menú.

### C. Frontend — admin (`/admin/lealtad`)

**`src/routes/admin.lealtad.tsx`** (copia de `admin.reservaciones.tsx`) + **`src/pages/admin/Lealtad.tsx`**.

**`src/hooks/useAdminLealtad.ts`:**
- `useConfigLealtad(tenantId)` — lee de `useTenantActual` (ya trae `tenant.*`); mutación `useGuardarConfigLealtad` → `supabase.from("tenants").update({ lealtad_activa, lealtad_sellos_meta, lealtad_premio })` (RLS de `tenants` ya permite al owner/encargado). Invalida `tenant-actual`.
- `useBuscarTarjeta(codigo)` — `useMutation` → `buscar_tarjeta(p_codigo)` (RPC `authenticated`, ya en la migración): devuelve la vista de la tarjeta sin mutar, para mostrarla antes de que el encargado selle o canjee.
- `useSellar()` / `useCanjear()` — `useMutation` → `sellar_tarjeta` / `canjear_premio` con `p_sucursal_id` (la sucursal activa del admin, si hay selector; si no, null).
- `useRecuperarTarjetas(contacto)` — `buscar_tarjetas_por_contacto`.
- `useMovimientosLealtad(tenantId)` — `useQuery` → `select` de `movimientos_lealtad` con join a `tarjetas_lealtad.codigo` y `sucursales.nombre`, `.order("creado_at", desc).limit(100)`.

**Página `Lealtad.tsx`** — muro de plan (`!ctx.plan.permite_lealtad` → `EJEMPLO` difuminado + `<Lock/>` + CTA), patrón `Reservaciones.tsx`. Secciones:
1. **Configuración** — toggle `lealtad_activa` (deshabilitado hasta que haya meta+premio), input numérico `sellos_meta` (2–50), input `premio` (≤80). Botón Guardar. Aviso "Actívalo cuando tengas listo el premio".
2. **Sellar / canjear** — campo de `codigo` (normaliza al escribir) + botón "Escanear" (`import("html5-qrcode")` dinámico, modal con cámara, al leer llena el campo y cierra). Si `sucursales.length > 1`, un `<select>` de sucursal (la que sella; default la 1ª); si no, se pasa `null`. Al enviar → `buscar_tarjeta` → tarjeta-card con sellos/meta, botón **Sellar** (deshabilitado + "ya selló hoy" si `sello_repetido_hoy` de la vista), botón **Canjear premio** (habilitado si `sellos >= meta`). Mensajes de error traducidos (`sello_repetido_hoy`, `tarjeta_no_encontrada`, …).
3. **Recuperar tarjeta** — input contacto → lista de tarjetas (código, sellos, `contacto_enmascarado`) cada una con su `<QRCode>` y la URL `/{slug}/lealtad/{id}` + botón "Copiar enlace". "Muéstrale el QR al cliente para que abra su tarjeta en su teléfono."
4. **Actividad** — tabla de `movimientos_lealtad` (fecha, tipo, código, sucursal, encargado). Vacío → "Aún no has sellado ninguna tarjeta."

Nav: `PESTANAS_NEGOCIO` gana `{ a: "/admin/lealtad", etiqueta: "Lealtad" }` (entre "Analítica" y "Suscripción"); `AdminLayout` añade `/admin/lealtad` al `cubre` de "Mi negocio". `bun run build` regenera `routeTree.gen.ts`.

### D. Cron de purga

`.github/workflows/purgar-tarjetas-lealtad.yml` — copia de `purgar-reservaciones.yml`: `schedule: - cron: "15 4 * * *"`, `workflow_dispatch: {}`, `curl` a `/rest/v1/rpc/purgar_tarjetas_lealtad` con `SUPABASE_SERVICE_ROLE_KEY`.

### E. Tipos y docs

- `src/types/database.ts` — regenerar con el conector tras la migración (conservar el bloque de alias al pie). Sin añadir alias a menos que el panel lo pida.
- `src/hooks/useMenuPublico.ts` — `permite_lealtad` en los 3 joins de plan + `Pick<Plan, …>` + `MenuPublico` gana `lealtad: { activa: boolean; meta: number; premio: string } | null` (armado de `tenant.lealtad_activa/…`) + el `return`.
- `src/lib/errores.ts` — slugs nuevos: `lealtad_no_disponible`, `sello_repetido_hoy`, `tarjeta_no_encontrada`, `sellos_insuficientes`, `consentimiento_requerido`, `sin_tenant`, `lealtad_error_interno`.
- `src/pages/Privacidad.tsx` + `src/lib/legal.ts` — sección nueva: teléfono/correo **solo si el comensal lo deja**, con consentimiento explícito para recuperación de la tarjeta **y contacto promocional**; se puede pedir el borrado (quitar el dato desde la tarjeta); retención 12 meses de inactividad. Fila en `legal.ts` si hay tabla de datos/terceros.
- `src/docs/vibemenu_alcance.md` — quitar de "Fuera del alcance" la línea de lealtad si existe; añadir descripción de feature (Pro+), fila en tabla de planes, ruta `/admin/lealtad` y `/{slug}/lealtad/{uuid}` en "Rutas y páginas".
- `src/docs/vibemenu_base-datos.md` — sección nueva (DDL verbatim de la migración + RLS + las RPC con sus grants + nota de diseño: tarjeta = UUID de localStorage, sin escritura pública directa salvo crear/contacto, sellado autenticado por el encargado, tope 1/día, purga).

## Flujo de datos (resumen)

```
Comensal (sin sesión)
  └─ MenuPublico → banner LealtadMenu (si data.lealtad.activa)
       ├─ "Junta sellos" → crear_tarjeta_lealtad(tenant) → {id, codigo}
       │     └─ localStorage vm:lealtad:{slug} = {uuid}; navega a /{slug}/lealtad/{uuid}
       └─ /{slug}/lealtad/{uuid} → obtener_tarjeta_lealtad(uuid) → progreso + codigo + QR(codigo)
             └─ (opcional) guardar_contacto_tarjeta(uuid, tel/correo, consent=true)

Encargado (con sesión, /admin/lealtad)
  ├─ Config → tenants.update({ lealtad_activa, lealtad_sellos_meta, lealtad_premio })   [RLS owner/encargado]
  ├─ teclea/escanea codigo → buscar_tarjeta(codigo)  [tenant del auth.uid()]
  │     ├─ Sellar   → sellar_tarjeta(codigo, sucursal)  → sellos+1 (tope 1/día tz sucursal) + movimiento
  │     └─ Canjear  → canjear_premio(codigo, sucursal)  → sellos-=meta, premios+1 + movimiento
  ├─ Recuperar → buscar_tarjetas_por_contacto(contacto) → [{id, codigo, ...}] → QR/URL para el cliente
  └─ Actividad → select movimientos_lealtad (limit 100)

Cron diario → purgar_tarjetas_lealtad()  (0 sellos >14d  ||  inactiva >365d)
```

## Pruebas

**Unitarias (CI, `bun:test`, `src/lib/lealtad.test.ts`):**
- `normalizarCodigo` / `codigoValido` (largo, alfabeto, trim, mayúsculas).
- `validarTelefono` (10 dígitos → `+52…`; con lada; basura → `ok:false`), `validarCorreo`.
- `progresoLealtad` (faltan/completa/pct; `sellos > meta` → `completa`, `faltan 0`).
- `rejillaSellos` (longitud = meta; `sellos` llenos; `sellos > meta` → todos llenos).
- `puedeSellarHoy` (mismo día → false; ayer → true; null → true).
- helpers de `localStorage` con `try/catch` (mock como en `analitica.test.ts`).

**SQL (manual, al pie de la migración):**
- Pro/Enterprise `permite_lealtad = true`; free/basic `false`.
- `set role anon`: `crear_tarjeta_lealtad` OK, `obtener_tarjeta_lealtad` OK, `sellar_tarjeta`/`canjear_premio`/`purgar_tarjetas_lealtad` → `permission denied`.
- Activar sin meta/premio → viola `tenants_lealtad_completa`.
- Dos `crear_tarjeta_lealtad` seguidas → códigos distintos, unique respeta `upper()`.
- `sellar_tarjeta` dos veces el mismo día → 2ª lanza `sello_repetido_hoy`.
- `canjear_premio` con `sellos < meta` → `sellos_insuficientes`; con `sellos = meta+1` → queda 1.
- Tarjeta de otro tenant por código → `tarjeta_no_encontrada` (no cruza tenants).

**Manual (navegador):**
- Tenant Pro, `lealtad_activa` con meta 5 / premio "Café": banner en el menú → crear tarjeta → `localStorage` tiene el uuid → la tarjeta muestra 0/5 + código + QR.
- `/admin/lealtad` (con sesión): teclear el código → sellar → tarjeta 1/5; volver a sellar → "ya selló hoy". Escanear el QR con el botón Escanear → llena el código.
- Llegar a 5/5 → "Canjear premio" → 0/5, `premios_canjeados` 1.
- Dejar contacto en la tarjeta con consentimiento → aparece enmascarado; en `/admin/lealtad` → Recuperar por ese dato → sale la tarjeta con su QR.
- Bajar el tenant a Basic → `/admin/lealtad` muestra el muro; el banner desaparece del menú; `crear_tarjeta_lealtad` lanza `lealtad_no_disponible`.
- `/{slug}/lealtad/{uuid-inexistente}` → "tarjeta no encontrada".

## Orden de implementación (para el plan)

1. Migración SQL + aplicar a prod por el conector. Regenerar `database.ts`.
2. `src/lib/lealtad.ts` + tests (TDD).
3. `src/lib/errores.ts` — slugs nuevos.
4. `src/hooks/useMenuPublico.ts` — `permite_lealtad` + `lealtad` en `MenuPublico`.
5. `src/hooks/useLealtad.ts` (comensal) + `src/components/menu/LealtadMenu.tsx` + montar el banner en `MenuPublico.tsx`.
6. `src/routes/$slug.lealtad.$tarjetaId.tsx` + `src/pages/TarjetaLealtad.tsx` (incluye el QR y el formulario de contacto).
7. `src/hooks/useAdminLealtad.ts` + `src/routes/admin.lealtad.tsx` + `src/pages/admin/Lealtad.tsx` (config + sellar/canjear + recuperar + actividad) + `PillTabs`/`AdminLayout` + `routeTree.gen.ts`. Escáner con `import()` dinámico de `html5-qrcode`.
8. `.github/workflows/purgar-tarjetas-lealtad.yml`.
9. Docs (`Privacidad.tsx`, `legal.ts`, `alcance.md`, `base-datos.md`).
10. QA end-to-end (tenant Pro de prueba; revertir al terminar).

## Riesgos y mitigaciones

- **Spam de creación de tarjetas** (RPC `to anon`, sin Turnstile) — filas mínimas; purga de tarjetas con 0 sellos a los 14 días; RLS las oculta. Si se abusa → Edge Function con Turnstile (patrón #4). Aceptado para v1.
- **`localStorage` borrado / cambio de teléfono** = tarjeta perdida — lo resuelve el campo de respaldo opcional; sin él, el comensal empieza de cero (comportamiento esperado y comunicado en "Cómo funciona").
- **`html5-qrcode`** (~200 KB, nueva dependencia) — `import()` dinámico solo al tocar "Escanear"; el flujo de código tecleado nunca lo carga. Si la cámara falla / sin permiso → el campo de texto es el fallback.
- **Fraude del encargado** (sellar a conocidos) — fuera de alcance; `movimientos_lealtad.encargado_id` + la sección Actividad dan rastro al owner.
- **Colisión de `codigo`** — 6 chars de 30 símbolos = ~7·10⁸ por tenant; retry en la RPC; unique sobre `upper(codigo)`.
- **PII y consentimiento** — el `contacto` nunca se expone en claro por RPC pública (solo enmascarado); el consentimiento de marketing se registra con timestamp; el comensal puede quitar el dato desde su tarjeta; `/privacidad` lo documenta. La función de campañas en sí no existe todavía.
- **Zona horaria del tope 1/día** — se calcula con la tz de la sucursal que sella (o la 1ª del tenant), mismo criterio que `registrar_visita` / analítica.
- **Migración antes del deploy** — igual que #4/#5: aplicar el SQL antes de mergear/desplegar.
