# Endurecer facturación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los tres huecos de cobro del audit — webhooks no idempotentes, `suspendido` sin efecto y cancelación sin baja ordenada — con periodo de gracia de 7 días, bloqueo del panel al vencer, y baja a Free al cancelar.

**Architecture:** Una tabla `eventos_stripe` deduplica cada webhook por `evento.id`. Dos columnas nuevas en `tenants` (`pago_fallido_desde`, `cancela_al_terminar`) llevan el estado de cobro; el webhook las mantiene y un bloque nuevo del cron diario suspende al día 7. El frontend lee esas columnas para mostrar banner de gracia, banner de cancelación, o una pantalla de panel bloqueado. Una función `security definer` nueva reemplaza `pertenece_a_tenant` en las policies de escritura de contenido para que un tenant suspendido tampoco pueda escribir por llamada directa.

**Tech Stack:** Supabase (Postgres, Edge Functions en Deno), Stripe SDK v17, TanStack Router/Query, React, Tailwind (tokens `vm-*`), bun:test, GitHub Actions (cron ya existente). MCP de Supabase disponible: `project_id: iaiiwtqqiaqxnzxjqcnt`.

**Spec:** `docs/superpowers/specs/2026-08-27-endurecer-facturacion-design.md`

## Global Constraints

- Todo el código nuevo, comentarios y copy en español, mismo tono que el repo (ver `enviar-bienvenida`, `procesar-trials-vencidos`, `stripe-webhook` como referencia de estilo).
- Ningún cambio puede tumbar el menú público del comensal por estado de cobro — las policies `*_select_publico` y las rutas públicas (`routes/index.tsx`, `$slug`, sucursales) NO se tocan.
- El único lugar que escribe en `suscripciones` sigue siendo `stripe-webhook` con `service_role_key`.
- Las columnas nuevas de `tenants` NO se agregan al `grant update (...)` de `authenticated` — solo el webhook (service_role) las escribe.
- `stripe-webhook` se despliega SIEMPRE con `verify_jwt: false` (Stripe no manda JWT de Supabase). `procesar-trials-vencidos` con `verify_jwt: true`.
- Sin tests de Bun para Edge Functions (Deno, fuera de `src/lib` — mismo patrón que `procesar-trials-vencidos`). Lógica pura nueva en `src/lib` SÍ lleva test.
- Migraciones: archivo `.sql` versionado en `src/docs/` + aplicación con la tool `apply_migration` del MCP de Supabase. Nunca `bun test` para migraciones.
- No tocar nada de Track B (dominios): `dominio_estado`, `agregar-dominio-vercel`, `verificar-dominios-pendientes`, `routes/sucursal.$sucursalSlug.tsx`.
- Valores de negocio verbatim: `DIAS_GRACIA = 7`. Plan de baja: el que tiene `planes.nombre = 'free'`.

---

### Task 1: Migración `eventos_stripe` + idempotencia real en `stripe-webhook`

**Files:**
- Create: `src/docs/vibemenu_migracion_eventos_stripe.sql`
- Modify: `supabase/functions/stripe-webhook/index.ts` (bloque nuevo entre la verificación de firma en la línea ~296 y el `try {` de la línea ~298)
- Aplicar migración con `apply_migration` del MCP (`project_id: iaiiwtqqiaqxnzxjqcnt`, `name: eventos_stripe`).
- Desplegar la función con `deploy_edge_function` del MCP (`name: stripe-webhook`, `verify_jwt: false`).

**Interfaces:**
- Produces: tabla `eventos_stripe (id text pk, tipo text, recibido_at timestamptz)`. `stripe-webhook` responde `200 {"duplicado":true}` sin ejecutar el `switch` cuando el `evento.id` ya está registrado.

- [ ] **Step 1: Escribir el archivo de migración**

Crear `src/docs/vibemenu_migracion_eventos_stripe.sql`:

```sql
-- ============================================================================
--  VIBEMENU — migracion: eventos_stripe (idempotencia de webhooks)
--
--  Stripe entrega cada webhook "al menos una vez": un mismo evento puede llegar
--  2+ veces. Hoy solo invoice.paid deduplica (por stripe_invoice_id). Esta
--  tabla deduplica TODOS los eventos por su id (evt_...): stripe-webhook
--  inserta la fila al inicio; si choca con la PK, ya lo procesamos y responde
--  200 sin volver a ejecutar el handler.
--
--  Sin policies de RLS: solo el service_role_key (que ya usa stripe-webhook)
--  la toca. Ver supabase/functions/stripe-webhook/index.ts.
--
--  Aplicar con apply_migration del MCP de Supabase (project_id
--  iaiiwtqqiaqxnzxjqcnt, name: eventos_stripe).
-- ============================================================================

begin;

create table eventos_stripe (
  id          text primary key,
  tipo        text not null,
  recibido_at timestamptz not null default now()
);

alter table eventos_stripe enable row level security;

commit;

-- ============================================================================
--  Verificar:
--    select tablename, rowsecurity from pg_tables where tablename = 'eventos_stripe';
--    -- una fila, rowsecurity = true
--
--    select count(*) from pg_policies where tablename = 'eventos_stripe';
--    -- 0 (ninguna policy: solo service_role escribe/lee)
-- ============================================================================
```

- [ ] **Step 2: Aplicar la migración con el MCP**

Usar `apply_migration` del MCP de Supabase: `project_id: iaiiwtqqiaqxnzxjqcnt`, `name: eventos_stripe`, `query`: el SQL entre `begin;` y `commit;` del Step 1 (sin los comentarios de verificación).

- [ ] **Step 3: Verificar la migración con el MCP**

Usar `execute_sql` del MCP con estas dos queries (una por una):

```sql
select tablename, rowsecurity from pg_tables where tablename = 'eventos_stripe';
```
Expected: una fila, `rowsecurity = true`.

```sql
select count(*) as policies from pg_policies where tablename = 'eventos_stripe';
```
Expected: `policies = 0`.

- [ ] **Step 4: Agregar el guard de idempotencia a `stripe-webhook/index.ts`**

En `supabase/functions/stripe-webhook/index.ts`, justo DESPUÉS del bloque `catch` que termina en `return new Response(\`firma invalida...\`, { status: 400 });` (línea ~296) y ANTES de `try {` (línea ~298), insertar:

```ts
  // Idempotencia: Stripe entrega cada evento "al menos una vez". Se registra el
  // evento.id al llegar; si ya estaba, este es un reintento y no se vuelve a
  // procesar. Guia oficial de Stripe: responder 200 rapido y deduplicar por id.
  const { error: errorDedup } = await db
    .from("eventos_stripe")
    .insert({ id: evento.id, tipo: evento.type });

  // 23505 = unique_violation: ya lo procesamos.
  if (errorDedup?.code === "23505") {
    return new Response(JSON.stringify({ duplicado: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  if (errorDedup) {
    // Fallo real de DB (no un duplicado): 500 para que Stripe reintente.
    console.error("no se pudo registrar evento_stripe", evento.id, errorDedup);
    return new Response(`error registrando evento: ${errorDedup.message}`, { status: 500 });
  }
```

Dejar intacto el guard `yaActiva` dentro de `checkout.session.completed` (defensa en profundidad) y el `upsert ... ignoreDuplicates` de `invoice.paid`.

- [ ] **Step 5: Desplegar `stripe-webhook` con el MCP**

Usar `deploy_edge_function` del MCP: `project_id: iaiiwtqqiaqxnzxjqcnt`, `name: stripe-webhook`, `entrypoint_path: index.ts`, `verify_jwt: false`, `files: [{ name: "index.ts", content: "<contenido completo del archivo modificado>" }]`.

- [ ] **Step 6: Verificar el despliegue con el MCP**

Usar `get_edge_function` del MCP (`project_id: iaiiwtqqiaqxnzxjqcnt`, `function_slug: stripe-webhook`) y confirmar que el `content` devuelto contiene el string `eventos_stripe` y que `verify_jwt` sigue en `false`.

- [ ] **Step 7: Commit**

```bash
git add src/docs/vibemenu_migracion_eventos_stripe.sql supabase/functions/stripe-webhook/index.ts
git commit -m "feat: idempotencia real de webhooks de Stripe por evento.id"
```

---

### Task 2: Migración `facturacion_estado` — columnas, función RLS y swap de policies

**Files:**
- Create: `src/docs/vibemenu_migracion_facturacion_estado.sql`
- Modify: `src/types/database.ts:721-780` (bloque `tenants` — Row/Insert/Update)
- Aplicar migración con `apply_migration` del MCP (`name: facturacion_estado`).

**Interfaces:**
- Consumes: nada (primera tarea de esquema de facturación).
- Produces:
  - `tenants.pago_fallido_desde timestamptz` (`null` = al corriente).
  - `tenants.cancela_al_terminar boolean not null default false`.
  - función `tenant_puede_escribir(check_tenant_id uuid) returns boolean` (= miembro del tenant Y `estado <> 'suspendido'`).
  - policies de escritura de `sucursales`, `horarios`, `categorias`, `productos`, `grupos_modificadores`, `opciones_modificador`, `producto_modificadores` y `tenants` (update) ahora exigen `tenant_puede_escribir`.
  - tipos TS: `Tenant` (`Tables<"tenants">`) incluye `pago_fallido_desde: string | null` y `cancela_al_terminar: boolean`.

- [ ] **Step 1: Escribir el archivo de migración**

Crear `src/docs/vibemenu_migracion_facturacion_estado.sql`:

```sql
-- ============================================================================
--  VIBEMENU — migracion: facturacion_estado
--
--  1. tenants.pago_fallido_desde  -> inicio del periodo de gracia de 7 dias
--     cuando Stripe reporta past_due/unpaid. null = al corriente.
--  2. tenants.cancela_al_terminar -> el tenant pidio cancelar; conserva su plan
--     hasta el fin del periodo ya cobrado (Stripe: cancel_at_period_end).
--  3. tenant_puede_escribir()     -> helper de RLS: miembro del tenant Y no
--     suspendido. Reemplaza a pertenece_a_tenant() SOLO en las policies de
--     ESCRITURA de contenido (no en las de lectura publica del menu).
--
--  Un tenant suspendido por impago con gracia vencida NO puede editar su
--  contenido ni por llamada directa a Supabase -- no solo por bloqueo de UI.
--  El menu publico sigue sirviendo: las policies *_select_publico no cambian.
--
--  Las columnas nuevas NO se agregan al grant update (...) de `authenticated`:
--  solo stripe-webhook (service_role) las escribe.
--
--  Aplicar con apply_migration del MCP (project_id iaiiwtqqiaqxnzxjqcnt,
--  name: facturacion_estado). Ver docs/superpowers/specs/2026-08-27-endurecer-facturacion-design.md
-- ============================================================================

begin;

alter table tenants
  add column pago_fallido_desde timestamptz,
  add column cancela_al_terminar boolean not null default false;

create or replace function tenant_puede_escribir(check_tenant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from tenant_usuarios tu
    join tenants t on t.id = tu.tenant_id
    where tu.tenant_id = check_tenant_id
      and tu.user_id = auth.uid()
      and t.estado <> 'suspendido'
  );
$$;

-- SUCURSALES
alter policy "sucursales_write_miembros" on sucursales
  using (tenant_puede_escribir(tenant_id));

-- HORARIOS (via subquery a sucursales)
alter policy "horarios_write_miembros" on horarios
  using (
    tenant_puede_escribir((select tenant_id from sucursales where id = sucursal_id))
  );

-- CATEGORIAS / PRODUCTOS
alter policy "categorias_write_miembros" on categorias
  using (tenant_puede_escribir(tenant_id));
alter policy "productos_write_miembros" on productos
  using (tenant_puede_escribir(tenant_id));

-- MODIFICADORES
alter policy "grupos_mod_write_miembros" on grupos_modificadores
  using (tenant_puede_escribir(tenant_id));
alter policy "opciones_mod_write_miembros" on opciones_modificador
  using (
    tenant_puede_escribir((select tenant_id from grupos_modificadores where id = grupo_id))
  );
alter policy "producto_mod_write_miembros" on producto_modificadores
  using (
    tenant_puede_escribir((select tenant_id from productos where id = producto_id))
  );

-- TENANTS (update): un tenant suspendido tampoco edita los datos del negocio.
alter policy "tenants_update_miembros" on tenants
  using (tenant_puede_escribir(id))
  with check (tenant_puede_escribir(id));

commit;

-- ============================================================================
--  Verificar:
--    select column_name, data_type, column_default
--      from information_schema.columns
--     where table_name = 'tenants'
--       and column_name in ('pago_fallido_desde','cancela_al_terminar');
--    -- 2 filas: pago_fallido_desde (timestamptz, null), cancela_al_terminar (boolean, false)
--
--    select proname from pg_proc where proname = 'tenant_puede_escribir';
--    -- 1 fila
--
--    select polname, qual from pg_policies
--     where tablename in ('sucursales','productos','categorias','tenants')
--       and polname like '%write%' or polname = 'tenants_update_miembros';
--    -- las qual deben mencionar tenant_puede_escribir, no pertenece_a_tenant
--
--    -- Las columnas nuevas NO deben tener grant update a authenticated:
--    select column_name from information_schema.column_privileges
--     where table_name = 'tenants' and grantee = 'authenticated'
--       and privilege_type = 'UPDATE'
--       and column_name in ('pago_fallido_desde','cancela_al_terminar');
--    -- 0 filas
-- ============================================================================
```

- [ ] **Step 2: Aplicar la migración con el MCP**

`apply_migration` del MCP: `project_id: iaiiwtqqiaqxnzxjqcnt`, `name: facturacion_estado`, `query`: el SQL entre `begin;` y `commit;` (sin comentarios de verificación).

- [ ] **Step 3: Verificar la migración con el MCP**

`execute_sql` del MCP, una por una, las 4 queries del bloque de comentarios de verificación. Confirmar todos los resultados esperados antes de seguir. En particular: la última query (`column_privileges`) DEBE devolver 0 filas.

- [ ] **Step 4: Agregar las columnas nuevas al tipo `tenants` en `database.ts`**

En `src/types/database.ts`, dentro de `tenants: {`:

En `Row: {` — después de `nombre_negocio: string;` y antes de `plan_id: string | null;`, agregar (mantener orden alfabético del bloque generado: van entre `logo_url` y `nombre_negocio`... revisar el orden real y colocarlas alfabéticamente — `cancela_al_terminar` va después de `aviso_trial_enviado_at`, `pago_fallido_desde` va después de `nombre_negocio`):

En `Row`:
```typescript
          cancela_al_terminar: boolean;
```
(justo después de `aviso_trial_enviado_at: string | null;`)
```typescript
          pago_fallido_desde: string | null;
```
(justo después de `nombre_negocio: string;`)

En `Insert` (después de `aviso_trial_enviado_at?: ...;` y de `nombre_negocio?: ...;` respectivamente):
```typescript
          cancela_al_terminar?: boolean;
```
```typescript
          pago_fallido_desde?: string | null;
```

En `Update` (mismas posiciones):
```typescript
          cancela_al_terminar?: boolean;
```
```typescript
          pago_fallido_desde?: string | null;
```

- [ ] **Step 5: Verificar tipos**

Run: `bun run typecheck`
Expected: sin errores (nada consume las columnas todavía; el cambio es aditivo).

- [ ] **Step 6: Commit**

```bash
git add src/docs/vibemenu_migracion_facturacion_estado.sql src/types/database.ts
git commit -m "feat: columnas pago_fallido_desde/cancela_al_terminar y RLS tenant_puede_escribir"
```

---

### Task 3: `src/lib/gracia.ts` — cálculo del periodo de gracia (TDD)

**Files:**
- Create: `src/lib/gracia.ts`
- Create: `src/lib/gracia.test.ts`

**Interfaces:**
- Produces:
  - `DIAS_GRACIA = 7` (number)
  - `fechaLimiteGracia(desde: string): Date` — `desde` + 7 días.
  - `graciaVencida(desde: string | null, ahora?: Date): boolean` — `true` si `desde` no es null y ya pasaron ≥ 7 días.
  - Los consumen `AdminLayout` (Task 6, Task 7) y, conceptualmente, el cron de Task 5 (que reimplementa el corte en SQL/Deno, no importa de aquí).

- [ ] **Step 1: Escribir el test primero**

Crear `src/lib/gracia.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { DIAS_GRACIA, fechaLimiteGracia, graciaVencida } from "@/lib/gracia";

describe("DIAS_GRACIA", () => {
  test("son 7 días", () => {
    expect(DIAS_GRACIA).toBe(7);
  });
});

describe("fechaLimiteGracia", () => {
  test("suma 7 días a la fecha de inicio", () => {
    expect(fechaLimiteGracia("2026-08-01T00:00:00.000Z").toISOString()).toBe(
      "2026-08-08T00:00:00.000Z",
    );
  });

  test("conserva la hora del día", () => {
    expect(fechaLimiteGracia("2026-08-01T14:30:00.000Z").toISOString()).toBe(
      "2026-08-08T14:30:00.000Z",
    );
  });
});

describe("graciaVencida", () => {
  test("null (al corriente) nunca está vencida", () => {
    expect(graciaVencida(null)).toBe(false);
  });

  test("dentro de los 7 días: no vencida", () => {
    const hace3dias = new Date("2026-08-01T00:00:00.000Z");
    const ahora = new Date("2026-08-04T00:00:00.000Z");
    expect(graciaVencida(hace3dias.toISOString(), ahora)).toBe(false);
  });

  test("justo en el límite de 7 días: vencida", () => {
    const desde = new Date("2026-08-01T00:00:00.000Z");
    const ahora = new Date("2026-08-08T00:00:00.000Z");
    expect(graciaVencida(desde.toISOString(), ahora)).toBe(true);
  });

  test("pasados los 7 días: vencida", () => {
    const desde = new Date("2026-08-01T00:00:00.000Z");
    const ahora = new Date("2026-08-20T00:00:00.000Z");
    expect(graciaVencida(desde.toISOString(), ahora)).toBe(true);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bun test src/lib/gracia.test.ts`
Expected: FAIL — `Cannot find module '@/lib/gracia'`.

- [ ] **Step 3: Escribir `src/lib/gracia.ts`**

```typescript
/**
 * Periodo de gracia por pago fallido. Cuando Stripe reporta past_due/unpaid,
 * stripe-webhook pone `tenants.pago_fallido_desde = now()` y el tenant conserva
 * acceso completo durante DIAS_GRACIA días con un banner de aviso. Pasado ese
 * plazo, el cron (procesar-trials-vencidos) lo pasa a `estado = 'suspendido'`.
 * Ver docs/superpowers/specs/2026-08-27-endurecer-facturacion-design.md
 */
export const DIAS_GRACIA = 7;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Fecha en la que se acaba la gracia y se bloquea el panel. */
export function fechaLimiteGracia(desde: string): Date {
  return new Date(new Date(desde).getTime() + DIAS_GRACIA * MS_POR_DIA);
}

/** `true` si hay un pago fallido y ya se cumplieron los DIAS_GRACIA. */
export function graciaVencida(desde: string | null, ahora: Date = new Date()): boolean {
  if (!desde) return false;
  return ahora.getTime() >= fechaLimiteGracia(desde).getTime();
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `bun test src/lib/gracia.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Correr la suite de `src/lib` completa**

Run: `bun test src/lib`
Expected: PASS — todo verde, incluyendo los 8 nuevos.

- [ ] **Step 6: Commit**

```bash
git add src/lib/gracia.ts src/lib/gracia.test.ts
git commit -m "feat: helper de periodo de gracia por pago fallido"
```

---

### Task 4: `stripe-webhook` — gracia, recuperación y cancelación ordenada

**Files:**
- Modify: `supabase/functions/stripe-webhook/index.ts`
- Desplegar con `deploy_edge_function` del MCP (`name: stripe-webhook`, `verify_jwt: false`).

**Interfaces:**
- Consumes: columnas `pago_fallido_desde` / `cancela_al_terminar` (Task 2); tabla `eventos_stripe` y guard de idempotencia (Task 1).
- Produces (efectos, sin contrato consumido por otras tareas de código):
  - `past_due`/`unpaid` → `tenants.pago_fallido_desde = coalesce(actual, now())`; NO suspende, NO cierra periodo.
  - `active` tras impago → `pago_fallido_desde = null`, `estado = 'activo'`.
  - `invoice.paid` → además de registrar el pago, `pago_fallido_desde = null`, `estado = 'activo'` para ese `stripe_subscription_id`.
  - `customer.subscription.updated` con `cancel_at_period_end` → `tenants.cancela_al_terminar` = ese booleano.
  - `customer.subscription.deleted` → baja ordenada a plan Free (nueva función `bajarAFree`), NUNCA a `suspendido`.

- [ ] **Step 1: Reemplazar `cerrarPeriodo` por `bajarAFree`**

En `supabase/functions/stripe-webhook/index.ts`, reemplazar la función `cerrarPeriodo` completa (líneas ~232-251) por:

```ts
/**
 * Baja ordenada a Free cuando Stripe borra la suscripcion (cancelacion
 * voluntaria al fin del periodo, o cancelacion automatica de Stripe tras
 * agotar el dunning). NUNCA deja al tenant en 'suspendido': el menu sigue
 * vivo con los limites de Free, igual que cuando vence un trial. El corte
 * por impago con gracia vencida lo hace el cron, no este webhook.
 */
async function bajarAFree(stripeSubscriptionId: string) {
  const { data: fila } = await db
    .from("suscripciones")
    .select("id, tenant_id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .eq("estado", "activa")
    .maybeSingle();
  if (!fila) return;

  await db
    .from("suscripciones")
    .update({
      estado: "cancelada",
      fecha_fin: new Date().toISOString(),
      motivo_cambio: "cancelacion",
    })
    .eq("id", fila.id);

  const { data: planFree } = await db
    .from("planes")
    .select("id")
    .eq("nombre", "free")
    .single();

  const patch: Record<string, unknown> = {
    estado: "activo",
    cancela_al_terminar: false,
    pago_fallido_desde: null,
  };
  if (planFree) patch.plan_id = planFree.id; // dispara el recorte de formatos/tema

  await db.from("tenants").update(patch).eq("id", fila.tenant_id);
}
```

- [ ] **Step 2: Reescribir el caso `customer.subscription.updated`**

Reemplazar el bloque `case "customer.subscription.updated": { ... }` completo (líneas ~344-381) por:

```ts
      case "customer.subscription.updated": {
        const s = evento.data.object;
        await db
          .from("suscripciones")
          .update({ fecha_renovacion: renovacionDe(s) })
          .eq("stripe_subscription_id", s.id)
          .eq("estado", "activa");

        const { tenant_id, plan_id, moneda } = s.metadata ?? {};

        // --- Estado de cobro del tenant --------------------------------------
        if (tenant_id) {
          if (s.status === "past_due" || s.status === "unpaid") {
            // Empieza (o continua) el periodo de gracia. No se pisa una fecha
            // ya puesta -- el conteo de 7 dias arranca en el PRIMER fallo.
            const { data: t } = await db
              .from("tenants")
              .select("pago_fallido_desde")
              .eq("id", tenant_id)
              .single();
            if (t && !t.pago_fallido_desde) {
              await db
                .from("tenants")
                .update({ pago_fallido_desde: new Date().toISOString() })
                .eq("id", tenant_id);
            }
          } else if (s.status === "active") {
            // Recuperado: se limpia la gracia y se reactiva el panel si estaba
            // suspendido.
            await db
              .from("tenants")
              .update({ pago_fallido_desde: null, estado: "activo" })
              .eq("id", tenant_id);
          }

          // El tenant pidio cancelar (o deshizo la cancelacion) desde el portal.
          await db
            .from("tenants")
            .update({ cancela_al_terminar: Boolean(s.cancel_at_period_end) })
            .eq("id", tenant_id);
        }

        // --- Cambio de plan sobre una suscripcion ya activa -----------------
        // (ver crear-checkout) la metadata trae el plan nuevo. Si difiere del
        // vigente en la base, se congela el precio de lista de HOY con el mismo
        // stripe_subscription_id. Idempotente: tras la primera corrida
        // vigente.plan_id ya coincide y un reintento no-op.
        if (tenant_id && plan_id) {
          const { data: vigente } = await db
            .from("suscripciones")
            .select("plan_id")
            .eq("stripe_subscription_id", s.id)
            .eq("estado", "activa")
            .maybeSingle();

          if (vigente && vigente.plan_id !== plan_id) {
            await abrirPeriodo({
              tenantId: tenant_id,
              planId: plan_id,
              moneda: (moneda as "usd" | "mxn") ?? "usd",
              stripeSubscriptionId: s.id,
              fechaRenovacion: renovacionDe(s),
            });
          }
        }
        break;
      }
```

- [ ] **Step 3: Reescribir el caso `customer.subscription.deleted`**

Reemplazar:

```ts
      case "customer.subscription.deleted": {
        await cerrarPeriodo(evento.data.object.id, "cancelada");
        break;
      }
```

por:

```ts
      case "customer.subscription.deleted": {
        await bajarAFree(evento.data.object.id);
        break;
      }
```

- [ ] **Step 4: Limpiar la recuperación en `invoice.paid`**

En el `case "invoice.paid":`, después del bloque que hace `db.from("pagos").upsert(...)` y su `if (error) throw error;`, y antes de `break;`, agregar:

```ts
        // Pago al corriente: si venia de un fallo, se limpia la gracia y se
        // reactiva el panel. Cubre el caso de que customer.subscription.updated
        // con status 'active' no llegue o llegue despues.
        await db
          .from("tenants")
          .update({ pago_fallido_desde: null, estado: "activo" })
          .eq("id", fila.tenant_id);
```

- [ ] **Step 5: Quitar el `type` y firma muertos de `cerrarPeriodo`**

Confirmar que `cerrarPeriodo` ya no se referencia en ningún lado (`grep -n cerrarPeriodo supabase/functions/stripe-webhook/index.ts` → sin resultados tras los pasos anteriores). El `type MotivoCambio` se conserva (lo usa `abrirPeriodo`). Si quedó algún `import`/símbolo sin usar que rompa el deploy, eliminarlo.

- [ ] **Step 6: Desplegar `stripe-webhook` con el MCP**

`deploy_edge_function` del MCP: `project_id: iaiiwtqqiaqxnzxjqcnt`, `name: stripe-webhook`, `entrypoint_path: index.ts`, `verify_jwt: false`, `files: [{ name: "index.ts", content: "<archivo completo>" }]`.

- [ ] **Step 7: Verificar el despliegue con el MCP**

`get_edge_function` del MCP (`function_slug: stripe-webhook`). Confirmar que el `content` contiene `bajarAFree` y `cancela_al_terminar`, y NO contiene `cerrarPeriodo`. `verify_jwt` sigue `false`.

- [ ] **Step 8: Prueba de humo con el MCP**

`execute_sql` del MCP:
```sql
select id, tipo from eventos_stripe order by recibido_at desc limit 5;
```
(Solo para confirmar que la tabla responde; puede venir vacía si no ha llegado ningún webhook real todavía — no es un fallo.)

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "feat: gracia por pago fallido y baja a Free al cancelar en stripe-webhook"
```

---

### Task 5: `procesar-trials-vencidos` — suspender tras la gracia vencida

**Files:**
- Modify: `supabase/functions/procesar-trials-vencidos/index.ts`
- Desplegar con `deploy_edge_function` del MCP (`name: procesar-trials-vencidos`, `verify_jwt: true`).

**Interfaces:**
- Consumes: `tenants.pago_fallido_desde` (Task 2).
- Produces: tenants con `pago_fallido_desde` de hace ≥ 7 días y `estado <> 'suspendido'` pasan a `estado = 'suspendido'`. La respuesta JSON incluye un contador nuevo `suspendidos`.

- [ ] **Step 1: Agregar el bloque de suspensión**

En `supabase/functions/procesar-trials-vencidos/index.ts`, después del bloque `// ---- 2. Vencimiento ...` (termina con el `for` que calcula `bajados`) y antes del `return new Response(...)` final, agregar:

```ts
  // ---- 3. Pago fallido: suspender tras 7 dias de gracia -----------------
  // stripe-webhook pone pago_fallido_desde en el PRIMER past_due/unpaid y lo
  // limpia si el tenant se pone al corriente. Aqui se corta a los que llevan
  // >= 7 dias sin regularizar. La suscripcion de Stripe NO se toca: sigue su
  // propio dunning; si al final Stripe la borra, cae en subscription.deleted
  // -> baja a Free. Ver docs/superpowers/specs/2026-08-27-endurecer-facturacion-design.md
  const DIAS_GRACIA = 7;
  const limiteGracia = new Date(ahora - DIAS_GRACIA * msPorDia).toISOString();

  const { data: enGracia, error: errorGracia } = await db
    .from("tenants")
    .select("id")
    .lt("pago_fallido_desde", limiteGracia)
    .neq("estado", "suspendido");

  if (errorGracia) {
    console.error("error consultando gracia vencida:", errorGracia);
    return new Response(JSON.stringify({ error: errorGracia.message }), { status: 500 });
  }

  let suspendidos = 0;
  for (const t of enGracia ?? []) {
    const { error } = await db
      .from("tenants")
      .update({ estado: "suspendido" })
      .eq("id", t.id);
    if (!error) suspendidos++;
  }
```

- [ ] **Step 2: Incluir `suspendidos` en la respuesta**

Cambiar el `return` final:

```ts
  return new Response(JSON.stringify({ ok: true, avisados, bajados }), {
```
por:
```ts
  return new Response(JSON.stringify({ ok: true, avisados, bajados, suspendidos }), {
```

- [ ] **Step 3: Actualizar el comentario de cabecera de la función**

En el comentario de bloque del inicio del archivo, donde enumera "Hace dos cosas sobre los tenants...", cambiarlo a "Hace tres cosas:" y agregar la línea 3: `//   3. Suspende (estado='suspendido') a los tenants con pago fallido cuya\n//      gracia de 7 dias ya vencio (pago_fallido_desde lo pone stripe-webhook).`

- [ ] **Step 4: Desplegar con el MCP**

`deploy_edge_function` del MCP: `project_id: iaiiwtqqiaqxnzxjqcnt`, `name: procesar-trials-vencidos`, `entrypoint_path: index.ts`, `verify_jwt: true`, `files: [{ name: "index.ts", content: "<archivo completo>" }]`.

- [ ] **Step 5: Verificar y probar con el MCP**

`get_edge_function` del MCP (`function_slug: procesar-trials-vencidos`): confirmar que el `content` contiene `suspendidos` y `pago_fallido_desde`.

`execute_sql` del MCP para confirmar que la query del bloque nuevo es válida contra el esquema real:
```sql
select id from tenants
 where pago_fallido_desde < now() - interval '7 days'
   and estado <> 'suspendido';
```
Expected: 0 filas (nadie tiene un pago fallido todavía) — sin error de SQL.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/procesar-trials-vencidos/index.ts
git commit -m "feat: el cron suspende a los tenants con gracia de pago vencida"
```

---

### Task 6: `<PanelBloqueado/>` + guard de suspensión en `AdminLayout`

**Files:**
- Create: `src/components/layout/PanelBloqueado.tsx`
- Modify: `src/components/layout/AdminLayout.tsx`

**Interfaces:**
- Consumes: `ctx.tenant.estado` (`useTenantActual`); `usePortalStripe` (`@/hooks/useStripe`); `cerrarSesion` (`@/hooks/useSesion`).
- Produces: cuando `ctx.tenant.estado === "suspendido"`, `AdminLayout` renderiza `<PanelBloqueado tenantId={ctx.tenant.id} />` en lugar de todo el panel (sidebar, header, `children`). Es la barrera de UI que acompaña al backstop de RLS de Task 2.

- [ ] **Step 1: Crear `PanelBloqueado.tsx`**

Crear `src/components/layout/PanelBloqueado.tsx`:

```tsx
import { useState } from "react";
import { CreditCard, Loader2, LogOut } from "lucide-react";
import { usePortalStripe } from "@/hooks/useStripe";
import { cerrarSesion } from "@/hooks/useSesion";

/**
 * Pantalla que reemplaza al panel completo cuando el tenant quedo
 * `estado = 'suspendido'` -- pago fallido con el periodo de gracia ya vencido
 * (ver src/lib/gracia.ts y el cron procesar-trials-vencidos). El menu publico
 * del comensal sigue vivo; esto solo bloquea la administracion. Se sale por el
 * portal de Stripe (actualizar metodo de pago) o cerrando sesion.
 */
export default function PanelBloqueado({ tenantId }: { tenantId: string }) {
  const portal = usePortalStripe();
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="grid min-h-screen place-items-center bg-white px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-vm-danger-soft">
          <CreditCard className="size-7 text-vm-danger" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl text-vm-ink">Tu plan está suspendido</h1>
        <p className="mt-3 text-sm leading-relaxed text-vm-body">
          No pudimos cobrar tu suscripción y el periodo para regularizar ya venció. Tu menú
          público sigue en línea, pero la administración queda bloqueada hasta que actualices tu
          método de pago.
        </p>

        <button
          type="button"
          disabled={portal.isPending}
          onClick={() => {
            setError(null);
            portal.mutateAsync(tenantId).catch((e: Error) => setError(e.message));
          }}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover disabled:opacity-50"
        >
          {portal.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <CreditCard className="size-4" aria-hidden />
          )}
          Actualizar método de pago
        </button>

        {error && <p className="mt-3 text-sm text-vm-danger">{error}</p>}

        <button
          type="button"
          onClick={() => void cerrarSesion()}
          className="mt-4 inline-flex items-center gap-2 text-xs text-vm-body hover:text-vm-ink"
        >
          <LogOut className="size-3.5" aria-hidden />
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Enganchar el guard en `AdminLayout`**

En `src/components/layout/AdminLayout.tsx`:

Agregar el import (junto a los demás de `@/components/...`):
```tsx
import PanelBloqueado from "@/components/layout/PanelBloqueado";
```

En el cuerpo de `AdminLayout`, después del bloque `if (!ctx) { ... }` y antes de `const urlMenu = ...`, agregar:
```tsx
  if (ctx.tenant.estado === "suspendido") {
    return <PanelBloqueado tenantId={ctx.tenant.id} />;
  }
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `bun run typecheck && bun run lint`
Expected: sin errores.

- [ ] **Step 4: Prueba manual**

Run: `bun run dev`
Con `execute_sql` del MCP, forzar el estado de un tenant de prueba: `update tenants set estado = 'suspendido' where id = '<tenant-de-prueba>';`. Entrar a `/admin` como ese tenant → debe verse `<PanelBloqueado/>`, sin sidebar ni header. Revertir: `update tenants set estado = 'activo' where id = '<tenant-de-prueba>';`.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/PanelBloqueado.tsx src/components/layout/AdminLayout.tsx
git commit -m "feat: pantalla de panel bloqueado para tenants suspendidos"
```

---

### Task 7: Banner de gracia y de cancelación en `AdminLayout` + nota en `Suscripcion.tsx`

**Files:**
- Create: `src/components/layout/BannerFacturacion.tsx`
- Modify: `src/components/layout/AdminLayout.tsx`
- Modify: `src/pages/admin/Suscripcion.tsx`

**Interfaces:**
- Consumes: `ctx.tenant.pago_fallido_desde`, `ctx.tenant.cancela_al_terminar` (Task 2); `fechaLimiteGracia` (`@/lib/gracia`, Task 3); `usePortalStripe`; `suscripcionActiva` + `useHistorialSuscripciones` (para la fecha de renovación en el banner de cancelación).
- Produces: `<BannerFacturacion ctx={ctx} />` — barra fija arriba del `<main>` del panel. Muestra el banner de gracia (urgente, con CTA al portal) si `pago_fallido_desde` y no suspendido; el banner de cancelación (informativo) si `cancela_al_terminar`; nada si ninguno aplica.

- [ ] **Step 1: Crear `BannerFacturacion.tsx`**

Crear `src/components/layout/BannerFacturacion.tsx`:

```tsx
import { useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import type { ContextoTenant } from "@/hooks/useTenantActual";
import { useHistorialSuscripciones, suscripcionActiva } from "@/hooks/useSuscripciones";
import { usePortalStripe } from "@/hooks/useStripe";
import { fechaLimiteGracia } from "@/lib/gracia";

const FECHA = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "long", year: "numeric" });

/**
 * Barra de aviso de facturacion. Dos estados posibles, excluyentes:
 *  - Gracia por pago fallido (urgente): `pago_fallido_desde` con fecha y el
 *    tenant aun no suspendido. Cuenta regresiva a fechaLimiteGracia + boton al
 *    portal de Stripe. (Si ya esta suspendido, AdminLayout muestra
 *    <PanelBloqueado/> y este componente no llega a renderizar.)
 *  - Cancelacion programada (informativo): `cancela_al_terminar`. Dice cuando
 *    baja a Free. Sin CTA -- el tenant puede reactivar desde el portal si quiere.
 */
export default function BannerFacturacion({ ctx }: { ctx: ContextoTenant }) {
  const portal = usePortalStripe();
  const [error, setError] = useState<string | null>(null);
  const { data: historial } = useHistorialSuscripciones(ctx.tenant.id, ctx.esOwner);

  if (ctx.tenant.pago_fallido_desde) {
    const limite = FECHA.format(fechaLimiteGracia(ctx.tenant.pago_fallido_desde));
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-vm-danger/30 bg-vm-danger-soft px-4 py-2.5 text-sm text-vm-danger md:px-8">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          No pudimos cobrar tu plan. Regulariza antes del <strong>{limite}</strong> para no
          perder el acceso al panel.
        </span>
        <button
          type="button"
          disabled={portal.isPending}
          onClick={() => {
            setError(null);
            portal.mutateAsync(ctx.tenant.id).catch((e: Error) => setError(e.message));
          }}
          className="font-medium underline underline-offset-2 hover:no-underline disabled:opacity-50"
        >
          Actualizar método de pago
        </button>
        {error && <span className="w-full text-xs">{error}</span>}
      </div>
    );
  }

  if (ctx.tenant.cancela_al_terminar) {
    const activa = suscripcionActiva(historial ?? undefined);
    const cuando = activa?.fecha_renovacion
      ? FECHA.format(new Date(activa.fecha_renovacion))
      : "el fin de tu periodo";
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-vm-warning/30 bg-vm-warning-soft px-4 py-2.5 text-sm text-vm-warning md:px-8">
        <Info className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          Tu plan termina el <strong>{cuando}</strong>. Después tu menú baja a Free
          automáticamente, sin perder tu información.
        </span>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: Montar el banner en `AdminLayout`**

En `src/components/layout/AdminLayout.tsx`:

Import:
```tsx
import BannerFacturacion from "@/components/layout/BannerFacturacion";
```

En el JSX, dentro de `<div className="flex min-w-0 flex-col">`, entre el `</header>` y `<main ...>`, agregar:
```tsx
        <BannerFacturacion ctx={ctx} />
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `bun run typecheck && bun run lint`
Expected: sin errores.

- [ ] **Step 4: Nota contextual en `Suscripcion.tsx`**

En `src/pages/admin/Suscripcion.tsx`, dentro de `Contenido`, justo después del bloque `{activa.fecha_renovacion && ( ... )}` (línea ~395-398, dentro del mismo contenedor donde vive ese texto de "Se renueva el ..."), agregar:

```tsx
{tenant.cancela_al_terminar && (
  <p className="mt-2 rounded-lg bg-vm-warning-soft px-3.5 py-2.5 text-xs text-vm-warning">
    Cancelaste la renovación. El{" "}
    {activa?.fecha_renovacion ? fecha(activa.fecha_renovacion) : "fin del periodo"} tu plan baja
    a Free automáticamente. Puedes reactivarlo desde “Administrar facturación” antes de esa
    fecha.
  </p>
)}
```

`tenant`, `activa` y el helper `fecha` ya existen en ese componente (líneas 38, 344, y `tenant` en el bloque de estado ~369). `activa` puede ser `null` — por eso el `?.` y el fallback.

- [ ] **Step 5: Verificar tipos y lint de nuevo**

Run: `bun run typecheck && bun run lint`
Expected: sin errores.

- [ ] **Step 6: Prueba manual**

Run: `bun run dev`. Con `execute_sql` del MCP contra un tenant de prueba:
- `update tenants set pago_fallido_desde = now() - interval '2 days' where id = '<t>';` → banner rojo de gracia con fecha límite +5 días, botón al portal. Panel accesible.
- `update tenants set pago_fallido_desde = null, cancela_al_terminar = true where id = '<t>';` → banner ámbar informativo, sin CTA de pago.
- Revertir: `update tenants set pago_fallido_desde = null, cancela_al_terminar = false where id = '<t>';`

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/BannerFacturacion.tsx src/components/layout/AdminLayout.tsx src/pages/admin/Suscripcion.tsx
git commit -m "feat: banner de gracia por pago fallido y de cancelación programada"
```

---

### Task 8: QA final + checklist de entrega

**Files:** ninguno nuevo — verificación de todo lo anterior.

- [ ] **Step 1: Suite completa**

Run: `bun test src/lib && bun run typecheck && bun run lint && bun run build`
Expected: todo en verde, incluyendo el build de producción.

- [ ] **Step 2: Revisar `git status` antes de subir**

Run: `git status --short`
Repo compartido con otras sesiones — confirmar que no se sube nada ajeno.

- [ ] **Step 3: Verificación de esquema con el MCP**

`execute_sql` del MCP, confirmar de un jalón:
```sql
select
  (select count(*) from information_schema.columns
    where table_name='tenants' and column_name in ('pago_fallido_desde','cancela_al_terminar')) as columnas_tenant,
  (select count(*) from pg_proc where proname='tenant_puede_escribir') as fn_rls,
  (select count(*) from pg_tables where tablename='eventos_stripe') as tabla_eventos,
  (select count(*) from information_schema.column_privileges
    where table_name='tenants' and grantee='authenticated' and privilege_type='UPDATE'
      and column_name in ('pago_fallido_desde','cancela_al_terminar')) as grants_indebidos;
```
Expected: `columnas_tenant = 2`, `fn_rls = 1`, `tabla_eventos = 1`, `grants_indebidos = 0`.

- [ ] **Step 4: Confirmar los despliegues con el MCP**

`get_edge_function` para `stripe-webhook` (contiene `eventos_stripe`, `bajarAFree`, `cancela_al_terminar`; NO contiene `cerrarPeriodo`; `verify_jwt=false`) y `procesar-trials-vencidos` (contiene `suspendidos`; `verify_jwt=true`).

- [ ] **Step 5: Prueba manual del ciclo de cambio de plan (modo test de Stripe)**

Con llaves de Stripe en modo test y un tenant de prueba en plan Pro:
1. Cambiar a Enterprise desde `/admin/suscripcion`; luego de vuelta a Pro; luego a Pro anual.
2. En el Dashboard de Stripe (modo test): **una sola** suscripción activa para ese customer.
3. `execute_sql` del MCP:
   ```sql
   select estado, count(*) from suscripciones where tenant_id = '<t>' group by estado;
   ```
   Expected: exactamente una fila `activa` = 1; el resto en `reemplazada`.
4. Reenviar (Resend events / "Resend" en el Dashboard) uno de los `customer.subscription.updated` ya entregados → confirmar en `select * from eventos_stripe where id = '<evt>'` que existe una sola fila y que no se creó una segunda fila de historial.

- [ ] **Step 6: Prueba manual del ciclo de gracia → suspensión → recuperación**

1. `execute_sql`: `update tenants set pago_fallido_desde = now() - interval '8 days' where id='<t>';`
2. Invocar el cron a mano: en GitHub Actions, "Procesar trials vencidos" → "Run workflow" (o `curl` con los secretos). Confirmar en la respuesta `suspendidos >= 1`.
3. `select estado from tenants where id='<t>';` → `suspendido`. Entrar a `/admin` → `<PanelBloqueado/>`.
4. Simular recuperación: `update tenants set estado='activo', pago_fallido_desde=null where id='<t>';` → panel normal.
5. Revertir cualquier cambio de prueba.

- [ ] **Step 7: Push a `dev`, luego merge a `main`**

Mismo patrón del repo: push directo a `dev`; luego `git checkout -b main-pushN origin/main`, `git merge dev`, `git push origin main-pushN:main`, volver a `dev`, borrar la rama temporal. (Lovable sincroniza `dev` — no reescribir historia ya subida.)

- [ ] **Step 8: Entregar al usuario el checklist manual**

Fuera del repo, nada de código:
1. **Regenerar tipos de Supabase** cuando haya un momento tranquilo: `generate_typescript_types` del MCP y comparar contra `src/types/database.ts` — el hand-edit del Task 2 debe coincidir con lo generado; si difiere, sobrescribir la parte generada conservando el bloque `/* Aliases de dominio */` en adelante.
2. **Revisar la configuración de dunning en Stripe** (Dashboard → Settings → Billing → Subscriptions and emails): saber si al agotar reintentos Stripe deja la suscripción en `unpaid` o la cancela. Ambos casos ya están cubiertos (uno cae en el cron de gracia, el otro en `subscription.deleted` → Free), pero conviene tenerlo claro.
3. **Confirmar el primer caso real**: cuando un tenant real falle un pago, seguir en el Dashboard de Stripe + `select * from eventos_stripe order by recibido_at desc` que el circuito completo (gracia → banner → suspensión al día 7 → recuperación) funciona de punta a punta.
