# Vibemenu — Conectar Stripe

Tres Edge Functions y un `UPDATE`. Nada de esto se puede hacer desde el frontend:
el `service_role_key` y el `STRIPE_SECRET_KEY` solo viven en las funciones.

---

## 1. Productos y precios en Stripe — ✅ HECHO (modo prueba)

Creados vía API el 2026-07-09 y verificados: monto correcto, recurrentes mensuales,
activos, `livemode = false`.

| Plan       | Producto              | USD/mes | MXN/mes |
| ---------- | --------------------- | ------- | ------- |
| Basic      | `prod_Ur3t2RdivMtBau` | $9      | $169    |
| Pro        | `prod_Ur3thZ5PDt8HuB` | $19     | $349    |
| Enterprise | `prod_Ur3tjthLSaF4bO` | $39     | $699    |

Cada precio tiene un `lookup_key` (`vibemenu_pro_mxn`, etc.) para poder
encontrarlo sin depender del id.

**Al pasar a producción hay que rehacer todo esto con la llave `sk_live_`.**
Los `price_id` de prueba no sirven en live.

---

## 2. Cargar los price_id en la base — pendiente

Ejecuta [`vibemenu_stripe_price_ids.sql`](./vibemenu_stripe_price_ids.sql) en el
SQL Editor. Ya trae los seis ids reales.

Hasta que corra, `/admin/suscripcion` deshabilita los botones de cambio de plan y
muestra un aviso. El estado sale de la base, no de una bandera en el código.

---

## 3. Desplegar las Edge Functions

```bash
npx supabase login
npx supabase link --project-ref iaiiwtqqiaqxnzxjqcnt

# El webhook NO lleva JWT: Stripe no manda un token de Supabase.
npx supabase functions deploy stripe-webhook --no-verify-jwt

npx supabase functions deploy crear-checkout
npx supabase functions deploy portal-stripe
npx supabase functions deploy invitar-encargado
```

---

## 4. Secretos

Dashboard → Edge Functions → Secrets. `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY` suelen inyectarse solos; los de Stripe no.

```bash
npx supabase secrets set STRIPE_SECRET_KEY=rk_test_...
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

`stripe-webhook` también necesita `RESEND_API_KEY` desde que manda el aviso de pago fallido
(ver `vibemenu_emails.md`, sección 6). Los secretos de Edge Functions son por **proyecto**, no
por función — si ya lo configuraste para `invitar-encargado`, no hace falta repetirlo.

### Sobre la llave restringida (`rk_`)

Se probaron los cinco permisos que el código necesita, y la llave de prueba los
tiene todos:

| Acción                       | Quién la usa                                  |
| ---------------------------- | --------------------------------------------- |
| Crear checkout session       | `crear-checkout`                              |
| Crear customer               | Stripe Checkout, al primer pago               |
| Crear billing portal session | `portal-stripe`                               |
| Leer subscriptions           | `stripe-webhook`, para la fecha de renovación |
| Leer products y prices       | `crear-checkout`                              |

Si al pasar a producción creas otra llave restringida, dale esos mismos permisos
o el checkout devolverá 403.

⚠️ El `service_role_key` y la llave de Stripe **jamás** van en `.env.local` ni con
prefijo `VITE_`. Cualquier variable que empiece con `VITE_` acaba en el bundle que
descarga el navegador.

---

## 5. Registrar el webhook en Stripe

Esto lo haces tú. El `whsec_…` no debe pasar por un chat ni por el repo: cópialo
directo del Dashboard de Stripe al de Supabase.

Dashboard de Stripe → **Developers → Webhooks → Add endpoint**.

**Endpoint URL:**

```
https://iaiiwtqqiaqxnzxjqcnt.supabase.co/functions/v1/stripe-webhook
```

**Eventos a escuchar** — exactamente estos cinco, ninguno más:

| Evento                          | Qué hace                                                      |
| ------------------------------- | ------------------------------------------------------------- |
| `checkout.session.completed`    | Congela el precio y abre el periodo nuevo                     |
| `customer.subscription.updated` | Sincroniza la fecha de renovación; marca `vencida` si no paga |
| `customer.subscription.deleted` | Marca `cancelada` y suspende el tenant                        |
| `invoice.paid`                  | Guarda el recibo en `pagos`                                   |
| `invoice.payment_failed`        | Manda el correo de aviso de pago fallido (no cambia estado)   |

⚠️ **Confirmado el 2026-08-21: en modo LIVE no hay ningún webhook endpoint registrado todavía**
(`GET /v1/webhook_endpoints` devuelve vacío). Si ya hay tenants pagando de verdad en live, hoy
Vibemenu no se entera de nada — ni de pagos, ni de cancelaciones, ni de pagos fallidos. Este es
el paso que falta hacer, con los cinco eventos de arriba.

**Versión de la API:** deja la de tu cuenta. El código fija
`apiVersion: "2024-12-18.acacia"` en el cliente de Stripe.

Al guardar, Stripe te muestra el **Signing secret** (`whsec_…`). Ese valor es el
`STRIPE_WEBHOOK_SECRET` del paso 4. Sin él, la función rechaza todo con
`firma invalida`, que es justo lo que debe hacer.

### Por qué solo esos cinco eventos

Suscribirse a más no rompe nada, pero cada evento extra es una llamada a tu Edge
Function que el `switch` ignora. Con miles de tenants eso cuesta.

---

## 6. Cron del trial — secretos aparte

`procesar-trials-vencidos` no la llama el frontend ni Stripe: la dispara
`.github/workflows/procesar-trials.yml` una vez al día. Necesita dos secretos que no comparte
con nada más:

- **Supabase → Edge Functions → Secrets:** `CRON_SECRET` (candado propio de la función — sin
  él, cualquiera podría dispararla a mano y forzar el vencimiento de trials).
- **GitHub → Settings → Secrets and variables → Actions:**
  - `TRIALS_CRON_SECRET` — el mismo valor que `CRON_SECRET` arriba, exacto.
  - `SUPABASE_SERVICE_ROLE_KEY` — el mismo que ya usan las Edge Functions (el workflow lo manda
    como `Authorization: Bearer` para pasar `verify_jwt=true`).

Sin estos dos, el workflow corre pero la función devuelve 401 — revisa la pestaña Actions del
repo si el trial nunca avisa ni vence a nadie.

---

## Cómo funciona el precio congelado

Lo hace `abrirPeriodo()` en `stripe-webhook`:

1. Lee el precio de lista **de hoy** desde `planes`.
2. Cierra la fila `activa` del tenant: `estado = 'reemplazada'`, `fecha_fin = now()`.
3. Inserta una fila nueva con `precio_congelado_usd` y `precio_congelado_mxn`
   copiados de ese momento — **las dos monedas**, aunque solo se cobre una.
4. Actualiza `tenants.plan_id` y `tenants.estado = 'activo'`.

El `motivo_cambio` se deduce comparando el precio de lista anterior con el nuevo:
más caro es `upgrade`, más barato es `downgrade`, igual es `reactivacion`.

Cambiar `tenants.plan_id` dispara `trg_tenants_20_formatos` y `trg_tenants_25_tema`,
que **recortan en silencio** los formatos y el tema a lo que permita el plan nuevo.
Por eso un downgrade nunca deja al tenant con un menú que su plan no soporta.

`suscripciones` no tiene policy de `insert` ni de `update` en RLS. Solo el
`service_role_key` la escribe. El owner únicamente puede leer su historial.

---

## Probar antes de cobrar de verdad

```bash
npx supabase functions serve stripe-webhook --no-verify-jwt
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
stripe trigger checkout.session.completed
```

Después revisa la base:

```sql
select s.estado, s.motivo_cambio, s.precio_congelado_mxn, s.fecha_fin, p.nombre
  from suscripciones s join planes p on p.id = s.plan_id
 order by s.fecha_inicio desc;
```

Debe haber **una sola fila `activa`**. Si hay dos, el índice único parcial
`uniq_suscripcion_activa_por_tenant` habría fallado — y no debería poder.

---

## Lo que ya existe (esta sección estaba desactualizada)

**Recibos y facturación: ✅ ya existe**, contrario a lo que decía esta sección antes. La tabla
`pagos` está creada (`vibemenu_migracion_pagos.sql`), cuelga de `suscripciones.id`, y el
webhook ya la alimenta en el evento `invoice.paid`. `src/hooks/usePagos.ts` y
`/admin/suscripcion` ya la consumen.

**Precios anuales: ✅ ya existe** (2026-08-21, `vibemenu_migracion_precios_anuales.sql`). 6
`Price` nuevos en Stripe (`interval: "year"`, 10 meses por 12 — ~17% de descuento), sus ids en
`planes.stripe_price_id_{usd,mxn}_anual`, y `/precios` + `/admin/suscripcion` ya dejan elegir
mensual/anual. `crear-checkout` recibe `intervalo` (`"mensual"` por default) y elige el price
correcto. El precio congelado (`suscripciones.precio_congelado_*`) sigue siendo el mensual de
referencia sin importar el intervalo — Stripe ya protege el monto real de la suscripción
existente por su cuenta, cambiar un `Price` nunca altera retroactivamente una suscripción ya
creada.

**Trial de 14 días con Pro: ✅ ya existe** (2026-08-21, `vibemenu_migracion_trial_pro.sql`). Todo
tenant nuevo nace en el plan Pro (antes nacía directo en Free) sin pedir tarjeta.
`procesar-trials-vencidos` (Edge Function con cron diario, ver
`.github/workflows/procesar-trials.yml`) avisa 3 días antes y baja a Free automáticamente a
quien no se suscribió — reutiliza los mismos triggers de downgrade que ya existían. Ver
`vibemenu_emails.md` para el correo.

**Webhook registrado en modo live: ✅ ya existe** (2026-08-21). Endpoint
`we_1U6uxUEWXMEt3EVbVWBgmzYb` con los 5 eventos de la tabla de arriba, `status: enabled`.
Probado con `procesar-trials-vencidos` respondiendo 200 con el `CRON_SECRET` real.

**El producto suelto ya no está activo.** `prod_UCvck2gbDgTkPy` ("Monthly Vibe Menu") y sus dos
precios se archivaron el 2026-08-21 (`active: false` — Stripe no deja borrar un `Price` que ya
se usó, archivarlo es el equivalente real). Ya no aparece en listados activos ni se puede volver
a cobrar; queda en el historial de Stripe por si algún pago viejo lo referencia.

## Lo que NO existe todavía

Nada pendiente de esta lista por ahora — la próxima revisión debería confirmar que los tres
secretos nuevos (`CRON_SECRET` en Supabase; `TRIALS_CRON_SECRET` y `SUPABASE_SERVICE_ROLE_KEY`
en GitHub) siguen correctos si algún día se rota alguno.

**Cobro por moneda automático.** El tenant elige USD o MXN en el checkout, y esa
elección se guarda en `suscripciones.moneda_cobro`. No hay detección por IP.
