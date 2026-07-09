# Vibemenu — Conectar Stripe

Tres Edge Functions y un `UPDATE`. Nada de esto se puede hacer desde el frontend:
el `service_role_key` y el `STRIPE_SECRET_KEY` solo viven en las funciones.

---

## 1. Productos y precios en Stripe — ✅ HECHO (modo prueba)

Creados vía API el 2026-07-09 y verificados: monto correcto, recurrentes mensuales,
activos, `livemode = false`.

| Plan | Producto | USD/mes | MXN/mes |
|---|---|---|---|
| Basic | `prod_Ur3t2RdivMtBau` | $9 | $169 |
| Pro | `prod_Ur3thZ5PDt8HuB` | $19 | $349 |
| Enterprise | `prod_Ur3tjthLSaF4bO` | $39 | $699 |

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

### Sobre la llave restringida (`rk_`)

Se probaron los cinco permisos que el código necesita, y la llave de prueba los
tiene todos:

| Acción | Quién la usa |
|---|---|
| Crear checkout session | `crear-checkout` |
| Crear customer | Stripe Checkout, al primer pago |
| Crear billing portal session | `portal-stripe` |
| Leer subscriptions | `stripe-webhook`, para la fecha de renovación |
| Leer products y prices | `crear-checkout` |

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

**Eventos a escuchar** — exactamente estos tres, ninguno más:

| Evento | Qué hace |
|---|---|
| `checkout.session.completed` | Congela el precio y abre el periodo nuevo |
| `customer.subscription.updated` | Sincroniza la fecha de renovación; marca `vencida` si no paga |
| `customer.subscription.deleted` | Marca `cancelada` y suspende el tenant |

**Versión de la API:** deja la de tu cuenta. El código fija
`apiVersion: "2024-12-18.acacia"` en el cliente de Stripe.

Al guardar, Stripe te muestra el **Signing secret** (`whsec_…`). Ese valor es el
`STRIPE_WEBHOOK_SECRET` del paso 4. Sin él, la función rechaza todo con
`firma invalida`, que es justo lo que debe hacer.

### Por qué solo esos tres eventos

Suscribirse a más no rompe nada, pero cada evento extra es una llamada a tu Edge
Function que el `switch` ignora. Con miles de tenants eso cuesta.

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

## Lo que NO existe todavía

**Recibos y facturación.** El historial ya guarda todo lo necesario, pero no hay
tabla `pagos`. Cuando toque, cuelga de `suscripciones.id` y se alimenta del evento
`invoice.paid`. La columna "Recibo" de `/admin/suscripcion` ya está reservada.

**Cobro por moneda automático.** El tenant elige USD o MXN en el checkout, y esa
elección se guarda en `suscripciones.moneda_cobro`. No hay detección por IP.
