# Dominios personalizados: proceso completo (diseño)

Estado al 2026-08-21: la columna, el trigger de validación y la UI de captura del
dominio ya existen (migración 013, `Empresa.tsx`). Lo que falta es el ciclo de vida
completo después de que el tenant guarda su dominio — hoy es 100% manual y sin
ningún estado visible. Este documento describe cómo se cierra ese hueco.

## Objetivo

Que un tenant en plan Pro/Enterprise pueda configurar su dominio propio y, sin que
nadie de KreaTech tenga que tocar el dashboard de Vercel a mano, termine viendo su
menú respondiendo en ese dominio — con visibilidad de estado tanto para el tenant
como para KreaTech en todo momento.

## Lo que ya existe (no se toca)

- `tenants.dominio_personalizado` — columna, formato validado, único, gateada a
  planes con `permite_dominio_propio` (`src/docs/vibemenu_migracion_dominio.sql`).
- `Empresa.tsx` — captura del dominio con feedback de disponibilidad en vivo.
- `routes/index.tsx` — resuelve el tenant por `Host` de la petición vía
  `getRequestHost()` y sirve `MenuPublico` en `/` si hay match; cae al landing si
  no hay match (no rompe nada si el DNS aún no propaga).

## Qué se agrega

### 1. Estado del dominio (`tenants.dominio_estado`)

Columna nueva, `text`, valores `null` (sin dominio) / `'pendiente'` / `'verificado'`.
Se modifica el trigger `validar_dominio_tenant()` (mismo archivo de migración,
nueva migración incremental) para que, cuando `dominio_personalizado` cambie a un
valor no nulo, ponga `dominio_estado = 'pendiente'`; si se limpia el dominio,
`dominio_estado` vuelve a `null`.

### 2. Alta automática en Vercel

Edge Function nueva `agregar-dominio-vercel`, invocada desde `Empresa.tsx` justo
después de que el `UPDATE` a `tenants` tiene éxito (fire-and-forget, mismo patrón
que `enviar-bienvenida`: si falla, no bloquea el guardado — el tenant no ve un
error técnico interno, el registro simplemente se queda en `pendiente` para que el
reintento del cron o el botón manual lo resuelva después).

La función recibe el `tenant_id`, relee el dominio actual con `service_role` (no
confía en el valor que mande el cliente) y llama:

```
POST https://api.vercel.com/v10/projects/{VERCEL_PROJECT_ID}/domains?teamId={VERCEL_TEAM_ID}
Authorization: Bearer {VERCEL_API_TOKEN}
Body: { "name": "<dominio>" }
```

Un `400` porque el dominio ya existe en el proyecto se trata como éxito (idempotente
— pasa si el tenant guarda dos veces sin cambiar nada, o si ya se había agregado a
mano antes de este cambio).

### 3. Verificación automática

Edge Function nueva `verificar-dominios-pendientes`, sin parámetros, protegida por
un secreto compartido en el header (mismo patrón que ya protege
`procesar-trials-vencidos`). Recorre los tenants con `dominio_estado = 'pendiente'`
y para cada uno llama:

```
POST https://api.vercel.com/v9/projects/{VERCEL_PROJECT_ID}/domains/{dominio}/verify?teamId={VERCEL_TEAM_ID}
```

(`POST /verify` en vez de solo `GET`: fuerza a Vercel a re-evaluar el DNS en ese
momento, en vez de leer un estado que pudo quedar cacheado desde el alta.) Si la
respuesta trae `verified: true`, se actualiza `dominio_estado = 'verificado'` y se
manda un correo de marca por Resend a los dueños del tenant avisando que su dominio
ya está listo (mismo patrón de plantillas que los demás correos del ciclo de vida).

Se dispara por un workflow de GitHub Actions con cron diario, igual que
`procesar-trials-vencidos.yml`. Además, en `SuperAdmin.tsx` se agrega un botón
"Verificar ahora" que invoca la misma función on-demand, para no depender del cron
si alguien quiere confirmar al momento.

### 4. Enrutamiento de sucursales bajo dominio propio

Hoy `routes/index.tsx` solo resuelve la página principal del menú por host. Un
tenant Pro puede tener hasta 3 sucursales — sin esto, los links de sucursal se
romperían bajo un dominio propio. Se agrega una ruta nueva `routes/sucursal.$sucursalSlug.tsx`
(fuera del prefijo `$slug`, mismo nivel que `index.tsx`) que repite exactamente el
mismo patrón de detección de host, y una función `obtenerSucursalPublicaPorDominio`
en `useMenuPublico.ts` que hace el mismo query que ya existe para
`$slug.sucursal.$sucursalSlug.tsx` pero filtrando por `dominio_personalizado` en vez
de `slug`.

### 5. Visibilidad de estado

- `Empresa.tsx`: en vez del texto estático de instrucciones DNS, se muestra el
  registro exacto que devuelve Vercel en la respuesta de alta (`verification`), más
  un badge de estado (`Pendiente de verificar` / `Verificado ✅`) leído de
  `dominio_estado`.
- `SuperAdmin.tsx`: la pill de advertencia estática se reemplaza por el estado real,
  más el botón "Verificar ahora" del punto 3.

## Decisiones tomadas y por qué

- **Por qué `POST /verify` y no solo `GET` para checar estado**: `GET` devuelve el
  último estado que Vercel tiene cacheado, que puede no reflejar que el DNS ya se
  configuró bien hace una hora. `POST /verify` lo re-evalúa en el momento — más
  lento pero siempre correcto, y el volumen esperado (unos pocos tenants con
  dominio propio) hace la diferencia de costo irrelevante.
- **Por qué el alta en Vercel es fire-and-forget y no bloquea el guardado**: el
  `UPDATE` a `tenants` ya pasó por el trigger de validación (formato, unicidad,
  plan) — eso es lo único que de verdad puede fallar por culpa del tenant. Que la
  llamada a Vercel falle (token vencido, rate limit) es un problema nuestro, no
  del tenant, y no debería impedirle guardar su dominio.
- **Costo**: agregar dominios por API es la misma función gratis que hacerlo a mano
  en el dashboard — Vercel no cobra por dominio conectado a un proyecto, ni por
  las llamadas a esta API al volumen que se espera aquí. Existe un código de error
  documentado (`custom_domain_needs_upgrade`) para cuentas sin plan de pago, pero
  el proyecto ya tiene 5 dominios conectados hoy en el plan Hobby actual (incluido
  `vibemenu.com.mx`), lo que confirma en la práctica que agregar más no requiere
  upgrade. Si Vercel llegara a devolver ese error de todos modos, el dominio se
  queda en `pendiente` — mismo comportamiento seguro que cualquier otra falla de
  la API, visible y sin bloquear nada.

## Lo que sigue siendo manual (no se puede automatizar)

Que el dueño del restaurante entre a su propio proveedor de dominio (GoDaddy,
Namecheap, el que sea) y cree el registro DNS que le mostramos — eso vive fuera de
cualquier sistema que controlemos, por definición.

## Fuera de alcance de esta primera versión

- Reintentos con backoff o expiración de dominios que nunca verifican (se quedan en
  `pendiente` indefinidamente; visible en SuperAdmin, sin urgencia para el volumen
  actual).
- Certificados/dominios wildcard o subdominios múltiples por tenant.
- Mover o quitar un dominio de Vercel cuando el tenant lo cambia por otro (la
  versión anterior se queda huérfana en el proyecto de Vercel; limpieza manual
  ocasional, volumen bajo).
