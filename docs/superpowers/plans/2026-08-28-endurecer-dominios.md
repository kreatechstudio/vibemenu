# Endurecer dominios personalizados — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el ciclo de vida del dominio propio: instrucciones DNS reales de Vercel (arregla `.com.mx`), estado de error visible, confirmación de HTTPS antes de avisar "listo", limpieza nocturna de dominios huérfanos en Vercel, y revocación al bajar de plan.

**Architecture:** Una migración incremental agrega columnas de diagnóstico y una tabla-cola de huérfanos, y extiende el trigger `validar_dominio_tenant()`. Un módulo compartido `_shared/vercel.ts` centraliza las llamadas a la API de Vercel con manejo de `429`. Dos Edge Functions existentes se modifican y una nueva se agrega. El frontend deja de adivinar registros DNS y los lee del `jsonb` que escriben las funciones.

**Tech Stack:** Supabase (Postgres + Edge Functions en Deno), TanStack Start/Router/Query, React, Tailwind (tokens `vm-*`), bun:test, GitHub Actions crons, Resend, API REST de Vercel, Stripe SDK v17.

**Spec:** `docs/superpowers/specs/2026-08-28-endurecer-dominios-design.md`

## Global Constraints

- **Nunca** tocar `dominio_*`, `estado`, `plan_id` ni columnas de facturación del tenant real "Cafe Charly" (`960ce569-bcae-459e-a564-e66c6e6509fe`). El QA en vivo usa un tenant de prueba desechable.
- No reescribir historia de git ya publicada (nada de force-push, rebase, amend, squash sobre commits ya en la rama conectada). La rama debe quedar siempre en estado funcional — sincroniza con Lovable.
- Proyecto Supabase: `iaiiwtqqiaqxnzxjqcnt` (`vibemenu`, us-east-2).
- Edge Functions: cada `deploy` con `--project-ref iaiiwtqqiaqxnzxjqcnt`. `verificar-dominios-pendientes` y `procesar-trials-vencidos` tienen `verify_jwt=true`; `agregar-dominio-vercel` también. La nueva `limpiar-dominios-huerfanos` va con `verify_jwt=true`.
- Verificación de cada tarea de Edge Function incluye **`bun run lint`** del repo completo (Prettier corre sobre `supabase/functions/**` y rompió el lint en Track A por omitirlo).
- Copy de UI en español de México, tono directo, sin signos de exclamación de apertura sobrantes. Tokens de color `vm-*` (nunca hex crudo en componentes).
- Secretos ya presentes en Supabase (no crear): `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `DOMINIO_CRON_SECRET`, `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- La API MCP de Supabase puede estar sin autenticar en la sesión de ejecución: si `apply_migration`/`deploy_edge_function` fallan para un subagente, el controlador los aplica desde su contexto, o el usuario corre el SQL en el editor.

---

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `src/docs/vibemenu_migracion_dominio_ciclo_vida.sql` | Migración: columnas nuevas, tabla `dominios_huerfanos`, trigger extendido, grants | 1 |
| `src/lib/dominio.ts` | Helpers puros: tipo `DominioDiagnostico`, `esApexSegunVercel`, `instruccionesDNS`, `motivoProblemaDNS` | 2 |
| `src/lib/dominio.test.ts` | Tests de los helpers puros | 2 |
| `supabase/functions/_shared/vercel.ts` | `fetchVercelConReintento`, `RateLimitError`, helpers de URL de Vercel | 3 |
| `supabase/functions/agregar-dominio-vercel/index.ts` | Tras el alta, persistir `dominio_diagnostico` desde `/config` | 3 |
| `supabase/functions/verificar-dominios-pendientes/index.ts` | Máquina de estados `pendiente→verificado→listo`, correo 72 h, corte por 429 | 4 |
| `.github/workflows/verificar-dominios.yml` | Cron: diario → cada 6 h | 4 |
| `supabase/functions/limpiar-dominios-huerfanos/index.ts` | Barrido nocturno: `DELETE` en Vercel de dominios que ya nadie usa + correo "se desactivó" | 5 |
| `.github/workflows/limpiar-dominios.yml` | Cron nocturno nuevo para la función de arriba | 5 |
| `src/types/database.ts` | Hand-add de 4 columnas nuevas de `tenants` (Row/Insert/Update) | 6 |
| `src/lib/demo.ts` | `TENANT_DEMO` gana los 4 campos nuevos | 6 |
| `src/pages/admin/Empresa.tsx` | Instrucciones DNS desde `dominio_diagnostico`; badge de estado; bloque de error | 6 |
| `src/hooks/useSuperAdmin.ts` | `select` agrega `dominio_diagnostico` | 7 |
| `src/pages/SuperAdmin.tsx` | 4 estados de dominio + "problema DNS"; botón "Verificar ahora" hasta `listo` | 7 |
| `src/pages/SuperAdminDetalle.tsx` | Estado del dominio + motivo si hay problema | 7 |

---

## Interfaces compartidas (contrato entre tareas)

**Forma de `tenants.dominio_diagnostico` (jsonb)** — la escriben las Tareas 3 y 4, la leen las Tareas 2/6/7:

```ts
type DominioDiagnostico = {
  name: string;              // el host tal cual (= dominio_personalizado)
  apexName: string;          // apex según Vercel; name === apexName ⇒ es apex
  misconfigured: boolean;    // true ⇒ DNS mal o cert no emitible
  verification: { type: string; domain: string; value: string; reason: string }[];
  recommendedIPv4: string[]; // valores ya normalizados a string (extraídos de {value})
  recommendedCNAME: string[];
  revisado_at: string;       // ISO 8601
};
```

**Columnas nuevas de `tenants` (Tarea 1):**
- `dominio_estado text` — check ampliado: `null | 'pendiente' | 'verificado' | 'listo'`
- `dominio_diagnostico jsonb` — nullable
- `dominio_asignado_at timestamptz` — nullable
- `dominio_aviso_error_at timestamptz` — nullable
- `dominio_revocado_por_plan boolean not null default false`

**`supabase/functions/_shared/vercel.ts` (Tarea 3), consumido por Tareas 4 y 5:**
```ts
export class RateLimitError extends Error {}
export function urlAgregarDominio(project: string, team: string): string;
export function urlVerificarDominio(project: string, team: string, dominio: string): string;
export function urlConfigDominio(project: string, team: string, dominio: string): string;
export function urlBorrarDominio(project: string, team: string, dominio: string): string;
// Llama fetch; en 429 respeta Retry-After y reintenta hasta `intentos` veces;
// si sigue 429 lanza RateLimitError. No reintenta otros códigos.
export function fetchVercelConReintento(
  url: string,
  init: RequestInit,
  intentos?: number,
): Promise<Response>;
```

**`src/lib/dominio.ts` (Tarea 2), consumido por Tareas 6 y 7:**
```ts
export type DominioDiagnostico = { /* ...igual que arriba... */ };
export type RegistroDNS = { tipo: "A" | "CNAME"; nombre: string; valor: string };
export function esApexSegunVercel(name: string, apexName: string): boolean;
export function instruccionesDNS(dominio: string, diag: DominioDiagnostico | null): RegistroDNS[];
export function motivoProblemaDNS(diag: DominioDiagnostico | null): string | null;
```

---

## Task 1: Migración de esquema y trigger

**Files:**
- Create: `src/docs/vibemenu_migracion_dominio_ciclo_vida.sql`
- Aplicar vía Supabase MCP `apply_migration` (name: `dominio_ciclo_vida`) o SQL Editor.

**Interfaces:**
- Consumes: nada.
- Produces: columnas `dominio_diagnostico`, `dominio_asignado_at`, `dominio_aviso_error_at`, `dominio_revocado_por_plan` en `tenants`; valor `'listo'` en el check de `dominio_estado`; tabla `dominios_huerfanos`; trigger `validar_dominio_tenant()` reescrito.

- [ ] **Step 1: Escribir el archivo de migración**

`src/docs/vibemenu_migracion_dominio_ciclo_vida.sql`:

```sql
-- ============================================================================
--  VIBEMENU — migracion 019: ciclo de vida del dominio propio
--
--  Endurece la base de las migraciones 013 y 018. Ver
--  docs/superpowers/specs/2026-08-28-endurecer-dominios-design.md
--
--    - dominio_estado gana el valor 'listo' (HTTPS confirmado).
--    - dominio_diagnostico jsonb: lo ultimo que dijo Vercel (registros DNS
--      recomendados + misconfigured + reasons). Lo escriben SOLO las Edge
--      Functions con service_role.
--    - dominio_asignado_at: cuando se asigno el dominio actual (mide las 72h
--      para el correo de recordatorio).
--    - dominio_aviso_error_at: cuando se mando ese correo (una sola vez).
--    - dominio_revocado_por_plan: lo prende el trigger cuando un downgrade
--      quita el dominio; lo lee limpiar-dominios-huerfanos para el correo.
--    - dominios_huerfanos: cola de dominios a borrar del proyecto de Vercel.
--
--  Aplicar via Supabase MCP (apply_migration) o SQL Editor completo.
-- ============================================================================

begin;

alter table tenants drop constraint dominio_estado_valido;
alter table tenants add constraint dominio_estado_valido check (
  dominio_estado is null or dominio_estado in ('pendiente', 'verificado', 'listo')
);

alter table tenants add column dominio_diagnostico jsonb;
alter table tenants add column dominio_asignado_at timestamptz;
alter table tenants add column dominio_aviso_error_at timestamptz;
alter table tenants add column dominio_revocado_por_plan boolean not null default false;

create table dominios_huerfanos (
  dominio text primary key,
  tenant_id uuid references tenants(id) on delete set null,
  creado_at timestamptz not null default now(),
  borrado_at timestamptz
);
alter table dominios_huerfanos enable row level security;
-- Sin policies: solo service_role entra.

create or replace function validar_dominio_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_permite boolean;
  v_permite_nuevo boolean;
  v_dominio text;
begin
  -- 1. Revocacion por downgrade: el plan cambio y el nuevo no permite dominio propio.
  if tg_op = 'UPDATE'
     and new.plan_id is distinct from old.plan_id
     and old.dominio_personalizado is not null then
    select p.permite_dominio_propio into v_permite_nuevo
      from planes p where p.id = new.plan_id;
    if not coalesce(v_permite_nuevo, false) then
      new.dominio_personalizado := null;
      new.dominio_revocado_por_plan := true;
    end if;
  end if;

  -- 2. Nada que hacer si el dominio no cambio.
  if tg_op = 'UPDATE'
     and new.dominio_personalizado is not distinct from old.dominio_personalizado then
    return new;
  end if;

  -- 3. Encolar el dominio viejo como huerfano (cambio o limpieza).
  if tg_op = 'UPDATE' and old.dominio_personalizado is not null then
    insert into dominios_huerfanos (dominio, tenant_id)
      values (old.dominio_personalizado, old.id)
      on conflict (dominio) do update set borrado_at = null, creado_at = now();
  end if;

  v_dominio := nullif(lower(trim(new.dominio_personalizado)), '');
  new.dominio_personalizado := v_dominio;

  -- 4. Limpieza: sin dominio nuevo.
  if v_dominio is null then
    new.dominio_estado := null;
    new.dominio_asignado_at := null;
    new.dominio_aviso_error_at := null;
    new.dominio_diagnostico := null;
    return new;
  end if;

  -- 5. Asignacion de un dominio nuevo: validar como antes.
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
  new.dominio_asignado_at := now();
  new.dominio_aviso_error_at := null;
  new.dominio_diagnostico := null;
  new.dominio_revocado_por_plan := false;
  return new;
end;
$$;

commit;

-- ============================================================================
--  Verificar:
--
--    select column_name from information_schema.columns
--     where table_name = 'tenants'
--       and column_name in ('dominio_diagnostico','dominio_asignado_at',
--                           'dominio_aviso_error_at','dominio_revocado_por_plan');
--    -- 4 filas.
--
--    select conname from pg_constraint where conname = 'dominio_estado_valido';
--    -- 1 fila; probar que acepta 'listo':
--    -- update tenants set dominio_estado = 'listo' where id = '<tenant-prueba>';  -- OK
--
--    select column_name from information_schema.column_privileges
--     where table_name = 'tenants' and grantee = 'authenticated'
--       and privilege_type = 'UPDATE'
--       and column_name like 'dominio_%';
--    -- SOLO debe salir dominio_personalizado (de la migracion 013).
--
--    -- Asignar dominio a un tenant Pro de prueba pone asignado_at:
--    update tenants set dominio_personalizado = 'menu.pruebaqa.com' where id = '<tenant-pro-prueba>';
--    select dominio_estado, dominio_asignado_at from tenants where id = '<tenant-pro-prueba>';
--
--    -- Cambiarlo encola el viejo:
--    update tenants set dominio_personalizado = 'menu2.pruebaqa.com' where id = '<tenant-pro-prueba>';
--    select * from dominios_huerfanos where dominio = 'menu.pruebaqa.com';
--
--    -- Bajar de plan revoca:
--    update tenants set plan_id = '<plan-free>' where id = '<tenant-pro-prueba>';
--    select dominio_personalizado, dominio_estado, dominio_revocado_por_plan
--      from tenants where id = '<tenant-pro-prueba>';
--    -- dominio_personalizado = null, dominio_estado = null, dominio_revocado_por_plan = true
--    select * from dominios_huerfanos where dominio = 'menu2.pruebaqa.com';
-- ============================================================================
```

- [ ] **Step 2: Aplicar la migración**

Vía MCP: `apply_migration(project_id="iaiiwtqqiaqxnzxjqcnt", name="dominio_ciclo_vida", query=<contenido sin los comentarios de verificación>)`. Si el subagente no puede, escalar al controlador.

- [ ] **Step 3: Correr las consultas de verificación**

Ejecutar el bloque "Verificar" con `execute_sql` contra un tenant de prueba (NO Cafe Charly). Crear el tenant de prueba si hace falta:
```sql
-- tenant de prueba desechable (si no existe uno)
insert into tenants (nombre_negocio, slug, plan_id)
  values ('QA Dominios', 'qa-dominios-'||substr(gen_random_uuid()::text,1,8),
          (select id from planes where nombre = 'pro'))
  returning id;
```
Confirmar: 4 columnas nuevas presentes; el check acepta `'listo'`; ningún grant nuevo a `authenticated`; `dominio_asignado_at` se llena al asignar; el cambio encola el viejo; el downgrade revoca y prende la bandera.

- [ ] **Step 4: Commit**

```bash
git add src/docs/vibemenu_migracion_dominio_ciclo_vida.sql
git commit -m "feat: migracion ciclo de vida del dominio (diagnostico, huerfanos, revocacion)"
```

---

## Task 2: Helpers puros de `src/lib/dominio.ts`

**Files:**
- Modify: `src/lib/dominio.ts`
- Create: `src/lib/dominio.test.ts`

**Interfaces:**
- Consumes: nada (tipos propios).
- Produces: `DominioDiagnostico`, `RegistroDNS`, `esApexSegunVercel`, `instruccionesDNS`, `motivoProblemaDNS` — consumidos por Tareas 6 y 7. La forma de `DominioDiagnostico` DEBE coincidir con lo que escriben las Tareas 3 y 4 (ver "Interfaces compartidas").

- [ ] **Step 1: Escribir los tests (fallan)**

`src/lib/dominio.test.ts`:

```ts
import { expect, test, describe } from "bun:test";
import {
  esApexSegunVercel,
  instruccionesDNS,
  motivoProblemaDNS,
  type DominioDiagnostico,
} from "./dominio";

const diagBase: DominioDiagnostico = {
  name: "menu.tienda.com.mx",
  apexName: "tienda.com.mx",
  misconfigured: false,
  verification: [],
  recommendedIPv4: ["76.76.21.21"],
  recommendedCNAME: ["cname.vercel-dns.com"],
  revisado_at: "2026-08-28T00:00:00.000Z",
};

describe("esApexSegunVercel", () => {
  test("subdominio .com.mx no es apex", () => {
    expect(esApexSegunVercel("menu.tienda.com.mx", "tienda.com.mx")).toBe(false);
  });
  test("apex .com.mx es apex", () => {
    expect(esApexSegunVercel("tienda.com.mx", "tienda.com.mx")).toBe(true);
  });
});

describe("instruccionesDNS", () => {
  test("subdominio .com.mx -> un CNAME al valor recomendado", () => {
    const r = instruccionesDNS("menu.tienda.com.mx", diagBase);
    expect(r).toEqual([{ tipo: "CNAME", nombre: "menu", valor: "cname.vercel-dns.com" }]);
  });

  test("apex .com.mx -> un registro A al IPv4 recomendado", () => {
    const diag = { ...diagBase, name: "tienda.com.mx", apexName: "tienda.com.mx" };
    const r = instruccionesDNS("tienda.com.mx", diag);
    expect(r).toEqual([{ tipo: "A", nombre: "@", valor: "76.76.21.21" }]);
  });

  test("sin diagnostico -> fallback estatico por conteo de labels sobre sufijo conocido", () => {
    // .com.mx es sufijo compuesto: 'tienda.com.mx' = apex, 'menu.tienda.com.mx' = subdominio
    expect(instruccionesDNS("tienda.com.mx", null)).toEqual([
      { tipo: "A", nombre: "@", valor: "76.76.21.21" },
    ]);
    expect(instruccionesDNS("menu.tienda.com.mx", null)).toEqual([
      { tipo: "CNAME", nombre: "menu", valor: "cname.vercel-dns.com" },
    ]);
    expect(instruccionesDNS("menu.tienda.com", null)).toEqual([
      { tipo: "CNAME", nombre: "menu", valor: "cname.vercel-dns.com" },
    ]);
    expect(instruccionesDNS("tienda.com", null)).toEqual([
      { tipo: "A", nombre: "@", valor: "76.76.21.21" },
    ]);
  });

  test("diagnostico sin recomendados -> cae a los valores estaticos", () => {
    const diag = { ...diagBase, recommendedIPv4: [], recommendedCNAME: [] };
    expect(instruccionesDNS("menu.tienda.com.mx", diag)).toEqual([
      { tipo: "CNAME", nombre: "menu", valor: "cname.vercel-dns.com" },
    ]);
  });
});

describe("motivoProblemaDNS", () => {
  test("null cuando no hay diagnostico", () => {
    expect(motivoProblemaDNS(null)).toBeNull();
  });
  test("null cuando misconfigured es false", () => {
    expect(motivoProblemaDNS(diagBase)).toBeNull();
  });
  test("mensaje generico cuando misconfigured y sin verification", () => {
    expect(motivoProblemaDNS({ ...diagBase, misconfigured: true })).toBe(
      "No encontramos el registro DNS, o apunta a otro lado. Revisa que coincida exactamente con lo de abajo.",
    );
  });
  test("usa el reason de verification cuando existe", () => {
    const diag: DominioDiagnostico = {
      ...diagBase,
      misconfigured: true,
      verification: [
        { type: "TXT", domain: "_vercel.tienda.com.mx", value: "abc", reason: "pending" },
      ],
    };
    expect(motivoProblemaDNS(diag)).toContain("_vercel.tienda.com.mx");
  });
});
```

- [ ] **Step 2: Correr los tests, verificar que fallan**

Run: `bun test src/lib/dominio.test.ts`
Expected: FAIL — funciones no exportadas.

- [ ] **Step 3: Implementar los helpers**

Agregar a `src/lib/dominio.ts` (sin tocar lo existente):

```ts
/** Sufijos públicos compuestos relevantes para el mercado MX; para el fallback sin datos de Vercel. */
const SUFIJOS_COMPUESTOS = [".com.mx", ".org.mx", ".net.mx", ".gob.mx", ".edu.mx"];

export type DominioDiagnostico = {
  name: string;
  apexName: string;
  misconfigured: boolean;
  verification: { type: string; domain: string; value: string; reason: string }[];
  recommendedIPv4: string[];
  recommendedCNAME: string[];
  revisado_at: string;
};

export type RegistroDNS = { tipo: "A" | "CNAME"; nombre: string; valor: string };

const IPV4_VERCEL = "76.76.21.21";
const CNAME_VERCEL = "cname.vercel-dns.com";

/** Vercel dice si el dominio es apex: apexName === name. */
export function esApexSegunVercel(name: string, apexName: string): boolean {
  return name.toLowerCase() === apexName.toLowerCase();
}

/** Fallback sin datos de Vercel: apex si solo quedan 2 labels sobre el sufijo conocido. */
function esApexPorHeuristica(dominio: string): boolean {
  const d = dominio.toLowerCase();
  const sufijo = SUFIJOS_COMPUESTOS.find((s) => d.endsWith(s));
  const labelsSufijo = sufijo ? sufijo.split(".").filter(Boolean).length : 1;
  return d.split(".").length === labelsSufijo + 1;
}

/** El label a la izquierda del apex ("menu" en "menu.tienda.com.mx"), o "@" si es apex. */
function nombreRegistro(dominio: string, esApex: boolean): string {
  if (esApex) return "@";
  return dominio.split(".")[0];
}

export function instruccionesDNS(
  dominio: string,
  diag: DominioDiagnostico | null,
): RegistroDNS[] {
  const esApex = diag
    ? esApexSegunVercel(diag.name, diag.apexName)
    : esApexPorHeuristica(dominio);
  const nombre = nombreRegistro(dominio, esApex);

  if (esApex) {
    const valor = diag?.recommendedIPv4?.[0] ?? IPV4_VERCEL;
    return [{ tipo: "A", nombre, valor }];
  }
  const valor = diag?.recommendedCNAME?.[0] ?? CNAME_VERCEL;
  return [{ tipo: "CNAME", nombre, valor }];
}

export function motivoProblemaDNS(diag: DominioDiagnostico | null): string | null {
  if (!diag || !diag.misconfigured) return null;
  const conReason = diag.verification.find((v) => v.reason && v.domain);
  if (conReason) {
    return `Falta el registro ${conReason.type} en ${conReason.domain}. Créalo con el valor de abajo y vuelve a intentar.`;
  }
  return "No encontramos el registro DNS, o apunta a otro lado. Revisa que coincida exactamente con lo de abajo.";
}
```

- [ ] **Step 4: Correr los tests, verificar que pasan**

Run: `bun test src/lib/dominio.test.ts`
Expected: PASS (todos). Luego `bun test src/lib` completo — sin regresiones.

- [ ] **Step 5: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dominio.ts src/lib/dominio.test.ts
git commit -m "feat: helpers de instrucciones DNS y diagnostico de dominio"
```

---

## Task 3: `_shared/vercel.ts` + `agregar-dominio-vercel` persiste diagnóstico

**Files:**
- Create: `supabase/functions/_shared/vercel.ts`
- Modify: `supabase/functions/agregar-dominio-vercel/index.ts`
- Deploy: `agregar-dominio-vercel`

**Interfaces:**
- Consumes: columnas de la Tarea 1 (`dominio_diagnostico`); forma `DominioDiagnostico` de "Interfaces compartidas".
- Produces: `supabase/functions/_shared/vercel.ts` (ver firma en "Interfaces compartidas") — consumido por Tareas 4 y 5.

- [ ] **Step 1: Escribir `_shared/vercel.ts`**

```ts
// Modulo compartido de las Edge Functions que hablan con la API de Vercel.
// Centraliza el manejo de 429 (rate limit) y la construccion de URLs.

export class RateLimitError extends Error {
  constructor() {
    super("vercel_rate_limit");
    this.name = "RateLimitError";
  }
}

const BASE = "https://api.vercel.com";

export function urlAgregarDominio(project: string, team: string): string {
  return `${BASE}/v10/projects/${project}/domains?teamId=${team}`;
}
export function urlVerificarDominio(project: string, team: string, dominio: string): string {
  return `${BASE}/v9/projects/${project}/domains/${encodeURIComponent(dominio)}/verify?teamId=${team}`;
}
export function urlConfigDominio(project: string, team: string, dominio: string): string {
  return `${BASE}/v6/domains/${encodeURIComponent(dominio)}/config?projectIdOrName=${project}&teamId=${team}`;
}
export function urlBorrarDominio(project: string, team: string, dominio: string): string {
  return `${BASE}/v9/projects/${project}/domains/${encodeURIComponent(dominio)}?teamId=${team}`;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch a Vercel con reintento SOLO ante 429. Respeta Retry-After (segundos).
 * Tras agotar los intentos, lanza RateLimitError -- quien llama corta la corrida
 * y deja el resto para la proxima. No reintenta otros codigos: los maneja quien llama.
 */
export async function fetchVercelConReintento(
  url: string,
  init: RequestInit,
  intentos = 2,
): Promise<Response> {
  for (let i = 0; ; i++) {
    const resp = await fetch(url, init);
    if (resp.status !== 429) return resp;
    if (i >= intentos) {
      await resp.body?.cancel();
      throw new RateLimitError();
    }
    const espera = Number(resp.headers.get("Retry-After")) || 5;
    await resp.body?.cancel();
    await dormir(Math.min(espera, 30) * 1000);
  }
}
```

- [ ] **Step 2: Modificar `agregar-dominio-vercel/index.ts`**

Cambios sobre el archivo actual:
1. Import: `import { fetchVercelConReintento, urlAgregarDominio, urlConfigDominio, RateLimitError } from "../_shared/vercel.ts";`
2. Reemplazar el `fetch(...)` del alta (líneas ~90-100) por `fetchVercelConReintento(urlAgregarDominio(vercelProject, vercelTeam), { method: "POST", headers: {...}, body: JSON.stringify({ name: tenant.dominio_personalizado }) })`.
3. Después del alta (haya sido `ok` o `400` "ya existe"), leer la config y persistir el diagnóstico:

```ts
// Diagnostico: registros DNS recomendados + misconfigured, para que Empresa.tsx
// muestre lo que Vercel realmente pide (no una heuristica local).
try {
  const respAlta = await resp.json().catch(() => ({}));
  const respConfig = await fetchVercelConReintento(
    urlConfigDominio(vercelProject, vercelTeam, tenant.dominio_personalizado),
    { headers: { Authorization: `Bearer ${vercelToken}` } },
  ).then((r) => (r.ok ? r.json() : {}));

  const normalizar = (arr: unknown): string[] =>
    Array.isArray(arr)
      ? arr.map((x) => (typeof x === "string" ? x : (x?.value ?? ""))).filter(Boolean)
      : [];

  const diagnostico = {
    name: respAlta.name ?? tenant.dominio_personalizado,
    apexName: respAlta.apexName ?? tenant.dominio_personalizado,
    misconfigured: Boolean(respConfig.misconfigured),
    verification: Array.isArray(respAlta.verification) ? respAlta.verification : [],
    recommendedIPv4: normalizar(respConfig.recommendedIPv4),
    recommendedCNAME: normalizar(respConfig.recommendedCNAME),
    revisado_at: new Date().toISOString(),
  };
  const { error: errDiag } = await db
    .from("tenants")
    .update({ dominio_diagnostico: diagnostico })
    .eq("id", tenantId);
  if (errDiag) console.error("no se pudo guardar dominio_diagnostico para", tenantId, errDiag);
} catch (e) {
  if (e instanceof RateLimitError) console.warn("vercel 429 al leer config de", tenant.dominio_personalizado);
  else console.error("error leyendo config de dominio para", tenantId, e);
}
```

> Nota para el implementador: confirmá con **un** `curl` real a `GET /v6/domains/<un-dominio-de-prueba>/config?projectIdOrName=...&teamId=...` (con `VERCEL_API_TOKEN`) si `recommendedIPv4`/`recommendedCNAME` vienen como `string[]` o `{rank,value}[]`. El helper `normalizar` cubre ambos, pero dejá un comentario con lo que viste.

- [ ] **Step 3: Verificar que el resto del archivo sigue coherente**

El `return json({ ok: true, vercel_status: resp.status })` final se mantiene. El diagnóstico es best-effort: nunca cambia el status de respuesta.

- [ ] **Step 4: lint del repo**

Run: `bun run lint`
Expected: 0 errores (Prettier incluido sobre `supabase/functions/**`).

- [ ] **Step 5: Desplegar**

`supabase functions deploy agregar-dominio-vercel --project-ref iaiiwtqqiaqxnzxjqcnt` (o MCP `deploy_edge_function`). Si el subagente no puede desplegar, dejar la nota y escalar al controlador.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/vercel.ts supabase/functions/agregar-dominio-vercel/index.ts
git commit -m "feat: agregar-dominio-vercel persiste el diagnostico DNS de Vercel"
```

---

## Task 4: `verificar-dominios-pendientes` — máquina de estados y correo 72 h

**Files:**
- Modify: `supabase/functions/verificar-dominios-pendientes/index.ts`
- Modify: `.github/workflows/verificar-dominios.yml`
- Deploy: `verificar-dominios-pendientes`

**Interfaces:**
- Consumes: columnas de la Tarea 1; `_shared/vercel.ts` de la Tarea 3 (`fetchVercelConReintento`, `urlVerificarDominio`, `urlConfigDominio`, `urlAgregarDominio`, `RateLimitError`).
- Produces: escribe `dominio_estado` (`'verificado'`/`'listo'`), `dominio_diagnostico`, `dominio_aviso_error_at`.

- [ ] **Step 1: Reescribir `verificarUno`**

Reemplazar la función `verificarUno` actual por esta lógica (mantener firma + el tipo `TenantPendiente`, que ahora incluye `dominio_estado`, `dominio_asignado_at`, `dominio_aviso_error_at`):

```ts
type TenantPendiente = {
  id: string;
  nombre_negocio: string;
  dominio_personalizado: string;
  dominio_estado: "pendiente" | "verificado";
  dominio_asignado_at: string | null;
  dominio_aviso_error_at: string | null;
};

const HORAS_ANTES_DE_AVISAR = 72;

async function verificarUno(
  vercelToken: string,
  vercelProject: string,
  vercelTeam: string,
  t: TenantPendiente,
): Promise<"listo" | "verificado" | "pendiente"> {
  const auth = { Authorization: `Bearer ${vercelToken}` };

  // 1. Forzar re-chequeo del DNS.
  const respVerify = await fetchVercelConReintento(
    urlVerificarDominio(vercelProject, vercelTeam, t.dominio_personalizado),
    { method: "POST", headers: auth },
  );

  if (respVerify.status === 404) {
    // Nunca se registro: re-alta y que la proxima corrida lo agarre.
    await fetchVercelConReintento(urlAgregarDominio(vercelProject, vercelTeam), {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name: t.dominio_personalizado }),
    }).catch((e) => console.error("re-alta fallo para", t.dominio_personalizado, e));
    return "pendiente";
  }

  const verifyData = respVerify.ok
    ? ((await respVerify.json()) as { verified?: boolean; name?: string; apexName?: string; verification?: unknown[] })
    : {};

  // 2. Config: registros recomendados + misconfigured.
  const configData = await fetchVercelConReintento(
    urlConfigDominio(vercelProject, vercelTeam, t.dominio_personalizado),
    { headers: auth },
  ).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));

  const normalizar = (arr: unknown): string[] =>
    Array.isArray(arr)
      ? arr.map((x) => (typeof x === "string" ? x : ((x as { value?: string })?.value ?? ""))).filter(Boolean)
      : [];

  const diagnostico = {
    name: verifyData.name ?? t.dominio_personalizado,
    apexName: verifyData.apexName ?? t.dominio_personalizado,
    misconfigured: Boolean((configData as { misconfigured?: boolean }).misconfigured),
    verification: Array.isArray(verifyData.verification) ? verifyData.verification : [],
    recommendedIPv4: normalizar((configData as { recommendedIPv4?: unknown }).recommendedIPv4),
    recommendedCNAME: normalizar((configData as { recommendedCNAME?: unknown }).recommendedCNAME),
    revisado_at: new Date().toISOString(),
  };
  await db.from("tenants").update({ dominio_diagnostico: diagnostico }).eq("id", t.id);

  const dnsOk = Boolean(verifyData.verified) && !diagnostico.misconfigured;

  // 3a. DNS ok: subir a 'verificado' y probar HTTPS en la misma corrida.
  if (dnsOk) {
    if (t.dominio_estado === "pendiente") {
      await db.from("tenants").update({ dominio_estado: "verificado" }).eq("id", t.id);
    }
    let httpsOk = false;
    try {
      await fetch(`https://${t.dominio_personalizado}/`, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });
      httpsOk = true; // resolvio el handshake TLS: el cert ya sirve
    } catch {
      httpsOk = false; // cert aun emitiendose: se queda en 'verificado'
    }
    if (!httpsOk) return "verificado";

    const { error: errListo } = await db
      .from("tenants")
      .update({ dominio_estado: "listo", dominio_aviso_error_at: null })
      .eq("id", t.id);
    if (errListo) {
      console.error("no se pudo marcar dominio_estado='listo' para", t.id, errListo);
      return "verificado";
    }
    await avisarDominioListo(t);
    return "listo";
  }

  // 3b. Sigue mal: correo de recordatorio a las 72h, una sola vez.
  if (
    t.dominio_estado === "pendiente" &&
    t.dominio_asignado_at &&
    !t.dominio_aviso_error_at &&
    Date.now() - new Date(t.dominio_asignado_at).getTime() >= HORAS_ANTES_DE_AVISAR * 3600_000
  ) {
    await avisarDominioProblema(t, diagnostico);
    await db.from("tenants").update({ dominio_aviso_error_at: new Date().toISOString() }).eq("id", t.id);
  }
  return "pendiente";
}
```

- [ ] **Step 2: Extraer los correos a funciones nombradas**

Mover el envío del correo "listo" (hoy inline en `verificarUno`) a `async function avisarDominioListo(t: TenantPendiente)` — reusa `plantillaDominioListo` y la búsqueda del owner + `RESEND_API_KEY` tal como está hoy.

Agregar `async function avisarDominioProblema(t: TenantPendiente, diag: {...})` con una plantilla nueva `plantillaDominioProblema(negocioNombre, dominio, motivo)` — mismo layout de marca que `plantillaDominioListo` (logo, colores `#2B4EFF`, CTA a `${SITIO}/admin/empresa`), copy: título "Tu dominio todavía no responde", cuerpo con `motivo` (derivado igual que `motivoProblemaDNS`: si hay `verification[0].reason` usa el registro faltante, si no el genérico), y "Ya llevas 3 días configurándolo — revisa que el registro DNS coincida exacto." El `motivo` legible se calcula dentro de la Edge Function (no importa `src/lib` — el runtime es Deno); replicar la lógica de `motivoProblemaDNS` en unas líneas.

- [ ] **Step 3: Ajustar el `select` de tenants y el loop `Deno.serve`**

Ambas ramas (cron y manual) cambian el `.select(...)` a:
```ts
"id, nombre_negocio, dominio_personalizado, dominio_estado, dominio_asignado_at, dominio_aviso_error_at"
```
y el filtro del cron de `.eq("dominio_estado", "pendiente")` a `.in("dominio_estado", ["pendiente", "verificado"])`. La rama manual mantiene `.eq("id", tenantId)` pero también `.in("dominio_estado", ["pendiente", "verificado"])`.

En el loop, capturar `RateLimitError` y cortar:
```ts
let verificados = 0;
let corteRateLimit = false;
for (const t of tenants) {
  try {
    const estado = await verificarUno(vercelToken, vercelProject, vercelTeam, t as TenantPendiente);
    if (estado === "listo") verificados++;
  } catch (e) {
    if (e instanceof RateLimitError) { corteRateLimit = true; break; }
    console.error("error verificando", t.id, e);
  }
}
return json({ ok: true, revisados: tenants.length, verificados, corte_rate_limit: corteRateLimit });
```

- [ ] **Step 4: Bump del cron**

`.github/workflows/verificar-dominios.yml`: cambiar `- cron: "30 10 * * *"` por `- cron: "0 */6 * * *"` y actualizar el comentario de cabecera ("Cada 6 horas" en vez de "Diario").

- [ ] **Step 5: lint del repo**

Run: `bun run lint`
Expected: 0 errores.

- [ ] **Step 6: Desplegar**

`supabase functions deploy verificar-dominios-pendientes --project-ref iaiiwtqqiaqxnzxjqcnt`.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/verificar-dominios-pendientes/index.ts .github/workflows/verificar-dominios.yml
git commit -m "feat: verificar-dominios confirma HTTPS antes de avisar y recuerda a las 72h"
```

---

## Task 5: `limpiar-dominios-huerfanos` (nuevo) + workflow

**Files:**
- Create: `supabase/functions/limpiar-dominios-huerfanos/index.ts`
- Create: `.github/workflows/limpiar-dominios.yml`
- Deploy: `limpiar-dominios-huerfanos`

**Interfaces:**
- Consumes: tabla `dominios_huerfanos` y columna `dominio_revocado_por_plan` de la Tarea 1; `_shared/vercel.ts` de la Tarea 3 (`fetchVercelConReintento`, `urlBorrarDominio`, `RateLimitError`).
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Escribir la Edge Function**

`supabase/functions/limpiar-dominios-huerfanos/index.ts`:

```ts
// Edge Function: limpiar-dominios-huerfanos
//
// Barrido nocturno (.github/workflows/limpiar-dominios.yml), protegido por
// DOMINIO_CRON_SECRET -- mismo patron que verificar-dominios-pendientes.
//
// Borra del proyecto de Vercel los dominios que ya ningun tenant usa. La cola
// la llena el trigger validar_dominio_tenant() cada vez que un tenant cambia,
// quita, o pierde (por downgrade) su dominio. Ver
// docs/superpowers/specs/2026-08-28-endurecer-dominios-design.md
//
// Desplegar:
//   supabase functions deploy limpiar-dominios-huerfanos --project-ref iaiiwtqqiaqxnzxjqcnt
//
// Secretos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VERCEL_API_TOKEN,
//           VERCEL_PROJECT_ID, VERCEL_TEAM_ID, DOMINIO_CRON_SECRET, RESEND_API_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";
import { fetchVercelConReintento, urlBorrarDominio, RateLimitError } from "../_shared/vercel.ts";

const SITIO = "https://vibemenu.com.mx";

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function plantillaDominioDesactivado(negocioNombre: string, dominio: string) {
  const urlSuscripcion = `${SITIO}/admin/suscripcion`;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Tu dominio propio se desactivó</title></head>
<body style="margin:0;padding:0;background-color:#F5F6F9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F6F9;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E4E6ED;border-radius:16px;">
        <tr><td style="padding:32px 40px 0 40px;">
          <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#0B0B0F;">Vibemenu</span>
        </td></tr>
        <tr><td style="padding:28px 40px 0 40px;">
          <h1 style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;line-height:1.2;letter-spacing:-0.03em;font-weight:700;color:#0B0B0F;">Tu dominio propio se desactivó.</h1>
          <p style="margin:18px 0 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#4B4E5A;">
            <strong style="color:#0B0B0F;">${dominio}</strong> dejó de servir el menú de ${negocioNombre} porque tu plan ya no incluye dominio propio. Tu menú sigue disponible en vibemenu.com.mx. Si vuelves a Pro, puedes reconectarlo desde tu panel.
          </p>
        </td></tr>
        <tr><td style="padding:32px 40px 40px 40px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#2B4EFF;border-radius:12px;">
            <a href="${urlSuscripcion}" style="display:inline-block;padding:15px 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:12px;">Ver mi plan</a>
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function avisarDesactivado(tenantId: string, dominio: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return;
  const { data: t } = await db.from("tenants").select("nombre_negocio").eq("id", tenantId).maybeSingle();
  const { data: owner } = await db
    .from("tenant_usuarios").select("user_id").eq("tenant_id", tenantId).eq("rol", "owner").maybeSingle();
  if (!owner) return;
  const { data: usuario } = await db.auth.admin.getUserById(owner.user_id);
  if (!usuario?.user?.email) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Vibemenu <hola@vibemenu.com.mx>",
      to: [usuario.user.email],
      subject: `${dominio} ya no sirve tu menú`,
      html: plantillaDominioDesactivado(t?.nombre_negocio ?? "tu negocio", dominio),
    }),
  }).catch((e) => console.error("no se pudo avisar desactivado a", tenantId, e));
}

Deno.serve(async (req) => {
  const secreto = Deno.env.get("DOMINIO_CRON_SECRET");
  if (!secreto || req.headers.get("x-cron-secret") !== secreto) {
    return json({ error: "no_autorizado" }, 401);
  }

  const vercelToken = Deno.env.get("VERCEL_API_TOKEN");
  const vercelProject = Deno.env.get("VERCEL_PROJECT_ID");
  const vercelTeam = Deno.env.get("VERCEL_TEAM_ID");
  if (!vercelToken || !vercelProject || !vercelTeam) {
    return json({ error: "falta_configuracion_vercel" }, 500);
  }

  const { data: filas, error } = await db
    .from("dominios_huerfanos")
    .select("dominio, tenant_id")
    .is("borrado_at", null);
  if (error) return json({ error: error.message }, 500);

  let borrados = 0;
  let corteRateLimit = false;

  for (const fila of filas ?? []) {
    try {
      // Guard anti-borrado: alguien pudo re-agregar el dominio.
      const { data: enUso } = await db
        .from("tenants").select("id").eq("dominio_personalizado", fila.dominio).maybeSingle();
      if (enUso) {
        await db.from("dominios_huerfanos").update({ borrado_at: new Date().toISOString() }).eq("dominio", fila.dominio);
        continue;
      }

      const resp = await fetchVercelConReintento(
        urlBorrarDominio(vercelProject, vercelTeam, fila.dominio),
        { method: "DELETE", headers: { Authorization: `Bearer ${vercelToken}` } },
      );

      if (resp.ok || resp.status === 404) {
        await db.from("dominios_huerfanos").update({ borrado_at: new Date().toISOString() }).eq("dominio", fila.dominio);
        borrados++;

        // Correo solo si fue una revocacion por downgrade.
        if (fila.tenant_id) {
          const { data: t } = await db
            .from("tenants").select("dominio_revocado_por_plan").eq("id", fila.tenant_id).maybeSingle();
          if (t?.dominio_revocado_por_plan) {
            await avisarDesactivado(fila.tenant_id, fila.dominio);
            await db.from("tenants").update({ dominio_revocado_por_plan: false }).eq("id", fila.tenant_id);
          }
        }
      } else {
        console.error(`vercel_delete_fallo (${resp.status}) para ${fila.dominio}:`, await resp.text());
        // Deja borrado_at null: reintento la proxima noche. 409 conflict_aliases = fuera de alcance.
      }
    } catch (e) {
      if (e instanceof RateLimitError) { corteRateLimit = true; break; }
      console.error("error limpiando huerfano", fila.dominio, e);
    }
  }

  return json({ ok: true, revisados: (filas ?? []).length, borrados, corte_rate_limit: corteRateLimit });
});
```

- [ ] **Step 2: Escribir el workflow**

`.github/workflows/limpiar-dominios.yml`:

```yaml
name: Limpiar dominios huerfanos

# Nocturno. Borra del proyecto de Vercel los dominios que ya ningun tenant usa
# -- ver supabase/functions/limpiar-dominios-huerfanos.
on:
  schedule:
    - cron: "0 4 * * *"
  workflow_dispatch: {}

jobs:
  limpiar:
    runs-on: ubuntu-latest
    steps:
      - name: Llamar a limpiar-dominios-huerfanos
        run: |
          curl --fail-with-body -sS -X POST \
            "https://iaiiwtqqiaqxnzxjqcnt.supabase.co/functions/v1/limpiar-dominios-huerfanos" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "x-cron-secret: ${{ secrets.DOMINIO_CRON_SECRET }}"

# Si este job falla, GitHub le manda correo solo al dueño del repo -- mismo
# criterio que verificar-dominios.yml y backup-db.yml.
```

- [ ] **Step 3: lint del repo**

Run: `bun run lint`
Expected: 0 errores.

- [ ] **Step 4: Desplegar**

`supabase functions deploy limpiar-dominios-huerfanos --project-ref iaiiwtqqiaqxnzxjqcnt`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/limpiar-dominios-huerfanos/index.ts .github/workflows/limpiar-dominios.yml
git commit -m "feat: barrido nocturno de dominios huerfanos en Vercel"
```

---

## Task 6: Frontend — `Empresa.tsx`, tipos, demo

**Files:**
- Modify: `src/types/database.ts:756-813` (tres bloques Row/Insert/Update de `tenants`)
- Modify: `src/lib/demo.ts:29-30` (tras `dominio_estado`)
- Modify: `src/pages/admin/Empresa.tsx:388-428`

**Interfaces:**
- Consumes: `instruccionesDNS`, `motivoProblemaDNS`, `DominioDiagnostico` de la Tarea 2; columnas de la Tarea 1 (llegan solas por `select("*")` en `useTenantActual`).
- Produces: nada.

- [ ] **Step 1: Hand-add de columnas en `database.ts`**

En `src/types/database.ts`, dentro de `Tables<"tenants">`, agregar en **cada uno** de los tres sub-objetos (Row en ~756, Insert en ~784, Update en ~812), en orden alfabético junto a las otras `dominio_*`:

Row (sin `?`):
```ts
          dominio_asignado_at: string | null;
          dominio_aviso_error_at: string | null;
          dominio_diagnostico: Json | null;
          dominio_revocado_por_plan: boolean;
```
Insert y Update (con `?`):
```ts
          dominio_asignado_at?: string | null;
          dominio_aviso_error_at?: string | null;
          dominio_diagnostico?: Json | null;
          dominio_revocado_por_plan?: boolean;
```
(`Json` es el tipo helper ya definido en el archivo. NO regenerar el archivo — tiene aliases hand-written al final.)

- [ ] **Step 2: `demo.ts`**

En `src/lib/demo.ts`, tras la línea `dominio_estado: null,` (línea 30):
```ts
  dominio_diagnostico: null,
  dominio_asignado_at: null,
  dominio_aviso_error_at: null,
  dominio_revocado_por_plan: false,
```

- [ ] **Step 3: `Empresa.tsx` — reemplazar el bloque de instrucciones**

Import arriba: `import { MENSAJE_ERROR_DOMINIO, normalizarDominio, instruccionesDNS, motivoProblemaDNS, type DominioDiagnostico } from "@/lib/dominio";`

Antes del `return`, derivar:
```tsx
const diag = (tenant?.dominio_diagnostico as DominioDiagnostico | null) ?? null;
const registrosDNS = instruccionesDNS(dominio.trim(), diag);
const problemaDNS = tenant?.dominio_estado !== "listo" ? motivoProblemaDNS(diag) : null;
```

Reemplazar el bloque actual `{dominio.trim().length > 0 && !dominioInvalido && ( ... )}` (líneas ~388-428) por:

```tsx
{dominio.trim().length > 0 && !dominioInvalido && (
  <>
    {!cambioDominio && tenant.dominio_estado && (
      <p className="mt-2 flex items-center gap-1.5 text-xs">
        {tenant.dominio_estado === "listo" ? (
          <>
            <Check className="size-3.5 shrink-0 text-vm-success" aria-hidden />
            <span className="text-vm-success">Verificado y sirviendo tráfico</span>
          </>
        ) : tenant.dominio_estado === "verificado" ? (
          <>
            <Loader2 className="size-3.5 shrink-0 animate-spin text-vm-body" aria-hidden />
            <span className="text-vm-body">DNS correcto, activando el certificado</span>
          </>
        ) : (
          <>
            <Loader2 className="size-3.5 shrink-0 text-vm-body" aria-hidden />
            <span className="text-vm-body">Pendiente de verificar</span>
          </>
        )}
      </p>
    )}

    {problemaDNS && !cambioDominio && (
      <div className="mt-3 rounded-lg border border-vm-danger bg-vm-danger-soft px-4 py-3 text-xs text-vm-danger">
        <p className="font-medium">Hay un problema con tu DNS</p>
        <p className="mt-1">{problemaDNS}</p>
      </div>
    )}

    <div className="mt-4 rounded-lg bg-vm-bg-soft px-4 py-3 text-xs text-vm-body">
      <p className="font-medium text-vm-ink">Configura tu DNS</p>
      {registrosDNS.map((r) => (
        <p key={r.tipo + r.nombre} className="mt-1">
          Crea un registro <span className="vm-data font-medium">{r.tipo}</span> que apunte{" "}
          <span className="vm-data font-medium">{r.nombre}</span> a{" "}
          <span className="vm-data font-medium">{r.valor}</span>.
        </p>
      ))}
      <p className="mt-2">
        En cuanto tu DNS esté configurado, lo detectamos solos — no hace falta que nos avises.
      </p>
    </div>
  </>
)}
```

> Verificá que `bg-vm-danger-soft` exista como token (grep en `src/index.css` / config de Tailwind). Track A usó `bg-vm-danger-soft` en `BannerFacturacion.tsx`, así que debería estar.

- [ ] **Step 4: typecheck + lint + build**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: sin errores.

- [ ] **Step 5: Correr la suite**

Run: `bun test src/lib`
Expected: sin regresiones (los tests de la Tarea 2 incluidos).

- [ ] **Step 6: Commit**

```bash
git add src/types/database.ts src/lib/demo.ts src/pages/admin/Empresa.tsx
git commit -m "feat: Empresa muestra instrucciones DNS reales y el estado del dominio"
```

---

## Task 7: Frontend — SuperAdmin

**Files:**
- Modify: `src/hooks/useSuperAdmin.ts:81` (el `select`)
- Modify: `src/pages/SuperAdmin.tsx:257-283`
- Modify: `src/pages/SuperAdminDetalle.tsx:~186`

**Interfaces:**
- Consumes: `motivoProblemaDNS`, `DominioDiagnostico` de la Tarea 2; columnas de la Tarea 1.
- Produces: nada.

- [ ] **Step 1: `useSuperAdmin.ts` — traer el diagnóstico**

En el `select` de la línea 81, agregar `dominio_diagnostico` tras `dominio_estado`. En el tipo `TenantResumen` (o como se llame, ~línea 54-57), agregar:
```ts
  dominio_diagnostico: unknown | null;
```

- [ ] **Step 2: `SuperAdmin.tsx` — 4 estados + problema DNS**

Import: `import { motivoProblemaDNS, type DominioDiagnostico } from "@/lib/dominio";`

Reemplazar el bloque `{t.dominio_personalizado ? (...)}` (líneas ~257-283):

```tsx
{t.dominio_personalizado ? (
  (() => {
    const problema = motivoProblemaDNS(
      (t.dominio_diagnostico as DominioDiagnostico | null) ?? null,
    );
    const listo = t.dominio_estado === "listo";
    const verificado = t.dominio_estado === "verificado";
    const etiqueta = listo
      ? "listo"
      : verificado
        ? "verificado"
        : problema
          ? "problema DNS"
          : "pendiente";
    return (
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            listo
              ? "bg-vm-success-soft text-vm-success"
              : problema
                ? "bg-vm-danger-soft text-vm-danger"
                : "bg-vm-warning-soft text-vm-warning",
          )}
        >
          {t.dominio_personalizado} · {etiqueta}
        </span>
        {!listo && (
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
    );
  })()
) : (
  <span className="text-vm-body">—</span>
)}
```

- [ ] **Step 3: `SuperAdminDetalle.tsx` — estado + motivo**

Donde muestra `detalle.tenant.dominio_personalizado ?? "—"` (~línea 186), agregar debajo el estado y, si `motivoProblemaDNS(...)` no es null, el motivo en texto `vm-danger` pequeño. Confirmar primero qué campos trae `detalle.tenant` (puede que haya que sumar `dominio_estado` / `dominio_diagnostico` al query de `useSuperAdminDetalle`).

- [ ] **Step 4: typecheck + lint + build**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSuperAdmin.ts src/pages/SuperAdmin.tsx src/pages/SuperAdminDetalle.tsx
git commit -m "feat: SuperAdmin muestra los 4 estados del dominio y el problema de DNS"
```

---

## Cierre (tras la revisión de rama)

- QA manual completo del spec, §"QA manual", con un dominio de prueba real.
- Regenerar `src/types/database.ts` desde Supabase y comparar contra el hand-add de la Tarea 6.
- Confirmar en el Dashboard de Vercel que el `DELETE` del barrido efectivamente quitó el dominio de prueba.
- Actualizar el artifact "Auditoría Vibemenu" (`8d645623`): filas de la sección 02 "Dominio propio" (Agregar dominio, Estado visible, SSL/certificado, Eliminar/cambiar dominio, Edge cases) y el P0 de dominios en la sección 07.

## Self-Review (hecho)

- **Cobertura del spec:** máquina de estados → T1+T4; instrucciones DNS reales → T2+T3+T6; HTTPS antes de avisar → T4; correo 72 h → T4; barrido nocturno → T5; revocación por downgrade → T1(trigger)+T5(correo); manejo de 429 → T3 (`fetchVercelConReintento`) usado por T4/T5. Todo cubierto.
- **Placeholders:** los pasos de código traen el código real. Dos notas explícitas piden al implementador confirmar con `curl` la forma de `recommendedIPv4/CNAME` y la existencia del token `bg-vm-danger-soft` — son verificaciones, no huecos.
- **Consistencia de tipos:** `DominioDiagnostico` definido una vez en "Interfaces compartidas" y replicado igual en T2; las Edge Functions (T3/T4) escriben esa forma exacta; `RegistroDNS` y las firmas de `_shared/vercel.ts` fijas en T3 y consumidas literal en T4/T5.
