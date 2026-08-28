# Endurecer dominios personalizados — Diseño

**Fecha:** 2026-08-28
**Rama:** dev
**Origen:** Auditoría Vibemenu (artifact `8d645623`), sección 02 "Dominio propio" y sección 07 "Por dónde empezar" (P0 de dominios).
**Predecesor:** `src/docs/vibemenu_dominio_personalizado.md` (primera versión del ciclo de vida, 2026-08-21). Este documento endurece esa base; no la reemplaza.

## Problema

Cinco huecos en el ciclo de vida del dominio propio, confirmados con lectura de código línea por línea:

1. **Instrucciones DNS hardcodeadas y con heurística rota.** `Empresa.tsx` decide apex vs. subdominio contando puntos (`dominio.split(".").length > 2`) y muestra registros DNS estáticos (`76.76.21.21` / `cname.vercel-dns.com`). La heurística falla justo con TLDs compuestos como `.com.mx`: `tienda.com.mx` (apex real, 3 partes) se trata como subdominio y se le muestra un CNAME donde necesita un registro A. Además, si Vercel cambia sus targets recomendados, las instrucciones quedan desactualizadas sin aviso.
2. **Sin estado de error.** `tenants.dominio_estado` solo tiene `null` / `'pendiente'` / `'verificado'`. Si el DNS está mal configurado, el dueño ve "pendiente de verificar" indefinidamente, sin ningún mensaje de qué está mal.
3. **Se avisa "listo" antes de que el HTTPS funcione.** `verificar-dominios-pendientes` manda el correo "tu dominio está listo" en cuanto Vercel responde `verified: true`. Eso solo confirma que el DNS apunta bien — no que el certificado TLS ya se emitió. Hay una ventana donde Vibemenu dice "listo" pero el navegador del comensal todavía no puede cargar por HTTPS.
4. **Ninguna llamada `DELETE` a Vercel.** Cuando un tenant quita o cambia su dominio, la fila de `tenants` se actualiza pero el dominio queda registrado en el proyecto de Vercel para siempre. No hay limpieza de ningún tipo.
5. **Sin manejo de rate limit (429) de la API de Vercel.** El cron recorre todos los tenants pendientes en un loop sin pausa ni reintento; un `429` tumba la corrida completa en silencio.

Adicional (decisión de negocio): **un downgrade de plan no revoca el dominio propio.** Hoy el trigger solo valida cuando la columna cambia, así que un tenant que baja de Pro a Free conserva su dominio activo indefinidamente.

## Decisiones tomadas (con el usuario, 2026-08-27)

- **Alcance:** todo el bloque de dominio propio en un solo plan (instrucciones DNS reales, estado de error, confirmación de SSL, limpieza de huérfanos, manejo de 429).
- **Correo "tu dominio está listo":** se manda solo cuando una petición HTTPS real al dominio responde sin error de TLS — confirma que el certificado ya sirve tráfico. Nuevo estado `listo`.
- **Estado de error para el dueño:** se muestra el motivo exacto que devuelve Vercel (registro faltante, apunta mal) inline en `Empresa.tsx` en cuanto exista; además, un correo de recordatorio una sola vez si el dominio sigue sin verificar 72 h después de asignarse.
- **Downgrade de plan:** al bajar a un plan sin `permite_dominio_propio`, el dominio propio se revoca — el menú deja de responder ahí y el dominio pasa a la cola de limpieza de Vercel. Un correo avisa al dueño.
- **Limpieza de huérfanos:** solo barrido nocturno (no un `DELETE` síncrono al quitar el dominio).

## Alcance

1. Máquina de estados ampliada: `null → pendiente → verificado → listo`, con el motivo de error de Vercel persistido y visible.
2. Instrucciones DNS derivadas de la respuesta real de Vercel (`apexName`/`name` + `GET /v6/domains/{domain}/config`), no de una heurística local. Arregla `.com.mx`.
3. Confirmación de HTTPS real antes de avisar "listo".
4. Correo de recordatorio a las 72 h para dominios atorados en `pendiente`.
5. Barrido nocturno que borra de Vercel los dominios que ya ningún tenant usa.
6. Revocación del dominio propio al bajar de plan.
7. Manejo de `429` de la API de Vercel (secuencial, respeta `Retry-After`, corta la corrida si insiste).

## Fuera de alcance

- Re-chequeo de dominios ya en `listo` que se rompan después (DNS que el dueño cambia más tarde). Visible en SuperAdmin si alguien reporta; sin urgencia al volumen actual.
- Manejo de `conflict_aliases` en el `DELETE` de Vercel (requiere quitar aliases antes). Se loguea y se reintenta la siguiente noche; volumen bajo.
- Wildcards, apex + `www` automático, o múltiples subdominios por tenant.
- Reintentos con backoff exponencial y expiración dura de dominios que nunca verifican.

## Lo que ya existe (contexto, no se reescribe la base)

- `tenants.dominio_personalizado` — columna, formato validado por regex, único, gateado a `permite_dominio_propio` (migración 013).
- `tenants.dominio_estado` — `null` / `'pendiente'` / `'verificado'`, mantenido por el trigger `validar_dominio_tenant()` (migración 018).
- `agregar-dominio-vercel` — Edge Function fire-and-forget invocada desde `Empresa.tsx` tras guardar; `POST /v10/projects/{id}/domains`.
- `verificar-dominios-pendientes` — Edge Function con dos disparadores: cron diario (`verificar-dominios.yml`, secreto `DOMINIO_CRON_SECRET`) que revisa todos los `pendiente`, y botón "Verificar ahora" en `SuperAdmin.tsx` (sesión de super-admin, un tenant). `POST /v9/.../verify`; re-alta en `404`; correo "listo" por Resend al verificar.
- `routes/index.tsx` + `routes/sucursal.$sucursalSlug.tsx` — resuelven el tenant/sucursal por `Host` de la petición; caen al landing si no hay match.
- `src/lib/dominio.ts` — `normalizarDominio`, `validarFormatoDominio` (cortesía de UI; la validación real vive en el trigger).

## API de Vercel — referencia usada en este diseño

| Uso | Endpoint | Campos que importan |
|---|---|---|
| Alta | `POST /v10/projects/{id}/domains?teamId=` body `{name}` | `{ name, apexName, verified, verification?: [{type,domain,value,reason}] }`; `400` si ya existe (= éxito idempotente) |
| Forzar re-chequeo DNS | `POST /v9/projects/{id}/domains/{domain}/verify?teamId=` | `{ verified }`; `404` = nunca se registró |
| Config y registros recomendados | `GET /v6/domains/{domain}/config?projectIdOrName={id}&teamId=` | `{ misconfigured, recommendedIPv4[], recommendedCNAME[], acceptedChallenges[] }` — `misconfigured:false` ⇒ DNS ok **y** se puede emitir cert |
| Listado del proyecto | `GET /v9/projects/{id}/domains?teamId=` | `domains[]`, paginado |
| Baja | `DELETE /v9/projects/{id}/domains/{domain}?teamId=` | `200` = borrado; `404` = ya no estaba (= éxito); `409 conflict_aliases` = fuera de alcance |

`apexName === name` ⇒ el dominio es apex (necesita registro A). `apexName !== name` ⇒ subdominio (necesita CNAME). Esto reemplaza por completo la heurística de contar puntos.

## Arquitectura

### 1. Máquina de estados

```
null ──asignar──> pendiente ──DNS ok──> verificado ──HTTPS ok──> listo
  ^                   │                                             │
  └────limpiar────────┴──────────────revocar/limpiar───────────────┘
```

| Estado | Significado | Transición de entrada | Efecto visible |
|---|---|---|---|
| `null` | sin dominio | trigger, al limpiar o revocar | — |
| `pendiente` | dominio guardado y dado de alta en Vercel; DNS aún no válido | trigger, al asignar un dominio nuevo | instrucciones DNS; a las 72 h, bloque de error + correo |
| `verificado` | `verified:true` **y** `misconfigured:false`; certificado emitiéndose | cron / botón manual | "DNS correcto, activando certificado" |
| `listo` **(nuevo)** | `fetch("https://<dominio>/")` respondió sin error de TLS | cron / botón manual | "Verificado y sirviendo tráfico"; **aquí se manda el correo "listo"** |

El **motivo de error no es un estado**. Se guarda el último diagnóstico de Vercel en `tenants.dominio_diagnostico` y la UI lo pinta en rojo siempre que `misconfigured` sea `true` o haya `verification[].reason`, independientemente del estado.

Una sola corrida del cron puede llevar un dominio de `pendiente` a `listo` de un jalón (verify → config → HTTPS, en secuencia).

### 2. Esquema (una migración incremental)

```sql
-- dominio_estado: agregar 'listo' al check existente
alter table tenants drop constraint dominio_estado_valido;
alter table tenants add constraint dominio_estado_valido check (
  dominio_estado is null or dominio_estado in ('pendiente', 'verificado', 'listo')
);

-- diagnóstico de Vercel (lo escriben solo las Edge Functions con service_role)
alter table tenants add column dominio_diagnostico jsonb;
-- forma: { name, apexName, misconfigured, verification: [{type,domain,value,reason}],
--          recommendedIPv4: [], recommendedCNAME: [], revisado_at: <iso> }

alter table tenants add column dominio_asignado_at timestamptz;   -- trigger; mide las 72 h
alter table tenants add column dominio_aviso_error_at timestamptz; -- edge fn; correo 72 h una sola vez
alter table tenants add column dominio_revocado_por_plan boolean not null default false; -- trigger; lo lee limpiar-dominios-huerfanos

-- cola de limpieza de Vercel
create table dominios_huerfanos (
  dominio text primary key,
  tenant_id uuid references tenants(id) on delete set null,
  creado_at timestamptz not null default now(),
  borrado_at timestamptz
);
alter table dominios_huerfanos enable row level security;  -- sin policies: solo service_role
```

**Todo vive en una sola función, `validar_dominio_tenant()` (se extiende).** Sigue siendo `before insert or update on tenants for each row`; ya se dispara ante cualquier `update`. Orden lógico dentro de la función:

1. **Revocación por downgrade (primero):** si `tg_op = 'UPDATE'`, `new.plan_id` cambió, el plan nuevo no tiene `permite_dominio_propio`, y `old.dominio_personalizado is not null` → `new.dominio_personalizado := null` y `new.dominio_revocado_por_plan := true` (columna boolean nueva, default `false`; la lee `limpiar-dominios-huerfanos` para decidir si manda el correo "se desactivó"). Se cae al paso 2 con el dominio ya en `null`.
2. **Detección de cambio:** si `new.dominio_personalizado is not distinct from old.dominio_personalizado` → `return new` (nada que hacer).
3. **Encolar huérfano:** si `old.dominio_personalizado is not null` → `insert into dominios_huerfanos (dominio, tenant_id) values (old.dominio_personalizado, old.id) on conflict (dominio) do update set borrado_at = null, creado_at = now()`.
4. **Asignación nueva** (`new.dominio_personalizado` no nulo): valida formato/reservado/plan como hoy, luego `dominio_estado := 'pendiente'`, `dominio_asignado_at := now()`, `dominio_aviso_error_at := null`, `dominio_diagnostico := null`, `dominio_revocado_por_plan := false`.
5. **Limpieza** (`new.dominio_personalizado` nulo): `dominio_estado := null`, `dominio_asignado_at := null`, `dominio_aviso_error_at := null`, `dominio_diagnostico := null`.

Columna extra para el paso 1: `alter table tenants add column dominio_revocado_por_plan boolean not null default false;` (sin grant a `authenticated`).

Cubre las tres rutas de downgrade: cron `procesar-trials-vencidos`, `bajarAFree` en `stripe-webhook`, y portal/checkout — todas terminan en un `update` de `plan_id` sobre `tenants`.

**Grants:** `dominio_diagnostico`, `dominio_asignado_at`, `dominio_aviso_error_at` **no** se otorgan a `authenticated` (solo lectura vía `select *`, escritura solo service_role). `dominios_huerfanos` sin grants.

### 3. `_shared/vercel.ts` (módulo nuevo de Edge Functions)

```ts
export async function fetchVercelConReintento(
  url: string, init: RequestInit, intentos = 2
): Promise<Response>
```

- Llama `fetch(url, init)`.
- En `429`: lee `Retry-After` (segundos; default 5), espera, reintenta. Máximo `intentos` veces.
- Si tras los reintentos sigue `429`, lanza `RateLimitError` — la función que la usa **corta la corrida** (no marca error en los tenants; el siguiente cron sigue).
- No reintenta otros códigos (los maneja quien llama).

Lo usan `agregar-dominio-vercel`, `verificar-dominios-pendientes` y `limpiar-dominios-huerfanos`. Supabase Edge Functions soportan `supabase/functions/_shared/` con imports relativos.

### 4. Edge Functions

**`agregar-dominio-vercel` (modificar):**
- Tras el `POST /domains` (éxito o `400` "ya existe"), hace `GET /v6/domains/{domain}/config?projectIdOrName={project}&teamId={team}`.
- Combina la respuesta del alta (`name`, `apexName`, `verification`) con la de config (`misconfigured`, `recommendedIPv4`, `recommendedCNAME`) y hace `update tenants set dominio_diagnostico = <json> where id = tenantId` (service_role).
- Sigue siendo fire-and-forget para el cliente. Si el `GET config` falla, `dominio_diagnostico` se queda `null` y el cron lo llena después.
- Usa `fetchVercelConReintento`.

**`verificar-dominios-pendientes` (modificar, el motor):**

Por cada tenant candidato (`dominio_estado in ('pendiente','verificado')`, `dominio_personalizado not null`):
1. `POST /verify`. Si `404` → `POST /domains` (re-alta, comportamiento actual) y `continue` (lo agarra la próxima corrida).
2. `GET /v6/domains/{domain}/config`. Construye y guarda `dominio_diagnostico` (incluye `misconfigured`, registros recomendados, `verification` con `reason`, `revisado_at`).
3. Transiciones:
   - `verified && !misconfigured`:
     - Si estado era `pendiente` → `update dominio_estado = 'verificado'`.
     - Luego, si estado (nuevo o ya) es `verificado` → `fetch("https://" + dominio + "/", { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(8000) })` dentro de `try`:
       - Resuelve (cualquier status HTTP, incluido 3xx/4xx) → certificado activo → `update dominio_estado = 'listo', dominio_aviso_error_at = null`; manda el correo "listo" (plantilla actual); `verificados++`.
       - Lanza (error TLS / timeout / DNS) → cert aún emitiéndose → se queda en `verificado`; la próxima corrida reintenta.
   - `!verified` o `misconfigured`, estado `pendiente`, `now() - dominio_asignado_at >= interval '72 hours'`, `dominio_aviso_error_at is null`:
     - Manda correo de recordatorio (plantilla nueva `plantillaDominioProblema`, con el motivo legible derivado de `verification[].reason` / "registro no encontrado o apunta a otro lado").
     - `update dominio_aviso_error_at = now()`.
4. `try/catch` por tenant como hoy; una `RateLimitError` de `fetchVercelConReintento` **rompe el loop** (`break`) y la función devuelve `{ ok: true, corte_rate_limit: true, ... }`.

El botón manual "Verificar ahora" (rama de super-admin, un tenant) corre exactamente el mismo `verificarUno`.

**Cron:** subir `verificar-dominios.yml` de `0 9 * * *` (diario) a `0 */6 * * *` (cada 6 h). Costo irrelevante al volumen; cierra el hueco de que un dominio se quede horas en `verificado` esperando la siguiente corrida.

**`limpiar-dominios-huerfanos` (nuevo):**
- Disparador único: cron nocturno `limpiar-dominios.yml` (`0 4 * * *`), header `x-cron-secret` = `DOMINIO_CRON_SECRET` (reutiliza el secreto existente).
- `select * from dominios_huerfanos where borrado_at is null`.
- Por fila:
  1. **Guard anti-borrado**: `select 1 from tenants where dominio_personalizado = fila.dominio` (service_role). Si existe → alguien lo re-agregó → `update dominios_huerfanos set borrado_at = now()` (ya no es huérfano) y `continue`.
  2. `DELETE /v9/projects/{project}/domains/{dominio}?teamId={team}` vía `fetchVercelConReintento`.
     - `200` o `404` → `update borrado_at = now()`.
     - `409` (`conflict_aliases`) → log, deja `borrado_at` null (reintento mañana). Fuera de alcance resolverlo.
     - otro error → log, deja `borrado_at` null.
  3. Correo "tu dominio propio se desactivó porque bajaste a Free": se manda **solo en la misma rama que setea `borrado_at`** (éxito del `DELETE`), y **solo si** `select dominio_revocado_por_plan from tenants where id = fila.tenant_id` es `true`. Como una fila con `borrado_at` no nulo ya no se reprocesa, sale a lo sumo una vez. Tras mandarlo (o si no aplica), `update tenants set dominio_revocado_por_plan = false where id = fila.tenant_id` para dejar la bandera limpia.
- `RateLimitError` → `break`, devuelve `{ ok: true, corte_rate_limit: true }`.

Decisión: función y workflow **separados** del cron de verificación, para que un fallo de uno no tape al otro (lección de Track A: bloques encadenados en una sola función se saltan entre sí ante un error temprano).

### 5. `src/lib/dominio.ts` — helpers puros nuevos

```ts
// El dominio es apex si Vercel dice que su apexName es él mismo.
export function esApexSegunVercel(name: string, apexName: string): boolean

// Registros DNS a mostrar, derivados del diagnóstico guardado.
// Si diag es null (Vercel aún no respondió) → fallback estático.
export type RegistroDNS = { tipo: "A" | "CNAME"; nombre: string; valor: string };
export function instruccionesDNS(dominio: string, diag: DominioDiagnostico | null): RegistroDNS[]

// Motivo legible para el bloque de error, o null si no hay problema.
export function motivoProblemaDNS(diag: DominioDiagnostico | null): string | null
```

`DominioDiagnostico` = tipo que refleja la forma del jsonb. Tests:
- `menu.tienda.com.mx` con `apexName: "tienda.com.mx"` → 1 registro CNAME a `recommendedCNAME[0]`.
- `tienda.com.mx` con `apexName: "tienda.com.mx"` → 1 registro A a `recommendedIPv4[0]`.
- `diag: null` → fallback: `> 2` labels reales según PSL corto (`.com.mx` etc.) o presencia de subdominio → A `76.76.21.21` para apex, CNAME `cname.vercel-dns.com` para subdominio. (El fallback solo aplica los segundos que Vercel tarda en responder la primera vez.)
- `motivoProblemaDNS` con `misconfigured: true` y `verification` vacío → mensaje genérico "el registro no se encuentra o apunta a otro lado".
- `motivoProblemaDNS` con `misconfigured: false` → `null`.

### 6. Frontend

**`Empresa.tsx`** — reemplaza el bloque hardcodeado (`dominio.split(".").length > 2 ? CNAME : A`) por:
- `const registros = instruccionesDNS(tenant.dominio_personalizado, tenant.dominio_diagnostico)` → tabla de registros.
- `const problema = motivoProblemaDNS(tenant.dominio_diagnostico)` → si no es `null` **y** `dominio_estado !== 'listo'`, bloque rojo (`bg-vm-danger-soft`, borde `vm-danger`) con el motivo + los registros correctos.
- Badge por estado:
  - `pendiente` → "Pendiente de verificar" (spinner)
  - `verificado` → "DNS correcto, activando certificado" (spinner, texto `vm-body`)
  - `listo` → "Verificado y sirviendo tráfico" (check verde)
- `Tenant` type (`src/types/index.ts` o donde viva) gana `dominio_diagnostico`, `dominio_asignado_at`, `dominio_aviso_error_at`, `dominio_revocado_por_plan`. `src/types/database.ts` hand-add de las mismas 4 columnas + `'listo'` en el enum de `dominio_estado` si está tipado. `src/lib/demo.ts` — `TENANT_DEMO` gana los 4 campos (`dominio_diagnostico: null`, timestamps `null`, `dominio_revocado_por_plan: false`).
- `useTenantActual` usa `select("*, ...")`, así que las columnas llegan solas.

**`SuperAdmin.tsx`** — la línea de dominio (`t.dominio_estado === "verificado" ? " · verificado" : " · pendiente"`) pasa a 4 casos: `pendiente` / `pendiente · problema DNS` (si `motivoProblemaDNS(t.dominio_diagnostico)`) / `verificado` / `listo`. El botón "Verificar ahora" se muestra mientras el estado no sea `listo`. `useSuperAdmin.ts` agrega `dominio_diagnostico` al `select`.

**`SuperAdminDetalle.tsx`** — muestra el estado y, si hay problema, el motivo.

### 7. Workflows

- `.github/workflows/verificar-dominios.yml` — cambiar cron a `0 */6 * * *`.
- `.github/workflows/limpiar-dominios.yml` — nuevo, `0 4 * * *`, `curl -X POST` a `limpiar-dominios-huerfanos` con `x-cron-secret: ${{ secrets.DOMINIO_CRON_SECRET }}` y `Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}` (verify_jwt true, mismo patrón que los demás crons).

## Secuencia de despliegue

1. Aplicar la migración (MCP `apply_migration` o SQL Editor).
2. Desplegar `_shared` + las 3 Edge Functions (`agregar-dominio-vercel`, `verificar-dominios-pendientes`, `limpiar-dominios-huerfanos`).
3. Confirmar secretos ya presentes: `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `DOMINIO_CRON_SECRET`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Merge del workflow nuevo y el cambio de cron.
5. Frontend (Vercel despliega solo en el push).

## QA manual (ninguna Edge Function tiene test automatizado)

- Con un dominio de prueba real bajo control (subdominio de algo propio):
  - Guardar el dominio → confirmar `dominio_estado = 'pendiente'`, `dominio_asignado_at` seteado, y que `agregar-dominio-vercel` llenó `dominio_diagnostico` con registros reales.
  - Ver en `Empresa.tsx` que las instrucciones DNS coinciden con lo que pide Vercel (probar con un `.com.mx` apex y un subdominio `.com.mx`).
  - Sin configurar el DNS, forzar `dominio_asignado_at` a hace 73 h y correr el cron → llega el correo de recordatorio, `dominio_aviso_error_at` seteado, no llega un segundo correo en la corrida siguiente.
  - Configurar el DNS bien → correr el cron → `verificado` → (misma corrida o la siguiente) `listo` + correo "listo". Confirmar que el correo NO llegó mientras estaba en `verificado`.
  - Abrir `https://<dominio>/` en el navegador y confirmar que carga el menú por HTTPS sin advertencia de certificado.
- Cambiar el dominio por otro → confirmar fila en `dominios_huerfanos` con el viejo; correr `limpiar-dominios-huerfanos` → el viejo desaparece del proyecto de Vercel (Dashboard) y `borrado_at` queda seteado.
- Bajar el tenant de prueba de Pro a Free → `dominio_personalizado` queda `null`, `dominio_estado` `null`, fila en `dominios_huerfanos`; el menú deja de responder en el dominio; tras el barrido llega el correo "se desactivó".
- Re-agregar a mano en `tenants` un dominio que está en `dominios_huerfanos` → el barrido NO lo borra de Vercel y marca `borrado_at` (guard anti-borrado).
- Regenerar `src/types/database.ts` desde Supabase y comparar contra el hand-add.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El barrido borra un dominio que alguien re-agregó | Guard anti-borrado: consulta `tenants` antes de cada `DELETE`. |
| `HEAD` a un dominio recién verificado falla por cert aún emitiéndose y se queda en `verificado` | Cron cada 6 h + botón manual; el estado `verificado` ya es informativo correcto para el dueño ("activando certificado"). |
| Vercel cambia la forma de `/config` | El diagnóstico es `jsonb` de forma flexible; los helpers puros toleran campos ausentes (fallback estático). |
| Doble correo "se desactivó" si el `DELETE` se reintenta | El correo sale solo en la rama que setea `borrado_at`; una fila procesada con éxito no se vuelve a tocar. |
| `429` en cascada durante una corrida grande | `fetchVercelConReintento` + corte de corrida; el resto se procesa en la siguiente. Volumen actual: dígitos. |
| Otra sesión toca los mismos archivos | La implementación de este plan espera a que el árbol quede libre. |
