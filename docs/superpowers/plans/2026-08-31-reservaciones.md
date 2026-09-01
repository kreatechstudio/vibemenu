# Reservaciones Simples — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un comensal sin sesión pide mesa desde el menú público (nombre, personas, fecha/hora, teléfono con lada); el restaurante recibe el aviso por correo y gestiona la solicitud en `/admin/reservaciones`.

**Architecture:** Formulario en el menú público → edge function `crear-reservacion` (verifica Turnstile, rate-limita, inserta con `service_role`, avisa por Resend). Tabla `reservaciones` con enforcement por trigger (plan Pro+, opt-in por sucursal). Panel con máquina de estados `nueva → atendida | cancelada`. Purga nocturna a 90 días vía RPC llamada por un workflow.

**Tech Stack:** React + TanStack Router (file-based) + TanStack Query + Tailwind + shadcn/ui; Supabase (Postgres + RLS + Edge Functions Deno); Resend (correo); Cloudflare Turnstile (captcha); Bun test runner; GitHub Actions (cron).

**Spec:** `docs/superpowers/specs/2026-08-28-reservaciones-design.md`

## Global Constraints

- **Proyecto Supabase:** `vibemenu`, ref `iaiiwtqqiaqxnzxjqcnt` (Postgres 17, **producción**). Todo SQL se ejecuta con el conector `claude.ai Supabase` (`mcp__claude_ai_Supabase__*`), nunca pidiéndole al usuario que lo pegue a mano. Para cambios de esquema: `create_branch` → `apply_migration` en el branch → verificar → `merge_branch`. Nunca `apply_migration` directo a producción sin ese paso.
- **Patrón de contador vs. fila:** las métricas agregadas (`visitas_menu`) son contadores; `reservaciones` **sí** es una fila por solicitud (es un dato transaccional, no una métrica).
- **Escritura sin sesión:** el comensal no tiene sesión. Precedente `registrar_visita` / `registrar_feedback` (RPC `SECURITY DEFINER`). Aquí se usa **edge function con `service_role`** en su lugar porque hay que verificar el token de Turnstile contra Cloudflare (una RPC no puede) y enviar correo.
- **Enforcement de plan:** vive en columnas de `planes` + triggers Postgres. `null` en `limite_*` = ilimitado. El frontend lee `planes` solo para mostrar/ocultar; la base bloquea.
- **Slugs de error:** las excepciones de trigger usan un slug estable como mensaje (`limite_productos_alcanzado`). Las edge functions devuelven `{ error: "<slug>" }`; `src/lib/erroresEdge.ts` los traduce.
- **Teléfono:** una sola columna de texto con lada `+NN` antepuesta por `PhoneInput`. `src/lib/whatsapp.ts` → `telefonoParaWaMe` (a dígitos), `asegurarLada` (garantiza prefijo). No columnas de lada separadas.
- **Correo:** Resend, `POST https://api.resend.com/emails`, `from: "Vibemenu <hola@vibemenu.com.mx>"`, HTML de tabla inline con la marca (ver `plantillaBienvenida` en `enviar-bienvenida`). El logo es `${SITIO}/logo-email.png`, `SITIO = "https://vibemenu.com.mx"`.
- **Tests:** solo en `src/lib/*.test.ts`, con `bun:test` (`import { describe, expect, test } from "bun:test"`). CI corre `src/lib`, `tsc` y `eslint`. Los componentes no se testean unitariamente en este repo — se verifican con `tsc` + `eslint` + build + prueba manual.
- **Edge functions:** ninguna de las del repo tiene prueba automatizada. Se prueban con `curl` en un proyecto/branch de prueba.
- **Copy:** español de México, tono directo y cálido (ver `src/lib/copy.ts`, `vibemenu_copywriting.md`). Sin signos de admiración de más.
- **`src/types/database.ts`** es un archivo generado por Supabase. Tras la migración se **regenera completo** con `mcp__claude_ai_Supabase__generate_typescript_types`, no se edita a mano.
- **Plan Pro+:** `permite_reservaciones = true` en `pro` y `enterprise`; `false` en `free` y `basic`.

---

## File Structure

**Nuevos:**

| Archivo | Responsabilidad |
|---|---|
| `src/docs/vibemenu_migracion_reservaciones.sql` | Registro textual de la migración (se aplica por el conector; el `.sql` queda como historia, patrón del resto de `src/docs/`). |
| `src/lib/reservaciones.ts` | Lógica pura: validación de borrador, armado de payload, formato de fecha/hora. Sin React, sin red. |
| `src/lib/reservaciones.test.ts` | Suite de lo anterior (CI). |
| `supabase/functions/crear-reservacion/index.ts` | Edge function: Turnstile siteverify → rate-limit → insert `service_role` → Resend. Único camino de escritura del comensal. |
| `src/hooks/useReservaciones.ts` | `useCrearReservacion` (mutación pública que invoca la edge function), `useReservaciones` (lista del panel, RLS), `useCambiarEstadoReservacion`, `useReservacionesNuevas` (conteo para el badge). |
| `src/components/menu/ReservarMenu.tsx` | Botón "Reservar" (píldora, estética de `ContactoMenu`) + `Sheet` con el formulario. Se auto-oculta si no aplica. |
| `src/pages/admin/Reservaciones.tsx` | Página del panel: muro de plan, lista filtrable, botones de estado. |
| `src/routes/admin.reservaciones.tsx` | Ruta file-based que monta la página. |
| `.github/workflows/purgar-reservaciones.yml` | Cron diario que llama la RPC de purga. |

**Modificados:**

| Archivo | Cambio |
|---|---|
| `src/types/database.ts` | Regenerado (tabla `reservaciones`, `planes.permite_reservaciones`, `sucursales.acepta_reservaciones`/`reservaciones_email`, RPCs nuevas). |
| `src/lib/erroresEdge.ts` | Slugs nuevos en `MENSAJES`. |
| `src/lib/erroresEdge.test.ts` | Casos para los slugs nuevos. |
| `src/components/layout/PillTabs.tsx` | Pestaña "Reservaciones" en `PESTANAS_NEGOCIO` + badge de conteo. |
| `src/components/layout/AdminLayout.tsx` | `/admin/reservaciones` en el `cubre` de "Mi negocio". |
| `src/hooks/useSucursales.ts` | `BorradorSucursal` gana `acepta_reservaciones` y `reservaciones_email`. |
| `src/components/admin/EditorSucursal.tsx` | Sección "Reservaciones" (switch + correo de aviso). |
| `src/hooks/useMenuPublico.ts` | Join de plan incluye `permite_reservaciones`; el tipo `MenuPublico` gana `permiteReservaciones`. |
| `src/pages/MenuPublico.tsx` | Render de `<ReservarMenu>` tras `<ContactoMenu>`. |
| `src/lib/demo.ts` | `SUCURSAL_DEMO` gana los dos campos nuevos. |
| `src/docs/vibemenu_alcance.md` | Reservaciones sale de "fuera de alcance", se documenta. |
| `src/docs/vibemenu_base-datos.md` | Tabla `reservaciones` + trigger documentados. |

---

## Task 1: Migración de esquema

**Files:**
- Create: `src/docs/vibemenu_migracion_reservaciones.sql`

**Interfaces:**
- Produces: tabla `reservaciones` (columnas: `id uuid`, `tenant_id uuid`, `sucursal_id uuid`, `nombre text`, `personas int`, `fecha_hora timestamptz`, `telefono text`, `email text|null`, `nota text|null`, `estado text` ∈ `nueva|atendida|cancelada`, `consentimiento_at timestamptz`, `ip inet|null`, `creada_en timestamptz`); `planes.permite_reservaciones boolean`; `sucursales.acepta_reservaciones boolean`, `sucursales.reservaciones_email text|null`; RPC `combinar_fecha_hora_sucursal(p_fecha date, p_hora time, p_tz text) returns timestamptz`; RPC `purgar_reservaciones_viejas() returns integer`; trigger `trg_validar_reservacion`.

- [ ] **Step 1: Escribir `src/docs/vibemenu_migracion_reservaciones.sql`**

```sql
-- ============================================================================
--  VIBEMENU — migracion: reservaciones simples (sub-proyecto #4)
--
--  1. planes.permite_reservaciones  → gatea la feature (Pro+).
--  2. sucursales.acepta_reservaciones + reservaciones_email → opt-in por local.
--  3. reservaciones → una fila por solicitud. El comensal no tiene sesion:
--     NADIE inserta directo, solo la Edge Function `crear-reservacion` con
--     service_role. RLS solo cubre lectura y cambio de estado (miembros).
--  4. trigger validar_reservacion → coherencia + plan + opt-in + ventana de fecha.
--  5. combinar_fecha_hora_sucursal → arma el timestamptz en la zona del local.
--  6. purgar_reservaciones_viejas → la llama un workflow nocturno.
--
--  Aplicar con apply_migration del conector Supabase (project_id
--  iaiiwtqqiaqxnzxjqcnt, name: reservaciones) EN UN BRANCH primero.
--
--  APLICAR ANTES del deploy de la rama: EditorSucursal manda
--  acepta_reservaciones/reservaciones_email en cada upsert de sucursal; sin la
--  columna, PostgREST rechaza (PGRST204) y ningun guardado de sucursal funciona.
-- ============================================================================

begin;

-- 1. Capacidad de plan ------------------------------------------------------
alter table planes
  add column if not exists permite_reservaciones boolean not null default false;

update planes set permite_reservaciones = true where nombre in ('pro', 'enterprise');

-- 2. Opt-in por sucursal --------------------------------------------------
alter table sucursales
  add column if not exists acepta_reservaciones boolean not null default false,
  add column if not exists reservaciones_email text
    constraint sucursal_reservaciones_email_valido
      check (reservaciones_email is null
             or reservaciones_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
-- policy sucursales_write_miembros ya cubre la tabla entera: sin grant extra.

-- 3. Tabla reservaciones -------------------------------------------------
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
create index idx_reservaciones_sucursal_estado on reservaciones (sucursal_id, estado);
create index idx_reservaciones_sucursal_creada on reservaciones (sucursal_id, creada_en desc);
create index idx_reservaciones_ip_creada on reservaciones (ip, creada_en desc) where ip is not null;

alter table reservaciones enable row level security;

create policy "reservaciones_select_miembros" on reservaciones for select
  to authenticated using (pertenece_a_tenant(tenant_id));

create policy "reservaciones_update_miembros" on reservaciones for update
  to authenticated using (pertenece_a_tenant(tenant_id))
  with check (pertenece_a_tenant(tenant_id));

-- Sin policy de insert: solo la Edge Function con service_role escribe.
revoke all on reservaciones from anon, authenticated;
grant select on reservaciones to authenticated;
grant update (estado) on reservaciones to authenticated;

-- 4. Enforcement --------------------------------------------------------
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
    raise exception 'reservaciones_no_permitidas' using errcode = 'check_violation';
  end if;

  select s.acepta_reservaciones into v_acepta
    from sucursales s
   where s.id = new.sucursal_id and s.tenant_id = new.tenant_id;

  if v_acepta is null then
    raise exception 'sucursal_ajena' using errcode = 'check_violation';
  end if;
  if not v_acepta then
    raise exception 'sucursal_no_acepta_reservaciones' using errcode = 'check_violation';
  end if;

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

-- 5. Combinar fecha + hora en la zona de la sucursal --------------------
--    El comensal manda fecha (date) y hora (time) "de reloj de pared". Esto
--    las fija a la zona del local, igual que registrar_visita calcula el dia.
create or replace function combinar_fecha_hora_sucursal(p_fecha date, p_hora time, p_tz text)
returns timestamptz
language sql
immutable
as $$
  select ((p_fecha + p_hora) at time zone coalesce(nullif(p_tz, ''), 'UTC'));
$$;

revoke execute on function combinar_fecha_hora_sucursal(date, time, text) from public;
grant execute on function combinar_fecha_hora_sucursal(date, time, text) to service_role;

-- 6. Purga nocturna ----------------------------------------------------
--    Por fecha_hora, no creada_en: una reserva pedida con 2 meses de
--    anticipacion sigue siendo relevante hasta que pasa.
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

revoke execute on function purgar_reservaciones_viejas() from public;
grant execute on function purgar_reservaciones_viejas() to service_role;

commit;

-- ============================================================================
--  Verificar:
--    select nombre, permite_reservaciones from planes order by precio_usd;
--    -- free=false, basic=false, pro=true, enterprise=true
--
--    select column_name from information_schema.columns
--     where table_name = 'sucursales'
--       and column_name in ('acepta_reservaciones','reservaciones_email');
--    -- 2 filas
--
--    select combinar_fecha_hora_sucursal(current_date, time '20:00', 'America/Mexico_City');
--    -- devuelve un timestamptz ~6h por delante de la lectura naive UTC
-- ============================================================================
```

- [ ] **Step 2: Crear un branch de Supabase**

Usar `mcp__claude_ai_Supabase__create_branch` con `project_id: "iaiiwtqqiaqxnzxjqcnt"`, `name: "reservaciones"`, `confirm_cost_id` (obtener antes con `get_cost` + `confirm_cost` si el conector lo pide).
Expected: devuelve un `branch_id` / project_id de branch.

- [ ] **Step 3: Aplicar la migración en el branch**

Usar `mcp__claude_ai_Supabase__apply_migration` con el `project_id` del branch, `name: "reservaciones"`, `query`: el contenido completo del `.sql` de arriba (sin las líneas de comentario final de "Verificar").
Expected: sin error.

- [ ] **Step 4: Verificar en el branch**

Correr con `mcp__claude_ai_Supabase__execute_sql` (project del branch):
```sql
select nombre, permite_reservaciones from planes order by precio_usd;
select combinar_fecha_hora_sucursal(current_date, time '20:00', 'America/Mexico_City') as fh;
select count(*) from pg_policies where tablename = 'reservaciones';
```
Expected: planes free/basic `false`, pro/enterprise `true`; `fh` es un timestamptz; 2 policies.

- [ ] **Step 5: Probar el enforcement en el branch**

```sql
-- Debe fallar con reservaciones_no_permitidas (si hay algún tenant Free/Basic):
insert into reservaciones (tenant_id, sucursal_id, nombre, personas, fecha_hora, telefono)
select t.id, s.id, 'Prueba', 2, now() + interval '2 days', '+52 55 1234 5678'
  from tenants t
  join sucursales s on s.tenant_id = t.id
  join planes p on p.id = t.plan_id
 where p.permite_reservaciones = false
 limit 1;
```
Expected: `ERROR: reservaciones_no_permitidas`. Si no hay tenants Free/Basic con sucursal, anotarlo y seguir.

- [ ] **Step 6: Merge del branch a producción**

Usar `mcp__claude_ai_Supabase__merge_branch` con el `branch_id`.
Expected: la migración queda en producción. Verificar de nuevo el `select ... from planes` contra `project_id: "iaiiwtqqiaqxnzxjqcnt"`.

- [ ] **Step 7: Commit**

```bash
git add src/docs/vibemenu_migracion_reservaciones.sql
git commit -m "feat(reservaciones): migración de esquema (planes, sucursales, tabla, triggers)"
```

---

## Task 2: Regenerar tipos de base de datos

**Files:**
- Modify: `src/types/database.ts` (regenerado completo)

**Interfaces:**
- Consumes: el esquema de Task 1 ya en producción.
- Produces: `Tables<"reservaciones">`, `Plan.permite_reservaciones: boolean`, `Sucursal.acepta_reservaciones: boolean`, `Sucursal.reservaciones_email: string | null`, y las firmas de las RPCs nuevas en `Database["public"]["Functions"]`.

- [ ] **Step 1: Regenerar**

Usar `mcp__claude_ai_Supabase__generate_typescript_types` con `project_id: "iaiiwtqqiaqxnzxjqcnt"`. Escribir la salida completa a `src/types/database.ts`, reemplazando el archivo.

- [ ] **Step 2: Confirmar que los alias al pie del archivo siguen**

`src/types/database.ts` tiene exports a mano al final (`export type Plan = Tables<"planes">`, `Sucursal`, `FORMATOS`, `NOMBRE_PLAN`, etc.). El generador **no** los produce. Si `generate_typescript_types` devuelve solo el `export type Database = ...`, hay que **conservar** el bloque de alias/constantes que hoy vive tras la definición de `Database` (de `export type Tables<...>` en adelante). Estrategia: regenerar solo la parte de `export type Json` … fin de `Database`, y volver a pegar el bloque manual de abajo intacto.

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS. (Los consumidores nuevos aún no existen; esto solo valida que el archivo regenerado es coherente.)

- [ ] **Step 4: Añadir `permite_reservaciones` a `SUCURSAL_DEMO` y demo tenant si `tsc` lo exige**

Si `tsc` marca `src/lib/demo.ts` por `Sucursal` incompleto, abrir `src/lib/demo.ts` y añadir a `SUCURSAL_DEMO`:
```ts
  acepta_reservaciones: false,
  reservaciones_email: null,
```
Run: `bunx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts src/lib/demo.ts
git commit -m "feat(reservaciones): regenera tipos de base de datos"
```

---

## Task 3: Biblioteca pura `src/lib/reservaciones.ts`

**Files:**
- Create: `src/lib/reservaciones.ts`
- Test: `src/lib/reservaciones.test.ts`

**Interfaces:**
- Consumes: `telefonoParaWaMe` de `src/lib/whatsapp.ts`.
- Produces:
  - `type BorradorReservacion = { nombre: string; personas: number; fecha: string; hora: string; telefono: string; email: string; nota: string; consentimiento: boolean }`
  - `type ErrorReservacion = { campo: "nombre"|"personas"|"fecha"|"hora"|"telefono"|"email"|"consentimiento"; motivo: string }`
  - `validarReservacion(b: BorradorReservacion, ahora: Date, tz: string): ErrorReservacion | null`
  - `payloadReservacion(b: BorradorReservacion, sucursalId: string, token: string | null): Record<string, unknown>`
  - `formatearFechaHora(fecha: string, hora: string, tz: string): string`
  - `MAX_DIAS_RESERVA = 60`, `MAX_PERSONAS = 99`

- [ ] **Step 1: Escribir los tests que fallan**

Create `src/lib/reservaciones.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import {
  formatearFechaHora,
  MAX_DIAS_RESERVA,
  payloadReservacion,
  validarReservacion,
  type BorradorReservacion,
} from "@/lib/reservaciones";

const TZ = "America/Mexico_City";
// Un "ahora" fijo para que las pruebas no dependan del reloj.
const AHORA = new Date("2026-09-01T18:00:00-06:00");

const base = (): BorradorReservacion => ({
  nombre: "Ana López",
  personas: 2,
  fecha: "2026-09-03",
  hora: "20:00",
  telefono: "+52 55 1234 5678",
  email: "",
  nota: "",
  consentimiento: true,
});

describe("validarReservacion", () => {
  test("un borrador completo y futuro pasa", () => {
    expect(validarReservacion(base(), AHORA, TZ)).toBeNull();
  });

  test("nombre de 1 caracter => error en nombre", () => {
    expect(validarReservacion({ ...base(), nombre: "A" }, AHORA, TZ)?.campo).toBe("nombre");
  });

  test("0 personas y 100 personas => error en personas", () => {
    expect(validarReservacion({ ...base(), personas: 0 }, AHORA, TZ)?.campo).toBe("personas");
    expect(validarReservacion({ ...base(), personas: 100 }, AHORA, TZ)?.campo).toBe("personas");
  });

  test("fecha/hora en el pasado => error en fecha", () => {
    const r = validarReservacion({ ...base(), fecha: "2026-08-30", hora: "20:00" }, AHORA, TZ);
    expect(r?.campo).toBe("fecha");
  });

  test("más de MAX_DIAS_RESERVA días adelante => error en fecha", () => {
    const lejos = new Date(AHORA);
    lejos.setDate(lejos.getDate() + MAX_DIAS_RESERVA + 5);
    const fecha = lejos.toISOString().slice(0, 10);
    expect(validarReservacion({ ...base(), fecha }, AHORA, TZ)?.campo).toBe("fecha");
  });

  test("teléfono sin dígitos usables => error en telefono", () => {
    expect(validarReservacion({ ...base(), telefono: "abc" }, AHORA, TZ)?.campo).toBe("telefono");
  });

  test("email presente pero inválido => error en email; vacío pasa", () => {
    expect(validarReservacion({ ...base(), email: "no-es-correo" }, AHORA, TZ)?.campo).toBe("email");
    expect(validarReservacion({ ...base(), email: "" }, AHORA, TZ)).toBeNull();
  });

  test("sin consentimiento => error en consentimiento", () => {
    expect(validarReservacion({ ...base(), consentimiento: false }, AHORA, TZ)?.campo).toBe(
      "consentimiento",
    );
  });
});

describe("payloadReservacion", () => {
  test("arma el cuerpo que espera la edge function", () => {
    const p = payloadReservacion(base(), "suc-1", "tok-123");
    expect(p).toEqual({
      sucursal_id: "suc-1",
      nombre: "Ana López",
      personas: 2,
      fecha: "2026-09-03",
      hora: "20:00",
      telefono: "+52 55 1234 5678",
      email: null,
      nota: null,
      consentimiento: true,
      turnstile_token: "tok-123",
    });
  });

  test("email y nota con espacios se recortan; vacíos => null", () => {
    const p = payloadReservacion(
      { ...base(), email: "  a@b.com ", nota: "  mesa junto a la ventana  " },
      "suc-1",
      null,
    );
    expect(p.email).toBe("a@b.com");
    expect(p.nota).toBe("mesa junto a la ventana");
    expect(p.turnstile_token).toBeNull();
  });
});

describe("formatearFechaHora", () => {
  test("devuelve algo legible en español con la fecha y la hora", () => {
    const s = formatearFechaHora("2026-09-03", "20:00", TZ);
    expect(s).toContain("2026");
    expect(s.toLowerCase()).toContain("sep");
    expect(s).toContain("8:00"); // 20:00 → 8:00 p.m.
  });
});
```

- [ ] **Step 2: Correr los tests para verlos fallar**

Run: `bun test src/lib/reservaciones.test.ts`
Expected: FAIL — `Cannot find module "@/lib/reservaciones"`.

- [ ] **Step 3: Implementar `src/lib/reservaciones.ts`**

```ts
import { telefonoParaWaMe } from "@/lib/whatsapp";

/**
 * Lógica pura del formulario de reservación. Sin React, sin red.
 * La validación de verdad la hace el trigger `validar_reservacion` en Postgres;
 * esto solo evita viajes obvios y da mensajes de campo.
 */

export const MAX_DIAS_RESERVA = 60;
export const MAX_PERSONAS = 99;

export type BorradorReservacion = {
  nombre: string;
  personas: number;
  /** `YYYY-MM-DD` de un <input type="date">. */
  fecha: string;
  /** `HH:MM` de un <input type="time">. */
  hora: string;
  /** Con lada `+NN` (viene de PhoneInput). */
  telefono: string;
  email: string;
  nota: string;
  consentimiento: boolean;
};

export type CampoReservacion =
  | "nombre"
  | "personas"
  | "fecha"
  | "hora"
  | "telefono"
  | "email"
  | "consentimiento";

export type ErrorReservacion = { campo: CampoReservacion; motivo: string };

const RE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** El instante que el comensal pidió, interpretado como reloj de pared en `tz`. */
function instantePedido(fecha: string, hora: string, tz: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return null;
  // Truco: formatear un instante en `tz` y medir el desfase contra UTC.
  const naive = new Date(`${fecha}T${hora}:00Z`);
  if (Number.isNaN(naive.getTime())) return null;
  const enTz = new Date(naive.toLocaleString("en-US", { timeZone: tz }));
  const enUtc = new Date(naive.toLocaleString("en-US", { timeZone: "UTC" }));
  const desfase = enTz.getTime() - enUtc.getTime();
  return new Date(naive.getTime() - desfase);
}

export function validarReservacion(
  b: BorradorReservacion,
  ahora: Date,
  tz: string,
): ErrorReservacion | null {
  if (b.nombre.trim().length < 2 || b.nombre.trim().length > 120) {
    return { campo: "nombre", motivo: "Escribe tu nombre completo." };
  }
  if (!Number.isInteger(b.personas) || b.personas < 1 || b.personas > MAX_PERSONAS) {
    return { campo: "personas", motivo: `Entre 1 y ${MAX_PERSONAS} personas.` };
  }

  const cuando = instantePedido(b.fecha, b.hora, tz);
  if (!cuando) return { campo: "fecha", motivo: "Elige una fecha y una hora." };
  if (cuando.getTime() < ahora.getTime()) {
    return { campo: "fecha", motivo: "Esa fecha y hora ya pasaron." };
  }
  const limite = new Date(ahora);
  limite.setDate(limite.getDate() + MAX_DIAS_RESERVA);
  if (cuando.getTime() > limite.getTime()) {
    return { campo: "fecha", motivo: `Como máximo ${MAX_DIAS_RESERVA} días adelante.` };
  }

  if (telefonoParaWaMe(b.telefono) === null) {
    return { campo: "telefono", motivo: "Deja un teléfono con lada para confirmarte." };
  }
  if (b.email.trim() !== "" && !RE_EMAIL.test(b.email.trim())) {
    return { campo: "email", motivo: "Ese correo no se ve bien." };
  }
  if (!b.consentimiento) {
    return { campo: "consentimiento", motivo: "Necesitamos tu permiso para guardar tus datos." };
  }
  return null;
}

export function payloadReservacion(
  b: BorradorReservacion,
  sucursalId: string,
  token: string | null,
): Record<string, unknown> {
  const limpio = (s: string) => {
    const t = s.trim();
    return t === "" ? null : t;
  };
  return {
    sucursal_id: sucursalId,
    nombre: b.nombre.trim(),
    personas: b.personas,
    fecha: b.fecha,
    hora: b.hora,
    telefono: b.telefono.trim(),
    email: limpio(b.email),
    nota: limpio(b.nota),
    consentimiento: b.consentimiento,
    turnstile_token: token,
  };
}

const FMT_CACHE = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = FMT_CACHE.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("es-MX", {
      timeZone: tz,
      dateStyle: "medium",
      timeStyle: "short",
    });
    FMT_CACHE.set(tz, f);
  }
  return f;
}

/** "3 sep 2026, 8:00 p.m." — para el resumen antes de enviar y el correo. */
export function formatearFechaHora(fecha: string, hora: string, tz: string): string {
  const cuando = instantePedido(fecha, hora, tz);
  if (!cuando) return `${fecha} ${hora}`;
  return fmt(tz).format(cuando);
}
```

- [ ] **Step 4: Correr los tests**

Run: `bun test src/lib/reservaciones.test.ts`
Expected: PASS (todos).
Si `formatearFechaHora` falla por el formato exacto de `Intl` (p. ej. "8:00 p. m." con espacio fino), ajustar los `toContain` del test a lo que emite tu runtime — la intención es "trae año, mes abreviado y la hora en 12h", no un string exacto.

- [ ] **Step 5: Lint + typecheck**

Run: `bunx eslint src/lib/reservaciones.ts src/lib/reservaciones.test.ts && bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/reservaciones.ts src/lib/reservaciones.test.ts
git commit -m "feat(reservaciones): biblioteca pura de validación y payload"
```

---

## Task 4: Slugs de error de la edge function

**Files:**
- Modify: `src/lib/erroresEdge.ts`
- Test: `src/lib/erroresEdge.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `MENSAJES` gana las claves `datos_invalidos`, `captcha_invalido`, `reservaciones_no_disponibles`, `demasiadas_solicitudes`, `reservacion_en_pasado`, `reservacion_muy_lejana`, `sucursal_no_acepta_reservaciones`, `reservaciones_no_permitidas`, `sucursal_ajena`.

- [ ] **Step 1: Añadir el caso de prueba que falla**

En `src/lib/erroresEdge.test.ts` (abrir y ver el patrón existente; usa `FunctionsHttpError` simulada o prueba directa del mapa). Añadir un `describe`:
```ts
import { describe, expect, test } from "bun:test";
import { MENSAJES_EDGE } from "@/lib/erroresEdge";

describe("mensajes de reservaciones", () => {
  test.each([
    "datos_invalidos",
    "captcha_invalido",
    "reservaciones_no_disponibles",
    "demasiadas_solicitudes",
    "reservacion_en_pasado",
    "reservacion_muy_lejana",
    "sucursal_no_acepta_reservaciones",
    "reservaciones_no_permitidas",
    "sucursal_ajena",
  ])("%s tiene copy en español", (slug) => {
    expect(MENSAJES_EDGE[slug]).toBeTruthy();
    expect(MENSAJES_EDGE[slug].length).toBeGreaterThan(10);
  });
});
```
Nota: hoy el mapa se llama `MENSAJES` y es `const` no exportado. Este test exige exportarlo. Si prefieres no cambiar la firma pública, adapta el test para provocar los slugs vía `traducirErrorEdge` con un `FunctionsHttpError` simulado como hacen las pruebas existentes — revisa `erroresEdge.test.ts` y sigue ese estilo. Elige uno y sé consistente.

- [ ] **Step 2: Correr para ver fallar**

Run: `bun test src/lib/erroresEdge.test.ts`
Expected: FAIL — claves ausentes (o `MENSAJES_EDGE` no exportado).

- [ ] **Step 3: Implementar**

En `src/lib/erroresEdge.ts`, dentro de `const MENSAJES: Record<string, string> = { ... }` añadir:
```ts
  datos_invalidos: "Revisa los datos del formulario e intenta de nuevo.",
  captcha_invalido: "No pudimos verificar que no eres un robot. Recarga e intenta otra vez.",
  reservaciones_no_disponibles: "Este restaurante no está recibiendo reservaciones ahora mismo.",
  demasiadas_solicitudes: "Llegaron muchas solicitudes seguidas. Espera unos minutos e intenta de nuevo.",
  reservacion_en_pasado: "Esa fecha y hora ya pasaron. Elige otra.",
  reservacion_muy_lejana: "Solo puedes reservar hasta con 60 días de anticipación.",
  sucursal_no_acepta_reservaciones: "Esta sucursal no está recibiendo reservaciones.",
  reservaciones_no_permitidas: "Este restaurante no está recibiendo reservaciones ahora mismo.",
  sucursal_ajena: "Algo salió mal con la sucursal. Recarga la página e intenta de nuevo.",
```
Si el test del Step 1 exige exportar el mapa, cambiar `const MENSAJES` por `export const MENSAJES_EDGE` y actualizar la referencia interna en `traducirErrorEdge`.

- [ ] **Step 4: Correr los tests**

Run: `bun test src/lib/erroresEdge.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + typecheck + commit**

```bash
bunx eslint src/lib/erroresEdge.ts src/lib/erroresEdge.test.ts && bunx tsc --noEmit
git add src/lib/erroresEdge.ts src/lib/erroresEdge.test.ts
git commit -m "feat(reservaciones): copy de errores de la edge function"
```

---

## Task 5: Edge function `crear-reservacion`

**Files:**
- Create: `supabase/functions/crear-reservacion/index.ts`

**Interfaces:**
- Consumes: RPC `combinar_fecha_hora_sucursal` y tabla `reservaciones` (Task 1). Secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`.
- Produces: endpoint `POST /functions/v1/crear-reservacion`. Body de entrada: `{ sucursal_id, nombre, personas, fecha, hora, telefono, email?, nota?, consentimiento, turnstile_token }`. Respuestas: `200 {ok:true}` | `200 {ok:true, aviso:"correo_no_enviado"}` | `400 {error:<slug>}` | `403 {error:"captcha_invalido"|"reservaciones_no_disponibles"}` | `405` | `429 {error:"demasiadas_solicitudes"}`.

- [ ] **Step 1: Escribir el archivo**

```ts
// Edge Function: crear-reservacion
//
// Unico camino de escritura de una reservacion. El comensal NO tiene sesion, asi
// que aqui se usa service_role (no la sesion del que llama). Antes de escribir:
//  1. verifica el token de Turnstile contra Cloudflare (siteverify),
//  2. lee sucursal + tenant + plan y confirma que la feature esta activa,
//  3. rate-limita por sucursal y por IP,
//  4. arma fecha_hora en la zona de la sucursal (RPC combinar_fecha_hora_sucursal),
//  5. inserta (el trigger validar_reservacion es la ultima red),
//  6. avisa al restaurante por Resend.
//
// Desplegar:
//   supabase functions deploy crear-reservacion --project-ref iaiiwtqqiaqxnzxjqcnt
//
// Secretos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, TURNSTILE_SECRET_KEY
//
// Requiere la migracion vibemenu_migracion_reservaciones.sql aplicada.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const REMITENTE = "Vibemenu <hola@vibemenu.com.mx>";
const SITIO = "https://vibemenu.com.mx";

const LIMITE_POR_SUCURSAL_HORA = 5;
const LIMITE_POR_IP_HORA = 3;

type Entrada = {
  sucursal_id: string;
  nombre: string;
  personas: number;
  fecha: string;
  hora: string;
  telefono: string;
  email: string | null;
  nota: string | null;
  consentimiento: boolean;
  turnstile_token: string | null;
};

function parseEntrada(x: unknown): Entrada | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const sucursal_id = str(o.sucursal_id);
  const nombre = str(o.nombre)?.trim() ?? null;
  const fecha = str(o.fecha);
  const hora = str(o.hora);
  const telefono = str(o.telefono)?.trim() ?? null;
  const personas = typeof o.personas === "number" ? o.personas : NaN;
  if (!sucursal_id || !nombre || !fecha || !hora || !telefono) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return null;
  if (!Number.isInteger(personas) || personas < 1 || personas > 99) return null;
  if (nombre.length < 2 || nombre.length > 120) return null;
  if (telefono.length < 6 || telefono.length > 30) return null;
  if (o.consentimiento !== true) return null;
  const email = str(o.email)?.trim() || null;
  const nota = str(o.nota)?.trim() || null;
  if (nota && nota.length > 500) return null;
  return {
    sucursal_id,
    nombre,
    personas,
    fecha,
    hora,
    telefono,
    email,
    nota,
    consentimiento: true,
    turnstile_token: str(o.turnstile_token),
  };
}

async function verificarTurnstile(token: string | null, ip: string | null): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return true; // dev sin configurar: no bloquea (igual que captchaHabilitado)
  if (!token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const data = await resp.json().catch(() => null);
  return data?.success === true;
}

function plantillaReservacion(o: {
  negocio: string;
  sucursal: string;
  nombre: string;
  personas: number;
  cuando: string;
  telefonoWa: string;
  telefonoRaw: string;
  nota: string | null;
}) {
  const urlPanel = `${SITIO}/admin/reservaciones`;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Nueva reservación</title></head>
<body style="margin:0;padding:0;background-color:#F5F6F9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F6F9;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E4E6ED;border-radius:16px;">
        <tr><td style="padding:32px 40px 0 40px;">
          <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#0B0B0F;">Vibemenu</span>
        </td></tr>
        <tr><td style="padding:28px 40px 0 40px;">
          <h1 style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:26px;line-height:1.2;letter-spacing:-0.03em;font-weight:700;color:#0B0B0F;">Nueva reservación en ${o.negocio}.</h1>
          <p style="margin:16px 0 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:#4B4E5A;">
            <strong style="color:#0B0B0F;">${o.nombre}</strong> · ${o.personas} ${o.personas === 1 ? "persona" : "personas"}<br />
            <strong style="color:#0B0B0F;">${o.cuando}</strong><br />
            Sucursal: ${o.sucursal}<br />
            Teléfono: <a href="https://wa.me/${o.telefonoWa}" style="color:#2B4EFF;">${o.telefonoRaw}</a>
            ${o.nota ? `<br />Nota: ${o.nota}` : ""}
          </p>
        </td></tr>
        <tr><td style="padding:28px 40px 40px 40px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#2B4EFF;border-radius:12px;">
            <a href="${urlPanel}" style="display:inline-block;padding:15px 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:12px;">Ver en el panel</a>
          </td></tr></table>
          <p style="margin:20px 0 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#4B4E5A;">
            Estos son datos de tu cliente. Confírmale tú directamente por teléfono o WhatsApp.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "metodo_no_permitido" }, 405);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;

  const entrada = parseEntrada(await req.json().catch(() => null));
  if (!entrada) return json({ error: "datos_invalidos" }, 400);

  if (!(await verificarTurnstile(entrada.turnstile_token, ip))) {
    return json({ error: "captcha_invalido" }, 403);
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Sucursal + tenant + plan + correos de aviso
  const { data: suc, error: errSuc } = await db
    .from("sucursales")
    .select(
      "id, nombre, timezone, acepta_reservaciones, reservaciones_email, " +
        "tenant:tenants(id, nombre_negocio, plan:planes(permite_reservaciones))",
    )
    .eq("id", entrada.sucursal_id)
    .maybeSingle();

  const tenant = (suc as { tenant?: { id: string; nombre_negocio: string; plan?: { permite_reservaciones: boolean } | null } } | null)?.tenant;
  if (
    errSuc ||
    !suc ||
    !tenant ||
    !suc.acepta_reservaciones ||
    !tenant.plan?.permite_reservaciones
  ) {
    return json({ error: "reservaciones_no_disponibles" }, 403);
  }

  // Rate-limit
  const desde = new Date(Date.now() - 3600_000).toISOString();
  const { count: nSuc } = await db
    .from("reservaciones")
    .select("id", { count: "exact", head: true })
    .eq("sucursal_id", entrada.sucursal_id)
    .gte("creada_en", desde);
  if ((nSuc ?? 0) >= LIMITE_POR_SUCURSAL_HORA) return json({ error: "demasiadas_solicitudes" }, 429);

  if (ip) {
    const { count: nIp } = await db
      .from("reservaciones")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("creada_en", desde);
    if ((nIp ?? 0) >= LIMITE_POR_IP_HORA) return json({ error: "demasiadas_solicitudes" }, 429);
  }

  // fecha_hora en la zona de la sucursal
  const { data: fhData, error: errFh } = await db.rpc("combinar_fecha_hora_sucursal", {
    p_fecha: entrada.fecha,
    p_hora: entrada.hora,
    p_tz: suc.timezone,
  });
  if (errFh || !fhData) return json({ error: "datos_invalidos" }, 400);
  const fechaHora = fhData as string;

  // Insert (el trigger valida plan/opt-in/ventana de fecha)
  const { error: errIns } = await db.from("reservaciones").insert({
    tenant_id: tenant.id,
    sucursal_id: entrada.sucursal_id,
    nombre: entrada.nombre,
    personas: entrada.personas,
    fecha_hora: fechaHora,
    telefono: entrada.telefono,
    email: entrada.email,
    nota: entrada.nota,
    ip,
  });
  if (errIns) {
    const slug = /reservacion_en_pasado|reservacion_muy_lejana|sucursal_no_acepta_reservaciones|reservaciones_no_permitidas|sucursal_ajena/.exec(
      errIns.message,
    )?.[0];
    return json({ error: slug ?? "datos_invalidos" }, 400);
  }

  // Aviso al restaurante — fire and forget: si falla, la fila ya existe.
  const apiKey = Deno.env.get("RESEND_API_KEY");
  let correoOk = false;
  if (apiKey) {
    let destino = suc.reservaciones_email as string | null;
    if (!destino) {
      const { data: owner } = await db
        .from("tenant_usuarios")
        .select("user_id")
        .eq("tenant_id", tenant.id)
        .eq("rol", "owner")
        .maybeSingle();
      if (owner?.user_id) {
        const { data: u } = await db.auth.admin.getUserById(owner.user_id);
        destino = u.user?.email ?? null;
      }
    }
    if (destino) {
      const telWa = entrada.telefono.replace(/[^\d]/g, "");
      const cuando = new Intl.DateTimeFormat("es-MX", {
        timeZone: suc.timezone,
        dateStyle: "full",
        timeStyle: "short",
      }).format(new Date(fechaHora));
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: REMITENTE,
          to: [destino],
          subject: `Nueva reservación — ${entrada.nombre}, ${entrada.personas} ${entrada.personas === 1 ? "persona" : "personas"}`,
          html: plantillaReservacion({
            negocio: tenant.nombre_negocio,
            sucursal: suc.nombre,
            nombre: entrada.nombre,
            personas: entrada.personas,
            cuando,
            telefonoWa: telWa,
            telefonoRaw: entrada.telefono,
            nota: entrada.nota,
          }),
        }),
      });
      correoOk = resp.ok;
    }
  }

  return correoOk ? json({ ok: true }) : json({ ok: true, aviso: "correo_no_enviado" });
});
```

- [ ] **Step 2: Verificar que `tenant_usuarios` tiene columna `rol` con valor `owner`**

Run (conector, `execute_sql` en producción):
```sql
select column_name from information_schema.columns
 where table_name = 'tenant_usuarios' and column_name = 'rol';
select distinct rol from tenant_usuarios;
```
Expected: existe `rol`; hay `owner`. Si el nombre difiere (p. ej. `role` o valores `dueño`), ajustar el `.eq("rol", "owner")` del Step 1 a lo real.

- [ ] **Step 3: Desplegar la función al branch de Supabase**

Usar `mcp__claude_ai_Supabase__deploy_edge_function` con el `project_id` del branch de Task 1 (si sigue vivo) o crear uno nuevo, `name: "crear-reservacion"`, el contenido del archivo. Configurar los secrets del branch si el conector lo permite; si no, anotar que en producción ya existen `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` y hay que **añadir `TURNSTILE_SECRET_KEY`** (Dashboard → Edge Functions → Secrets) antes del deploy a producción.

- [ ] **Step 4: Probar con curl (caso feliz, captcha en modo dev)**

Con `TURNSTILE_SECRET_KEY` sin configurar en el branch (o con la test key `1x0000000000000000000000000000000AA`):
```bash
curl -sS -X POST "https://<branch-ref>.supabase.co/functions/v1/crear-reservacion" \
  -H "Authorization: Bearer <branch-anon-key>" -H "Content-Type: application/json" \
  -d '{"sucursal_id":"<una sucursal Pro con acepta_reservaciones=true>","nombre":"Ana Prueba","personas":2,"fecha":"<+3 días>","hora":"20:00","telefono":"+52 55 1234 5678","consentimiento":true,"turnstile_token":"x"}'
```
Expected: `{"ok":true}` o `{"ok":true,"aviso":"correo_no_enviado"}`. Verificar la fila:
```sql
select nombre, personas, fecha_hora, estado, ip from reservaciones order by creada_en desc limit 1;
```

- [ ] **Step 5: Probar los rechazos**

```bash
# datos_invalidos (personas fuera de rango)
curl ... -d '{"sucursal_id":"...","nombre":"X","personas":0,...}'   # → 400 datos_invalidos
# reservaciones_no_disponibles (sucursal sin opt-in o tenant Basic)
curl ... -d '{"sucursal_id":"<sucursal Free/Basic>",...}'            # → 403
# demasiadas_solicitudes: repetir el caso feliz 6 veces
for i in $(seq 1 6); do curl ... ; done                             # la 6ª → 429
```
Expected: los códigos indicados.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/crear-reservacion/index.ts
git commit -m "feat(reservaciones): edge function crear-reservacion (Turnstile + rate-limit + Resend)"
```

---

## Task 6: Cron de purga

**Files:**
- Create: `.github/workflows/purgar-reservaciones.yml`

**Interfaces:**
- Consumes: RPC `purgar_reservaciones_viejas()` (Task 1), `grant execute ... to service_role`.
- Produces: workflow diario. Secret de repo ya existente: `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 1: Escribir el workflow**

```yaml
name: Purgar reservaciones viejas

# Nocturno. Borra reservaciones con fecha_hora de hace mas de 90 dias.
# Ver src/docs/vibemenu_migracion_reservaciones.sql (purgar_reservaciones_viejas).
on:
  schedule:
    - cron: "30 4 * * *"
  workflow_dispatch: {}

jobs:
  purgar:
    runs-on: ubuntu-latest
    steps:
      - name: Llamar a purgar_reservaciones_viejas
        run: |
          curl --fail-with-body -sS -X POST \
            "https://iaiiwtqqiaqxnzxjqcnt.supabase.co/rest/v1/rpc/purgar_reservaciones_viejas" \
            -H "apikey: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" -d '{}'

# Si este job falla, GitHub le manda correo al dueño del repo — mismo criterio
# que limpiar-dominios.yml y backup-db.yml.
```

- [ ] **Step 2: Validar el YAML**

Run: `bunx --yes yaml-lint .github/workflows/purgar-reservaciones.yml` (o `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/purgar-reservaciones.yml'))"`).
Expected: sin error de sintaxis.

- [ ] **Step 3: Probar la RPC directamente (conector)**

`execute_sql` en producción: `select purgar_reservaciones_viejas();`
Expected: devuelve `0` (o el número de filas viejas). Sin error de permisos.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/purgar-reservaciones.yml
git commit -m "feat(reservaciones): cron nocturno de purga a 90 días"
```

---

## Task 7: Hooks de datos `src/hooks/useReservaciones.ts`

**Files:**
- Create: `src/hooks/useReservaciones.ts`

**Interfaces:**
- Consumes: `supabase` de `@/lib/supabase`; `payloadReservacion` de `@/lib/reservaciones`; `traducirErrorEdge` de `@/lib/erroresEdge`.
- Produces:
  - `type Reservacion` (forma de la fila que usa el panel: `id, sucursal_id, nombre, personas, fecha_hora, telefono, email, nota, estado, creada_en`)
  - `type EstadoReservacion = "nueva" | "atendida" | "cancelada"`
  - `useReservaciones(tenantId?: string)` → `UseQueryResult<Reservacion[]>`
  - `useReservacionesNuevas(tenantId?: string)` → `UseQueryResult<number>`
  - `useCambiarEstadoReservacion(tenantId?: string)` → mutación `{ id: string; estado: EstadoReservacion }`
  - `useCrearReservacion(sucursalId: string, tz: string)` → mutación que recibe `BorradorReservacion` + `token: string | null`, invoca la edge function, y en error lanza `Error` con `message` ya traducido.

- [ ] **Step 1: Escribir el archivo**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { traducirErrorEdge } from "@/lib/erroresEdge";
import { payloadReservacion, type BorradorReservacion } from "@/lib/reservaciones";

export type EstadoReservacion = "nueva" | "atendida" | "cancelada";

export type Reservacion = {
  id: string;
  sucursal_id: string;
  nombre: string;
  personas: number;
  fecha_hora: string;
  telefono: string;
  email: string | null;
  nota: string | null;
  estado: EstadoReservacion;
  creada_en: string;
};

const COLS = "id, sucursal_id, nombre, personas, fecha_hora, telefono, email, nota, estado, creada_en";

/**
 * Reservaciones del tenant, próximas primero. `retry: false`: sin la migración
 * `vibemenu_migracion_reservaciones.sql` la tabla no existe y reintentar no la crea.
 */
export function useReservaciones(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["reservaciones", tenantId],
    enabled: Boolean(tenantId),
    retry: false,
    queryFn: async (): Promise<Reservacion[]> => {
      const { data, error } = await supabase
        .from("reservaciones")
        .select(COLS)
        .eq("tenant_id", tenantId!)
        .order("fecha_hora", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data as Reservacion[];
    },
  });
}

/** Conteo de `nueva` para el badge de la pestaña. Silencioso si no aplica. */
export function useReservacionesNuevas(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["reservaciones-nuevas", tenantId],
    enabled: Boolean(tenantId),
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("reservaciones")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .eq("estado", "nueva");
      if (error) return 0;
      return count ?? 0;
    },
  });
}

export function useCambiarEstadoReservacion(tenantId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: EstadoReservacion }) => {
      const { error } = await supabase.from("reservaciones").update({ estado }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["reservaciones", tenantId] });
      void qc.invalidateQueries({ queryKey: ["reservaciones-nuevas", tenantId] });
    },
  });
}

/**
 * Envío del formulario público. Invoca la edge function `crear-reservacion`.
 * El comensal no tiene sesión: supabase-js manda la anon key sola, que es lo
 * que la función espera.
 */
export function useCrearReservacion(sucursalId: string, _tz: string) {
  return useMutation({
    mutationFn: async ({
      borrador,
      token,
    }: {
      borrador: BorradorReservacion;
      token: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke("crear-reservacion", {
        body: payloadReservacion(borrador, sucursalId, token),
      });
      if (error) throw new Error(await traducirErrorEdge(error));
      return data as { ok: true; aviso?: string };
    },
  });
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `bunx tsc --noEmit && bunx eslint src/hooks/useReservaciones.ts`
Expected: PASS. (Si `tsc` se queja de que `reservaciones` no existe en el tipo `Database`, es que Task 2 no se completó — volver a él.)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useReservaciones.ts
git commit -m "feat(reservaciones): hooks de datos (lista, estado, conteo, envío)"
```

---

## Task 8: Formulario público `ReservarMenu` + integración

**Files:**
- Create: `src/components/menu/ReservarMenu.tsx`
- Modify: `src/hooks/useMenuPublico.ts`
- Modify: `src/pages/MenuPublico.tsx`

**Interfaces:**
- Consumes: `useCrearReservacion` (Task 7); `validarReservacion`, `formatearFechaHora`, `MAX_PERSONAS`, `type BorradorReservacion` (Task 3); `<Captcha>` de `@/components/ui/captcha`; `PhoneInput` de `@/components/ui/phone-input`; `Sheet` de shadcn (`@/components/ui/sheet` — confirmar que existe; si no, usar `Modal` de `@/components/ui/modal` como en `EditorSucursal`).
- Produces: `<ReservarMenu tenant sucursal sucursales habilitado />` — se renderiza como sibling tras `<ContactoMenu>`. `MenuPublico` gana `permiteReservaciones: boolean`.

- [ ] **Step 1: Extender `useMenuPublico.ts`**

En las 4 llamadas `.select("*, plan:planes(...)")` añadir `permite_reservaciones` a la lista de columnas del join (hoy: `marca_agua, menu_independiente_por_sucursal, permite_embudo_resenas, permite_pedidos_whatsapp`).
En el tipo `Pick<Plan, ...>` del parámetro de `armarMenuPublico`, añadir `| "permite_reservaciones"`.
En el tipo `MenuPublico` añadir: `/** planes.permite_reservaciones — gatea "Reservar" en el menú. */ permiteReservaciones: boolean;`
En el `return` de `armarMenuPublico` añadir: `permiteReservaciones: plan?.permite_reservaciones ?? false,`

- [ ] **Step 2: Crear `src/components/menu/ReservarMenu.tsx`**

```tsx
import { useMemo, useRef, useState } from "react";
import { CalendarPlus, Check, Loader2 } from "lucide-react";
import Modal from "@/components/ui/modal";
import Captcha, { captchaHabilitado, type TurnstileInstance } from "@/components/ui/captcha";
import PhoneInput from "@/components/ui/phone-input";
import { useCrearReservacion } from "@/hooks/useReservaciones";
import {
  formatearFechaHora,
  MAX_PERSONAS,
  validarReservacion,
  type BorradorReservacion,
} from "@/lib/reservaciones";
import type { Sucursal, Tenant } from "@/types/database";

/** Sucursal a la que se reserva: la activa, o la única del negocio en el menú general. */
export function sucursalParaReservar(
  sucursalActiva: Sucursal | null,
  sucursales: Sucursal[],
): Sucursal | null {
  if (sucursalActiva) return sucursalActiva;
  return sucursales.length === 1 ? sucursales[0] : null;
}

const HOY = () => new Date().toISOString().slice(0, 10);
const MAX_FECHA = () => {
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return d.toISOString().slice(0, 10);
};

const nuevoBorrador = (): BorradorReservacion => ({
  nombre: "",
  personas: 2,
  fecha: "",
  hora: "",
  telefono: "",
  email: "",
  nota: "",
  consentimiento: false,
});

export default function ReservarMenu({
  tenant: _tenant,
  sucursalActiva,
  sucursales,
  habilitado,
}: {
  tenant: Tenant;
  sucursalActiva: Sucursal | null;
  sucursales: Sucursal[];
  habilitado: boolean;
}) {
  const sucursal = useMemo(
    () => sucursalParaReservar(sucursalActiva, sucursales),
    [sucursalActiva, sucursales],
  );
  const [abierto, setAbierto] = useState(false);

  if (!habilitado || !sucursal?.acepta_reservaciones) return null;

  return (
    <div className="mx-auto -mt-2 max-w-2xl px-4 pb-8">
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-opacity hover:opacity-75"
        style={{
          background: "color-mix(in srgb, var(--menu-primario) 10%, transparent)",
          color: "var(--menu-primario)",
        }}
      >
        <CalendarPlus className="size-4" aria-hidden />
        Reservar
      </button>
      {abierto && (
        <FormularioReserva
          sucursalId={sucursal.id}
          tz={sucursal.timezone}
          alCerrar={() => setAbierto(false)}
        />
      )}
    </div>
  );
}

function FormularioReserva({
  sucursalId,
  tz,
  alCerrar,
}: {
  sucursalId: string;
  tz: string;
  alCerrar: () => void;
}) {
  const [b, setB] = useState<BorradorReservacion>(nuevoBorrador);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const captchaRef = useRef<TurnstileInstance>(null);
  const crear = useCrearReservacion(sucursalId, tz);

  const set = <K extends keyof BorradorReservacion>(k: K, v: BorradorReservacion[K]) =>
    setB((prev) => ({ ...prev, [k]: v }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const problema = validarReservacion(b, new Date(), tz);
    if (problema) {
      setError(problema.motivo);
      return;
    }
    if (captchaHabilitado && !token) {
      setError("Espera a que cargue la verificación de seguridad.");
      return;
    }
    try {
      await crear.mutateAsync({ borrador: b, token });
      setListo(true);
    } catch (err) {
      setError((err as Error).message);
      captchaRef.current?.reset();
      setToken(null);
    }
  }

  return (
    <Modal alCerrar={alCerrar} etiqueta="Reservar">
      <header className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="text-lg">Reservar</h2>
        <button type="button" onClick={alCerrar} aria-label="Cerrar" className="text-vm-body">
          ✕
        </button>
      </header>

      {listo ? (
        <div className="space-y-3 p-6 text-center">
          <Check className="mx-auto size-10 text-vm-success" aria-hidden />
          <p className="text-sm text-vm-ink">
            Recibimos tu solicitud. El restaurante te contactará al número que dejaste.
          </p>
          <button
            type="button"
            onClick={alCerrar}
            className="mt-2 inline-flex h-11 items-center rounded-lg bg-vm-primary px-5 text-sm font-medium text-white"
          >
            Listo
          </button>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4 p-5">
          <label className="block text-sm">
            Nombre
            <input
              required
              value={b.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              className="mt-1.5 h-11 w-full rounded-lg border px-3 text-sm outline-none focus:border-vm-primary"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Personas
              <input
                type="number"
                min={1}
                max={MAX_PERSONAS}
                value={b.personas}
                onChange={(e) => set("personas", Number(e.target.value))}
                className="mt-1.5 h-11 w-full rounded-lg border px-3 text-sm outline-none focus:border-vm-primary"
              />
            </label>
            <label className="block text-sm">
              Fecha
              <input
                type="date"
                required
                min={HOY()}
                max={MAX_FECHA()}
                value={b.fecha}
                onChange={(e) => set("fecha", e.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border px-3 text-sm outline-none focus:border-vm-primary"
              />
            </label>
          </div>

          <label className="block text-sm">
            Hora
            <input
              type="time"
              required
              value={b.hora}
              onChange={(e) => set("hora", e.target.value)}
              className="mt-1.5 h-11 w-full rounded-lg border px-3 text-sm outline-none focus:border-vm-primary"
            />
          </label>

          <div className="text-sm">
            Teléfono
            <div className="mt-1.5">
              <PhoneInput value={b.telefono} onChange={(v) => set("telefono", v)} placeholder="55 1234 5678" />
            </div>
          </div>

          <label className="block text-sm">
            Correo <span className="text-vm-body">(opcional)</span>
            <input
              type="email"
              value={b.email}
              onChange={(e) => set("email", e.target.value)}
              className="mt-1.5 h-11 w-full rounded-lg border px-3 text-sm outline-none focus:border-vm-primary"
            />
          </label>

          <label className="block text-sm">
            Nota <span className="text-vm-body">(opcional)</span>
            <textarea
              value={b.nota}
              onChange={(e) => set("nota", e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Alergias, silla para bebé, festejo…"
              className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-vm-primary"
            />
          </label>

          {b.fecha && b.hora && (
            <p className="text-xs text-vm-body">Para el {formatearFechaHora(b.fecha, b.hora, tz)}.</p>
          )}

          <label className="flex items-start gap-2 text-xs text-vm-body">
            <input
              type="checkbox"
              checked={b.consentimiento}
              onChange={(e) => set("consentimiento", e.target.checked)}
              className="mt-0.5 size-4 accent-vm-primary"
            />
            <span>
              Acepto que mis datos se usen para gestionar mi reservación (
              <a href="/privacidad" target="_blank" rel="noreferrer" className="underline">
                aviso de privacidad
              </a>
              ).
            </span>
          </label>

          <Captcha ref={captchaRef} onToken={setToken} />

          {error && (
            <p className="rounded-lg bg-vm-danger-soft px-3 py-2 text-sm text-vm-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={crear.isPending}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white disabled:opacity-50"
          >
            {crear.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Enviar solicitud
          </button>
        </form>
      )}
    </Modal>
  );
}
```
Nota: si existe `@/components/ui/sheet`, preferirlo sobre `Modal` para que en móvil suba desde abajo. Revisar `src/components/ui/` antes de implementar y usar el que ya use el resto del menú público.

- [ ] **Step 3: Renderizar en `MenuPublico.tsx`**

Importar `ReservarMenu`. En el `cuerpo` (la rama no-TikTok), justo después de `<ContactoMenu tenant={data.tenant} sucursal={data.sucursalActiva} />`:
```tsx
        <ReservarMenu
          tenant={data.tenant}
          sucursalActiva={data.sucursalActiva}
          sucursales={data.sucursales}
          habilitado={data.permiteReservaciones}
        />
```
No se añade a la rama TikTok en la v1 (igual que `EmbudoResenas`, que tampoco está ahí).

- [ ] **Step 4: Typecheck + lint + build**

Run: `bunx tsc --noEmit && bunx eslint src/components/menu/ReservarMenu.tsx src/hooks/useMenuPublico.ts src/pages/MenuPublico.tsx && bun run build`
Expected: PASS.

- [ ] **Step 5: Prueba manual en dev**

Run: `bun run dev`. Abrir el menú de una sucursal de un tenant Pro. Requiere que `acepta_reservaciones` esté en `true` para esa sucursal (se puede poner a mano por el conector mientras Task 10 no está: `update sucursales set acepta_reservaciones = true where id = '...'`).
Verificar: aparece "Reservar" bajo la fila de contacto; abre el modal; enviar sin captcha en dev crea la reservación (revisar la fila por el conector); el mensaje de éxito sale; los errores de validación de campo se muestran.

- [ ] **Step 6: Commit**

```bash
git add src/components/menu/ReservarMenu.tsx src/hooks/useMenuPublico.ts src/pages/MenuPublico.tsx
git commit -m "feat(reservaciones): formulario Reservar en el menú público"
```

---

## Task 9: Página del panel `/admin/reservaciones`

**Files:**
- Create: `src/routes/admin.reservaciones.tsx`
- Create: `src/pages/admin/Reservaciones.tsx`
- Modify: `src/components/layout/PillTabs.tsx`
- Modify: `src/components/layout/AdminLayout.tsx`

**Interfaces:**
- Consumes: `useReservaciones`, `useCambiarEstadoReservacion`, `useReservacionesNuevas`, `type Reservacion` (Task 7); `useTenantActual`; `useSucursales`; patrón de muro de `Opiniones.tsx`.
- Produces: ruta `/admin/reservaciones`; `PillTabs` acepta el conteo para el badge.

- [ ] **Step 1: Crear la ruta**

`src/routes/admin.reservaciones.tsx`:
```tsx
import { createFileRoute } from "@tanstack/react-router";
import Reservaciones from "@/pages/admin/Reservaciones";

export const Route = createFileRoute("/admin/reservaciones")({
  component: Reservaciones,
});
```

- [ ] **Step 2: Añadir la pestaña + badge en `PillTabs.tsx`**

- En `PESTANAS_NEGOCIO`, insertar `{ a: "/admin/reservaciones", etiqueta: "Reservaciones" }` entre "Equipo" y "Opiniones".
- Añadir un hook de badge. Como `PillTabs` es genérico, hacer que consuma el conteo solo para esa ruta:
```tsx
import { useReservacionesNuevas } from "@/hooks/useReservaciones";
import { useTenantActual } from "@/hooks/useTenantActual";
// ...
export default function PillTabs({ pestanas }: { pestanas: Pestana[] }) {
  const { pathname } = useLocation();
  const { data: ctx } = useTenantActual();
  const { data: nuevas = 0 } = useReservacionesNuevas(ctx?.tenant.id);
  // ... dentro del map, tras {p.etiqueta}:
  //   {p.a === "/admin/reservaciones" && nuevas > 0 && (
  //     <span className="ml-1.5 rounded-full bg-vm-primary px-1.5 text-[11px] font-semibold text-white">{nuevas}</span>
  //   )}
}
```
Cuando la pestaña activa es Reservaciones, su fondo ya es `bg-vm-primary`; en ese caso pintar el badge con `bg-white text-vm-primary`. Ajustar con un ternario sobre `activa`.

- [ ] **Step 3: `AdminLayout.tsx` — extender `cubre`**

En el item `{ a: "/admin/empresa", ... }`, añadir `"/admin/reservaciones"` al array `cubre`.

- [ ] **Step 4: Crear `src/pages/admin/Reservaciones.tsx`**

```tsx
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Lock, MessageCircle, Phone } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import PillTabs, { PESTANAS_NEGOCIO } from "@/components/layout/PillTabs";
import { useTenantActual } from "@/hooks/useTenantActual";
import { useSucursales } from "@/hooks/useSucursales";
import {
  useReservaciones,
  useCambiarEstadoReservacion,
  type EstadoReservacion,
  type Reservacion,
} from "@/hooks/useReservaciones";
import { telefonoParaWaMe } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export default function Reservaciones() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

const EJEMPLO: Reservacion[] = [
  {
    id: "1",
    sucursal_id: null as unknown as string,
    nombre: "Marisol Vega",
    personas: 4,
    fecha_hora: "2026-09-12T02:00:00Z",
    telefono: "+52 55 1234 5678",
    email: null,
    nota: "Festejo de cumpleaños",
    estado: "nueva",
    creada_en: "2026-09-01",
  },
  {
    id: "2",
    sucursal_id: null as unknown as string,
    nombre: "Jorge Ramos",
    personas: 2,
    fecha_hora: "2026-09-10T20:00:00Z",
    telefono: "+52 55 8765 4321",
    email: null,
    nota: null,
    estado: "atendida",
    creada_en: "2026-08-30",
  },
];

function fmtFecha(tz: string) {
  return new Intl.DateTimeFormat("es-MX", { timeZone: tz, dateStyle: "medium", timeStyle: "short" });
}

function Fila({
  r,
  sucursal,
  tz,
  onEstado,
  ocupado,
}: {
  r: Reservacion;
  sucursal: string;
  tz: string;
  onEstado?: (e: EstadoReservacion) => void;
  ocupado?: boolean;
}) {
  const wa = telefonoParaWaMe(r.telefono);
  return (
    <li className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-vm-ink">
            {r.nombre} · {r.personas} {r.personas === 1 ? "persona" : "personas"}
          </p>
          <p className="mt-0.5 text-xs text-vm-body">
            {fmtFecha(tz).format(new Date(r.fecha_hora))} · {sucursal}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium capitalize",
            r.estado === "nueva" && "bg-vm-primary/10 text-vm-primary",
            r.estado === "atendida" && "bg-vm-success-soft text-vm-success",
            r.estado === "cancelada" && "bg-vm-bg-soft text-vm-body",
          )}
        >
          {r.estado}
        </span>
      </div>

      {r.nota && <p className="mt-2 text-sm text-vm-body">{r.nota}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={`tel:${r.telefono.replace(/[^\d+]/g, "")}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs text-vm-ink hover:bg-vm-bg-soft"
        >
          <Phone className="size-3.5" aria-hidden /> Llamar
        </a>
        {wa && (
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs text-vm-ink hover:bg-vm-bg-soft"
          >
            <MessageCircle className="size-3.5" aria-hidden /> WhatsApp
          </a>
        )}
        <span className="flex-1" />
        {onEstado && r.estado === "nueva" && (
          <>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => onEstado("atendida")}
              className="h-8 rounded-full bg-vm-primary px-3 text-xs font-medium text-white disabled:opacity-50"
            >
              Marcar atendida
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => onEstado("cancelada")}
              className="h-8 rounded-full border px-3 text-xs font-medium text-vm-body disabled:opacity-50"
            >
              Cancelar
            </button>
          </>
        )}
        {onEstado && r.estado !== "nueva" && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => onEstado("nueva")}
            className="h-8 rounded-full border px-3 text-xs font-medium text-vm-body disabled:opacity-50"
          >
            Reabrir
          </button>
        )}
      </div>
    </li>
  );
}

function Bloqueado() {
  return (
    <div className="relative mt-8">
      <ul className="pointer-events-none space-y-3 select-none blur-sm" aria-hidden>
        {EJEMPLO.map((r) => (
          <Fila key={r.id} r={r} sucursal="Centro" tz="America/Mexico_City" />
        ))}
      </ul>
      <div className="absolute inset-0 grid place-items-center">
        <div className="max-w-sm rounded-xl border bg-white p-7 text-center shadow-vm-3">
          <Lock className="mx-auto size-8 text-vm-primary" aria-hidden />
          <h2 className="mt-4 text-xl">Las reservaciones son parte de los planes Pro y Enterprise.</h2>
          <p className="mt-2 text-sm text-vm-body">
            Tus clientes piden mesa desde el menú y tú las gestionas aquí.
          </p>
          <Link
            to="/admin/suscripcion"
            className="mt-6 inline-flex h-12 items-center rounded-lg bg-vm-primary px-6 text-sm font-medium text-white hover:bg-vm-primary-hover"
          >
            Actualizar plan
          </Link>
        </div>
      </div>
    </div>
  );
}

function Contenido() {
  const { data: ctx } = useTenantActual();
  const tenantId = ctx?.tenant.id;
  const { data: sucursales } = useSucursales(tenantId);
  const { data: reservas, isLoading, isError } = useReservaciones(tenantId);
  const cambiar = useCambiarEstadoReservacion(tenantId);

  const [filtroSuc, setFiltroSuc] = useState<string | "todas">("todas");
  const [cuando, setCuando] = useState<"proximas" | "pasadas" | "todas">("proximas");

  const nombreSuc = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sucursales ?? []) m.set(s.id, s.nombre);
    return m;
  }, [sucursales]);
  const tzSuc = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sucursales ?? []) m.set(s.id, s.timezone);
    return m;
  }, [sucursales]);

  if (!ctx) return null;

  if (!ctx.plan.permite_reservaciones) {
    return (
      <>
        <PillTabs pestanas={PESTANAS_NEGOCIO} />
        <h1 className="text-2xl">Reservaciones</h1>
        <p className="mt-1 text-sm text-vm-body">Lo que tus clientes piden desde el menú.</p>
        <Bloqueado />
      </>
    );
  }

  const ahora = Date.now();
  const visibles = (reservas ?? [])
    .filter((r) => (filtroSuc === "todas" ? true : r.sucursal_id === filtroSuc))
    .filter((r) => {
      const t = new Date(r.fecha_hora).getTime();
      if (cuando === "proximas") return t >= ahora;
      if (cuando === "pasadas") return t < ahora;
      return true;
    });

  return (
    <>
      <PillTabs pestanas={PESTANAS_NEGOCIO} />
      <h1 className="text-2xl">Reservaciones</h1>
      <p className="mt-1 text-sm text-vm-body">Lo que tus clientes piden desde el menú.</p>

      {isError && (
        <p className="mt-8 rounded-lg bg-vm-danger-soft px-4 py-3 text-sm text-vm-danger">
          No pudimos leer tus reservaciones. Falta correr la migración{" "}
          <code>vibemenu_migracion_reservaciones.sql</code>.
        </p>
      )}
      {isLoading && <div className="mt-8 h-40 animate-pulse rounded-xl bg-vm-bg-soft" />}

      {reservas && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {(["proximas", "pasadas", "todas"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setCuando(k)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  cuando === k ? "bg-vm-primary text-white" : "bg-vm-bg-soft text-vm-body",
                )}
              >
                {k}
              </button>
            ))}
            {(sucursales?.length ?? 0) > 1 && (
              <select
                value={filtroSuc}
                onChange={(e) => setFiltroSuc(e.target.value)}
                className="ml-auto h-8 rounded-full border px-3 text-xs"
              >
                <option value="todas">Todas las sucursales</option>
                {(sucursales ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          {visibles.length === 0 ? (
            <div className="mt-8 grid place-items-center gap-2 rounded-xl border border-dashed py-16 text-center">
              <CalendarClock className="size-8 text-vm-body" aria-hidden />
              <p className="text-sm text-vm-body">
                {(reservas.length ?? 0) === 0
                  ? "Aún no tienes reservaciones. Actívalas por sucursal en Sucursales."
                  : "Nada con este filtro."}
              </p>
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {visibles.map((r) => (
                <Fila
                  key={r.id}
                  r={r}
                  sucursal={nombreSuc.get(r.sucursal_id) ?? "Sucursal"}
                  tz={tzSuc.get(r.sucursal_id) ?? "America/Mexico_City"}
                  ocupado={cambiar.isPending}
                  onEstado={(estado) => void cambiar.mutateAsync({ id: r.id, estado })}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
```
Nota sobre `EJEMPLO`: `sucursal_id` es `string` no-nullable en el tipo real. Para el ejemplo difuminado se castea; alternativamente cambiar `Fila` para no depender del id en el modo bloqueado (pasa el nombre ya resuelto). Preferir lo segundo si el cast molesta al lint.

- [ ] **Step 5: Regenerar el árbol de rutas si aplica**

TanStack Router file-based suele autogenerar `routeTree.gen.ts`. Run: `bun run dev` una vez (o el script que regenere el árbol — revisar `package.json`) para que la ruta nueva entre. Confirmar que `src/routeTree.gen.ts` (si existe) incluye `/admin/reservaciones`.

- [ ] **Step 6: Typecheck + lint + build**

Run: `bunx tsc --noEmit && bunx eslint src/pages/admin/Reservaciones.tsx src/routes/admin.reservaciones.tsx src/components/layout/PillTabs.tsx src/components/layout/AdminLayout.tsx && bun run build`
Expected: PASS.

- [ ] **Step 7: Prueba manual**

`bun run dev` → entrar como tenant Pro → `/admin/reservaciones`: se ve la lista (con la fila creada en Task 8); marcar atendida mueve el estado y baja el badge de la pestaña; filtros funcionan. Entrar como tenant Free → se ve el muro con CTA a `/admin/suscripcion`.

- [ ] **Step 8: Commit**

```bash
git add src/pages/admin/Reservaciones.tsx src/routes/admin.reservaciones.tsx src/components/layout/PillTabs.tsx src/components/layout/AdminLayout.tsx src/routeTree.gen.ts
git commit -m "feat(reservaciones): panel /admin/reservaciones con estados y badge"
```

---

## Task 10: Opt-in por sucursal en el editor

**Files:**
- Modify: `src/hooks/useSucursales.ts`
- Modify: `src/components/admin/EditorSucursal.tsx`

**Interfaces:**
- Consumes: `Sucursal.acepta_reservaciones`, `Sucursal.reservaciones_email` (Task 2); `ctx.plan.permite_reservaciones` vía `useTenantActual` (o recibir un prop `permiteReservaciones` desde el padre de `EditorSucursal`).
- Produces: `BorradorSucursal` gana `acepta_reservaciones: boolean` y `reservaciones_email: string | null`; se persisten en el upsert existente de `useGuardarSucursal` sin más cambios (ya hace `update(datos)` / `insert({...datos})`).

- [ ] **Step 1: Extender `BorradorSucursal` en `useSucursales.ts`**

```ts
export type BorradorSucursal = {
  // ...campos existentes...
  /** Opt-in de reservaciones para esta sucursal (plan Pro+). */
  acepta_reservaciones: boolean;
  /** Correo de aviso; null = al correo del owner. */
  reservaciones_email: string | null;
};
```
En el JSDoc de `useGuardarSucursal`, añadir a la nota de migración: "…y `acepta_reservaciones`/`reservaciones_email`; la migración `vibemenu_migracion_reservaciones.sql` debe estar aplicada antes del deploy."

- [ ] **Step 2: Añadir la sección en `EditorSucursal.tsx`**

- Importar `useTenantActual`.
- Estado nuevo:
```tsx
const { data: ctx } = useTenantActual();
const permiteReservaciones = Boolean(ctx?.plan.permite_reservaciones);
const [aceptaReservaciones, setAceptaReservaciones] = useState(
  sucursal?.acepta_reservaciones ?? false,
);
const [reservacionesEmail, setReservacionesEmail] = useState(
  sucursal?.reservaciones_email ?? "",
);
```
- En `alGuardar`, dentro de `datos`, añadir:
```tsx
        acepta_reservaciones: permiteReservaciones ? aceptaReservaciones : false,
        reservaciones_email:
          permiteReservaciones && reservacionesEmail.trim() ? reservacionesEmail.trim() : null,
```
- Validación previa (junto a la de `reviews`): si `reservacionesEmail.trim()` y no matchea `/^[^@\s]+@[^@\s]+\.[^@\s]+$/`, `setError("El correo de avisos no se ve bien.")` y `return`.
- UI, tras la sección de reseñas:
```tsx
          <div className="rounded-xl border p-4">
            <label className="flex items-center justify-between text-sm font-medium text-vm-ink">
              Recibir reservaciones en esta sucursal
              <input
                type="checkbox"
                disabled={!permiteReservaciones}
                checked={aceptaReservaciones}
                onChange={(e) => setAceptaReservaciones(e.target.checked)}
                className="size-4 accent-vm-primary disabled:opacity-40"
              />
            </label>
            {permiteReservaciones ? (
              aceptaReservaciones && (
                <div className="mt-3">
                  <label htmlFor="s-resv-email" className="text-sm text-vm-ink">
                    Correo para avisos <span className="text-vm-body">(opcional)</span>
                  </label>
                  <input
                    id="s-resv-email"
                    type="email"
                    inputMode="email"
                    value={reservacionesEmail}
                    onChange={(e) => setReservacionesEmail(e.target.value)}
                    placeholder="reservas@tunegocio.mx"
                    className="mt-1.5 h-11 w-full rounded-lg border px-3 text-sm outline-none focus:border-vm-primary"
                  />
                  <p className="mt-1.5 text-xs text-vm-body">
                    Si lo dejas vacío, los avisos llegan al correo del dueño. Estos serán datos de
                    tus clientes: confírmales tú directamente.
                  </p>
                </div>
              )
            ) : (
              <p className="mt-2 text-xs text-vm-body">
                Disponible en los planes Pro y Enterprise.{" "}
                <Link to="/admin/suscripcion" className="text-vm-primary hover:underline">
                  Ver planes
                </Link>
                .
              </p>
            )}
          </div>
```
(Importar `Link` de `@tanstack/react-router` si no está.)

- [ ] **Step 3: Typecheck + lint + build**

Run: `bunx tsc --noEmit && bunx eslint src/hooks/useSucursales.ts src/components/admin/EditorSucursal.tsx && bun run build`
Expected: PASS. Si `tsc` marca otros lugares que construyen un `BorradorSucursal` (p. ej. `Sucursales.tsx` al abrir el editor con valores por defecto), añadir ahí `acepta_reservaciones: false, reservaciones_email: null`.

- [ ] **Step 4: Prueba manual**

`bun run dev` → tenant Pro → Sucursales → editar una → activar "Recibir reservaciones", guardar → reabrir: quedó activo. Veréar por el conector: `select acepta_reservaciones, reservaciones_email from sucursales where id = '...'`. Tenant Free → la sección aparece deshabilitada con el enlace a planes.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSucursales.ts src/components/admin/EditorSucursal.tsx src/pages/admin/Sucursales.tsx
git commit -m "feat(reservaciones): opt-in por sucursal en el editor"
```

---

## Task 11: Documentación

**Files:**
- Modify: `src/docs/vibemenu_alcance.md`
- Modify: `src/docs/vibemenu_base-datos.md`

- [ ] **Step 1: `vibemenu_alcance.md`**

- En "Fuera del alcance (MVP)", quitar/anotar la línea de reservaciones si la hubiera; en la sección de features o planes, documentar: "**Reservaciones simples (Pro/Enterprise).** Formulario en el menú público (nombre, personas, fecha/hora, teléfono, nota); aviso por correo al restaurante; gestión en `/admin/reservaciones` con estados nueva/atendida/cancelada. Opt-in por sucursal (`sucursales.acepta_reservaciones`). Sin mesas ni disponibilidad. Anti-spam con Turnstile en la edge function `crear-reservacion`."
- En la tabla de planes, añadir la fila/columna "Reservaciones" → Pro y Enterprise.
- En "Rutas y páginas", añadir `/admin/reservaciones`.

- [ ] **Step 2: `vibemenu_base-datos.md`**

Añadir una sección para `reservaciones` con el `create table`, las policies, el trigger `validar_reservacion`, y las funciones `combinar_fecha_hora_sucursal` / `purgar_reservaciones_viejas`. Copiar el estilo de la sección de `feedback_privado` / migración 007.

- [ ] **Step 3: Commit**

```bash
git add src/docs/vibemenu_alcance.md src/docs/vibemenu_base-datos.md
git commit -m "docs(reservaciones): actualiza alcance y esquema"
```

---

## Task 12: QA end-to-end y merge

**Files:** ninguno (verificación).

- [ ] **Step 1: Correr toda la suite y el lint**

Run: `bun test && bunx tsc --noEmit && bunx eslint . && bun run build`
Expected: todo PASS.

- [ ] **Step 2: Configurar `TURNSTILE_SECRET_KEY` en producción**

Confirmar con el usuario que el secret está puesto en Supabase (Dashboard → Edge Functions → Secrets del proyecto `iaiiwtqqiaqxnzxjqcnt`). Sin él, la edge function no verifica captcha (acepta todo).

- [ ] **Step 3: Desplegar la edge function a producción**

`mcp__claude_ai_Supabase__deploy_edge_function` con `project_id: "iaiiwtqqiaqxnzxjqcnt"`, `name: "crear-reservacion"`.

- [ ] **Step 4: Checklist manual en preview/producción**

- Tenant Pro, sucursal con `acepta_reservaciones=true` → el menú de esa sucursal muestra "Reservar"; el menú general lo muestra solo si el tenant tiene 1 sucursal.
- Enviar una reservación real → llega el correo (a `reservaciones_email` o al owner) con la fecha/hora en la zona de la sucursal y el link `wa.me` correcto.
- `/admin/reservaciones` la muestra como "nueva"; el badge de la pestaña sube; marcar atendida lo baja.
- Bajar el tenant a Basic (o probar con uno Basic) → `/admin/reservaciones` muestra el muro; "Reservar" desaparece del menú; `curl` directo a la función → `reservaciones_no_disponibles`.
- 6 envíos seguidos desde la misma sucursal → el 6º muestra "demasiadas solicitudes".
- `select purgar_reservaciones_viejas();` por el conector → devuelve 0 sin error.

- [ ] **Step 5: Merge de la rama**

Seguir `superpowers:finishing-a-development-branch`. Rama `feat/reservaciones` → `main`. Aplicar la migración a producción ya se hizo en Task 1 Step 6; confirmar que sigue.

---

## Self-Review

**Spec coverage:**

| Sección del spec | Task |
|---|---|
| Migración: `planes.permite_reservaciones` | 1 |
| Migración: `sucursales.acepta_reservaciones` + email | 1, 10 |
| Tabla `reservaciones` + índices + RLS | 1 |
| Trigger `validar_reservacion` | 1 |
| RPC `combinar_fecha_hora_sucursal` | 1, 5 |
| Edge function `crear-reservacion` (Turnstile, rate-limit, Resend, owner fallback) | 5 |
| Cron de purga a 90 días | 1 (RPC), 6 (workflow) |
| `src/lib/reservaciones.ts` + tests | 3 |
| `ReservarMenu` + Sheet + consentimiento + visibilidad general/sucursal | 8 |
| `useCrearReservacion` | 7 |
| Panel `/admin/reservaciones` + estados + muro de plan | 9 |
| Badge de "nuevas" en PillTabs | 7 (hook), 9 (render) |
| `EditorSucursal` switch + email | 10 |
| `erroresEdge.ts` slugs | 4 |
| Tipos `database.ts` + `demo.ts` | 2 |
| `useMenuPublico` join de plan | 8 |
| Docs `alcance` + `base-datos` | 11 |
| Matriz de pruebas del spec | 3, 5, 12 |

Sin huecos.

**Placeholder scan:** sin "TBD"/"añadir manejo de errores" — cada step trae el código o el comando concreto. Los `<+3 días>` / `<una sucursal Pro>` en comandos `curl` son valores que el ejecutor rellena con datos reales de su entorno de prueba, no placeholders de lógica.

**Type consistency:**
- `BorradorReservacion` — misma forma en Task 3 (def), 7 (`payloadReservacion`), 8 (`nuevoBorrador`, formulario).
- `Reservacion` / `EstadoReservacion` — def en Task 7, consumidos en Task 9 con esos nombres.
- `validarReservacion(b, ahora, tz)` — firma idéntica en 3 y 8.
- `useCrearReservacion(sucursalId, tz)` → `.mutateAsync({ borrador, token })` — igual en 7 y 8.
- `useReservacionesNuevas(tenantId)` — igual en 7, 9 (PillTabs), 9 (badge).
- Slugs de error — el set de Task 4 cubre exactamente los que la edge function (Task 5) puede devolver (`datos_invalidos`, `captcha_invalido`, `reservaciones_no_disponibles`, `demasiadas_solicitudes`, y los del trigger).
- `combinar_fecha_hora_sucursal(p_fecha, p_hora, p_tz)` — firma idéntica en 1 (def) y 5 (`.rpc`).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-31-reservaciones.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
