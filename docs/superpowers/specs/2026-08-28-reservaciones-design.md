# Reservaciones simples — Diseño

**Fecha:** 2026-08-28
**Rama:** dev
**Origen:** Auditoría Vibemenu (artifact `8d645623`), sección 04 "Extras vendibles" → "Reservaciones simples" y sección 07 "Por dónde empezar" → **P2**.
**Alcance de este documento:** sub-proyecto **#4** del artifact (continúa la numeración de contacto/reseñas #1–#3). Los sub-proyectos #5 (Analítica por platillo) y #6 (Lealtad con QR) tienen sus propios specs y se construyen después, en ese orden.

## Contexto: qué pidió el usuario

Un formulario corto en el menú público para que el comensal pida mesa (nombre, personas, fecha/hora) y el restaurante reciba el aviso. **No es un sistema de reservas con mesas ni disponibilidad** — es captar la intención antes de que el comensal se vaya a otro lado. El alcance (`vibemenu_alcance.md`) ya lo marca así y como fase 2.

### Decisiones tomadas con el usuario (2026-08-28)

1. **Plan:** **Pro y Enterprise** (`permite_reservaciones`). El artifact decía Enterprise; se movió a Pro+ para engordar el salto Basic→Pro. Es barata de operar.
2. **Opt-in por sucursal:** cada sucursal tiene su switch `acepta_reservaciones` y su correo de aviso opcional. El formulario del menú solo aparece para sucursales que lo activaron.
3. **Sin correo al comensal en la v1:** al enviar ve "Recibimos tu solicitud, el restaurante te contactará". Cero plantilla dirigida al comensal, cero loop de confirmación. El restaurante confirma por teléfono/WhatsApp fuera de Vibemenu.
4. **Ubicación del formulario:** botón "Reservar" en la fila de contacto del menú (`ContactoMenu`), abre un `Sheet` (shadcn) con el formulario. No estorba a quien solo quiere ver el menú.
5. **Campos:** nombre, personas, fecha, hora, **teléfono con lada `+NN`** (obligatorio — es el único canal de contacto), email **opcional** (se guarda, no se usa en v1), nota opcional. Más un **checkbox de consentimiento** obligatorio con enlace a `/privacidad` (LFPDPPP: el restaurante es el responsable de esos datos personales, Vibemenu el encargado).
6. **Panel:** ruta propia `/admin/reservaciones` con máquina de estados `nueva → atendida | cancelada`. Badge con el conteo de `nueva` en el nav.
7. **Anti-spam:** widget Turnstile en el formulario + edge function `crear-reservacion` que verifica el token contra Cloudflare (`siteverify`) antes de insertar. Front door único; sin `insert` público directo.

### Juicios del diseñador (revertibles)

- `sucursal_id` **obligatorio**: toda reservación pertenece a una sucursal concreta, nunca al "menú general".
- Estados mínimos `nueva / atendida / cancelada`, ninguno dispara correos.
- Purga de reservaciones pasadas a los **90 días** (cron GitHub Actions, patrón de `eventos_stripe`).
- La fecha se limita a **≤ 60 días** a futuro y no puede estar en el pasado (zona horaria de la sucursal).

## Fuera de alcance

- Mesas, aforo, disponibilidad, confirmación de horario contra los `horarios` de la sucursal (se puede **avisar** que está fuera de horario, no bloquear).
- Cualquier correo/SMS/WhatsApp dirigido al comensal (acuse, recordatorio, confirmación).
- WhatsApp Business API (cobra por mensaje). El teléfono guardado habilita un link `wa.me` manual desde el panel, nada automático.
- Pagos o depósito de reserva.
- Sub-proyectos #5 y #6.

## Lo que ya existe (contexto, no se reescribe)

- **`planes`** — columnas de capacidad booleanas (`permite_multiusuario`, `permite_dominio_propio`, `marca_agua`, `menu_independiente_por_sucursal`). El frontend las lee para mostrar/ocultar; los triggers en Postgres son el enforcement real. `null` en `limite_*` = ilimitado.
- **`sucursales`** — `nombre`, `direccion`, `telefono`, `whatsapp`, `maps_url`, `timezone` (IANA), `google_reviews_url` (migración de contacto/reseñas #1). Policy `sucursales_write_miembros` cubre la tabla entera: **una columna nueva no necesita `grant` extra** a `authenticated` (a diferencia de `tenants`, revocado columna por columna).
- **`tenants`** — `estado` (`activo`/`suspendido`/…); owner y encargados en `tenant_usuarios`. El correo del owner vive en `auth.users`, accesible con `service_role`.
- **`registrar_visita(p_tenant_id, p_sucursal_id)`** (migración 007) — RPC `SECURITY DEFINER` para escritura sin sesión del comensal; valida que la sucursal sea del tenant; calcula el día con `now() at time zone coalesce(sucursal.timezone, 'UTC')`. **Patrón a seguir** para el cálculo de `fecha_hora`.
- **`sucursal_esta_abierta(sucursal_id, momento)`** — función servidor que evalúa `horarios` con turnos que cruzan medianoche. Reutilizable para el aviso "fuera de horario" (opcional, no bloquea).
- **RLS helpers** — `pertenece_a_tenant(tenant_id)` (miembro del tenant), `tenant_puede_escribir(tenant_id)` (miembro + tenant no suspendido). Las policies de escritura de contenido usan la segunda.
- **Edge functions** — todas en `supabase/functions/<nombre>/index.ts`, `Deno.serve`, CORS `*`, helper `json(cuerpo, status)`. Dos patrones de cliente:
  - `enviar-bienvenida` — corre **como el usuario** (`SUPABASE_ANON_KEY` + `Authorization` header), respeta RLS. No sirve aquí: el comensal no tiene sesión.
  - `invitar-encargado` — usa **`SUPABASE_SERVICE_ROLE_KEY`** (`createClient(url, service, { auth: { persistSession: false } })`) para leer/escribir saltando RLS. **Este es el patrón** para `crear-reservacion`.
  - Envío de correo: `POST https://api.resend.com/emails` con `Authorization: Bearer ${RESEND_API_KEY}`, `from: "Vibemenu <hola@vibemenu.com.mx>"`, HTML de tabla inline (plantilla de marca; ver `plantillaBienvenida`).
- **Crons** — GitHub Actions en `.github/workflows/*.yml` que pegan a una edge function con un secreto (`procesar-trials.yml`, `backup-db.yml`). **No hay `pg_cron` ni `pg_net`** en la base.
- **`src/components/ui/captcha.tsx`** — `<Captcha onToken={...} ref={...} />` monta Turnstile con `VITE_TURNSTILE_SITE_KEY`. `captchaHabilitado` es `false` si falta la key (dev): el formulario **no debe bloquear** el envío en ese caso. `ref.current?.reset()` para reintentar.
- **`src/components/ui/phone-input.tsx`** — `PhoneInput` con selector de lada (`CODIGOS_PAIS`). Guarda `"+52 55 1234 5678"` en una sola cadena. `src/lib/whatsapp.ts` → `telefonoParaWaMe(texto)` normaliza a dígitos para `wa.me`; `enlaceWhatsApp(texto)` arma el link. `src/lib/paises.ts` → `combinarTelefono`, `LADA_DEFAULT = "+52"`.
- **`src/lib/contacto.ts`** — `contactoSucursal(sucursal, tenant)` resuelve teléfono/WhatsApp/reseñas con fallback sucursal→empresa.
- **`src/components/menu/ContactoMenu.tsx`** — fila de píldoras (Llamar, WhatsApp, Cómo llegar, Reseñas) al pie del menú. Recibe `{ tenant, sucursal: Sucursal | null }`. Solo pinta filas con dato; sin ninguna, no se monta. Usa `var(--menu-primario)`, nunca colores de marca externos. **Aquí entra el botón "Reservar".**
- **`src/pages/MenuPublico.tsx` / `MenuPublicoSucursal.tsx`** — `/:slug` y `/:slug/sucursal/:sucursalSlug`. Arman `<HeaderMenu/>` + formato + `<ContactoMenu/>` + `<MarcaAgua/>`. TikTok es fullscreen y tiene su propia rama.
- **`src/hooks/useMenuPublico.ts`** — `select("*")` sobre `tenants` y `sucursales` + join `planes(...)`. Columnas nuevas de `sucursales` llegan solas; **hay que añadir `permite_reservaciones` al join de `planes`**.
- **`src/hooks/useVisitas.ts`** — `useVisitas(tenantId)` (`useQuery`, select con RLS, resumen agregado en cliente) y `useRegistrarVisita` (efecto que llama la RPC una vez por sesión, `sessionStorage`). **Patrón para `useReservaciones`.**
- **`src/hooks/useSucursales.ts`** — `BorradorSucursal`, `useGuardarSucursal` (upsert sucursal + 7 horarios, `select("*")`). El editor incluye **cada** columna editable en el upsert: añadir campos exige tocarlo o PostgREST rechaza todo (PGRST204).
- **`src/components/admin/EditorSucursal.tsx`** — formulario de sucursal (incluye el campo "Reseñas en Google" de #1). Aquí van el switch `acepta_reservaciones` y el correo de aviso.
- **`src/components/layout/PillTabs.tsx`** — `PESTANAS_NEGOCIO` = Sucursales / Equipo / Suscripción, sub-tabs de "Mi negocio". **Se añade "Reservaciones".**
- **`src/components/layout/AdminLayout.tsx`** — nav principal (5 ítems); "Mi negocio" (`/admin/empresa`) `cubre: ["/admin/sucursales", "/admin/equipo", "/admin/suscripcion"]`. Se añade `/admin/reservaciones` a ese `cubre`.
- **`src/pages/admin/Equipo.tsx`** — **patrón de muro de plan**: si el plan no permite la feature, se renderiza una tabla `EJEMPLO` difuminada tras un `<Lock/>` con enlace a `/admin/suscripcion`. `src/lib/plan.ts` → helpers de límite/capacidad.
- **`src/lib/plan.ts` / `plan.test.ts`** — lógica de plan pura, con suite en CI.
- **`src/routes/admin.*.tsx`** — TanStack Router **file-based**: `createFileRoute("/admin/x")({ component: X })`, un archivo por ruta.
- **`src/types/database.ts`** — tipos generados/mantenidos a mano; tabla nueva y RPC nuevas hay que agregarlas o `tsc` truena.
- **`src/lib/demo.ts`** — `TENANT_DEMO`, `SUCURSAL_DEMO` literales tipados: columna nueva = campo nuevo a mano.
- **`src/lib/erroresEdge.ts` / `.test.ts`** — `traducirErrorEdge(codigo)` mapea códigos de edge function a copy en español. Los códigos nuevos van aquí.

## Arquitectura

### 1. Migración — `src/docs/vibemenu_migracion_reservaciones.sql`

Una transacción. Aplicar en producción **antes** del deploy de la rama (si `EditorSucursal` manda `acepta_reservaciones` en el upsert y la columna no existe, PGRST204 rompe todo guardado de sucursal — misma lección que #1).

```sql
begin;

-- 1. Capacidad de plan
alter table planes
  add column if not exists permite_reservaciones boolean not null default false;

update planes set permite_reservaciones = true where nombre in ('pro', 'enterprise');

-- 2. Opt-in por sucursal
alter table sucursales
  add column if not exists acepta_reservaciones boolean not null default false,
  add column if not exists reservaciones_email text
    constraint sucursal_reservaciones_email_valido
      check (reservaciones_email is null or reservaciones_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
-- policy sucursales_write_miembros ya cubre la tabla: sin grant extra.

-- 3. Reservaciones
create table reservaciones (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  sucursal_id       uuid not null references sucursales(id) on delete cascade,
  nombre            text not null check (length(btrim(nombre)) between 2 and 120),
  personas          int  not null check (personas between 1 and 99),
  fecha_hora        timestamptz not null,
  telefono          text not null check (length(btrim(telefono)) between 6 and 30),
  email             text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  nota              text check (nota is null or length(nota) <= 500),
  estado            text not null default 'nueva' check (estado in ('nueva','atendida','cancelada')),
  consentimiento_at timestamptz not null default now(),
  ip                inet,
  creada_en         timestamptz not null default now()
);

create index idx_reservaciones_tenant on reservaciones (tenant_id, fecha_hora desc);
create index idx_reservaciones_sucursal_estado on reservaciones (sucursal_id, estado);
-- rate-limit: contar recientes por sucursal / por IP
create index idx_reservaciones_sucursal_creada on reservaciones (sucursal_id, creada_en desc);
create index idx_reservaciones_ip_creada on reservaciones (ip, creada_en desc) where ip is not null;

alter table reservaciones enable row level security;

-- Lectura: miembros del tenant. Cambiar estado: miembros del tenant (aunque esté
-- suspendido — es solo gestión de contacto, no contenido público).
create policy "reservaciones_select_miembros" on reservaciones for select
  to authenticated using (pertenece_a_tenant(tenant_id));

create policy "reservaciones_update_miembros" on reservaciones for update
  to authenticated using (pertenece_a_tenant(tenant_id))
  with check (pertenece_a_tenant(tenant_id));

-- Sin policy de insert: nadie escribe directo. Solo la edge function con service_role.
revoke all on reservaciones from anon, authenticated;
grant select, update on reservaciones to authenticated;

-- 4. Enforcement: la reservación debe ser coherente y estar permitida
create or replace function validar_reservacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_permite boolean;
  v_acepta  boolean;
  v_tz      text;
begin
  select p.permite_reservaciones into v_permite
    from planes p join tenants t on t.plan_id = p.id
   where t.id = new.tenant_id;

  if not coalesce(v_permite, false) then
    raise exception 'reservaciones_no_permitidas' using errcode = 'check_violation';
  end if;

  select s.acepta_reservaciones, s.timezone into v_acepta, v_tz
    from sucursales s
   where s.id = new.sucursal_id and s.tenant_id = new.tenant_id;

  if v_acepta is null then
    raise exception 'sucursal_ajena' using errcode = 'check_violation';
  end if;
  if not v_acepta then
    raise exception 'sucursal_no_acepta_reservaciones' using errcode = 'check_violation';
  end if;

  -- fecha_hora: ni pasado ni más de 60 días adelante, en la zona de la sucursal
  if new.fecha_hora < now() then
    raise exception 'reservacion_en_pasado' using errcode = 'check_violation';
  end if;
  if new.fecha_hora > now() + interval '60 days' then
    raise exception 'reservacion_muy_lejana' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger trg_validar_reservacion
  before insert on reservaciones
  for each row execute function validar_reservacion();

commit;
```

Verificación al pie del archivo (patrón de las otras migraciones): columnas creadas, `update` de planes surtió efecto, un insert de prueba con sucursal ajena falla con `sucursal_ajena`, uno con plan Free falla con `reservaciones_no_permitidas`.

### 2. Edge function — `supabase/functions/crear-reservacion/index.ts`

Front door único. `service_role`. Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`.

**Entrada** (JSON):
```
{ sucursal_id, nombre, personas, fecha (YYYY-MM-DD), hora (HH:MM),
  telefono, email?, nota?, consentimiento (bool), turnstile_token }
```

**Flujo:**

1. `OPTIONS` → CORS. Método distinto de `POST` → `405`.
2. Parseo + validación de forma (tipos, rangos, `consentimiento === true`). Falla → `400 { error: "datos_invalidos" }`.
3. **Turnstile** — si `TURNSTILE_SECRET_KEY` está configurada: `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` con `secret` + `response: turnstile_token` + `remoteip`. `success !== true` → `403 { error: "captcha_invalido" }`. Si no está configurada (dev), se salta (igual que `captchaHabilitado`).
4. Cliente `service_role`. Lee la sucursal:
   ```
   select s.id, s.nombre, s.timezone, s.acepta_reservaciones, s.reservaciones_email,
          t.id as tenant_id, t.nombre_negocio, p.permite_reservaciones
     from sucursales s
     join tenants t on t.id = s.tenant_id
     join planes  p on p.id = t.plan_id
    where s.id = :sucursal_id
   ```
   No existe / `!acepta_reservaciones` / `!permite_reservaciones` → `403 { error: "reservaciones_no_disponibles" }` (mismo mensaje para los tres: no filtramos por qué).
5. **Rate-limit** (con `service_role`, saltando RLS):
   - `count` de `reservaciones` de esta `sucursal_id` con `creada_en > now() - interval '1 hour'` → si ≥ **5**, `429 { error: "demasiadas_solicitudes" }`.
   - `count` por `ip` (del header `x-forwarded-for`, primera IP) con la misma ventana → si ≥ **3**, `429`.
6. Calcula `fecha_hora`: interpretar `fecha + 'T' + hora` en `sucursal.timezone`. Implementación: `select (($1)::timestamp at time zone $2) as fecha_hora` vía RPC mínima `combinar_fecha_hora_sucursal(p_fecha date, p_hora time, p_tz text) returns timestamptz` (SECURITY DEFINER, sin efectos) — o construirlo en Deno con `Temporal`/offset. **Preferir la RPC**: la base ya sabe de zonas horarias y es una línea.
7. `insert into reservaciones (...) values (...)` con `ip`. El trigger `trg_validar_reservacion` es la última red; si lanza (`raise exception`), mapear a `400 { error: <slug> }`.
8. **Resend** → correo al restaurante:
   - `to`: `[sucursal.reservaciones_email ?? correo_del_owner]`. El correo del owner se saca con `service_role`: `auth.admin` o join a `tenant_usuarios` + `auth.users` por `rol = 'owner'`.
   - `subject`: `Nueva reservación — ${nombre}, ${personas} personas`
   - HTML de marca (tabla inline, patrón `plantillaBienvenida`): negocio, sucursal, nombre, personas, **fecha y hora formateadas en la zona de la sucursal** (`Intl.DateTimeFormat('es-MX', { timeZone })`), teléfono como link `https://wa.me/<solo-dígitos>` **y** `tel:`, nota, y un CTA "Ver en el panel" → `${SITIO}/admin/reservaciones`.
   - Si Resend falla: **no** deshacer el insert. La fila ya existe y sale en el panel. Responder `200 { ok: true, aviso: "correo_no_enviado" }` para no alarmar al comensal.
9. Éxito → `200 { ok: true }`. Nunca devolver la fila ni IDs internos.

**Deploy:** `supabase functions deploy crear-reservacion --project-ref <ref>`. Documentar en la cabecera del archivo (patrón de las otras).

### 3. Cron de purga — `.github/workflows/purgar-reservaciones.yml` + función

Patrón del barrido de `eventos_stripe` (>30 días). Función SQL `purgar_reservaciones_viejas()` (SECURITY DEFINER): `delete from reservaciones where fecha_hora < now() - interval '90 days'`. En el plan: revisar primero si ya existe una edge function de "barrido nocturno" (la de `dominios_huerfanos` / `eventos_stripe`) a la que agregarle esta llamada; si la hay, reutilizarla y **no** crear workflow nuevo. Solo si no existe ninguna, una edge function mínima `purgar-reservaciones` + workflow diario protegido por secreto.

Purga por `fecha_hora`, no por `creada_en`: una reserva pedida con 2 meses de anticipación sigue siendo relevante hasta que pasa.

### 4. Frontend — biblioteca pura

**`src/lib/reservaciones.ts`** (+ `reservaciones.test.ts`, CI):

- `type BorradorReservacion = { nombre; personas; fecha; hora; telefono; email; nota; consentimiento }`
- `validarReservacion(borrador, ahora: Date, tz: string): { ok: true } | { ok: false, campo, motivo }` — nombre 2–120, personas 1–99, fecha/hora futura y ≤60 días (en `tz`), teléfono con `telefonoParaWaMe` no nulo, email vacío o válido, nota ≤500, consentimiento `true`.
- `payloadReservacion(borrador, sucursalId, token): {...}` — arma el body de la edge function (separa fecha y hora, teléfono ya trae lada del `PhoneInput`).
- `formatearFechaHora(fecha, hora, tz): string` — para el resumen antes de enviar.
- `MAX_DIAS_RESERVA = 60`, `MAX_PERSONAS = 99`.

### 5. Frontend — formulario público

**`src/components/menu/ReservarMenu.tsx`**:

- Props `{ tenant, sucursal: Sucursal | null }` (igual que `ContactoMenu`).
- **Visibilidad:** se monta solo si hay una sucursal que acepta:
  - en `MenuPublicoSucursal` → `sucursal?.acepta_reservaciones`
  - en `MenuPublico` (general) → si el tenant tiene **exactamente una** sucursal y esa acepta (se resuelve con los datos que ya trae `useMenuPublico`; si trae varias, no se muestra en el menú general — el comensal entra por el menú de la sucursal).
- Botón "Reservar" (píldora con `var(--menu-primario)`, ícono `CalendarPlus`) **dentro de `ContactoMenu`** como una fila más de la `nav` — `ContactoMenu` recibe `ReservarMenu` como último hijo, o expone la píldora y `ReservarMenu` monta solo el `Sheet`. Un solo contenedor, mismo estilo que las otras píldoras.
- Abre un `<Sheet>` (shadcn, lado inferior en móvil) con el formulario: `Input` nombre, stepper personas, `<input type="date">` (min hoy, max +60d), `<input type="time">`, `<PhoneInput>`, `Input` email ("opcional"), `Textarea` nota ("opcional"), `<Captcha>`, y checkbox **"Acepto que mis datos se usen para gestionar mi reservación"** con `<a href="/privacidad" target="_blank">aviso de privacidad</a>`.
- `useCrearReservacion()` — `useMutation` que llama `supabase.functions.invoke("crear-reservacion", { body })`. Estados: idle / enviando / ok / error. `ok` → reemplaza el form por "✓ Recibimos tu solicitud. El restaurante te contactará al número que dejaste." + botón cerrar. `error` → `traducirErrorEdge(codigo)` inline, resetea el captcha (`ref.current?.reset()`).
- Sin datos personales en `localStorage`/analítica. El evento GA (si acaso) es `reservacion_enviada` sin PII.

**Tipos:** `Sucursal` gana `acepta_reservaciones: boolean` y `reservaciones_email: string | null`; el join de plan en `useMenuPublico` gana `permite_reservaciones`. `demo.ts`: `SUCURSAL_DEMO.acepta_reservaciones = false`.

### 6. Frontend — panel admin

**Ruta:** `src/routes/admin.reservaciones.tsx` → `src/pages/admin/Reservaciones.tsx`. Añadir `"/admin/reservaciones"` a `PESTANAS_NEGOCIO` (`PillTabs`) y al `cubre` de "Mi negocio" en `AdminLayout`.

**Muro de plan:** si `!permite_reservaciones` → tabla `EJEMPLO` difuminada tras `<Lock/>` con enlace a `/admin/suscripcion` (patrón `Equipo.tsx`).

**`useReservaciones(tenantId)`** (patrón `useVisitas`):
- `useQuery` → `select("*").eq("tenant_id", …).order("fecha_hora", { ascending: true })` (RLS filtra). `retry: false`.
- Deriva: `nuevas` (count `estado = 'nueva'`), particiones próximas / pasadas por `fecha_hora` vs ahora.
- `useCambiarEstadoReservacion()` — `useMutation` → `update({ estado }).eq("id", …)`; invalida `["reservaciones", tenantId]`.

**Página:**
- Filtro por sucursal (si hay >1) y toggle Próximas / Pasadas / Todas.
- Filas: fecha/hora (en la zona de esa sucursal), nombre, personas, teléfono (acciones `wa.me` + `tel:`), nota (expandible), estado. Botones: `nueva` → "Marcar atendida" / "Cancelar"; `atendida`/`cancelada` → "Reabrir".
- Vacío: "Aún no tienes reservaciones. Actívalas por sucursal en Sucursales."

**Badge:** el conteo de `nuevas` junto a "Reservaciones" en `PillTabs`, visible desde cualquier pestaña de "Mi negocio" para que no se pasen por alto. Hook mínimo `useReservacionesNuevas()` (solo `count` con `head: true`, `estado = 'nueva'`, RLS; `staleTime` 60s) que `PillTabs` consume cuando renderiza `PESTANAS_NEGOCIO` (toma el tenant de `useTenantActual`). Devuelve `0` si el plan no lo permite o la tabla no existe (`retry: false`). Sin tocar el nav principal en la v1.

**`EditorSucursal.tsx`:** sección "Reservaciones" — `Switch` `acepta_reservaciones` + `Input` email "Correo para avisos (si lo dejas vacío, llegan al correo del dueño)". `useGuardarSucursal` / `BorradorSucursal` incluyen ambos campos en el upsert. Si `!permite_reservaciones`, la sección se muestra deshabilitada con nota de upsell (no se oculta — el dueño de Basic debe ver qué gana subiendo).

### 7. Errores — `src/lib/erroresEdge.ts`

Añadir al mapa: `datos_invalidos`, `captcha_invalido`, `reservaciones_no_disponibles`, `demasiadas_solicitudes`, `reservacion_en_pasado`, `reservacion_muy_lejana`, `sucursal_no_acepta_reservaciones`. Copy en español, tono del resto. Test en `erroresEdge.test.ts`.

## Flujo de datos (resumen)

```
Comensal (sin sesión)
  └─ MenuPublicoSucursal → ContactoMenu → ReservarMenu (Sheet)
       └─ Captcha (Turnstile) → token
       └─ useCrearReservacion → supabase.functions.invoke("crear-reservacion")
            └─ Edge function (service_role)
                 ├─ siteverify (Cloudflare)
                 ├─ lee sucursal+tenant+plan
                 ├─ rate-limit (por sucursal / por IP)
                 ├─ combinar_fecha_hora_sucursal (RPC)
                 ├─ insert reservaciones  ──trigger──▶ validar_reservacion
                 └─ Resend → correo al restaurante
       └─ "Recibimos tu solicitud"

Dueño / encargado (con sesión)
  └─ /admin/reservaciones → useReservaciones (RLS select)
       └─ useCambiarEstadoReservacion (RLS update: nueva/atendida/cancelada)
  └─ /admin/sucursales → EditorSucursal → acepta_reservaciones + reservaciones_email

Cron diario → purgar_reservaciones_viejas (fecha_hora < now() - 90d)
```

## Pruebas

**Unitarias (CI, Bun):**
- `reservaciones.test.ts` — `validarReservacion` (pasado, +61 días, personas 0 y 100, teléfono sin dígitos, sin consentimiento, email inválido, caso feliz), `payloadReservacion`, `formatearFechaHora` con dos zonas.
- `erroresEdge.test.ts` — los códigos nuevos traducen.

**SQL (manual, en el Editor de Supabase, al pie de la migración):**
- Insert con plan Free → `reservaciones_no_permitidas`.
- Insert con sucursal de otro tenant → `sucursal_ajena`.
- Insert con `acepta_reservaciones = false` → `sucursal_no_acepta_reservaciones`.
- Insert en el pasado / a +61 días → excepción correspondiente.
- Caso feliz → fila creada; `select` como miembro la ve, como otro tenant no.

**Edge function (manual, sin automatizar — ninguna de las 8 del repo la tiene):**
- `curl` con token de prueba de Turnstile → 200, fila creada, correo recibido.
- Sin token / token basura → 403.
- 6 llamadas seguidas a la misma sucursal → la 6ª da 429.
- Resend caído (key mala) → 200 con `aviso: "correo_no_enviado"`, fila igual creada.

**Manual end-to-end:**
- Tenant Pro, sucursal con reservaciones activas → botón "Reservar" visible en el menú de esa sucursal; menú general de un tenant con 1 sucursal también lo muestra; con 2+, no.
- Enviar desde el menú → correo llega con la hora correcta en la zona de la sucursal, link `wa.me` funciona.
- Panel: la reservación aparece como "nueva" con badge; marcar atendida baja el badge.
- Bajar el tenant a Basic → `/admin/reservaciones` muestra el muro; el botón del menú desaparece; un `curl` directo a la edge function da `reservaciones_no_disponibles`.

## Orden de implementación (para el plan)

1. Migración SQL + aplicarla en un branch de Supabase / local. Tipos en `database.ts`.
2. `src/lib/reservaciones.ts` + tests (TDD).
3. Edge function `crear-reservacion` + `combinar_fecha_hora_sucursal` RPC + deploy a un proyecto de prueba.
4. `erroresEdge.ts` + tests.
5. Formulario público: `ReservarMenu`, `useCrearReservacion`, integración en `ContactoMenu` / `MenuPublico(Sucursal)`, tipos de `useMenuPublico`, `demo.ts`.
6. Panel: ruta, página, `useReservaciones`, `useCambiarEstadoReservacion`, `PillTabs` + `AdminLayout`, muro de plan, badge.
7. `EditorSucursal` + `useSucursales` (switch + email).
8. Cron de purga.
9. QA manual end-to-end con Stripe/Supabase de prueba.
10. Actualizar `vibemenu_alcance.md` (quitar de "fuera de alcance", documentar la feature) y `vibemenu_base-datos.md` (tabla nueva, trigger).

## Riesgos y mitigaciones

- **Spam pese al captcha** — rate-limit por sucursal e IP en la edge function; el restaurante puede apagar `acepta_reservaciones` en un clic. Si escala, añadir un límite diario por tenant.
- **Correo del restaurante en spam / no configurado** — el panel es la fuente de verdad; el correo es un aviso, no el canal. El badge de "nuevas" asegura que no se pierdan aunque el correo falle.
- **Zona horaria mal** — toda conversión pasa por `sucursal.timezone` en Postgres (mismo camino probado que `registrar_visita` y `sucursal_esta_abierta`); nunca la hora del navegador.
- **PGRST204 al deployar** — aplicar la migración **antes** del deploy; `useGuardarSucursal` mandará las columnas nuevas.
- **LFPDPPP** — `consentimiento_at` registra la aceptación; el `/privacidad` ya lista a Vibemenu como encargado. El restaurante como responsable es algo a mencionar en el copy del panel ("estos son datos de tus clientes").
