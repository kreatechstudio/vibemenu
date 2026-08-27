# Registro asistido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el registro de una sola pantalla (`Registro.tsx`/`Onboarding.tsx`) por un
wizard guiado de 7 pasos que da de alta el negocio con la información esencial, agrega lada de
país a teléfono/WhatsApp, y cierra con 3 preguntas rápidas de producto guardadas en una tabla
nueva.

**Architecture:** Un solo componente contenedor (`RegistroAsistido`) sin rutas nuevas, con
estado interno de paso y un componente por paso bajo `src/components/registro/pasos/`. El
tenant se crea justo después del paso "Tu negocio" (igual que hoy) — los pasos siguientes
(Contacto, Logo, Métricas) hacen `UPDATE`/`INSERT` directos contra ese tenant en vez de
acumular un borrador. Transiciones animadas con `framer-motion` (ya es dependencia del
proyecto, usado hoy en `Diseno.tsx`).

**Tech Stack:** React, TanStack Router/Query, Supabase (Postgres + Storage), framer-motion,
Tailwind (tokens `vm-*` del proyecto), bun:test.

**Spec:** `src/docs/vibemenu_registro_asistido.md`

## Global Constraints

- Todo el copy, comentarios y mensajes van en español, mismo tono cálido-pero-directo del
  resto del repo.
- Reusar SIEMPRE hooks y helpers existentes en vez de reimplementarlos: `useSlugDisponible`,
  `useActualizarTenant`, `subirImagen` (`src/hooks/useCarta.ts`), `traducirError`,
  `normalizarSlug`, `trackEvent`, `cn`.
- Clases Tailwind: usar los tokens `vm-*` ya definidos (`text-vm-ink`, `text-vm-body`,
  `bg-vm-primary`, `bg-vm-danger-soft`, `bg-vm-success-soft`, `bg-vm-warning-soft`, etc.) — no
  inventar colores nuevos.
- No hay setup de testing de componentes React en este repo (`bun test` solo corre
  `src/lib`). Los componentes de UI se verifican con `bun run typecheck` + prueba manual en
  `bun dev`, no con tests automatizados — igual que el resto de páginas de admin.
- La migración SQL se ejecuta a mano en el SQL Editor de Supabase (el MCP de Supabase no está
  autorizado en este entorno); el archivo `.sql` queda listo para eso, mismo patrón que casi
  todas las migraciones existentes en `src/docs/`.
- No tocar `Login.tsx`, `RestablecerContrasena.tsx`, `AdminLayout.tsx` ni `CompletarAcceso.tsx`
  — el flujo de confirmación de correo pendiente y de OAuth ya funciona con estas páginas tal
  cual están (ver spec §2, nota "Sin borrador en localStorage").

---

### Task 1: Migración SQL + tipos TypeScript de `onboarding_respuestas`

**Files:**

- Create: `src/docs/vibemenu_migracion_onboarding_respuestas.sql`
- Modify: `src/types/database.ts:245-246` (insertar bloque nuevo justo antes de
  `opciones_modificador: {` — alfabéticamente entre `notas_internas` y `opciones_modificador`)

**Interfaces:**

- Produces: tabla Postgres `onboarding_respuestas (id, tenant_id, respuestas, created_at)` +
  el tipo TS `Tables<"onboarding_respuestas">` que usará `guardarRespuestasOnboarding` (Task 3).

- [ ] **Step 1: Escribir la migración**

Crear `src/docs/vibemenu_migracion_onboarding_respuestas.sql`:

```sql
-- ============================================================================
--  VIBEMENU — migracion 019: respuestas de onboarding (metricas de producto)
--
--  Tabla de solo escritura para las 3 preguntas rapidas que el registro
--  asistido hace al final (como maneja su menu hoy, su dolor principal, como
--  nos conocio). Es dato de producto, no operativo: nadie la lee desde el
--  cliente, se consulta desde el dashboard de Supabase o con service_role.
--
--  jsonb en vez de columnas fijas: si las preguntas cambian mas adelante no
--  hace falta otra migracion.
--
--  Ejecutar COMPLETO en el SQL Editor de Supabase.
-- ============================================================================

begin;

create table onboarding_respuestas (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null unique references tenants(id) on delete cascade,
  respuestas jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_onboarding_respuestas_tenant on onboarding_respuestas (tenant_id);

alter table onboarding_respuestas enable row level security;

-- Insert-only: el owner puede crear (una vez, por el unique de arriba) la fila
-- de su propio tenant. Sin policy de select/update/delete para authenticated
-- ni anon — nadie del lado del cliente vuelve a leer esto.
create policy "onboarding_respuestas_insert_owner" on onboarding_respuestas for insert
  to authenticated with check (es_owner_de_tenant(tenant_id));

commit;

-- ============================================================================
--  Verificar:
--    select tablename, rowsecurity from pg_tables where tablename = 'onboarding_respuestas';
--    -- rowsecurity debe ser true
--
--    select polname, cmd, with_check from pg_policies
--      where tablename = 'onboarding_respuestas';
--    -- debe listar solo "onboarding_respuestas_insert_owner", cmd = 'INSERT'
-- ============================================================================
```

- [ ] **Step 2: Agregar el tipo TypeScript a `database.ts`**

Abrir `src/types/database.ts`, localizar la línea `opciones_modificador: {` (línea 246, justo
después de que cierra el bloque de `notas_internas` en la línea 245). Insertar este bloque
completo INMEDIATAMENTE ANTES de `opciones_modificador: {`:

```typescript
      onboarding_respuestas: {
        Row: {
          created_at: string;
          id: string;
          respuestas: Json;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          respuestas?: Json;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          respuestas?: Json;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "onboarding_respuestas_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
```

- [ ] **Step 3: Verificar que el tipo compila**

Run: `bun run typecheck`
Expected: sin errores (el bloque nuevo es aditivo, nada lo consume todavía).

- [ ] **Step 4: Commit**

```bash
git add src/docs/vibemenu_migracion_onboarding_respuestas.sql src/types/database.ts
git commit -m "feat: agrega tabla onboarding_respuestas (migracion 019)"
```

**Nota para quien ejecute el plan:** este archivo `.sql` debe correrse a mano en el SQL Editor
de Supabase antes de que el Task 9 (Métricas) funcione contra una base real — sin la tabla, el
insert de `guardarRespuestasOnboarding` falla silenciosamente (es best-effort a propósito, ver
Task 3), así que el código sigue funcionando pero no guarda nada hasta correr la migración.

---

### Task 2: `src/lib/paises.ts` — lista de ladas + combinar teléfono

**Files:**

- Create: `src/lib/paises.ts`
- Create: `src/lib/paises.test.ts`

**Interfaces:**

- Produces: `PAISES_LADA: PaisLada[]`, `LADA_DEFAULT: string`, `combinarTelefono(lada: string, numero: string): string | null` — los consume `PasoContacto.tsx` (Task 7).

- [ ] **Step 1: Escribir el test primero**

Crear `src/lib/paises.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { combinarTelefono, LADA_DEFAULT, PAISES_LADA } from "@/lib/paises";

describe("PAISES_LADA", () => {
  test("no tiene ladas vacías", () => {
    for (const p of PAISES_LADA) {
      expect(p.lada.length).toBeGreaterThan(1);
      expect(p.lada.startsWith("+")).toBe(true);
      expect(p.pais.length).toBeGreaterThan(0);
    }
  });

  test("México está en la lista con +52", () => {
    const mexico = PAISES_LADA.find((p) => p.pais === "México");
    expect(mexico?.lada).toBe("+52");
  });

  test("LADA_DEFAULT es la lada de México", () => {
    expect(LADA_DEFAULT).toBe("+52");
  });
});

describe("combinarTelefono", () => {
  test("combina lada y número con un espacio", () => {
    expect(combinarTelefono("+52", "55 1234 5678")).toBe("+52 55 1234 5678");
  });

  test("recorta espacios sobrantes del número", () => {
    expect(combinarTelefono("+52", "  55 1234 5678  ")).toBe("+52 55 1234 5678");
  });

  test("número vacío devuelve null", () => {
    expect(combinarTelefono("+52", "")).toBeNull();
    expect(combinarTelefono("+52", "   ")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bun test src/lib/paises.test.ts`
Expected: FAIL — `Cannot find module '@/lib/paises'`.

- [ ] **Step 3: Escribir `src/lib/paises.ts`**

```typescript
/**
 * Lada de país para los campos de teléfono/WhatsApp del registro asistido.
 * Lista curada (no las ~195 del mundo) — LatAm + España + Norteamérica, los
 * mercados relevantes de Vibemenu. `tenants.telefono`/`whatsapp` siguen siendo
 * texto libre: esto solo ayuda a construir un valor bien formado desde el inicio.
 */
export type PaisLada = {
  pais: string;
  lada: string;
};

export const PAISES_LADA: PaisLada[] = [
  { pais: "México", lada: "+52" },
  { pais: "Estados Unidos", lada: "+1" },
  { pais: "Canadá", lada: "+1" },
  { pais: "Guatemala", lada: "+502" },
  { pais: "Belice", lada: "+501" },
  { pais: "El Salvador", lada: "+503" },
  { pais: "Honduras", lada: "+504" },
  { pais: "Nicaragua", lada: "+505" },
  { pais: "Costa Rica", lada: "+506" },
  { pais: "Panamá", lada: "+507" },
  { pais: "Colombia", lada: "+57" },
  { pais: "Venezuela", lada: "+58" },
  { pais: "Ecuador", lada: "+593" },
  { pais: "Perú", lada: "+51" },
  { pais: "Bolivia", lada: "+591" },
  { pais: "Chile", lada: "+56" },
  { pais: "Argentina", lada: "+54" },
  { pais: "Uruguay", lada: "+598" },
  { pais: "Paraguay", lada: "+595" },
  { pais: "República Dominicana", lada: "+1" },
  { pais: "Puerto Rico", lada: "+1" },
  { pais: "España", lada: "+34" },
];

export const LADA_DEFAULT = "+52";

/** Combina lada + número en un solo string para guardar en `tenants.telefono`/`whatsapp`. */
export function combinarTelefono(lada: string, numero: string): string | null {
  const limpio = numero.trim();
  if (!limpio) return null;
  return `${lada} ${limpio}`;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `bun test src/lib/paises.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/paises.ts src/lib/paises.test.ts
git commit -m "feat: agrega lista de ladas de pais para telefono/whatsapp"
```

---

### Task 3: `src/lib/registro.ts` — `crearTenant` devuelve el id + `guardarRespuestasOnboarding`

**Files:**

- Modify: `src/lib/registro.ts`
- Create: `src/lib/registro.test.ts`

**Interfaces:**

- Consumes: tabla `onboarding_respuestas` (Task 1).
- Produces: `crearTenant(t: TenantPendiente): Promise<{ id: string }>` (antes no devolvía nada) — lo consume `PasoNegocio.tsx` (Task 6). `guardarRespuestasOnboarding(tenantId: string, respuestas: Record<string, string>): Promise<void>` — lo consume `PasoMetricas.tsx` (Task 9).

- [ ] **Step 1: Escribir el test primero**

Crear `src/lib/registro.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { guardarRespuestasOnboarding } from "@/lib/registro";

/**
 * guardarRespuestasOnboarding es best-effort: si no hay nada que contestar
 * (el usuario omitió las 3 preguntas), no debe intentar ningún insert — se
 * puede probar sin mockear Supabase porque esa rama corta antes de tocar la
 * red. El resto de la función (el insert real) no tiene test unitario, igual
 * que crearTenant hoy: se verifica manualmente (ver Task 12).
 */
describe("guardarRespuestasOnboarding", () => {
  test("con respuestas vacías no hace nada y no lanza", async () => {
    await expect(guardarRespuestasOnboarding("tenant-falso", {})).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bun test src/lib/registro.test.ts`
Expected: FAIL — `guardarRespuestasOnboarding` todavía no existe en `@/lib/registro`.

- [ ] **Step 3: Modificar `crearTenant` para que devuelva el id**

En `src/lib/registro.ts`, reemplazar:

```typescript
export async function crearTenant(t: TenantPendiente) {
  const { error } = await supabase.from("tenants").insert(t);
  if (error) throw error;
  limpiarTenantPendiente();

  // Fire and forget: un correo de bienvenida que falla no debe tumbar el
  // registro. trg_crear_owner ya corrio dentro del insert de arriba, asi que
  // la funcion ya encuentra el tenant_usuarios al consultarlo.
  void supabase.functions.invoke("enviar-bienvenida").catch(() => {});
}
```

por:

```typescript
export async function crearTenant(t: TenantPendiente): Promise<{ id: string }> {
  const { data, error } = await supabase.from("tenants").insert(t).select("id").single();
  if (error) throw error;
  limpiarTenantPendiente();

  // Fire and forget: un correo de bienvenida que falla no debe tumbar el
  // registro. trg_crear_owner ya corrio dentro del insert de arriba, asi que
  // la funcion ya encuentra el tenant_usuarios al consultarlo.
  void supabase.functions.invoke("enviar-bienvenida").catch(() => {});

  return data;
}
```

(La policy `tenants_select_publico` ya permite leer cualquier tenant por `select "id"` — no
hace falta tocar RLS para esto.)

- [ ] **Step 4: Agregar `guardarRespuestasOnboarding` al final del archivo**

Agregar al final de `src/lib/registro.ts`:

```typescript
/**
 * Guarda las respuestas de las 3 preguntas rápidas del paso "Cuéntanos más" del
 * registro asistido. Best-effort a propósito: si falla, no debe bloquear al
 * usuario ni mostrarle un error — es dato de producto, no algo que el negocio
 * necesite para funcionar. Si `respuestas` viene vacío (el usuario omitió las
 * 3 preguntas), no inserta nada.
 */
export async function guardarRespuestasOnboarding(
  tenantId: string,
  respuestas: Record<string, string>,
): Promise<void> {
  if (Object.keys(respuestas).length === 0) return;

  const { error } = await supabase
    .from("onboarding_respuestas")
    .insert({ tenant_id: tenantId, respuestas });

  if (error) {
    console.error("[onboarding_respuestas] no se pudo guardar:", error);
  }
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `bun test src/lib/registro.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 6: Verificar que compila**

Run: `bun run typecheck`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/lib/registro.ts src/lib/registro.test.ts
git commit -m "feat: crearTenant devuelve el id, agrega guardarRespuestasOnboarding"
```

---

### Task 4: `PasoCuenta.tsx`

**Files:**

- Create: `src/components/registro/pasos/PasoCuenta.tsx`

**Interfaces:**

- Consumes: `Captcha`, `captchaHabilitado`, `TurnstileInstance` (`@/components/ui/captcha`); `BotonGoogle` (`@/components/ui/boton-google`); `traducirError` (`@/lib/errores`); `supabase` (`@/lib/supabase`).
- Produces: `PasoCuentaProps = { onListo: () => void; onConfirmarCorreo: (email: string) => void }` — lo consume `RegistroAsistido.tsx` (Task 11).

- [ ] **Step 1: Crear el componente**

Crear `src/components/registro/pasos/PasoCuenta.tsx`:

```tsx
import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";
import BotonGoogle from "@/components/ui/boton-google";
import Captcha, { captchaHabilitado, type TurnstileInstance } from "@/components/ui/captcha";
import { supabase } from "@/lib/supabase";
import { traducirError } from "@/lib/errores";

type PasoCuentaProps = {
  onListo: () => void;
  onConfirmarCorreo: (email: string) => void;
};

export default function PasoCuenta({ onListo, onConfirmarCorreo }: PasoCuentaProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileInstance>(null);

  const puedeEnviar =
    email.includes("@") &&
    password.length >= 6 &&
    (!captchaHabilitado || captchaToken !== null) &&
    !enviando;

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      const { data, error: errorAuth } = await supabase.auth.signUp({
        email,
        password,
        options: captchaToken ? { captchaToken } : undefined,
      });
      if (errorAuth) throw errorAuth;

      if (!data.session) {
        onConfirmarCorreo(email);
        return;
      }

      onListo();
    } catch (err) {
      setError(traducirError(err as Error).mensaje);
      captchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl text-vm-ink">Crea tu cuenta</h1>
      <p className="mt-2 text-sm text-vm-body">El primer paso para tener tu menú digital.</p>

      <form onSubmit={alEnviar} className="mt-6 space-y-5">
        <div>
          <label htmlFor="email" className="text-sm font-medium text-vm-ink">
            Correo
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
          />
        </div>

        <div>
          <label htmlFor="password" className="text-sm font-medium text-vm-ink">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
          />
        </div>

        {error && (
          <p className="flex items-center gap-1.5 rounded-lg bg-vm-danger-soft px-3.5 py-2.5 text-sm text-vm-danger">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <p className="text-xs leading-relaxed text-vm-body">
          Al crear tu cuenta aceptas el{" "}
          <Link to="/privacidad" className="text-vm-primary hover:underline">
            Aviso de Privacidad
          </Link>{" "}
          de Vibemenu.
        </p>

        <Captcha ref={captchaRef} onToken={setCaptchaToken} />

        <button
          type="submit"
          disabled={!puedeEnviar}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Crear cuenta
        </button>

        <div className="flex items-center gap-3 text-xs text-vm-body">
          <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
        </div>

        <BotonGoogle />

        <p className="text-center text-sm text-vm-body">
          ¿Ya tienes menú?{" "}
          <Link to="/login" className="font-medium text-vm-primary hover:underline">
            Entra aquí
          </Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `bun run typecheck`
Expected: sin errores (el componente no se usa todavía, pero debe compilar solo).

- [ ] **Step 3: Commit**

```bash
git add src/components/registro/pasos/PasoCuenta.tsx
git commit -m "feat: agrega PasoCuenta al registro asistido"
```

---

### Task 5: `PasoBienvenida.tsx`

**Files:**

- Create: `src/components/registro/pasos/PasoBienvenida.tsx`

**Interfaces:**

- Consumes: `REGISTRO` (`@/lib/copy`).
- Produces: `PasoBienvenidaProps = { onContinuar: () => void }` — lo consume `RegistroAsistido.tsx` (Task 11).

- [ ] **Step 1: Crear el componente**

Crear `src/components/registro/pasos/PasoBienvenida.tsx`:

```tsx
import { UtensilsCrossed } from "lucide-react";
import { REGISTRO } from "@/lib/copy";

type PasoBienvenidaProps = {
  onContinuar: () => void;
};

export default function PasoBienvenida({ onContinuar }: PasoBienvenidaProps) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-vm-primary/10">
        <UtensilsCrossed className="size-8 text-vm-primary" aria-hidden />
      </div>

      <div>
        <h1 className="text-2xl text-vm-ink">Bienvenido a Vibemenu</h1>
        <p className="mt-3 text-sm leading-relaxed text-vm-body">
          Tu cuenta ya está lista. Ahora vamos a armar tu negocio paso a paso — en unos minutos tu
          menú digital estará listo para tus clientes.
        </p>
      </div>

      <button
        type="button"
        onClick={onContinuar}
        className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-vm-primary text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover"
      >
        Vamos a crear tu negocio
      </button>

      <p className="text-xs text-vm-body">{REGISTRO.nota}</p>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `bun run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/registro/pasos/PasoBienvenida.tsx
git commit -m "feat: agrega PasoBienvenida al registro asistido"
```

---

### Task 6: `PasoNegocio.tsx`

**Files:**

- Create: `src/components/registro/pasos/PasoNegocio.tsx`

**Interfaces:**

- Consumes: `crearTenant` con firma `(t: TenantPendiente) => Promise<{ id: string }>` (Task 3); `useSlugDisponible`, `EstadoSlug` (`@/hooks/useSlugDisponible`); `MENSAJE_ERROR_SLUG`, `normalizarSlug` (`@/lib/slug`); `EMPRESA` (`@/lib/legal`); `trackEvent` (`@/lib/analytics`); `cn` (`@/lib/utils`).
- Produces: `PasoNegocioProps = { onCreado: (tenant: { id: string; nombreNegocio: string }) => void; onAtras: () => void }` — lo consume `RegistroAsistido.tsx` (Task 11).

- [ ] **Step 1: Crear el componente**

Crear `src/components/registro/pasos/PasoNegocio.tsx`:

```tsx
import { useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useSlugDisponible, type EstadoSlug } from "@/hooks/useSlugDisponible";
import { crearTenant } from "@/lib/registro";
import { traducirError } from "@/lib/errores";
import { MENSAJE_ERROR_SLUG, normalizarSlug } from "@/lib/slug";
import { EMPRESA } from "@/lib/legal";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const GIROS = ["Restaurante", "Cafetería", "Bar", "Food truck", "Panadería"];

function AvisoSlug({ estado }: { estado: EstadoSlug }) {
  switch (estado.estado) {
    case "verificando":
      return (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-vm-body">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Verificando disponibilidad…
        </p>
      );
    case "disponible":
      return (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-vm-success">
          <Check className="size-3.5" aria-hidden />
          Disponible
        </p>
      );
    case "ocupado":
    case "reservado":
      return (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-vm-danger">
          <AlertCircle className="size-3.5" aria-hidden />
          Ese nombre ya está en uso — prueba con otra variante.
        </p>
      );
    case "invalido":
      return (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-vm-danger">
          <AlertCircle className="size-3.5" aria-hidden />
          {MENSAJE_ERROR_SLUG[estado.motivo]}
        </p>
      );
    default:
      return null;
  }
}

type PasoNegocioProps = {
  onCreado: (tenant: { id: string; nombreNegocio: string }) => void;
  onAtras: () => void;
};

export default function PasoNegocio({ onCreado, onAtras }: PasoNegocioProps) {
  const [nombre, setNombre] = useState("");
  const [giro, setGiro] = useState<string | null>(null);
  const [giroOtro, setGiroOtro] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estadoSlug = useSlugDisponible(slug);
  const giroFinal = giro === "Otro" ? giroOtro.trim() : giro;
  const puedeEnviar = nombre.trim().length > 1 && estadoSlug.estado === "disponible" && !enviando;

  function alCambiarNombre(valor: string) {
    setNombre(valor);
    if (!slugTocado) setSlug(normalizarSlug(valor));
  }

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      const tenant = await crearTenant({
        nombre_negocio: nombre.trim(),
        slug: slug.trim(),
        giro: giroFinal?.trim() || null,
      });
      trackEvent("sign_up", { method: "email" });
      onCreado({ id: tenant.id, nombreNegocio: nombre.trim() });
    } catch (err) {
      setError(traducirError(err as Error).mensaje);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl text-vm-ink">¿Cómo se llama tu negocio?</h1>
      <p className="mt-2 text-sm text-vm-body">Así es como lo van a ver tus clientes en tu menú.</p>

      <form onSubmit={alEnviar} className="mt-6 space-y-5">
        <div>
          <label htmlFor="nombre" className="text-sm font-medium text-vm-ink">
            Nombre del negocio
          </label>
          <input
            id="nombre"
            required
            value={nombre}
            onChange={(e) => alCambiarNombre(e.target.value)}
            placeholder="Café Aurora"
            className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
          />
        </div>

        <div>
          <span className="text-sm font-medium text-vm-ink">
            Giro <span className="font-normal text-vm-body">(opcional)</span>
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...GIROS, "Otro"].map((opcion) => (
              <button
                key={opcion}
                type="button"
                onClick={() => setGiro(opcion === giro ? null : opcion)}
                className={cn(
                  "h-10 rounded-lg border px-4 text-sm transition-colors",
                  giro === opcion
                    ? "border-vm-primary bg-vm-primary text-white"
                    : "text-vm-ink hover:border-vm-primary",
                )}
              >
                {opcion}
              </button>
            ))}
          </div>
          {giro === "Otro" && (
            <input
              value={giroOtro}
              onChange={(e) => setGiroOtro(e.target.value)}
              placeholder="Cuéntanos cuál"
              className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
          )}
        </div>

        <div>
          <label htmlFor="slug" className="text-sm font-medium text-vm-ink">
            La dirección de tu menú
          </label>
          <div
            className={cn(
              "mt-2 flex h-12 items-center overflow-hidden rounded-lg border bg-white focus-within:ring-2 focus-within:ring-vm-primary/20",
              estadoSlug.estado === "disponible" && "border-vm-success",
              (estadoSlug.estado === "ocupado" ||
                estadoSlug.estado === "reservado" ||
                estadoSlug.estado === "invalido") &&
                "border-vm-danger",
            )}
          >
            <span className="select-none self-stretch border-r bg-vm-bg-soft px-3.5 py-3.5 text-sm text-vm-body">
              {EMPRESA.dominio}/
            </span>
            <input
              id="slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugTocado(true);
                setSlug(normalizarSlug(e.target.value));
              }}
              placeholder="cafe-aurora"
              className="h-full flex-1 px-3 text-sm outline-none"
              aria-describedby="slug-aviso"
            />
          </div>
          <div id="slug-aviso" aria-live="polite">
            <AvisoSlug estado={estadoSlug} />
          </div>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 rounded-lg bg-vm-danger-soft px-3.5 py-2.5 text-sm text-vm-danger">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onAtras}
            className="inline-flex h-12 items-center justify-center rounded-lg border px-6 text-sm font-medium text-vm-ink hover:bg-vm-bg-soft"
          >
            Atrás
          </button>
          <button
            type="submit"
            disabled={!puedeEnviar}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Continuar
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `bun run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/registro/pasos/PasoNegocio.tsx
git commit -m "feat: agrega PasoNegocio al registro asistido"
```

---

### Task 7: `PasoContacto.tsx`

**Files:**

- Create: `src/components/registro/pasos/PasoContacto.tsx`

**Interfaces:**

- Consumes: `useActualizarTenant` (`@/hooks/useActualizarTenant`); `combinarTelefono`, `LADA_DEFAULT`, `PAISES_LADA` (`@/lib/paises`, Task 2); `traducirError` (`@/lib/errores`).
- Produces: `PasoContactoProps = { tenantId: string; onContinuar: () => void }` — lo consume `RegistroAsistido.tsx` (Task 11).

- [ ] **Step 1: Crear el componente**

Crear `src/components/registro/pasos/PasoContacto.tsx`:

```tsx
import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useActualizarTenant } from "@/hooks/useActualizarTenant";
import { combinarTelefono, LADA_DEFAULT, PAISES_LADA } from "@/lib/paises";
import { traducirError } from "@/lib/errores";

type PasoContactoProps = {
  tenantId: string;
  onContinuar: () => void;
};

export default function PasoContacto({ tenantId, onContinuar }: PasoContactoProps) {
  const actualizar = useActualizarTenant(tenantId);
  const [ladaTelefono, setLadaTelefono] = useState(LADA_DEFAULT);
  const [telefono, setTelefono] = useState("");
  const [ladaWhatsapp, setLadaWhatsapp] = useState(LADA_DEFAULT);
  const [whatsapp, setWhatsapp] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puedeEnviar = telefono.trim().length > 0 && whatsapp.trim().length > 0 && !enviando;

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      await actualizar.mutateAsync({
        telefono: combinarTelefono(ladaTelefono, telefono),
        whatsapp: combinarTelefono(ladaWhatsapp, whatsapp),
      });
      onContinuar();
    } catch (err) {
      setError(traducirError(err as Error).mensaje);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl text-vm-ink">¿Cómo te contactan tus clientes?</h1>
      <p className="mt-2 text-sm text-vm-body">
        Lo usamos para que puedan escribirte y pedir directo por WhatsApp.
      </p>

      <form onSubmit={alEnviar} className="mt-6 space-y-5">
        <div>
          <label htmlFor="telefono" className="text-sm font-medium text-vm-ink">
            Teléfono
          </label>
          <div className="mt-2 flex gap-2">
            <select
              aria-label="Lada de teléfono"
              value={ladaTelefono}
              onChange={(e) => setLadaTelefono(e.target.value)}
              className="h-12 rounded-lg border bg-white px-2 text-sm text-vm-ink outline-none focus:border-vm-primary"
            >
              {PAISES_LADA.map((p) => (
                <option key={p.pais} value={p.lada}>
                  {p.pais} ({p.lada})
                </option>
              ))}
            </select>
            <input
              id="telefono"
              type="tel"
              required
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="55 1234 5678"
              className="h-12 flex-1 rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
          </div>
        </div>

        <div>
          <label htmlFor="whatsapp" className="text-sm font-medium text-vm-ink">
            WhatsApp para pedidos
          </label>
          <div className="mt-2 flex gap-2">
            <select
              aria-label="Lada de WhatsApp"
              value={ladaWhatsapp}
              onChange={(e) => setLadaWhatsapp(e.target.value)}
              className="h-12 rounded-lg border bg-white px-2 text-sm text-vm-ink outline-none focus:border-vm-primary"
            >
              {PAISES_LADA.map((p) => (
                <option key={p.pais} value={p.lada}>
                  {p.pais} ({p.lada})
                </option>
              ))}
            </select>
            <input
              id="whatsapp"
              type="tel"
              required
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="55 1234 5678"
              className="h-12 flex-1 rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
          </div>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 rounded-lg bg-vm-danger-soft px-3.5 py-2.5 text-sm text-vm-danger">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!puedeEnviar}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Continuar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `bun run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/registro/pasos/PasoContacto.tsx
git commit -m "feat: agrega PasoContacto (con lada de pais) al registro asistido"
```

---

### Task 8: `PasoLogo.tsx`

**Files:**

- Create: `src/components/registro/pasos/PasoLogo.tsx`

**Interfaces:**

- Consumes: `useActualizarTenant` (`@/hooks/useActualizarTenant`); `subirImagen` (`@/hooks/useCarta`); `ESTADOS.errorImagen` (`@/lib/copy`).
- Produces: `PasoLogoProps = { tenantId: string; onContinuar: () => void }` — lo consume `RegistroAsistido.tsx` (Task 11).

- [ ] **Step 1: Crear el componente**

Crear `src/components/registro/pasos/PasoLogo.tsx`:

```tsx
import { useState } from "react";
import { Check, ImagePlus, Loader2 } from "lucide-react";
import { useActualizarTenant } from "@/hooks/useActualizarTenant";
import { subirImagen } from "@/hooks/useCarta";
import { ESTADOS } from "@/lib/copy";

type PasoLogoProps = {
  tenantId: string;
  onContinuar: () => void;
};

export default function PasoLogo({ tenantId, onContinuar }: PasoLogoProps) {
  const actualizar = useActualizarTenant(tenantId);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function alSubir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError(null);
    setSubiendo(true);
    try {
      const url = await subirImagen(tenantId, archivo, "logos");
      await actualizar.mutateAsync({ logo_url: url });
      setLogoUrl(url);
    } catch {
      setError(ESTADOS.errorImagen);
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl text-vm-ink">Dale cara a tu negocio</h1>
      <p className="mt-2 text-sm text-vm-body">
        Un logo ayuda a que tu menú se vea profesional. Puedes agregarlo después si no lo tienes a
        la mano.
      </p>

      <label
        htmlFor="logo"
        className="mt-6 flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed bg-vm-bg-soft px-6 py-10 text-center hover:border-vm-primary"
      >
        {logoUrl ? (
          <img src={logoUrl} alt="Logo del negocio" className="size-16 rounded-lg object-cover" />
        ) : subiendo ? (
          <Loader2 className="size-8 animate-spin text-vm-primary" aria-hidden />
        ) : (
          <ImagePlus className="size-8 text-vm-primary" aria-hidden />
        )}
        <span className="text-sm font-medium text-vm-ink">
          {logoUrl ? "Logo subido" : "Arrastra tu logo o haz clic para subir"}
        </span>
        <span className="text-xs text-vm-body">PNG o JPG, máx 2MB</span>
        <input
          id="logo"
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => void alSubir(e)}
          disabled={subiendo}
          className="hidden"
        />
      </label>

      {error && <p className="mt-3 text-sm text-vm-danger">{error}</p>}

      <div className="mt-6 flex items-center justify-end gap-5">
        {!logoUrl && (
          <button
            type="button"
            onClick={onContinuar}
            className="text-sm font-medium text-vm-body underline hover:text-vm-primary"
          >
            Lo hago después
          </button>
        )}
        <button
          type="button"
          onClick={onContinuar}
          disabled={subiendo}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-vm-primary px-6 text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {logoUrl && <Check className="size-4" aria-hidden />}
          Continuar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `bun run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/registro/pasos/PasoLogo.tsx
git commit -m "feat: agrega PasoLogo al registro asistido"
```

---

### Task 9: `PasoMetricas.tsx`

**Files:**

- Create: `src/components/registro/pasos/PasoMetricas.tsx`

**Interfaces:**

- Consumes: `guardarRespuestasOnboarding` con firma `(tenantId: string, respuestas: Record<string, string>) => Promise<void>` (Task 3); `cn` (`@/lib/utils`).
- Produces: `PasoMetricasProps = { tenantId: string; onContinuar: () => void }` — lo consume `RegistroAsistido.tsx` (Task 11).

- [ ] **Step 1: Crear el componente**

Crear `src/components/registro/pasos/PasoMetricas.tsx`:

```tsx
import { useState } from "react";
import { guardarRespuestasOnboarding } from "@/lib/registro";
import { cn } from "@/lib/utils";

const PREGUNTA_1 = "¿Cómo manejas tu menú hoy?";
const OPCIONES_1 = [
  "Papel o impreso",
  "PDF o Word",
  "Redes sociales",
  "Otra app de menú digital",
  "Aún no tengo uno",
];

const PREGUNTA_2 = "¿Cuál es tu mayor dolor de cabeza con tu menú actual?";
const OPCIONES_2 = [
  "Actualizar precios es lento",
  "No se ve profesional",
  "Batallo para tomar pedidos",
  "Los clientes no ven fotos u opciones claras",
  "Otro",
];

const PREGUNTA_3 = "¿Cómo nos conociste?";
const OPCIONES_3 = ["Redes sociales", "Recomendación", "Búsqueda en Google", "Otro"];

type PasoMetricasProps = {
  tenantId: string;
  onContinuar: () => void;
};

function GrupoOpciones({
  pregunta,
  opciones,
  valor,
  alElegir,
}: {
  pregunta: string;
  opciones: string[];
  valor: string | null;
  alElegir: (opcion: string) => void;
}) {
  return (
    <div>
      <span className="text-sm font-medium text-vm-ink">{pregunta}</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {opciones.map((opcion) => (
          <button
            key={opcion}
            type="button"
            onClick={() => alElegir(opcion === valor ? "" : opcion)}
            className={cn(
              "h-9 rounded-lg border px-3 text-xs transition-colors",
              valor === opcion
                ? "border-vm-primary bg-vm-primary text-white"
                : "text-vm-ink hover:border-vm-primary",
            )}
          >
            {opcion}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PasoMetricas({ tenantId, onContinuar }: PasoMetricasProps) {
  const [comoManejasMenu, setComoManejasMenu] = useState<string | null>(null);
  const [dolorPrincipal, setDolorPrincipal] = useState<string | null>(null);
  const [dolorPrincipalOtro, setDolorPrincipalOtro] = useState("");
  const [comoNosConociste, setComoNosConociste] = useState<string | null>(null);
  const [comoNosConocisteOtro, setComoNosConocisteOtro] = useState("");

  function alContinuar() {
    const respuestas: Record<string, string> = {};
    if (comoManejasMenu) respuestas.como_manejas_menu = comoManejasMenu;
    if (dolorPrincipal) {
      respuestas.dolor_principal = dolorPrincipal;
      if (dolorPrincipal === "Otro" && dolorPrincipalOtro.trim()) {
        respuestas.dolor_principal_otro = dolorPrincipalOtro.trim();
      }
    }
    if (comoNosConociste) {
      respuestas.como_nos_conociste = comoNosConociste;
      if (comoNosConociste === "Otro" && comoNosConocisteOtro.trim()) {
        respuestas.como_nos_conociste_otro = comoNosConocisteOtro.trim();
      }
    }
    void guardarRespuestasOnboarding(tenantId, respuestas);
    onContinuar();
  }

  return (
    <div>
      <h1 className="text-2xl text-vm-ink">Cuéntanos un poco más</h1>
      <p className="mt-2 text-sm text-vm-body">
        Nos ayuda a mejorar Vibemenu para negocios como el tuyo.
      </p>

      <div className="mt-6 space-y-6">
        <GrupoOpciones
          pregunta={PREGUNTA_1}
          opciones={OPCIONES_1}
          valor={comoManejasMenu}
          alElegir={setComoManejasMenu}
        />

        <div>
          <GrupoOpciones
            pregunta={PREGUNTA_2}
            opciones={OPCIONES_2}
            valor={dolorPrincipal}
            alElegir={setDolorPrincipal}
          />
          {dolorPrincipal === "Otro" && (
            <input
              value={dolorPrincipalOtro}
              onChange={(e) => setDolorPrincipalOtro(e.target.value)}
              placeholder="Cuéntanos"
              className="mt-2 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
          )}
        </div>

        <div>
          <GrupoOpciones
            pregunta={PREGUNTA_3}
            opciones={OPCIONES_3}
            valor={comoNosConociste}
            alElegir={setComoNosConociste}
          />
          {comoNosConociste === "Otro" && (
            <input
              value={comoNosConocisteOtro}
              onChange={(e) => setComoNosConocisteOtro(e.target.value)}
              placeholder="Cuéntanos"
              className="mt-2 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-5">
        <button
          type="button"
          onClick={onContinuar}
          className="text-sm font-medium text-vm-body underline hover:text-vm-primary"
        >
          Omitir
        </button>
        <button
          type="button"
          onClick={alContinuar}
          className="inline-flex h-12 items-center justify-center rounded-lg bg-vm-primary px-6 text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `bun run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/registro/pasos/PasoMetricas.tsx
git commit -m "feat: agrega PasoMetricas al registro asistido"
```

---

### Task 10: `PasoFelicidades.tsx`

**Files:**

- Create: `src/components/registro/pasos/PasoFelicidades.tsx`

**Interfaces:**

- Consumes: `useNavigate` (`@tanstack/react-router`).
- Produces: `PasoFelicidadesProps = { nombreNegocio: string }` — lo consume `RegistroAsistido.tsx` (Task 11).

- [ ] **Step 1: Crear el componente**

Crear `src/components/registro/pasos/PasoFelicidades.tsx`:

```tsx
import { useNavigate } from "@tanstack/react-router";
import { PartyPopper } from "lucide-react";

type PasoFelicidadesProps = {
  nombreNegocio: string;
};

export default function PasoFelicidades({ nombreNegocio }: PasoFelicidadesProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-vm-success-soft">
        <PartyPopper className="size-8 text-vm-success" aria-hidden />
      </div>

      <div>
        <h1 className="text-2xl text-vm-ink">¡Felicidades! {nombreNegocio} ya está en Vibemenu</h1>
        <p className="mt-3 text-sm leading-relaxed text-vm-body">
          Tu menú digital está listo para compartirse. Tienes 14 días de prueba con el plan Pro para
          explorar personalización, modificadores, códigos QR y más.
        </p>
      </div>

      <span className="rounded-full bg-vm-warning-soft px-3 py-1 text-xs font-medium text-vm-warning">
        Prueba Pro · 14 días
      </span>

      <button
        type="button"
        onClick={() => void navigate({ to: "/admin" })}
        className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-vm-primary text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover"
      >
        Ir a mi panel
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `bun run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/registro/pasos/PasoFelicidades.tsx
git commit -m "feat: agrega PasoFelicidades al registro asistido"
```

---

### Task 11: `RegistroAsistido.tsx` — ensamblar el wizard + reemplazar `Registro.tsx`/`Onboarding.tsx`

**Files:**

- Create: `src/components/registro/RegistroAsistido.tsx`
- Modify: `src/pages/Registro.tsx` (reemplazo completo)
- Modify: `src/pages/Onboarding.tsx` (reemplazo completo)

**Interfaces:**

- Consumes: los 7 `Paso*` de las Tasks 4-10 con las props ya definidas ahí; `useSesion` (`@/hooks/useSesion`); `useTenantActual` (`@/hooks/useTenantActual`); `Navigate` (`@tanstack/react-router`); `AnimatePresence`, `motion` (`framer-motion`).
- Produces: `RegistroAsistido` sin props, usado por ambas páginas.

- [ ] **Step 1: Crear el contenedor**

Crear `src/components/registro/RegistroAsistido.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Navigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { MailCheck } from "lucide-react";
import { useSesion } from "@/hooks/useSesion";
import { useTenantActual } from "@/hooks/useTenantActual";
import PasoCuenta from "@/components/registro/pasos/PasoCuenta";
import PasoBienvenida from "@/components/registro/pasos/PasoBienvenida";
import PasoNegocio from "@/components/registro/pasos/PasoNegocio";
import PasoContacto from "@/components/registro/pasos/PasoContacto";
import PasoLogo from "@/components/registro/pasos/PasoLogo";
import PasoMetricas from "@/components/registro/pasos/PasoMetricas";
import PasoFelicidades from "@/components/registro/pasos/PasoFelicidades";

type Paso = "cuenta" | "bienvenida" | "negocio" | "contacto" | "logo" | "metricas" | "felicidades";

const PROGRESO: Partial<Record<Paso, number>> = {
  negocio: 1,
  contacto: 2,
  logo: 3,
  metricas: 4,
};

export default function RegistroAsistido() {
  const { user, cargando: cargandoSesion } = useSesion();
  const { data: ctx, isLoading: cargandoTenant } = useTenantActual();

  const [paso, setPaso] = useState<Paso | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [correoConfirmacion, setCorreoConfirmacion] = useState<string | null>(null);

  // Con sesión ya puesta (OAuth, o una recarga después de crear la cuenta) el
  // wizard arranca en Bienvenida — el copy de ahí ("Tu cuenta ya está lista")
  // solo tiene sentido si ya hay sesión. Sin sesión, arranca en Cuenta.
  useEffect(() => {
    if (cargandoSesion || paso !== null) return;
    setPaso(user ? "bienvenida" : "cuenta");
  }, [cargandoSesion, user, paso]);

  if (!cargandoTenant && ctx) return <Navigate to="/admin" />;

  if (correoConfirmacion) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center shadow-vm-1">
        <MailCheck className="mx-auto size-10 text-vm-primary" aria-hidden />
        <h1 className="mt-5 text-2xl">Confirma tu correo</h1>
        <p className="mt-3 text-sm leading-relaxed text-vm-body">
          Te enviamos un enlace a{" "}
          <span className="font-medium text-vm-ink">{correoConfirmacion}</span>. Ábrelo desde este
          dispositivo para seguir armando tu negocio.
        </p>
      </div>
    );
  }

  if (cargandoSesion || cargandoTenant || paso === null) return null;

  const progreso = PROGRESO[paso];

  return (
    <div className="w-full">
      {progreso && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-medium text-vm-body">
            <span>Vibemenu</span>
            <span>Paso {progreso} de 4</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-vm-bg-soft">
            <div
              className="h-full rounded-full bg-vm-primary transition-all duration-300"
              style={{ width: `${(progreso / 4) * 100}%` }}
            />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={paso}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="rounded-xl border bg-white p-7 shadow-vm-1"
        >
          {paso === "cuenta" && (
            <PasoCuenta
              onListo={() => setPaso("bienvenida")}
              onConfirmarCorreo={setCorreoConfirmacion}
            />
          )}

          {paso === "bienvenida" && <PasoBienvenida onContinuar={() => setPaso("negocio")} />}

          {paso === "negocio" && (
            <PasoNegocio
              onCreado={(tenant) => {
                setTenantId(tenant.id);
                setNombreNegocio(tenant.nombreNegocio);
                setPaso("contacto");
              }}
              onAtras={() => setPaso("bienvenida")}
            />
          )}

          {paso === "contacto" && tenantId && (
            <PasoContacto tenantId={tenantId} onContinuar={() => setPaso("logo")} />
          )}

          {paso === "logo" && tenantId && (
            <PasoLogo tenantId={tenantId} onContinuar={() => setPaso("metricas")} />
          )}

          {paso === "metricas" && tenantId && (
            <PasoMetricas tenantId={tenantId} onContinuar={() => setPaso("felicidades")} />
          )}

          {paso === "felicidades" && <PasoFelicidades nombreNegocio={nombreNegocio} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar `src/pages/Registro.tsx` completo**

```tsx
import Layout from "@/components/layout/Layout";
import RegistroAsistido from "@/components/registro/RegistroAsistido";

export default function Registro() {
  return (
    <Layout>
      <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
        <RegistroAsistido />
      </section>
    </Layout>
  );
}
```

- [ ] **Step 3: Reemplazar `src/pages/Onboarding.tsx` completo**

```tsx
import Layout from "@/components/layout/Layout";
import RegistroAsistido from "@/components/registro/RegistroAsistido";

export default function Onboarding() {
  return (
    <Layout>
      <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
        <RegistroAsistido />
      </section>
    </Layout>
  );
}
```

(`src/routes/registro.tsx` y `src/routes/onboarding.tsx` no cambian — siguen importando el
`export default` de estas dos páginas tal cual.)

- [ ] **Step 4: Verificar que compila**

Run: `bun run typecheck`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/registro/RegistroAsistido.tsx src/pages/Registro.tsx src/pages/Onboarding.tsx
git commit -m "feat: ensambla el registro asistido y reemplaza Registro/Onboarding"
```

---

### Task 12: QA final

**Files:** ninguno nuevo — verificación de todo lo anterior.

- [ ] **Step 1: Lint completo**

Run: `bun run lint`
Expected: sin errores (si hay warnings de imports no usados en los archivos viejos, corregirlos).

- [ ] **Step 2: Typecheck completo**

Run: `bun run typecheck`
Expected: sin errores.

- [ ] **Step 3: Tests de `src/lib`**

Run: `bun test src/lib`
Expected: PASS, incluyendo los 6 tests nuevos de `paises.test.ts` y el de `registro.test.ts`.

- [ ] **Step 4: Formato**

Run: `bun run format`
Expected: sin diffs pendientes (o los que Prettier haga, revisarlos y volver a `git add`).

- [ ] **Step 5: Prueba manual — flujo email/password**

Run: `bun dev`, abrir `/registro` en el navegador y recorrer el wizard completo con un correo
de prueba: Cuenta → Bienvenida → Tu negocio (probar un chip de Giro y también "Otro") →
Contacto (probar cambiar la lada) → Logo (probar "Lo hago después") → Cuéntanos más (contestar
una y omitir las otras dos) → Felicidades → confirmar que aterriza en `/admin` y que el
negocio aparece con el nombre correcto en el sidebar.

Si Supabase Auth tiene confirmación de correo activada en ese proyecto, verificar también que
aparece la pantalla "Confirma tu correo" al no haber sesión inmediata tras el paso Cuenta.

- [ ] **Step 6: Prueba manual — flujo Google (si hay credenciales de prueba)**

Entrar con "Continuar con Google" desde `/login` o `/registro`, confirmar que aterriza
directo en Bienvenida (sin ver el paso Cuenta) y que el resto del flujo es idéntico.

- [ ] **Step 7: Confirmar la migración pendiente**

Recordar al usuario que `src/docs/vibemenu_migracion_onboarding_respuestas.sql` (Task 1) debe
correrse en el SQL Editor de Supabase antes de que las respuestas de "Cuéntanos más" se
guarden de verdad — sin la tabla, el paso sigue funcionando (best-effort) pero no persiste
nada.

- [ ] **Step 8: Commit final si el formato tocó algo**

```bash
git add -A
git commit -m "chore: formato final del registro asistido"
```

(Omitir este paso si `bun run format` no generó cambios.)
