# Endurecer facturación — Diseño

**Fecha:** 2026-08-27
**Rama:** dev
**Origen:** Auditoría Vibemenu (artifact `8d645623`), sección 02 "Pagos y suscripciones" y sección 07 "Por dónde empezar" (P0).

## Problema

Tres huecos en el ciclo de cobro, confirmados con lectura de código línea por línea:

1. **Webhooks no idempotentes.** De los 5 eventos de Stripe que maneja `stripe-webhook`, solo `invoice.paid` deduplica (por `stripe_invoice_id`). Un reintento de Stripe en `checkout.session.completed`, `customer.subscription.updated/deleted` o `invoice.payment_failed` puede duplicar una fila de historial o repetir un correo. `checkout.session.completed` tiene un guard ad-hoc (revisa si ya hay suscripción activa) pero no es dedup real por evento.
2. **`estado = 'suspendido'` no restringe nada.** Cuando Stripe reporta `past_due`/`unpaid`, `customer.subscription.updated` marca `tenants.estado = 'suspendido'` de inmediato — sin periodo de gracia — y ese estado no bloquea nada: ni una policy de RLS lo filtra, ni el frontend hace más que cambiar el color de un badge. Un tenant "suspendido" conserva acceso completo al panel.
3. **Cancelación sin efecto real.** `customer.subscription.deleted` marca la baja pero deja al tenant en `suspendido` (mismo problema de arriba). No hay concepto de "acceso hasta fin de periodo" ni baja ordenada a Free.

## Decisiones tomadas (con el usuario, 2026-08-27)

- **Pago fallido:** periodo de gracia de 7 días con banner de aviso y acceso completo; pasados los 7 días sin regularizar, se bloquea el panel de administración. **El menú público del comensal nunca se cae** por un problema de cobro.
- **Cancelación voluntaria:** el tenant conserva acceso a su plan pagado hasta el fin del periodo ya cobrado (`cancel_at_period_end`); cuando Stripe borra la suscripción al terminar el periodo, baja de forma ordenada a plan **Free** (no a `suspendido`) — el menú sigue vivo con los límites del plan gratuito, igual que cuando vence un trial.
- **Limpieza de dominios huérfanos en Vercel:** fuera de alcance de esta sesión (Track B).

## Alcance

1. Idempotencia real de los 5 webhooks de Stripe, por `evento.id`.
2. Periodo de gracia de 7 días + bloqueo del panel al vencer, para pago fallido.
3. Cancelación con acceso hasta fin de periodo + baja ordenada a Free.
4. Backstop de RLS: un tenant `suspendido` no puede escribir contenido ni con llamadas directas a Supabase (no solo bloqueo de UI).
5. QA manual del fix de cambio de plan ya existente (una sola suscripción activa por tenant).

## Fuera de alcance

- Track B (dominios personalizados: DNS real de Vercel, estado de error, SSL, DELETE, edge cases).
- Recibos fiscales / timbrado (ver `vibemenu_stripe.md` §7).
- Reintentos con backoff propios sobre la API de Stripe (Stripe ya hace dunning).
- Correos nuevos de ciclo de vida más allá de reutilizar el de pago fallido que ya existe.

---

## Diseño

### 1. Idempotencia de webhooks (`evento.id`)

**Migración** — tabla nueva:

```sql
create table eventos_stripe (
  id          text primary key,          -- evt_... de Stripe
  tipo        text not null,
  recibido_at timestamptz not null default now()
);
alter table eventos_stripe enable row level security;
-- Sin policies: solo el service_role_key (que ya usa stripe-webhook) la toca.
```

**`stripe-webhook/index.ts`** — justo después de verificar la firma y antes del `switch`:

```ts
const { error: errDup } = await db
  .from("eventos_stripe")
  .insert({ id: evento.id, tipo: evento.type });

// 23505 = unique_violation: Stripe ya nos mandó este evento y lo procesamos.
if (errDup?.code === "23505") {
  return new Response(JSON.stringify({ duplicado: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
if (errDup) throw errDup; // fallo real de DB → 500 → Stripe reintenta
```

- Dedup **al inicio**, siguiendo la guía oficial de Stripe ("responde 200 rápido, deduplica por `event.id`"). El riesgo de que el handler lance excepción *después* del insert está acotado: `abrirPeriodo` ya comprueba la suscripción vigente y `cerrarPeriodo` la fila activa — son de suyo casi idempotentes.
- El guard ad-hoc de `checkout.session.completed` (revisa `yaActiva`) se **conserva** como defensa en profundidad.
- `invoice.paid` conserva su `upsert ... ignoreDuplicates` (redundante ahora, inofensivo).

### 2. Periodo de gracia + bloqueo (pago fallido)

**Migración** — columna nueva:

```sql
alter table tenants add column pago_fallido_desde timestamptz;
-- null = al corriente. Con fecha = inicio del periodo de gracia de 7 días.
```

**`stripe-webhook` — `customer.subscription.updated`:**

- `s.status in ('past_due','unpaid')` → **ya no** llama `cerrarPeriodo`. En su lugar: `update tenants set pago_fallido_desde = coalesce(pago_fallido_desde, now()) where id = <tenant>` (no se pisa una fecha ya puesta). La suscripción sigue `activa`, `estado` sigue `activo`.
- `s.status === 'active'` → recuperado: `update tenants set pago_fallido_desde = null, estado = 'activo'`.

**`stripe-webhook` — `invoice.paid`:** además de registrar el pago, `update tenants set pago_fallido_desde = null, estado = 'activo'` para esa suscripción (recuperación por si el `updated` no llega).

**Cron (`procesar-trials-vencidos` — se le agrega un tercer bloque):**

- Tenants con `pago_fallido_desde < now() - interval '7 days'` y `estado <> 'suspendido'` → `update tenants set estado = 'suspendido'`. La suscripción NO se toca (Stripe sigue su propio dunning; si al final la borra, cae en `subscription.deleted` → baja a Free, ver §3).
- Se renombra el archivo de función mentalmente a "tareas diarias de facturación" pero se mantiene el nombre `procesar-trials-vencidos` para no re-desplegar cron ni secretos.

**Frontend:**

- `useTenantActual` ya trae `tenants.*` completo → `pago_fallido_desde` queda disponible sin cambios de query. Regenerar `src/types/database.ts`.
- `src/lib/gracia.ts` (nuevo, con test):
  - `graciaVencida(desde: string | null, ahora = new Date()): boolean`
  - `fechaLimiteGracia(desde: string): Date` (desde + 7 días)
  - `DIAS_GRACIA = 7`
- `AdminLayout`:
  - `ctx.tenant.estado === 'suspendido'` → renderiza `<PanelBloqueado/>` en lugar de `children`: pantalla de marca "Tu plan está suspendido por un pago pendiente", botón "Actualizar método de pago" → `portal-stripe`, y "Cerrar sesión". El header/sidebar no se renderizan.
  - `pago_fallido_desde` con fecha y `estado !== 'suspendido'` → banner fijo arriba del `<main>` en todas las rutas admin: "No pudimos cobrar tu plan. Regulariza antes del {fechaLimiteGracia} para no perder el acceso." + botón al portal.
- El menú público (`routes/index.tsx`, `$slug`, sucursales) **no cambia**: no consulta `estado` para decidir si servir.

### 3. Cancelación (acceso hasta fin de periodo → Free)

**Migración** — columna nueva:

```sql
alter table tenants add column cancela_al_terminar boolean not null default false;
```

**`stripe-webhook` — `customer.subscription.updated`:**

- Leer `s.cancel_at_period_end`. `update tenants set cancela_al_terminar = <bool> where id = <tenant>` (cubre tanto marcar como des-marcar si el tenant reactiva desde el portal).

**`stripe-webhook` — `customer.subscription.deleted`:** cambia el comportamiento actual.
Hoy: `cerrarPeriodo(id, "cancelada")` → `tenants.estado = 'suspendido'`.
Nuevo: función `bajarAFree(stripeSubscriptionId)`:

1. `suscripciones`: la fila `activa` de ese `stripe_subscription_id` → `estado = 'cancelada'`, `fecha_fin = now()`, `motivo_cambio = 'cancelacion'`.
2. `planes`: `select id where nombre = 'free'`.
3. `tenants`: `update set plan_id = <free>, estado = 'activo', cancela_al_terminar = false, pago_fallido_desde = null where id = <tenant>`.
   - Cambiar `plan_id` dispara `trg_tenants_20_formatos` y `trg_tenants_25_tema` (recorte de formatos/tema), igual que un downgrade a mano o el vencimiento de trial.
4. `stripe_customer_id` se conserva (para un futuro re-alta desde el portal).

`cerrarPeriodo` con `"vencida"` deja de invocarse desde el webhook (el vencimiento por impago ahora es el bloque de cron de §2). Se puede borrar la rama `"vencida"` de `cerrarPeriodo` o dejar la función solo para `"cancelada"` interno — el plan lo decide; lo importante es que ningún camino deja un tenant en `suspendido` de forma permanente salvo el impago con gracia vencida.

**Frontend:**

- `cancela_al_terminar === true` → banner (distinto color al de gracia, informativo no urgente): "Tu plan {Plan} termina el {fecha_renovacion de la suscripción activa}. Después tu menú baja a Free automáticamente." Sin bloqueo, sin CTA de pago (puede reactivar desde el portal si quiere).
- `Suscripcion.tsx` ya muestra el historial; añadir ahí el mismo aviso con más contexto.

### 4. Backstop de RLS

**Migración** — función + swap de policies:

```sql
create or replace function tenant_puede_escribir(check_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from tenant_usuarios tu
    join tenants t on t.id = tu.tenant_id
    where tu.tenant_id = check_tenant_id
      and tu.user_id = auth.uid()
      and t.estado <> 'suspendido'
  );
$$;
```

Swap `using (pertenece_a_tenant(tenant_id))` → `using (tenant_puede_escribir(tenant_id))` (y el `with check` equivalente) en las policies de escritura de: `sucursales`, `horarios` (vía subquery), `categorias`, `productos`, `grupos_modificadores`, `opciones_modificador` (vía subquery), `producto_modificadores` (vía subquery), `precios_sucursal` (vía subquery), y `tenants` (update).

> Nota: `precios_sucursal` se omitió en la migración `facturacion_estado` original y se agregó como migración de seguimiento `facturacion_estado_precios` (`src/docs/vibemenu_migracion_facturacion_estado_precios.sql`).

- Lecturas públicas (`*_select_publico`) **sin cambios** — el menú del comensal sigue leyendo todo.
- `suscripciones_select_owner` / `pagos` sin cambios (escritura ya es solo service_role).
- `tenant_usuarios`: **sin cambios** — bloquear su `insert` rompería el onboarding (`crear_owner_al_registrar_tenant`), y un tenant suspendido gestionando su equipo no es un riesgo de cobro.
- `cancelado` como valor de `estado` deja de usarse en la práctica (cancelación → Free), pero se mantiene en el `check` del schema por compatibilidad.

### 5. QA del fix de cambio de plan

Tarea final del plan, manual, en modo test de Stripe:

1. Suscribir un tenant a Pro mensual.
2. Cambiar a Enterprise; luego de vuelta a Pro; luego a Pro anual.
3. Confirmar en el Dashboard de Stripe: **una sola** suscripción activa por tenant.
4. Confirmar en Supabase: **una sola** fila `suscripciones.estado = 'activa'` por tenant, con el `precio_congelado_*` correcto y el historial en `reemplazada`.
5. El test `src/lib/checkout.test.ts` sigue en verde.

---

## Testing

- **Lógica pura (`bun test src/lib`):** `src/lib/gracia.ts` (nuevo) con casos para `graciaVencida` y `fechaLimiteGracia`. Cualquier helper de formato de fecha del banner también va con test.
- **Edge Functions:** sin tests de Bun (Deno, fuera de `src/lib` — patrón establecido). Se verifican con los pasos manuales de QA (§5) y la lista de entrega.
- **Front:** `bun run typecheck` + `bun run lint` + `bun run build` + prueba manual en `bun dev` de los tres estados (gracia con banner, suspendido con `<PanelBloqueado/>`, `cancela_al_terminar` con banner informativo) forzando los valores de columna a mano en Supabase.

## Migraciones (archivos `.sql` en `src/docs/`, aplicar por MCP de Supabase si está disponible; si no, a mano en el SQL Editor)

1. `vibemenu_migracion_eventos_stripe.sql` — tabla `eventos_stripe`.
2. `vibemenu_migracion_facturacion_estado.sql` — columnas `pago_fallido_desde`, `cancela_al_terminar`; función `tenant_puede_escribir`; swap de las policies de escritura de contenido.

## Entrega manual (fuera del repo)

- Desplegar `stripe-webhook` y `procesar-trials-vencidos` (MCP `deploy_edge_function` o CLI).
- Regenerar `src/types/database.ts`.
- Confirmar en el Dashboard de Stripe la configuración de dunning (qué hace Stripe al agotar reintentos: dejar `unpaid` o cancelar — ambos casos quedan cubiertos, pero conviene saberlo).
- Verificar que el cron `procesar-trials.yml` sigue corriendo (no cambia; solo se le agrega un bloque a la función que llama).

## Global Constraints

- Todo el código nuevo, comentarios y copy en español, mismo tono que el repo (ver `enviar-bienvenida`, `procesar-trials-vencidos`).
- Ningún cambio puede tumbar el menú público del comensal por estado de cobro.
- El único lugar que escribe en `suscripciones` sigue siendo `stripe-webhook` con `service_role`.
- Las Edge Functions nuevas o modificadas conservan `verify_jwt` como está (`stripe-webhook`: sin verificación; el resto: como esté).
- `dominio_estado` y todo lo de Track B queda intacto.
- Migraciones: archivo `.sql` versionado + aplicación por MCP; nunca `bun test` para migraciones.
