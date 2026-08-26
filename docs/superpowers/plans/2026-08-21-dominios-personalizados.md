# Dominios personalizados: alta y verificación automática — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el ciclo de vida del dominio personalizado — desde que el tenant lo guarda hasta que queda verificado y sirviendo tráfico — sin intervención manual de KreaTech, usando la API de Vercel desde Supabase Edge Functions.

**Architecture:** Un trigger de Postgres ya existente pasa a marcar el dominio como `pendiente` automáticamente. Dos Edge Functions nuevas hablan con la API de Vercel: una da de alta el dominio (fire-and-forget, invocada por el cliente tras guardar) y otra verifica el estado (cron diario + botón manual de super-admin). Una ruta nueva extiende el enrutamiento por host — que ya existe para la página principal — a las páginas de sucursal.

**Tech Stack:** Supabase (Postgres, Edge Functions en Deno), TanStack Start/Router, Vercel REST API v9/v10, GitHub Actions (cron), Resend (correo).

**Spec:** `src/docs/vibemenu_dominio_personalizado.md`

## Global Constraints

- Todo el código nuevo, comentarios y mensajes de usuario van en español, mismo tono que el resto del repo (ver `enviar-bienvenida`, `procesar-trials-vencidos` como referencia de estilo).
- Ningún cambio bloquea el guardado del tenant si la llamada a Vercel falla — el registro se queda en `pendiente`, nunca en un estado de error visible al tenant.
- `dominio_estado` nunca se otorga con `GRANT UPDATE` a `authenticated` — solo el trigger (validación/limpieza) y las Edge Functions (con `service_role`) pueden escribirlo. Un tenant no puede auto-marcarse "verificado".
- Edge Functions nuevas: `verify_jwt = true` siempre (igual que las 6 funciones existentes). La autorización específica de cada acción se resuelve dentro de la función, no desactivando la revisión de JWT de la plataforma.
- No se agregan tests de Bun para las Edge Functions (Deno, fuera de `src/lib` — mismo patrón que `procesar-trials-vencidos`, que tampoco los tiene). Si se toca una función pura existente en `src/lib`, sí lleva test.

---

### Task 1: Migración — `dominio_estado` y trigger actualizado

**Files:**

- Create: `src/docs/vibemenu_migracion_dominio_estado.sql`
- Aplicar con la tool `apply_migration` del MCP de Supabase (`project_id: iaiiwtqqiaqxnzxjqcnt`, `name: dominio_estado`), no con `bun test`.

**Interfaces:**

- Produces: columna `tenants.dominio_estado text` (`null` / `'pendiente'` / `'verificado'`), función `validar_dominio_tenant()` actualizada (mismo nombre y trigger `trg_tenants_27_dominio`, solo cambia el cuerpo).

- [ ] **Step 1: Escribir el archivo de migración**

```sql
-- ============================================================================
--  VIBEMENU — migracion: dominio_estado
--
--  Agrega tenants.dominio_estado ('pendiente' | 'verificado' | null) y hace
--  que el trigger validar_dominio_tenant() lo mantenga solo: 'pendiente' en
--  cuanto se asigna un dominio nuevo, null si se quita el dominio. Ninguna
--  otra transicion es valida desde el cliente -- solo las Edge Functions
--  agregar-dominio-vercel / verificar-dominios-pendientes (con service_role)
--  pueden poner 'verificado'. Ver src/docs/vibemenu_dominio_personalizado.md.
--
--  Ejecutar via Supabase MCP (apply_migration). No otorga UPDATE de
--  dominio_estado a `authenticated` a proposito.
-- ============================================================================

begin;

alter table tenants
  add column dominio_estado text
    constraint dominio_estado_valido check (
      dominio_estado is null or dominio_estado in ('pendiente', 'verificado')
    );

create or replace function validar_dominio_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_permite boolean;
  v_dominio text;
begin
  if tg_op = 'UPDATE' then
    if new.dominio_personalizado is not distinct from old.dominio_personalizado then
      return new;
    end if;
  end if;

  v_dominio := nullif(lower(trim(new.dominio_personalizado)), '');
  new.dominio_personalizado := v_dominio;

  if v_dominio is null then
    new.dominio_estado := null;
    return new;
  end if;

  if v_dominio = 'vibemenu.com.mx' or v_dominio like '%.vibemenu.com.mx' then
    raise exception 'dominio_reservado'
      using detail = 'Ese dominio está reservado para Vibemenu.';
  end if;

  select p.permite_dominio_propio into v_permite
    from planes p where p.id = new.plan_id;

  if not coalesce(v_permite, false) then
    raise exception 'dominio_propio_no_permitido'
      using detail = 'El dominio personalizado es parte de Pro.';
  end if;

  new.dominio_estado := 'pendiente';
  return new;
end;
$$;

commit;

-- ============================================================================
--  Verificar:
--
--    select column_name, data_type from information_schema.columns
--     where table_name = 'tenants' and column_name = 'dominio_estado';
--
--    -- El cliente NO debe poder tocarlo directo (columna sin GRANT):
--    select column_name from information_schema.column_privileges
--     where table_name = 'tenants' and grantee = 'authenticated'
--       and privilege_type = 'UPDATE' and column_name = 'dominio_estado';
--    -- debe devolver 0 filas.
--
--    -- Asignar un dominio debe poner 'pendiente' solo:
--    update tenants set dominio_personalizado = 'menu.pruebaqa.com'
--     where id = '<tenant-pro>';
--    select dominio_personalizado, dominio_estado from tenants where id = '<tenant-pro>';
--    -- dominio_estado = 'pendiente'
--
--    -- Quitar el dominio debe limpiar el estado:
--    update tenants set dominio_personalizado = null where id = '<tenant-pro>';
--    select dominio_estado from tenants where id = '<tenant-pro>';
--    -- dominio_estado = null
-- ============================================================================
```

- [ ] **Step 2: Aplicar la migración**

Usar la tool `apply_migration` del MCP de Supabase con `project_id: iaiiwtqqiaqxnzxjqcnt`, `name: dominio_estado`, `query`: el SQL completo entre `begin;` y `commit;` del Step 1 (sin los comentarios de verificación).

- [ ] **Step 3: Correr las 3 queries de verificación del bloque de comentarios**

Usar `execute_sql` del MCP de Supabase, una por una, contra un tenant real en plan Pro (buscarlo con `select id, plan_id from tenants where plan_id = (select id from planes where nombre = 'pro') limit 1;` si no se conoce uno de memoria). Confirmar los tres resultados esperados antes de seguir.

- [ ] **Step 4: Commit**

```bash
git add src/docs/vibemenu_migracion_dominio_estado.sql
git commit -m "feat: agrega tenants.dominio_estado, mantenido por el trigger existente"
```

---

### Task 2: Regenerar tipos y exponer `dominio_estado` en super-admin

**Files:**

- Modify: `src/types/database.ts` (regenerar completo)
- Modify: `src/hooks/useSuperAdmin.ts:55,78`

**Interfaces:**

- Consumes: columna `dominio_estado` del Task 1.
- Produces: `TenantSuperAdmin.dominio_estado: string | null`, disponible para `SuperAdmin.tsx` en el Task 7.

- [ ] **Step 1: Regenerar `src/types/database.ts`**

Usar la tool `generate_typescript_types` del MCP de Supabase con `project_id: iaiiwtqqiaqxnzxjqcnt`, y sobrescribir el archivo completo con el resultado (es generado, no se edita a mano — ver el comentario de cabecera del propio archivo).

- [ ] **Step 2: Verificar que el tipo trae la columna nueva**

```bash
grep -n "dominio_estado" src/types/database.ts
```

Expected: al menos 3 apariciones (Row, Insert, Update), igual que `dominio_personalizado`.

- [ ] **Step 3: Agregar `dominio_estado` al tipo y al select de `useSuperAdmin.ts`**

En `src/hooks/useSuperAdmin.ts:55` (dentro del type `TenantSuperAdmin`, junto a `dominio_personalizado: string | null;`):

```ts
dominio_estado: string | null;
```

En `src/hooks/useSuperAdmin.ts:78` (el string de `.select(...)`), agregar `dominio_estado` justo después de `dominio_personalizado`:

```ts
"id, nombre_negocio, slug, estado, created_at, dominio_personalizado, dominio_estado, plan:planes(nombre), suscripciones(estado, precio_congelado_usd, precio_congelado_mxn, moneda_cobro, fecha_renovacion)",
```

- [ ] **Step 4: Verificar tipos**

```bash
bun run typecheck
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts src/hooks/useSuperAdmin.ts
git commit -m "chore: regenera tipos de Supabase y expone dominio_estado en super-admin"
```

---

### Task 3: Edge Function `agregar-dominio-vercel`

**Files:**

- Create: `supabase/functions/agregar-dominio-vercel/index.ts`

**Interfaces:**

- Consumes: `POST` con body `{ tenant_id: string }`, header `Authorization: Bearer <jwt del tenant>`.
- Produces: efecto secundario (dominio agregado al proyecto de Vercel). Sin contrato de respuesta que otras tareas consuman — el Task 4 la invoca fire-and-forget.
- Requiere secretos (Task 8, manual): `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`.

- [ ] **Step 1: Escribir la función**

```ts
// Edge Function: agregar-dominio-vercel
//
// Se invoca desde Empresa.tsx justo despues de guardar un dominio_personalizado
// nuevo -- fire and forget, mismo patron que enviar-bienvenida: si esto falla,
// el tenant ya guardo su dominio de todos modos (dominio_estado se queda en
// 'pendiente', puesto por el trigger validar_dominio_tenant). El cron de
// verificar-dominios-pendientes vuelve a intentarlo despues sin que nadie
// tenga que reintentar nada a mano.
//
// Relee el dominio con service_role en vez de confiar en lo que mande el
// cliente: la unica fuente de verdad es la fila de `tenants`.
//
// Desplegar:
//   supabase functions deploy agregar-dominio-vercel --project-ref iaiiwtqqiaqxnzxjqcnt
//
// Secretos: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//           VERCEL_API_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const autorizacion = req.headers.get("Authorization");
  if (!autorizacion) return json({ error: "sin_sesion" }, 401);

  const comoUsuario = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: autorizacion } } },
  );

  const {
    data: { user },
  } = await comoUsuario.auth.getUser();
  if (!user) return json({ error: "sin_sesion" }, 401);

  let tenantId: string | undefined;
  try {
    ({ tenant_id: tenantId } = await req.json());
  } catch {
    return json({ error: "body_invalido" }, 400);
  }
  if (!tenantId) return json({ error: "falta_tenant_id" }, 400);

  // RLS de tenant_usuarios_select exige pertenece_a_tenant: si quien llama no
  // pertenece a este tenant, la consulta de abajo (con la sesion del usuario,
  // no con service_role) simplemente no encuentra nada.
  const { data: pertenece } = await comoUsuario
    .from("tenant_usuarios")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!pertenece) return json({ error: "sin_permiso" }, 403);

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: tenant, error: errorTenant } = await db
    .from("tenants")
    .select("dominio_personalizado")
    .eq("id", tenantId)
    .single();

  if (errorTenant) return json({ error: errorTenant.message }, 400);
  if (!tenant.dominio_personalizado) return json({ error: "sin_dominio" }, 400);

  const vercelToken = Deno.env.get("VERCEL_API_TOKEN");
  const vercelProject = Deno.env.get("VERCEL_PROJECT_ID");
  const vercelTeam = Deno.env.get("VERCEL_TEAM_ID");
  if (!vercelToken || !vercelProject || !vercelTeam) {
    return json({ error: "falta_configuracion_vercel" }, 500);
  }

  const resp = await fetch(
    `https://api.vercel.com/v10/projects/${vercelProject}/domains?teamId=${vercelTeam}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: tenant.dominio_personalizado }),
    },
  );

  // No se propaga como error al cliente en ningun caso -- fire and forget.
  // Si Vercel dice "ya existe" (el dominio se agrego antes, a mano o por un
  // guardado previo) tambien cuenta como exito: el objetivo ya esta cumplido.
  const cuerpo = await resp.text();
  if (!resp.ok) {
    console.error(
      `vercel_add_domain_fallo (${resp.status}) para ${tenant.dominio_personalizado}:`,
      cuerpo,
    );
  }

  return json({ ok: true, vercel_status: resp.status });
});
```

- [ ] **Step 2: Desplegar**

Usar la tool `deploy_edge_function` del MCP de Supabase — `project_id: iaiiwtqqiaqxnzxjqcnt`, `name: agregar-dominio-vercel`, `entrypoint_path: index.ts`, `verify_jwt: true`, `files: [{ name: "index.ts", content: "<contenido del Step 1>" }]`.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/agregar-dominio-vercel/index.ts
git commit -m "feat: Edge Function agregar-dominio-vercel, da de alta el dominio por API"
```

(El despliegue real vive en Supabase, no en git — el commit es para que el código quede versionado, mismo patrón que las funciones existentes.)

---

### Task 4: Invocar `agregar-dominio-vercel` desde `Empresa.tsx`

**Files:**

- Modify: `src/pages/admin/Empresa.tsx`

**Interfaces:**

- Consumes: Edge Function `agregar-dominio-vercel` del Task 3.

- [ ] **Step 1: Detectar cuándo el dominio cambió a un valor nuevo, e invocar la función tras guardar**

En `alGuardar`, después de `avisarGuardado();` (línea 161) y antes del `catch`:

```tsx
avisarGuardado();

// Fire and forget: si guardar el dominio en tenants ya tuvo exito, no
// debe fallar el formulario porque Vercel este lento o caido. El cron
// de verificar-dominios-pendientes reintenta solo despues.
if (permiteDominio && cambioDominio && dominio.trim()) {
  void supabase.functions
    .invoke("agregar-dominio-vercel", { body: { tenant_id: tenantId } })
    .catch(() => {});
}
```

Requiere importar `supabase`:

```tsx
import { supabase } from "@/lib/supabase";
```

(agregar junto a los demás imports de `@/lib/...`, línea 11-18 actual).

- [ ] **Step 2: Verificar tipos y lint**

```bash
bun run typecheck && bun run lint
```

Expected: sin errores.

- [ ] **Step 3: Probar a mano en dev**

```bash
bun run dev --port 8095
```

Entrar como un tenant en plan Pro a `/admin/empresa`, cambiar el dominio personalizado y guardar. Confirmar en la pestaña Network del navegador que se dispara una llamada a `.../functions/v1/agregar-dominio-vercel` con status 200, y que el guardado del formulario (el aviso de "guardado") no espera a que esa llamada termine.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/Empresa.tsx
git commit -m "feat: invoca agregar-dominio-vercel al guardar un dominio nuevo"
```

---

### Task 5: Edge Function `verificar-dominios-pendientes` + cron

**Files:**

- Create: `supabase/functions/verificar-dominios-pendientes/index.ts`
- Create: `.github/workflows/verificar-dominios.yml`

**Interfaces:**

- Consumes: dos modos de invocación —
  - Cron: header `x-cron-secret` = `DOMINIO_CRON_SECRET`, sin body → procesa TODOS los tenants con `dominio_estado = 'pendiente'`.
  - Manual (Task 7): `Authorization: Bearer <jwt de un super_admin>`, body `{ tenant_id: string }` → procesa solo ese tenant.
- Produces: actualiza `tenants.dominio_estado = 'verificado'` y envía correo al owner vía Resend cuando Vercel confirma `verified: true`.
- Requiere secretos (Task 8, manual): los 3 de Vercel del Task 3, más `DOMINIO_CRON_SECRET`. Reutiliza `RESEND_API_KEY` ya existente.

- [ ] **Step 1: Escribir la función**

```ts
// Edge Function: verificar-dominios-pendientes
//
// Dos formas de dispararla:
//   1. Cron diario (.github/workflows/verificar-dominios.yml), protegida por
//      DOMINIO_CRON_SECRET -- mismo patron que procesar-trials-vencidos.
//      Revisa TODOS los tenants en dominio_estado = 'pendiente'.
//   2. Boton "Verificar ahora" en SuperAdmin.tsx, con la sesion del propio
//      super-admin (sin secreto: la tabla `super_admins` con su RLS de
//      "solo tu propia fila" ya es la autorizacion). Revisa un tenant.
//
// POST /verify (no solo GET) para forzar a Vercel a re-evaluar el DNS en el
// momento, en vez de leer un estado que pudo quedar cacheado.
//
// Desplegar:
//   supabase functions deploy verificar-dominios-pendientes --project-ref iaiiwtqqiaqxnzxjqcnt
//
// Secretos: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//           VERCEL_API_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID,
//           DOMINIO_CRON_SECRET, RESEND_API_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";

const SITIO = "https://vibemenu.com.mx";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function plantillaDominioListo(negocioNombre: string, dominio: string) {
  const urlEmpresa = `${SITIO}/admin/empresa`;
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tu dominio ya está listo</title>
  </head>
  <body style="margin:0; padding:0; background-color:#F5F6F9;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      ${dominio} ya está sirviendo el menú de ${negocioNombre}.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background-color:#F5F6F9; padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
                 style="max-width:600px; width:100%; background-color:#FFFFFF; border:1px solid #E4E6ED; border-radius:16px;">
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-right:8px; vertical-align:middle;">
                      <img src="${SITIO}/logo-email.png" width="22" height="22" alt=""
                           style="display:block; width:22px; height:22px;" />
                    </td>
                    <td style="vertical-align:middle;">
                      <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:20px; font-weight:700; letter-spacing:-0.02em; color:#0B0B0F;">
                        Vibemenu
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 0 40px;">
                <h1 style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:30px; line-height:1.2; letter-spacing:-0.03em; font-weight:700; color:#0B0B0F;">
                  Tu dominio ya está listo.
                </h1>
                <p style="margin:18px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:1.6; color:#4B4E5A;">
                  <strong style="color:#0B0B0F;">${dominio}</strong> ya está sirviendo el menú de
                  ${negocioNombre}, sin pasar por vibemenu.com.mx.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:#2B4EFF; border-radius:12px;">
                      <a href="${urlEmpresa}"
                         style="display:inline-block; padding:15px 28px; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; font-weight:600; color:#FFFFFF; text-decoration:none; border-radius:12px;">
                        Ver mi negocio
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <div style="height:1px; background-color:#E4E6ED; line-height:1px; font-size:0;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 36px 40px;">
                <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; font-weight:600; color:#0B0B0F;">
                  Tu menú, tu formato.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:12px; color:#4B4E5A;">
            Vibemenu · Menú digital con 4 formatos visuales
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

type TenantPendiente = { id: string; nombre_negocio: string; dominio_personalizado: string };

async function verificarUno(
  vercelToken: string,
  vercelProject: string,
  vercelTeam: string,
  t: TenantPendiente,
) {
  const resp = await fetch(
    `https://api.vercel.com/v9/projects/${vercelProject}/domains/${t.dominio_personalizado}/verify?teamId=${vercelTeam}`,
    { method: "POST", headers: { Authorization: `Bearer ${vercelToken}` } },
  );

  if (!resp.ok) {
    console.error(
      `vercel_verify_fallo (${resp.status}) para ${t.dominio_personalizado}:`,
      await resp.text(),
    );
    return false;
  }

  const data = (await resp.json()) as { verified?: boolean };
  if (!data.verified) return false;

  await db.from("tenants").update({ dominio_estado: "verificado" }).eq("id", t.id);

  const { data: owner } = await db
    .from("tenant_usuarios")
    .select("user_id")
    .eq("tenant_id", t.id)
    .eq("rol", "owner")
    .maybeSingle();
  if (!owner) return true;

  const { data: usuario } = await db.auth.admin.getUserById(owner.user_id);
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!usuario?.user?.email || !apiKey) return true;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Vibemenu <hola@vibemenu.com.mx>",
      to: [usuario.user.email],
      subject: `${t.dominio_personalizado} ya está listo`,
      html: plantillaDominioListo(t.nombre_negocio, t.dominio_personalizado),
    }),
  }).catch((e) => console.error("no se pudo avisar dominio listo a", t.id, e));

  return true;
}

Deno.serve(async (req) => {
  const vercelToken = Deno.env.get("VERCEL_API_TOKEN");
  const vercelProject = Deno.env.get("VERCEL_PROJECT_ID");
  const vercelTeam = Deno.env.get("VERCEL_TEAM_ID");
  if (!vercelToken || !vercelProject || !vercelTeam) {
    return new Response(JSON.stringify({ error: "falta_configuracion_vercel" }), { status: 500 });
  }

  const secretoCron = Deno.env.get("DOMINIO_CRON_SECRET");
  const esCron = Boolean(secretoCron) && req.headers.get("x-cron-secret") === secretoCron;

  let tenants: TenantPendiente[] = [];

  if (esCron) {
    const { data, error } = await db
      .from("tenants")
      .select("id, nombre_negocio, dominio_personalizado")
      .eq("dominio_estado", "pendiente")
      .not("dominio_personalizado", "is", null);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    tenants = (data ?? []) as TenantPendiente[];
  } else {
    // No es el cron: exige sesion de un super_admin, y solo revisa un tenant.
    const autorizacion = req.headers.get("Authorization");
    if (!autorizacion)
      return new Response(JSON.stringify({ error: "sin_sesion" }), { status: 401 });

    const comoUsuario = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: autorizacion } } },
    );
    const {
      data: { user },
    } = await comoUsuario.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "sin_sesion" }), { status: 401 });

    // RLS de super_admins solo deja leer la propia fila: si no existe, no es admin.
    const { data: esAdmin } = await comoUsuario
      .from("super_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!esAdmin) return new Response(JSON.stringify({ error: "sin_permiso" }), { status: 403 });

    let tenantId: string | undefined;
    try {
      ({ tenant_id: tenantId } = await req.json());
    } catch {
      return new Response(JSON.stringify({ error: "body_invalido" }), { status: 400 });
    }
    if (!tenantId)
      return new Response(JSON.stringify({ error: "falta_tenant_id" }), { status: 400 });

    const { data, error } = await db
      .from("tenants")
      .select("id, nombre_negocio, dominio_personalizado")
      .eq("id", tenantId)
      .eq("dominio_estado", "pendiente")
      .not("dominio_personalizado", "is", null);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    tenants = (data ?? []) as TenantPendiente[];
  }

  let verificados = 0;
  for (const t of tenants) {
    try {
      if (await verificarUno(vercelToken, vercelProject, vercelTeam, t)) verificados++;
    } catch (e) {
      console.error("error verificando", t.id, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, revisados: tenants.length, verificados }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Desplegar**

`deploy_edge_function` del MCP de Supabase — `project_id: iaiiwtqqiaqxnzxjqcnt`, `name: verificar-dominios-pendientes`, `entrypoint_path: index.ts`, `verify_jwt: true`, `files: [{ name: "index.ts", content: "<contenido del Step 1>" }]`.

- [ ] **Step 3: Escribir el workflow de cron**

```yaml
name: Verificar dominios pendientes

# Diario. Revisa los tenants con dominio_estado = 'pendiente' contra la API
# de Vercel y los pasa a 'verificado' en cuanto el DNS ya resuelve -- ver
# supabase/functions/verificar-dominios-pendientes.
on:
  schedule:
    - cron: "30 10 * * *"
  workflow_dispatch: {} # boton "Run workflow" para probar sin esperar al cron

jobs:
  verificar:
    runs-on: ubuntu-latest
    steps:
      - name: Llamar a verificar-dominios-pendientes
        run: |
          curl --fail-with-body -sS -X POST \
            "https://iaiiwtqqiaqxnzxjqcnt.supabase.co/functions/v1/verificar-dominios-pendientes" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "x-cron-secret: ${{ secrets.DOMINIO_CRON_SECRET }}"

# Si este job falla, GitHub le manda correo solo al dueño del repo — mismo
# criterio que procesar-trials.yml y backup-db.yml.
```

Guardar en `.github/workflows/verificar-dominios.yml`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/verificar-dominios-pendientes/index.ts .github/workflows/verificar-dominios.yml
git commit -m "feat: Edge Function y cron de verificar-dominios-pendientes"
```

---

### Task 6: Enrutamiento de sucursales bajo dominio propio

**Files:**

- Modify: `src/hooks/useMenuPublico.ts`
- Create: `src/routes/sucursal.$sucursalSlug.tsx`

**Interfaces:**

- Consumes: `armarMenuPublico` (ya existe en `useMenuPublico.ts`), `esDominioPrincipal`/`obtenerHost` (patrón ya existente en `src/routes/index.tsx`, se repite igual aquí).
- Produces: `obtenerSucursalPublicaPorDominio(host, sucursalSlug): Promise<MenuPublico | null>`.

- [ ] **Step 1: Agregar `obtenerSucursalPublicaPorDominio` a `useMenuPublico.ts`**

Justo después de `obtenerMenuPublicoPorDominio` (después de la línea 69 actual):

```ts
/**
 * Igual que `obtenerMenuPublicoPorDominio`, pero para una sucursal especifica.
 * La usa `routes/sucursal.$sucursalSlug.tsx` -- el equivalente, bajo dominio
 * propio, de `$slug.sucursal.$sucursalSlug.tsx`.
 */
export async function obtenerSucursalPublicaPorDominio(
  host: string,
  sucursalSlug: string,
): Promise<MenuPublico | null> {
  const { data: tenantRow, error: errorTenant } = await supabase
    .from("tenants")
    .select("*, plan:planes(marca_agua, menu_independiente_por_sucursal)")
    .eq("dominio_personalizado", host)
    .maybeSingle();

  if (errorTenant) throw errorTenant;
  return armarMenuPublico(tenantRow, sucursalSlug);
}
```

- [ ] **Step 2: Crear la ruta**

```tsx
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import MenuPublicoSucursal from "@/pages/MenuPublicoSucursal";
import MenuNoEncontrado from "@/components/menu/MenuNoEncontrado";
import { obtenerSucursalPublicaPorDominio } from "@/hooks/useMenuPublico";
import { metaMenuPublico } from "@/lib/seoTenant";

// Equivalente, bajo dominio propio, de $slug.sucursal.$sucursalSlug.tsx. Solo
// tiene sentido si el Host de la peticion es un dominio personalizado -- en
// vibemenu.com.mx esta ruta no existe (el patron es /<slug>/sucursal/<slug>).
const obtenerHost = createIsomorphicFn()
  .server(() => getRequestHost() ?? "")
  .client(() => window.location.hostname);

export const Route = createFileRoute("/sucursal/$sucursalSlug")({
  loader: async ({ params }) => {
    const host = obtenerHost().replace(/:\d+$/, "").toLowerCase();
    const menu = await obtenerSucursalPublicaPorDominio(host, params.sucursalSlug);
    if (!menu) throw notFound();
    return menu;
  },
  head: ({ loaderData, params }) =>
    loaderData
      ? {
          meta: metaMenuPublico(
            loaderData,
            `/sucursal/${params.sucursalSlug}`,
            loaderData.tenant.dominio_personalizado ?? undefined,
          ),
        }
      : {},
  component: RouteComponent,
  notFoundComponent: MenuNoEncontrado,
});

function RouteComponent() {
  const { sucursalSlug } = Route.useParams();
  const menu = Route.useLoaderData();
  return <MenuPublicoSucursal slug={menu.tenant.slug} sucursalSlug={sucursalSlug} inicial={menu} />;
}
```

Guardar en `src/routes/sucursal.$sucursalSlug.tsx`.

- [ ] **Step 3: Verificar tipos**

```bash
bun run typecheck
```

Expected: sin errores. (TanStack Router regenera el árbol de rutas al arrancar `bun run dev` o `bun run build` — si `typecheck` se queja de una ruta no reconocida, correr `bun run dev` un momento para que el plugin regenere `routeTree.gen.ts` y volver a intentar.)

- [ ] **Step 4: Probar en dev**

```bash
bun run dev --port 8095
```

Con un tenant que tenga `dominio_personalizado` puesto (aunque no esté verificado en Vercel — esto se prueba local, sin DNS real) y al menos 2 sucursales activas: entrar a `http://localhost:8095/sucursal/<slug-de-una-sucursal>` — como en local el host es `localhost`, hay que editar temporalmente `obtenerHost` o probar con `curl -H "Host: <dominio-del-tenant>"` contra el server de dev para simular el host real. Confirmar que devuelve el menú de esa sucursal y no un 404.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMenuPublico.ts src/routes/sucursal.\$sucursalSlug.tsx
git commit -m "feat: enrutamiento de sucursales bajo dominio personalizado"
```

---

### Task 7: Estado visible en `Empresa.tsx` y `SuperAdmin.tsx`

**Files:**

- Modify: `src/pages/admin/Empresa.tsx`
- Modify: `src/pages/SuperAdmin.tsx`

**Interfaces:**

- Consumes: `tenant.dominio_estado` (Task 1/2), Edge Function `verificar-dominios-pendientes` (Task 5, modo manual).

- [ ] **Step 1: Badge de estado en `Empresa.tsx`**

Dentro del bloque `{dominio.trim().length > 0 && !dominioInvalido && (...)}` (línea 368-391 actual), agregar el badge antes del párrafo de "Configura tu DNS", usando `tenant.dominio_estado` (no `dominio` local, que es el valor del input — el estado real viene del tenant guardado):

```tsx
{
  !cambioDominio && tenant.dominio_estado && (
    <p className="mt-2 flex items-center gap-1.5 text-xs">
      {tenant.dominio_estado === "verificado" ? (
        <>
          <Check className="size-3.5 shrink-0 text-vm-success" aria-hidden />
          <span className="text-vm-success">Verificado</span>
        </>
      ) : (
        <>
          <Loader2 className="size-3.5 shrink-0 text-vm-body" aria-hidden />
          <span className="text-vm-body">Pendiente de verificar</span>
        </>
      )}
    </p>
  );
}
```

(Se muestra solo cuando el dominio en pantalla es el ya guardado, no un valor que el tenant está escribiendo sin guardar todavía — de ahí `!cambioDominio`.)

- [ ] **Step 2: Reemplazar la pill estática de `SuperAdmin.tsx` por el estado real**

En `src/pages/SuperAdmin.tsx:237-246`, reemplazar el bloque completo:

```tsx
{
  t.dominio_personalizado ? (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-xs font-medium",
          t.dominio_estado === "verificado"
            ? "bg-vm-success-soft text-vm-success"
            : "bg-vm-warning-soft text-vm-warning",
        )}
      >
        {t.dominio_personalizado}
        {t.dominio_estado === "verificado" ? " · verificado" : " · pendiente"}
      </span>
      {t.dominio_estado !== "verificado" && (
        <button
          type="button"
          onClick={() => void verificarDominio(t.id)}
          disabled={verificandoId === t.id}
          className="text-xs font-medium text-vm-primary hover:underline disabled:opacity-50"
        >
          {verificandoId === t.id ? "Revisando…" : "Verificar ahora"}
        </button>
      )}
    </div>
  ) : (
    <span className="text-vm-body">—</span>
  );
}
```

- [ ] **Step 3: Agregar el estado y la función `verificarDominio` al componente**

Cerca del inicio de la función que contiene la tabla (donde ya vive el resto del estado del componente — buscar el `useState` más cercano en `SuperAdmin.tsx`), agregar:

```tsx
const [verificandoId, setVerificandoId] = useState<string | null>(null);

async function verificarDominio(tenantId: string) {
  setVerificandoId(tenantId);
  try {
    await supabase.functions.invoke("verificar-dominios-pendientes", {
      body: { tenant_id: tenantId },
    });
    await qc.invalidateQueries({ queryKey: ["super-admin-tenants"] });
  } finally {
    setVerificandoId(null);
  }
}
```

Requiere importar `supabase` (`@/lib/supabase`) y `useQueryClient` de `@tanstack/react-query` (como `qc`) si el componente no los tiene ya — revisar los imports existentes de `SuperAdmin.tsx` antes de duplicar.

- [ ] **Step 4: Verificar tipos y lint**

```bash
bun run typecheck && bun run lint
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/Empresa.tsx src/pages/SuperAdmin.tsx
git commit -m "feat: muestra el estado real del dominio en Empresa y SuperAdmin"
```

---

### Task 8: Push y checklist de configuración manual

**Files:** ninguno (verificación y entrega).

- [ ] **Step 1: Correr la suite completa**

```bash
bun test src/lib && bun run typecheck && bun run lint && bun run build
```

Expected: todo en verde, incluyendo el build de producción (confirma que la ruta nueva del Task 6 no rompe el árbol de rutas generado).

- [ ] **Step 2: Revisar `git status` antes de subir**

```bash
git status --short
```

Repo compartido con otras sesiones — confirmar que no se está por subir nada de otra sesión sin querer.

- [ ] **Step 3: Push a `dev`, luego merge a `main`**

Mismo patrón ya usado en este repo (ver Tasks anteriores de esta conversación): push directo a `dev`, luego `git checkout -b main-pushN origin/main`, `git merge dev`, `git push origin main-pushN:main`, volver a `dev` y borrar la rama temporal.

- [ ] **Step 4: Entregar al usuario la lista de configuración manual**

Nada de código pendiente en este punto — lo que sigue es 100% fuera del repo:

1. **Crear el token de API de Vercel**: Vercel → Settings → Tokens → Create Token. Scope: el team `KreaTech Studio`. Copiar el valor (solo se muestra una vez).
2. **Cargar los 4 secretos en Supabase** (`supabase secrets set` desde la CLI, o Dashboard → Edge Functions → Secrets — cualquiera de las dos, ninguna es posible por MCP):
   - `VERCEL_API_TOKEN` = el token del paso 1.
   - `VERCEL_PROJECT_ID` = `prj_LS6VtDcnsv03riBrDXCE5AF3dKHA`
   - `VERCEL_TEAM_ID` = `team_wqPJ17eIBVoFixJBtR9RT2a1`
   - `DOMINIO_CRON_SECRET` = cualquier cadena larga aleatoria nueva (igual que se hizo con `TRIALS_CRON_SECRET`).
3. **Agregar `SUPABASE_SERVICE_ROLE_KEY` y `DOMINIO_CRON_SECRET` como secretos del repo en GitHub** (Settings → Secrets and variables → Actions) — `SUPABASE_SERVICE_ROLE_KEY` ya debería existir ahí (lo usa `procesar-trials.yml`); si no, agregarlo también. `DOMINIO_CRON_SECRET` debe ser el mismo valor exacto que se puso en Supabase en el paso 2.
4. **Confirmar el primer caso real**: en cuanto un tenant Pro guarde su dominio y configure su DNS, correr manualmente el workflow "Verificar dominios pendientes" desde la pestaña Actions de GitHub (botón "Run workflow") en vez de esperar al cron del día siguiente, para confirmar que todo el circuito real funciona de punta a punta.

Nada de esto requiere volver a tocar código — son valores a pegar en dos formularios (Vercel y Supabase) y uno en GitHub.
