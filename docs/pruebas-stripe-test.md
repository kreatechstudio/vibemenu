# Guion de prueba del ciclo de cobro (Stripe en modo test)

Corre esto **una vez** antes de abrir cobros reales. Prueba el ciclo completo:
alta → cambio de plan → fallo de pago → periodo de gracia → suspensión →
recuperación → cancelación → baja a Free, y que cada transición se vea bien en
`/superadmin`.

Todo pasa en **modo test** de Stripe. No se cobra dinero real.

---

## Antes de empezar

1. **Stripe en modo test.** Arriba a la izquierda del dashboard de Stripe, el
   switch "Test mode" encendido. Los `price_id` de test son distintos a los de
   producción — revisa que `planes.stripe_price_id_*` en la base tenga los de
   **test** mientras dure la prueba, o usa un proyecto/tenant que apunte a ellos.

2. **Secrets de la Edge Function en test.** La función `stripe-webhook` debe
   tener, durante la prueba, `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` **de
   test** (empiezan con `sk_test_` y `whsec_...` del endpoint de test). Si hoy
   tiene los de producción, la prueba no sirve.
   - Registra un endpoint de webhook de test que apunte a
     `https://iaiiwtqqiaqxnzxjqcnt.supabase.co/functions/v1/stripe-webhook` con
     estos eventos: `checkout.session.completed`,
     `customer.subscription.updated`, `customer.subscription.deleted`,
     `invoice.paid`, `invoice.payment_failed`.
   - Copia su "Signing secret" a `STRIPE_WEBHOOK_SECRET`.
   - **Al terminar la prueba, vuelve a poner los secrets de producción.**

3. **Un tenant de prueba** recién creado, con un correo tuyo real (para ver los
   correos que manda Vibemenu). Anota su `tenant_id`.

4. **Tarjetas de prueba de Stripe:**
   | Tarjeta | Qué hace |
   |---|---|
   | `4242 4242 4242 4242` | Pago exitoso siempre |
   | `4000 0000 0000 0341` | Falla al cobrar la **renovación** (el primer cobro pasa) |
   | `4000 0000 0000 9995` | Fondos insuficientes (falla desde el primer cobro) |
   Fecha de expiración: cualquiera futura. CVC: cualquiera. CP: cualquiera.

5. **Test clock (para no esperar 30 días).** Stripe → Developers → **Test
   clocks** → "New test clock". Crea el clock, y al hacer el checkout asigna el
   customer a ese clock (o créalo desde el clock). Para adelantar el tiempo:
   "Advance time" hasta la fecha que necesites. Cada avance dispara los webhooks
   de renovación/dunning como si el tiempo real hubiera pasado.

### Cómo revisar la base

Con el conector de Supabase o el SQL editor:

```sql
select estado, plan_id, pago_fallido_desde, cancela_al_terminar, trial_iniciado_at
from tenants where id = '<tenant_id>';

select estado, motivo_cambio, fecha_inicio, fecha_fin, fecha_renovacion,
       precio_congelado_mxn, moneda_cobro
from suscripciones where tenant_id = '<tenant_id>' order by fecha_inicio;

select tipo, recibido_at from eventos_stripe order by recibido_at desc limit 10;
```

---

## Paso 1 — Alta (primera suscripción)

**Qué hacer:** desde el panel del tenant, `/admin/suscripcion`, elige un plan de
pago (ej. Pro mensual, MXN) → checkout → paga con `4242 4242 4242 4242`.

**Qué revisar:**
- [ ] `tenants.estado = 'activo'` y `tenants.plan_id` = el del plan elegido.
- [ ] Una fila en `suscripciones`: `estado = 'activa'`, `motivo_cambio = 'alta'`,
      `precio_congelado_mxn`/`precio_congelado_usd` con los precios de lista de
      hoy, `moneda_cobro` correcta, `fecha_renovacion` ~1 mes adelante.
- [ ] `eventos_stripe` tiene `checkout.session.completed` (y no lo procesa dos
      veces si Stripe reintenta).
- [ ] Llega el **correo de bienvenida** al negocio.
- [ ] En `/superadmin`: el tenant no lleva ningún badge extra en "Estado" (Pagando
      es el estado normal, sin badge), con monto en "Suscripción activa" y fecha en
      "Renueva". El MRR sube.

## Paso 2 — Cambio de plan (upgrade y downgrade)

**Qué hacer:** en `/admin/suscripcion` (o el portal de cliente de Stripe), sube
a Enterprise. Luego baja a Basic.

**Qué revisar (cada cambio):**
- [ ] La fila anterior queda `estado = 'reemplazada'` con `fecha_fin` = ahora.
- [ ] Nueva fila `estado = 'activa'` con `motivo_cambio`:
      `'upgrade'` al subir, `'downgrade'` al bajar (se deduce por precio, no por
      nombre).
- [ ] `tenants.plan_id` actualizado.
- [ ] Al **bajar** de plan: formatos y tema se recortan a lo que permite el plan
      nuevo (revisa `/admin/diseño` — si tenía un formato o color que Basic no
      da, ya no está activo). Los **datos no se borran**: productos, sucursales y
      usuarios de más siguen en la base (el bloqueo retroactivo de eso es otro
      proyecto aparte).
- [ ] `/superadmin` muestra el plan nuevo y el monto congelado nuevo.

## Paso 3 — Fallo de pago (entra el periodo de gracia)

**Qué hacer:** cambia el método de pago del customer a `4000 0000 0000 0341`
(en el portal de Stripe o desde el dashboard). Avanza el test clock hasta la
`fecha_renovacion`. Stripe intenta cobrar y falla → dispara
`invoice.payment_failed`.

**Qué revisar:**
- [ ] `tenants.pago_fallido_desde` queda puesto (fecha del primer fallo).
- [ ] `tenants.estado` **sigue `'activo'`** — NO se suspende todavía.
- [ ] Llega el **correo de aviso de pago fallido**.
- [ ] En el panel del tenant se ve el **banner de periodo de gracia** (7 días).
- [ ] El menú público sigue funcionando normal.
- [ ] En `/superadmin` el tenant lleva el badge ámbar **"Pago pendiente"** en "Estado".

## Paso 4 — Gracia vencida (suspensión)

**Qué hacer:** avanza el test clock **más de 7 días** desde `pago_fallido_desde`.
Luego corre el cron manualmente: GitHub → Actions → **"Procesar trials
vencidos"** → "Run workflow". (Ese cron también hace el corte por gracia
vencida.)

**Qué revisar:**
- [ ] `tenants.estado = 'suspendido'`.
- [ ] Al entrar al panel del tenant se ve **`PanelBloqueado`** (no puede editar
      nada).
- [ ] El **menú público sigue en línea**, con los límites de Free.
- [ ] La suscripción en Stripe NO se tocó — sigue su propio dunning.
- [ ] En `/superadmin` el badge de "Estado" muestra **"suspendido"** (rojo).

## Paso 5 — Recuperación

**Qué hacer:** paga la factura pendiente (portal de Stripe, o cambia la tarjeta
a `4242…` y reintenta el cobro). Dispara `invoice.paid`.

**Qué revisar:**
- [ ] `tenants.pago_fallido_desde = null`.
- [ ] `tenants.estado = 'activo'`.
- [ ] El panel se **desbloquea**.
- [ ] La suscripción sigue siendo la misma fila `activa` (no se crea una nueva).

## Paso 6 — Cancelación

**Qué hacer:** en el portal de cliente de Stripe, **cancela la suscripción** (al
final del periodo). Dispara `customer.subscription.updated` con
`cancel_at_period_end = true`.

**Qué revisar (inmediato):**
- [ ] `tenants.cancela_al_terminar = true`.
- [ ] `tenants.estado` sigue `'activo'` — conserva el plan hasta
      `fecha_renovacion`.
- [ ] En `/superadmin`: badge ámbar **"Cancela al terminar · {fecha}"** en la
      lista, y **"Cancela el {fecha}"** en la ficha.

**Qué hacer (después):** avanza el test clock más allá de `fecha_renovacion`.
Stripe borra la suscripción → `customer.subscription.deleted`.

**Qué revisar:**
- [ ] La fila de `suscripciones` queda `estado = 'cancelada'`,
      `motivo_cambio = 'cancelacion'`, `fecha_fin` puesta.
- [ ] `tenants.plan_id` = Free, `tenants.estado = 'activo'`,
      `tenants.cancela_al_terminar = false`.
- [ ] Formatos/tema recortados a Free. Datos no borrados.
- [ ] En `/superadmin`: el tenant ahora sale como **Bajó · {fecha}**, cuenta en
      el total **"Bajas (30 d)"**, y aparece con el filtro **"Bajas"**. El MRR
      baja.

## Paso 7 — Revisión final en `/superadmin`

- [ ] Recorre la lista: cada tenant de prueba muestra el badge de situación
      correcto en "Estado" — "Pago pendiente", "suspendido", "Cancela al terminar ·
      {fecha}" o "Bajó · {fecha}". Un tenant al corriente no lleva badge extra.
- [ ] Abre la ficha de uno: el bloque **"Pagos"** tiene el historial con recibos
      de Stripe; el historial de plan cuadra con lo que hiciste.
- [ ] Los totales de arriba (Activos, MRR, Bajas 30 d) reflejan la realidad.

---

## Checklist para abrir cobros reales

- [ ] Los 7 pasos pasaron sin sorpresas.
- [ ] Ningún correo se duplicó por reintentos de Stripe (idempotencia por
      `eventos_stripe`).
- [ ] Ninguna fila de historial se duplicó.
- [ ] Un tenant suspendido nunca perdió su menú público.
- [ ] Un tenant que bajó de plan conservó sus datos (solo se recortó
      formato/tema).
- [ ] **Los secrets de la Edge Function `stripe-webhook` volvieron a los de
      producción** (`sk_live_…`, el `whsec_…` del endpoint live).
- [ ] `planes.stripe_price_id_*` tiene de vuelta los `price_id` de producción.
- [ ] El endpoint de webhook **live** en Stripe está activo y con los 5 eventos.
- [ ] Borraste o archivaste los datos de prueba (tenant, test clock).
