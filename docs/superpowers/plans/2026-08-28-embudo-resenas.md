# Embudo a reseñas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A los ~20 s en el menú público, un aviso "¿cómo estuvo tu visita?" — 🙂 abre Google Reviews, 😐/🙁 guarda un comentario anónimo que el dueño ve en una pestaña "Opiniones" del panel.

**Architecture:** Una tabla `feedback_privado` + función `registrar_feedback` (SECURITY DEFINER, patrón `registrar_visita`); flag `planes.permite_embudo_resenas`; componente `EmbudoResenas` en el menú público reusando `contactoSucursal` del sub-proyecto #1; página de admin nueva `/admin/opiniones`.

**Tech Stack:** React 18 + TS, TanStack Router (file-based, `routeTree.gen.ts` autogenerado) + Query, Tailwind, framer-motion, Supabase (Postgres + RLS), `bun test` para `src/lib`.

**Spec:** `docs/superpowers/specs/2026-08-28-embudo-resenas-design.md`

## Global Constraints

- **Migración:** `planes.permite_embudo_resenas boolean not null default false` (backfill `true` para `nombre <> 'free'`); tabla `feedback_privado` (sentimiento `check in ('regular','mal')`, comentario `check <= 500`, `resuelto` bool, `sucursal_id ... on delete set null`); función `registrar_feedback(p_tenant_id uuid, p_sentimiento text, p_sucursal_id uuid default null, p_comentario text default null)` — params con default AL FINAL (regla de Postgres). Grants: `select` + `update (resuelto)` a `authenticated`; `execute` de la función a `anon, authenticated`.
- **El sentimiento `bien` NUNCA se guarda** — solo abre el enlace. El RPC lo rechaza (`return` temprano) y el cliente no lo manda.
- **`EmbudoResenas` NO se monta** en la rama TikTok de `MenuPublico.tsx` ni en `/demo`.
- **Una vez por navegador y por tenant** vía `localStorage` clave `vm:embudo:<tenantId>` — responder O cerrar la marca.
- **Estilo del menú:** solo variables CSS del tema (`--menu-primario`, `--menu-fondo`, `--menu-texto`, `--menu-texto-suave`). Nunca el azul de Vibemenu (`vm-primary` etc. está prohibido en `src/components/menu/`).
- **`routeTree.gen.ts` NO se edita a mano** — se regenera corriendo `bun run build` (o `bun run dev`) y se commitea el resultado.
- **`src/types/database.ts`:** hand-add si el MCP de Supabase no está autorizado; regenerar con `generate_typescript_types` si sí lo está.
- **Migración a producción:** paso manual del usuario si el MCP no puede aplicarla. A diferencia del sub-proyecto #1, un fallo aquí **no rompe** escrituras existentes (degrada suave: `useOpiniones` tiene `retry:false`, el RPC del menú es fire-and-forget).
- **Copy en español**, tono del producto. Iconos de `lucide-react`.
- **Commits** en español, prefijo `feat:` / `refactor:` / `docs:`, terminan con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Verde = `bun test src/lib` + `bun run typecheck` + `bun run lint` (0 errores; ~12 warnings `react-refresh` pre-existentes son OK) + `bun run build`.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/docs/vibemenu_migracion_embudo_resenas.sql` | **Crear.** Migración completa. |
| `src/types/database.ts` | **Modificar.** `feedback_privado`, `planes.permite_embudo_resenas`, `registrar_feedback`. |
| `src/pages/Privacidad.tsx` | **Modificar.** Una frase en `datos-que-recabamos`. |
| `src/lib/embudo.ts` + `src/lib/embudo.test.ts` | **Crear.** Guard "ya respondió" con storage inyectable. |
| `src/hooks/useMenuPublico.ts` | **Modificar.** Select de plan + `permiteEmbudoResenas` en el tipo y en `armarMenuPublico`. |
| `src/components/menu/EmbudoResenas.tsx` | **Crear.** La hoja del embudo. |
| `src/pages/MenuPublico.tsx` | **Modificar.** Monta `<EmbudoResenas/>` fuera de la rama TikTok. |
| `src/hooks/useOpiniones.ts` | **Crear.** `useOpiniones` + `useMarcarOpinionResuelta`. |
| `src/routes/admin.opiniones.tsx` | **Crear.** Ruta file-based. |
| `src/routeTree.gen.ts` | **Regenerado** por `bun run build`. |
| `src/components/layout/PillTabs.tsx` | **Modificar.** Entrada "Opiniones" en `PESTANAS_NEGOCIO`. |
| `src/pages/admin/Opiniones.tsx` | **Crear.** Página con gating, filtro y "marcar resuelto". |

---

## Task 1: Migración + tipos + privacidad

**Files:**
- Create: `src/docs/vibemenu_migracion_embudo_resenas.sql`
- Modify: `src/types/database.ts` (bloque `Tables` — insertar `feedback_privado` alfabéticamente; `planes` Row/Insert/Update; bloque `Functions` — `registrar_feedback`)
- Modify: `src/pages/Privacidad.tsx` (sección `datos-que-recabamos`, líneas ~60-64)

**Interfaces:**
- Consumes: nada.
- Produces: tabla `feedback_privado` y flag `planes.permite_embudo_resenas` visibles en los tipos; función `registrar_feedback` tipada.

- [ ] **Step 1: Crear el archivo de migración**

`src/docs/vibemenu_migracion_embudo_resenas.sql` — copiar **exactamente** el bloque SQL de la sección "Arquitectura › 1. Migración" del spec (`docs/superpowers/specs/2026-08-28-embudo-resenas-design.md`), incluyendo el `begin; … commit;`, los comentarios y el bloque `-- Verificar` del final.

- [ ] **Step 2: Aplicar la migración**

Si el MCP de Supabase está autorizado: `mcp__claude_ai_Supabase__apply_migration` con `name: "embudo_resenas"` y el cuerpo entre `begin;`/`commit;`.
Si no: dejarlo como paso manual (pegar en el SQL Editor). Anotarlo en el reporte y luego en el PR.

- [ ] **Step 3: Hand-add en `src/types/database.ts` — `planes`**

En el bloque `planes:`, agregar `permite_embudo_resenas` en orden alfabético: va **entre `permite_dominio_propio` y `permite_multiusuario`**.

```ts
// Row:
          permite_dominio_propio: boolean;
          permite_embudo_resenas: boolean;
          permite_multiusuario: boolean;
// Insert:
          permite_dominio_propio?: boolean;
          permite_embudo_resenas?: boolean;
          permite_multiusuario?: boolean;
// Update:
          permite_dominio_propio?: boolean;
          permite_embudo_resenas?: boolean;
          permite_multiusuario?: boolean;
```

- [ ] **Step 4: Hand-add en `src/types/database.ts` — tabla `feedback_privado`**

Dentro de `Tables`, en orden alfabético (antes de `horarios`, después de `datos_fiscales` / lo que corresponda — buscar la posición). Modelar sobre `visitas_menu`:

```ts
      feedback_privado: {
        Row: {
          comentario: string | null;
          creado_at: string;
          id: number;
          resuelto: boolean;
          sentimiento: string;
          sucursal_id: string | null;
          tenant_id: string;
        };
        Insert: {
          comentario?: string | null;
          creado_at?: string;
          id?: never;
          resuelto?: boolean;
          sentimiento: string;
          sucursal_id?: string | null;
          tenant_id: string;
        };
        Update: {
          comentario?: string | null;
          creado_at?: string;
          id?: never;
          resuelto?: boolean;
          sentimiento?: string;
          sucursal_id?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_privado_sucursal_id_fkey";
            columns: ["sucursal_id"];
            isOneToOne: false;
            referencedRelation: "sucursales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feedback_privado_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
```

- [ ] **Step 5: Hand-add en `src/types/database.ts` — función `registrar_feedback`**

En el bloque `Functions`, en orden alfabético (justo antes de `registrar_visita`):

```ts
      registrar_feedback: {
        Args: {
          p_comentario?: string;
          p_sentimiento: string;
          p_sucursal_id?: string;
          p_tenant_id: string;
        };
        Returns: undefined;
      };
```

- [ ] **Step 6: Frase en Privacidad**

`src/pages/Privacidad.tsx`, la sección con `id: "datos-que-recabamos"`. El `<p>` que empieza `<strong>Si escaneas un menú público:</strong>` — añadir una frase al final, dentro del mismo `<p>`:

```tsx
        <p>
          <strong>Si escaneas un menú público:</strong> no creamos una cuenta ni un perfil tuyo.
          Registramos únicamente un conteo agregado de visitas por sucursal y por día — nunca una
          fila por persona, ni tu ubicación, ni tu identidad. Si dejas un comentario en el aviso de
          «¿cómo estuvo tu visita?», se guarda ese texto tal cual, sin ligarlo a tu identidad ni a
          tu dispositivo.
        </p>
```

- [ ] **Step 7: Verificar que compila**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/docs/vibemenu_migracion_embudo_resenas.sql src/types/database.ts src/pages/Privacidad.tsx
git commit -m "$(cat <<'EOF'
feat: tabla feedback_privado y flag permite_embudo_resenas

Migracion del embudo a resenas: flag de plan, tabla de opiniones
privadas con RLS y funcion registrar_feedback (SECURITY DEFINER, patron
registrar_visita). Mas una frase en privacidad sobre el comentario
anonimo.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Helper `embudo.ts`

**Files:**
- Create: `src/lib/embudo.ts`
- Test: `src/lib/embudo.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type SentimientoEmbudo = "bien" | "regular" | "mal"`
  - `claveEmbudo(tenantId: string): string` → `"vm:embudo:<tenantId>"`
  - `yaRespondioEmbudo(tenantId: string, storage: Pick<Storage,"getItem"|"setItem"> | undefined): boolean`
  - `marcarEmbudoRespondido(tenantId: string, storage: Pick<Storage,"getItem"|"setItem"> | undefined): void`

- [ ] **Step 1: Escribir el test que falla**

`src/lib/embudo.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { claveEmbudo, marcarEmbudoRespondido, yaRespondioEmbudo } from "@/lib/embudo";

/** localStorage falso: un Map con la misma firma parcial que usa el helper. */
function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    _map: m,
  };
}

function storageQueLanza() {
  return {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceeded");
    },
  };
}

describe("claveEmbudo", () => {
  test("namespacea por tenant", () => {
    expect(claveEmbudo("abc-123")).toBe("vm:embudo:abc-123");
  });
});

describe("yaRespondioEmbudo / marcarEmbudoRespondido", () => {
  test("false antes de marcar, true despues", () => {
    const s = fakeStorage();
    expect(yaRespondioEmbudo("t1", s)).toBe(false);
    marcarEmbudoRespondido("t1", s);
    expect(yaRespondioEmbudo("t1", s)).toBe(true);
  });

  test("cada tenant es independiente", () => {
    const s = fakeStorage();
    marcarEmbudoRespondido("t1", s);
    expect(yaRespondioEmbudo("t2", s)).toBe(false);
  });

  test("guarda un timestamp ISO, no solo un flag", () => {
    const s = fakeStorage();
    marcarEmbudoRespondido("t1", s);
    expect(s._map.get("vm:embudo:t1")).toMatch(/^\d{4}-\d\d-\d\dT/);
  });

  test("storage undefined: no responde, no lanza", () => {
    expect(yaRespondioEmbudo("t1", undefined)).toBe(false);
    expect(() => marcarEmbudoRespondido("t1", undefined)).not.toThrow();
  });

  test("storage que lanza: se trata como 'no respondio', sin propagar", () => {
    const s = storageQueLanza();
    expect(yaRespondioEmbudo("t1", s)).toBe(false);
    expect(() => marcarEmbudoRespondido("t1", s)).not.toThrow();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bun test src/lib/embudo.test.ts`
Expected: FAIL — `Cannot find module '@/lib/embudo'`.

- [ ] **Step 3: Escribir la implementación**

`src/lib/embudo.ts`:

```ts
export type SentimientoEmbudo = "bien" | "regular" | "mal";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** localStorage (persiste entre sesiones, a diferencia de las visitas). */
export const claveEmbudo = (tenantId: string): string => `vm:embudo:${tenantId}`;

/**
 * ¿Ya respondió (o cerró) el embudo en este navegador para este tenant?
 * Cualquier fallo de storage (modo privado, cuota) cuenta como "no respondió":
 * peor mostrarlo dos veces que tragarse una reseña.
 */
export function yaRespondioEmbudo(
  tenantId: string,
  storage: StorageLike | undefined,
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(claveEmbudo(tenantId)) !== null;
  } catch {
    return false;
  }
}

/** Marca el embudo como atendido en este navegador. Silenciosa ante fallos. */
export function marcarEmbudoRespondido(
  tenantId: string,
  storage: StorageLike | undefined,
): void {
  if (!storage) return;
  try {
    storage.setItem(claveEmbudo(tenantId), new Date().toISOString());
  } catch {
    /* modo privado: se aceptará mostrarlo otra vez */
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `bun test src/lib/embudo.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Suite + lint + typecheck**

Run: `bun test src/lib && bun run lint && bun run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/embudo.ts src/lib/embudo.test.ts
git commit -m "$(cat <<'EOF'
feat: helper embudo con guard de una-vez-por-navegador

yaRespondioEmbudo / marcarEmbudoRespondido sobre un storage inyectable
(testeable, a diferencia del sessionStorage global de useVisitas).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `EmbudoResenas` + wiring en el menú público

**Files:**
- Modify: `src/hooks/useMenuPublico.ts` (el `select` de plan en las 3 funciones `obtener*`; el tipo `MenuPublico`; `armarMenuPublico`)
- Create: `src/components/menu/EmbudoResenas.tsx`
- Modify: `src/pages/MenuPublico.tsx` (import + montaje en `cuerpo`)

**Interfaces:**
- Consumes: `contactoSucursal` (`@/lib/contacto`), `yaRespondioEmbudo` / `marcarEmbudoRespondido` (`@/lib/embudo`), `supabase` (`@/lib/supabase`).
- Produces: `MenuPublico` gana `permiteEmbudoResenas: boolean`. `EmbudoResenas` default export: `({ tenant: Tenant; sucursal: Sucursal | null; habilitado: boolean }) => ReactElement | null`.

- [ ] **Step 1: `useMenuPublico` — exponer el flag**

En `src/hooks/useMenuPublico.ts`:

1. Las **tres** consultas de tenant (`obtenerMenuPublico`, `obtenerMenuPublicoPorDominio`, `obtenerSucursalPublicaPorDominio`) usan hoy:
   `.select("*, plan:planes(marca_agua, menu_independiente_por_sucursal)")`
   Cambiar las tres a:
   `.select("*, plan:planes(marca_agua, menu_independiente_por_sucursal, permite_embudo_resenas)")`

2. En el tipo `MenuPublico`, junto a `marcaAgua`:
   ```ts
   marcaAgua: boolean;
   /** planes.permite_embudo_resenas — gatea el aviso "¿cómo estuvo tu visita?". */
   permiteEmbudoResenas: boolean;
   menuIndependiente: boolean;
   ```

3. En `armarMenuPublico`, el objeto de retorno, junto a `marcaAgua: plan?.marca_agua ?? true`:
   ```ts
   marcaAgua: plan?.marca_agua ?? true,
   permiteEmbudoResenas: plan?.permite_embudo_resenas ?? false,
   ```

4. Ajustar el tipo del parámetro `plan` de `armarMenuPublico` — hoy es `Pick<Plan, "marca_agua" | "menu_independiente_por_sucursal"> | null`. Añadir `"permite_embudo_resenas"` al `Pick`. (Buscar la firma exacta; puede estar como un tipo inline en `tenantRow`.)

- [ ] **Step 2: Verificar typecheck**

Run: `bun run typecheck`
Expected: PASS. Si falla en `MenuPublico.tsx` por `permiteEmbudoResenas` faltante en algún objeto literal de `DatosMenu`, es esperado y lo arregla el Step 4 (el demo/`inicial` no construye `MenuPublico` a mano — confirmar; si lo hace, añadir el campo ahí también).

- [ ] **Step 3: Crear `EmbudoResenas.tsx`**

`src/components/menu/EmbudoResenas.tsx`:

```tsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Frown, Meh, Smile, X } from "lucide-react";
import { contactoSucursal } from "@/lib/contacto";
import { marcarEmbudoRespondido, yaRespondioEmbudo } from "@/lib/embudo";
import { supabase } from "@/lib/supabase";
import type { Sucursal, Tenant } from "@/types/database";

const ESPERA_MS = 20_000;
const GRACIAS_MS = 3_000;

type Fase = "oculto" | "pregunta" | "comentario" | "gracias";

const storage = () => (typeof window !== "undefined" ? window.localStorage : undefined);

/**
 * Aviso "¿cómo estuvo tu visita?" al pie del menú público.
 *
 * 🙂 → abre el enlace de reseñas de Google (sucursal → empresa, vía
 * contactoSucursal). 😐/🙁 → comentario opcional que se guarda en
 * feedback_privado por el RPC registrar_feedback (fire-and-forget, el menú
 * nunca se rompe por esto). Una vez por navegador y por tenant; cerrar cuenta.
 *
 * Gateado por plan (habilitado) y por que exista un enlace de reseñas.
 * No se monta en TikTok ni en /demo (lo decide MenuPublico.tsx).
 */
export default function EmbudoResenas({
  tenant,
  sucursal,
  habilitado,
}: {
  tenant: Tenant;
  sucursal: Sucursal | null;
  habilitado: boolean;
}) {
  const resenasUrl = contactoSucursal(sucursal, tenant).googleReviewsUrl;

  // Lectura única: si ya respondió/cerró en este navegador, el embudo no existe.
  const [yaRespondio] = useState(() => yaRespondioEmbudo(tenant.id, storage()));

  const puedeMostrar = habilitado && resenasUrl !== null && !yaRespondio;

  const [fase, setFase] = useState<Fase>("oculto");
  const [sentimiento, setSentimiento] = useState<"regular" | "mal">("regular");
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    if (!puedeMostrar) return;
    const t = setTimeout(() => setFase("pregunta"), ESPERA_MS);
    return () => clearTimeout(t);
  }, [puedeMostrar]);

  useEffect(() => {
    if (fase !== "gracias") return;
    const t = setTimeout(() => setFase("oculto"), GRACIAS_MS);
    return () => clearTimeout(t);
  }, [fase]);

  function cerrar() {
    marcarEmbudoRespondido(tenant.id, storage());
    setFase("oculto");
  }

  function elegirBien() {
    if (resenasUrl) window.open(resenasUrl, "_blank", "noopener,noreferrer");
    cerrar();
  }

  function elegirMalo(s: "regular" | "mal") {
    setSentimiento(s);
    setFase("comentario");
  }

  function enviar() {
    void supabase.rpc("registrar_feedback", {
      p_tenant_id: tenant.id,
      p_sentimiento: sentimiento,
      p_sucursal_id: sucursal?.id,
      p_comentario: comentario.trim() || undefined,
    });
    marcarEmbudoRespondido(tenant.id, storage());
    setFase("gracias");
  }

  if (!puedeMostrar || fase === "oculto") return null;

  const borde = "color-mix(in srgb, var(--menu-texto) 12%, transparent)";

  return (
    <motion.div
      role="dialog"
      aria-label="¿Cómo estuvo tu visita?"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md p-3"
    >
      <div
        className="relative rounded-2xl border p-4 shadow-lg"
        style={{ background: "var(--menu-fondo)", borderColor: borde, color: "var(--menu-texto)" }}
      >
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar"
          className="absolute right-3 top-3 opacity-60 transition-opacity hover:opacity-100"
        >
          <X className="size-4" />
        </button>

        {fase === "pregunta" && (
          <>
            <p className="pr-6 text-sm font-medium">¿Cómo estuvo tu visita?</p>
            <div className="mt-3 flex gap-2">
              {(
                [
                  { k: "bien", Icono: Smile, txt: "Bien", fn: elegirBien },
                  { k: "regular", Icono: Meh, txt: "Regular", fn: () => elegirMalo("regular") },
                  { k: "mal", Icono: Frown, txt: "Mal", fn: () => elegirMalo("mal") },
                ] as const
              ).map(({ k, Icono, txt, fn }) => (
                <button
                  key={k}
                  type="button"
                  onClick={fn}
                  className="flex flex-1 flex-col items-center gap-1 rounded-xl border py-2.5 text-xs transition-opacity hover:opacity-80"
                  style={{ borderColor: borde }}
                >
                  <Icono className="size-6" style={{ color: "var(--menu-primario)" }} aria-hidden />
                  {txt}
                </button>
              ))}
            </div>
          </>
        )}

        {fase === "comentario" && (
          <>
            <p className="pr-6 text-sm font-medium">¿Qué podríamos mejorar?</p>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Opcional — solo lo verá el negocio."
              className="mt-2 w-full resize-none rounded-lg border bg-transparent p-2.5 text-sm outline-none"
              style={{ borderColor: borde }}
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={enviar}
                className="h-10 flex-1 rounded-lg text-sm font-medium text-white"
                style={{ background: "var(--menu-primario)" }}
              >
                Enviar
              </button>
              <button
                type="button"
                onClick={cerrar}
                className="h-10 rounded-lg px-3 text-sm opacity-70 transition-opacity hover:opacity-100"
              >
                Ahora no
              </button>
            </div>
          </>
        )}

        {fase === "gracias" && <p className="py-2 pr-6 text-sm">Gracias, lo tomamos en cuenta.</p>}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 4: Montar en `MenuPublico.tsx`**

Import junto a `ContactoMenu`:
```ts
import EmbudoResenas from "@/components/menu/EmbudoResenas";
```

En `const cuerpo = (…)`, justo **después** de `<ContactoMenu tenant={data.tenant} sucursal={data.sucursalActiva} />` y antes de `{data.marcaAgua && <MarcaAgua />}`:

```tsx
      <ContactoMenu tenant={data.tenant} sucursal={data.sucursalActiva} />

      <EmbudoResenas
        tenant={data.tenant}
        sucursal={data.sucursalActiva}
        habilitado={data.permiteEmbudoResenas}
      />

      {data.marcaAgua && <MarcaAgua />}
```

La rama `data.formato === "tiktok"` (la que renderiza `<Formato/>` + `<MarcaAgua flotante />` sin `cuerpo`) **no** se toca. `Demo.tsx` **no** se toca.

- [ ] **Step 5: typecheck + lint + suite + build**

Run: `bun test src/lib && bun run typecheck && bun run lint && bun run build`
Expected: los cuatro PASS.

- [ ] **Step 6: Verificación manual (sin navegador: releer el diff)**

Confirmar: (a) los hooks se declaran siempre, el gate es `if (!puedeMostrar || fase === "oculto") return null` DESPUÉS de los hooks; (b) `elegirBien` no manda nada al RPC; (c) `p_sucursal_id: sucursal?.id` es `undefined` cuando no hay sucursal (supabase-js lo omite → default `null`); (d) TikTok y demo intactos. Anotar QA de navegador pendiente.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useMenuPublico.ts src/components/menu/EmbudoResenas.tsx src/pages/MenuPublico.tsx
git commit -m "$(cat <<'EOF'
feat: embudo a resenas en el menu publico

A los 20s, aviso "como estuvo tu visita": bien abre Google Reviews,
regular/mal guarda comentario anonimo via registrar_feedback. Una vez
por navegador, gateado por plan y por enlace de resenas. Fuera de
TikTok y /demo.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Panel — `/admin/opiniones`

**Files:**
- Create: `src/hooks/useOpiniones.ts`
- Create: `src/routes/admin.opiniones.tsx`
- Modify: `src/routeTree.gen.ts` (regenerado por `bun run build`, no a mano)
- Modify: `src/components/layout/PillTabs.tsx` (`PESTANAS_NEGOCIO`)
- Create: `src/pages/admin/Opiniones.tsx`

**Interfaces:**
- Consumes: `feedback_privado` (tipos de Task 1), `useTenantActual`, `useSucursales`, `AdminLayout`, `PillTabs` + `PESTANAS_NEGOCIO`.
- Produces: ruta `/admin/opiniones`; `useOpiniones(tenantId)` → `{ data: Opinion[] }`; `useMarcarOpinionResuelta(tenantId)` → mutation `(id: number)`.

- [ ] **Step 1: `useOpiniones.ts`**

`src/hooks/useOpiniones.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type Opinion = {
  id: number;
  sucursal_id: string | null;
  sentimiento: "regular" | "mal";
  comentario: string | null;
  resuelto: boolean;
  creado_at: string;
};

/**
 * Opiniones privadas del tenant, más reciente primero. `retry: false`: sin la
 * migración `vibemenu_migracion_embudo_resenas.sql` la tabla no existe y
 * reintentar no la crea.
 */
export function useOpiniones(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["opiniones", tenantId],
    enabled: Boolean(tenantId),
    retry: false,
    queryFn: async (): Promise<Opinion[]> => {
      const { data, error } = await supabase
        .from("feedback_privado")
        .select("id, sucursal_id, sentimiento, comentario, resuelto, creado_at")
        .eq("tenant_id", tenantId!)
        .order("creado_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Opinion[];
    },
  });
}

export function useMarcarOpinionResuelta(tenantId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    // La policy feedback_update_miembros + grant update(resuelto) solo dejan
    // tocar esta columna.
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("feedback_privado")
        .update({ resuelto: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["opiniones", tenantId] }),
  });
}
```

- [ ] **Step 2: Ruta**

`src/routes/admin.opiniones.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import Opiniones from "@/pages/admin/Opiniones";

export const Route = createFileRoute("/admin/opiniones")({
  component: Opiniones,
});
```

- [ ] **Step 3: Pestaña en `PillTabs.tsx`**

`PESTANAS_NEGOCIO` — insertar "Opiniones" **antes de "Suscripción"**:

```ts
export const PESTANAS_NEGOCIO: Pestana[] = [
  { a: "/admin/empresa", etiqueta: "Perfil" },
  { a: "/admin/sucursales", etiqueta: "Sucursales" },
  { a: "/admin/equipo", etiqueta: "Equipo" },
  { a: "/admin/opiniones", etiqueta: "Opiniones" },
  { a: "/admin/suscripcion", etiqueta: "Suscripción" },
];
```

- [ ] **Step 4: Página `Opiniones.tsx`**

`src/pages/admin/Opiniones.tsx`:

```tsx
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Frown, Lock, Meh, MessageSquare } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import PillTabs, { PESTANAS_NEGOCIO } from "@/components/layout/PillTabs";
import { useTenantActual } from "@/hooks/useTenantActual";
import { useSucursales } from "@/hooks/useSucursales";
import { useOpiniones, useMarcarOpinionResuelta, type Opinion } from "@/hooks/useOpiniones";
import { cn } from "@/lib/utils";

export default function Opiniones() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

const FECHA = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });

/** Detrás del muro, difuminada. Nunca son datos reales. */
const EJEMPLO: Opinion[] = [
  {
    id: 1,
    sucursal_id: null,
    sentimiento: "mal",
    comentario: "Esperé mucho para que me tomaran la orden.",
    resuelto: false,
    creado_at: "2026-03-01",
  },
  {
    id: 2,
    sucursal_id: null,
    sentimiento: "regular",
    comentario: "La música estaba muy fuerte.",
    resuelto: true,
    creado_at: "2026-02-18",
  },
];

function IconoSentimiento({ s }: { s: Opinion["sentimiento"] }) {
  return s === "mal" ? (
    <Frown className="size-5 shrink-0 text-vm-danger" aria-label="Mal" />
  ) : (
    <Meh className="size-5 shrink-0 text-vm-warning" aria-label="Regular" />
  );
}

function Fila({
  o,
  sucursal,
  onResolver,
  resolviendo,
}: {
  o: Opinion;
  sucursal: string | null;
  onResolver?: () => void;
  resolviendo?: boolean;
}) {
  return (
    <li className="flex gap-3 rounded-xl border p-4">
      <IconoSentimiento s={o.sentimiento} />
      <div className="min-w-0 flex-1">
        {o.comentario ? (
          <p className="text-sm text-vm-ink">{o.comentario}</p>
        ) : (
          <p className="text-sm italic text-vm-body">Sin comentario</p>
        )}
        <p className="mt-1 text-xs text-vm-body">
          {(sucursal ?? "Menú general") + " · " + FECHA.format(new Date(o.creado_at))}
        </p>
      </div>
      {o.resuelto ? (
        <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-vm-success-soft px-3 text-xs font-medium text-vm-success">
          <Check className="size-3.5" aria-hidden />
          Resuelto
        </span>
      ) : (
        onResolver && (
          <button
            type="button"
            onClick={onResolver}
            disabled={resolviendo}
            className="h-8 shrink-0 rounded-full border px-3 text-xs font-medium text-vm-body hover:bg-vm-bg-soft disabled:opacity-50"
          >
            Marcar resuelto
          </button>
        )
      )}
    </li>
  );
}

function Bloqueado() {
  return (
    <div className="relative mt-8">
      <ul className="pointer-events-none space-y-3 select-none blur-sm" aria-hidden>
        {EJEMPLO.map((o) => (
          <Fila key={o.id} o={o} sucursal={null} />
        ))}
      </ul>
      <div className="absolute inset-0 grid place-items-center">
        <div className="max-w-sm rounded-xl border bg-white p-7 text-center shadow-vm-3">
          <Lock className="mx-auto size-8 text-vm-primary" aria-hidden />
          <h2 className="mt-4 text-xl">Las opiniones de tus clientes son parte de los planes de pago.</h2>
          <p className="mt-2 text-sm text-vm-body">
            El aviso «¿cómo estuvo tu visita?» lleva a los contentos a dejarte reseña en Google, y te
            guarda aquí lo que hay que mejorar.
          </p>
          <Link
            to="/admin/suscripcion"
            className="mt-6 inline-flex h-12 items-center rounded-lg bg-vm-primary px-6 text-sm font-medium text-white hover:bg-vm-primary-hover"
          >
            Actualizar plan
          </Link>
        </div>
      </div>
    </div>
  );
}

function Contenido() {
  const { data: ctx } = useTenantActual();
  const tenantId = ctx?.tenant.id;

  const { data: sucursales } = useSucursales(tenantId);
  const { data: opiniones, isLoading, isError } = useOpiniones(tenantId);
  const resolver = useMarcarOpinionResuelta(tenantId);

  const [filtro, setFiltro] = useState<string | "todas">("todas");
  const [verResueltas, setVerResueltas] = useState(false);

  const nombreSucursal = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sucursales ?? []) m.set(s.id, s.nombre);
    return m;
  }, [sucursales]);

  if (!ctx) return null;

  if (!ctx.plan.permite_embudo_resenas) {
    return (
      <>
        <PillTabs pestanas={PESTANAS_NEGOCIO} />
        <h1 className="text-2xl">Opiniones</h1>
        <p className="mt-1 text-sm text-vm-body">Lo que tus clientes te dicen al salir del menú.</p>
        <Bloqueado />
      </>
    );
  }

  const visibles = (opiniones ?? [])
    .filter((o) => verResueltas || !o.resuelto)
    .filter((o) =>
      filtro === "todas"
        ? true
        : filtro === "general"
          ? o.sucursal_id === null
          : o.sucursal_id === filtro,
    );

  const hayGeneral = (opiniones ?? []).some((o) => o.sucursal_id === null);

  return (
    <>
      <PillTabs pestanas={PESTANAS_NEGOCIO} />
      <h1 className="text-2xl">Opiniones</h1>
      <p className="mt-1 text-sm text-vm-body">Lo que tus clientes te dicen al salir del menú.</p>

      {isError && (
        <p className="mt-8 rounded-lg bg-vm-danger-soft px-4 py-3 text-sm text-vm-danger">
          No pudimos leer tus opiniones. Falta correr la migración{" "}
          <code>vibemenu_migracion_embudo_resenas.sql</code>.
        </p>
      )}

      {isLoading && <div className="mt-8 h-40 animate-pulse rounded-xl bg-vm-bg-soft" />}

      {opiniones && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {(
              [
                { k: "todas", txt: "Todas" },
                ...(hayGeneral ? [{ k: "general", txt: "Menú general" }] : []),
                ...(sucursales ?? []).map((s) => ({ k: s.id, txt: s.nombre })),
              ] as { k: string; txt: string }[]
            ).map(({ k, txt }) => (
              <button
                key={k}
                type="button"
                onClick={() => setFiltro(k)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  filtro === k ? "bg-vm-primary text-white" : "bg-vm-bg-soft text-vm-body",
                )}
              >
                {txt}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-1.5 text-xs text-vm-body">
              <input
                type="checkbox"
                checked={verResueltas}
                onChange={(e) => setVerResueltas(e.target.checked)}
                className="size-3.5 accent-vm-primary"
              />
              Ver resueltas
            </label>
          </div>

          {visibles.length === 0 ? (
            <div className="mt-8 grid place-items-center gap-2 rounded-xl border border-dashed py-16 text-center">
              <MessageSquare className="size-8 text-vm-body" aria-hidden />
              <p className="text-sm text-vm-body">
                {opiniones.length === 0
                  ? "Todavía no hay opiniones."
                  : "Nada con este filtro."}
              </p>
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {visibles.map((o) => (
                <Fila
                  key={o.id}
                  o={o}
                  sucursal={o.sucursal_id ? (nombreSucursal.get(o.sucursal_id) ?? null) : null}
                  onResolver={() => void resolver.mutateAsync(o.id)}
                  resolviendo={resolver.isPending}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
```

- [ ] **Step 5: Regenerar `routeTree.gen.ts` + typecheck/lint/build**

Run: `bun run build`
Expected: PASS. Regenera `src/routeTree.gen.ts` con la ruta `/admin/opiniones`.

Run: `bun run typecheck && bun run lint && bun test src/lib`
Expected: PASS. (Si `bun run build` no regeneró el routeTree, correr `bun run dev` unos segundos y matarlo, o el script de codegen del router — buscar en `package.json` / `vite.config.ts` cómo se llama.)

- [ ] **Step 6: Verificación manual (releer diffs)**

Confirmar: (a) `useOpiniones` con `retry:false`; (b) el muro `Bloqueado` se muestra cuando `!ctx.plan.permite_embudo_resenas`; (c) `useMarcarOpinionResuelta` invalida `["opiniones", tenantId]`; (d) `routeTree.gen.ts` incluye la ruta nueva y no tiene otros cambios espurios; (e) el filtro "Menú general" solo aparece si hay filas sin sucursal. Anotar QA de navegador pendiente.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useOpiniones.ts src/routes/admin.opiniones.tsx src/routeTree.gen.ts src/components/layout/PillTabs.tsx src/pages/admin/Opiniones.tsx
git commit -m "$(cat <<'EOF'
feat: pestana Opiniones en el panel

Lista de feedback_privado filtrable por sucursal, con "marcar resuelto"
y toggle de resueltas. Muro con candado en Free. Ruta file-based nueva
/admin/opiniones.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Verificación final

**Files:** ninguno.

- [ ] **Step 1: Suite + typecheck + lint + build**

Run: `bun test src/lib && bun run typecheck && bun run lint && bun run build`
Expected: los cuatro PASS. Lint: 0 errores (≈12 warnings `react-refresh` pre-existentes son OK — confirmar que no hay NINGUNO nuevo en los archivos tocados salvo, quizás, `PillTabs.tsx` que ya lo tenía).

- [ ] **Step 2: Diff contra `main`**

Run: `git diff main...HEAD --stat`
Confirmar que los archivos coinciden con la tabla "File Structure" y que `routeTree.gen.ts` es el único cambio no listado explícitamente como "a mano".

- [ ] **Step 3: QA manual del spec**

Recorrer la sección "QA manual" de `docs/superpowers/specs/2026-08-28-embudo-resenas-design.md` y anotar el resultado de cada punto en el PR (varios requieren navegador + la migración aplicada).

- [ ] **Step 4: PR**

```bash
git push -u origin feat/embudo-resenas
gh pr create --base main --title "feat: embudo a reseñas (sub-proyecto #2)" --body "$(cat <<'EOF'
Implementa `docs/superpowers/specs/2026-08-28-embudo-resenas-design.md`.

## Incluye
- Migración: `planes.permite_embudo_resenas`, tabla `feedback_privado`, función `registrar_feedback`.
- `EmbudoResenas` en el menú público (3 formatos de tarjeta, no TikTok/demo), gateado por plan + enlace de reseñas.
- Pestaña `/admin/opiniones` con filtro por sucursal y "marcar resuelto".
- Frase nueva en `/privacidad`.

## ⚠️ Antes del deploy
Aplicar `src/docs/vibemenu_migracion_embudo_resenas.sql` en Supabase. (No rompe nada si falta — degrada suave — pero la pestaña Opiniones falla hasta que exista la tabla.)

## QA manual
<!-- pegar resultados -->

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**

| Requisito del spec | Task |
|---|---|
| Migración: flag + tabla + `registrar_feedback` | Task 1 |
| Helper `embudo.ts` con storage inyectable + suite | Task 2 |
| `EmbudoResenas.tsx` (3 fases, 20s, once-per-browser, cerrar cuenta) | Task 3 |
| `useMenuPublico` expone `permiteEmbudoResenas` | Task 3 Step 1 |
| Montaje fuera de TikTok/demo | Task 3 Step 4 |
| Gate: plan + enlace de reseñas resuelto + `yaRespondio` | Task 3 Step 3 (`puedeMostrar`) |
| 🙂 abre Google, 😐/🙁 → comentario → RPC fire-and-forget | Task 3 Step 3 (`elegirBien` / `enviar`) |
| Ruta `/admin/opiniones` + pestaña | Task 4 Steps 2-3 |
| `useOpiniones` + `useMarcarOpinionResuelta` | Task 4 Step 1 |
| Página: lista, filtro por sucursal, ver resueltas, marcar resuelto, muro Free | Task 4 Step 4 |
| Tipos `database.ts` | Task 1 Steps 3-5 |
| Frase en Privacidad | Task 1 Step 6 |
| QA manual | Task 5 Step 3 |

Sin huecos.

**2. Placeholder scan:** sin "TBD"/"TODO"/"añadir manejo de errores". Cada paso de código trae el código real. El único "buscar en el codebase" es la posición alfabética de `feedback_privado` en `database.ts` y la firma exacta del `Pick` de `armarMenuPublico` — ambos son "localizar un ancla", no "decidir lógica".

**3. Type consistency:**
- `Opinion` (`useOpiniones.ts`, Task 4) — `sentimiento: "regular" | "mal"`, usado en `Opiniones.tsx` y `EJEMPLO`. El `data as Opinion[]` cast está porque la Row generada tiene `sentimiento: string`. Consistente.
- `registrar_feedback` Args: `{ p_tenant_id, p_sentimiento, p_sucursal_id?, p_comentario? }` — mismo shape en el hand-add (Task 1 Step 5) y en la llamada de `EmbudoResenas` (Task 3). ✅
- `permiteEmbudoResenas` (camel, tipo `MenuPublico`) vs `permite_embudo_resenas` (snake, columna/Plan) — consistente, espeja `marcaAgua`/`marca_agua`. ✅
- `yaRespondioEmbudo(tenantId, storage)` / `marcarEmbudoRespondido(tenantId, storage)` — firma idéntica en Task 2 (definición) y Task 3 (uso, vía el wrapper `storage()`). ✅
- `PESTANAS_NEGOCIO` gana una entrada; `PillTabs` la itera sin cambios de tipo. ✅
