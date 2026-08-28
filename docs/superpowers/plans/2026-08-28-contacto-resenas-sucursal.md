# Contacto y reseñas por sucursal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a cada sucursal su propio teléfono, WhatsApp (con lada) y enlace de reseñas de Google, mostrarlos en el menú público, y dejar helpers `wa.me` listos para las features de WhatsApp y embudo de reseñas.

**Architecture:** Una columna nueva (`sucursales.google_reviews_url`); el teléfono/WhatsApp siguen siendo texto libre con lada antepuesta por el `PhoneInput` existente. Dos helpers puros nuevos (`whatsapp.ts`, `contacto.ts`) concentran la normalización a dígitos y la cadena de fallback sucursal→empresa. El menú público gana un componente `ContactoMenu` al pie y la estrella de reseñas de la cabecera respeta el fallback.

**Tech Stack:** React 18 + TypeScript, TanStack Router/Query, Tailwind, Supabase (Postgres + RLS), `bun test` para `src/lib`, lucide-react para iconos.

**Spec:** `docs/superpowers/specs/2026-08-28-contacto-resenas-sucursal-design.md`

## Global Constraints

- **Migración:** una sola columna — `sucursales.google_reviews_url text` con `check (google_reviews_url is null or google_reviews_url ~* '^https://')`. **Sin `grant` extra**: la policy `sucursales_write_miembros` cubre la tabla entera.
- **Sin columnas de lada.** El teléfono/WhatsApp es una sola cadena de texto (`"+52 55 1234 5678"`).
- **`tenants.whatsapp` / `telefono` / `google_reviews_url` se quedan** — son el fallback.
- **Redes sociales** (`facebook_url`, `instagram_url`, `tiktok_url`) no se tocan: son de la empresa.
- **El bloque de contacto del menú es para todos los planes.** El *gating* vive en los sub-proyectos #2 y #3, no aquí.
- **TikTok** es fullscreen y no monta cabecera ni pie — `ContactoMenu` tampoco.
- **Tests de `src/lib`** corren con `bun test`; importan de `"bun:test"` y usan el alias `@/`. Los componentes no tienen test runner: se verifican con `bun run typecheck` + `bun run lint`.
- **Copy en español**, tono del producto (ver `src/lib/copy.ts` y textos vecinos). Iconos de `lucide-react`.
- **Commits** en español, prefijo `feat:` / `refactor:` / `docs:`, y terminan con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/docs/vibemenu_migracion_contacto_sucursal.sql` | **Crear.** La migración (1 columna). |
| `src/types/database.ts` | **Modificar.** `sucursales.google_reviews_url` en `Row`/`Insert`/`Update`. |
| `src/lib/demo.ts` | **Modificar.** `SUCURSAL_DEMO.google_reviews_url`. |
| `src/lib/whatsapp.ts` + `src/lib/whatsapp.test.ts` | **Crear.** `telefonoParaWaMe`, `enlaceWhatsApp`, `asegurarLada`. |
| `src/lib/contacto.ts` + `src/lib/contacto.test.ts` | **Crear.** `contactoSucursal` (fallback sucursal→empresa). |
| `src/hooks/useSucursales.ts` | **Modificar.** `BorradorSucursal` gana `google_reviews_url`. |
| `src/components/admin/EditorSucursal.tsx` | **Modificar.** Campo "Reseñas en Google", `asegurarLada` al guardar, microcopy. |
| `src/pages/admin/Empresa.tsx` | **Modificar.** Notas de contacto/reseñas + `asegurarLada` al guardar. |
| `src/components/menu/RedesSociales.tsx` | **Modificar.** Prop opcional `resenasUrlOverride` en el componente y en `tieneRedes`. |
| `src/components/menu/HeaderMenu.tsx` | **Modificar.** Calcula el override de reseñas y lo pasa. |
| `src/components/menu/ContactoMenu.tsx` | **Crear.** Fila de contacto al pie del menú. |
| `src/pages/MenuPublico.tsx` | **Modificar.** Monta `<ContactoMenu/>` en `cuerpo`. |
| `src/pages/Demo.tsx` | **Modificar.** Monta `<ContactoMenu/>` en la rama no-TikTok. |

---

## Task 1: Migración + tipos + demo

**Files:**
- Create: `src/docs/vibemenu_migracion_contacto_sucursal.sql`
- Modify: `src/types/database.ts` (bloque `sucursales:` — `Row` ~594, `Insert` ~607, `Update` ~620)
- Modify: `src/lib/demo.ts:55-67` (`SUCURSAL_DEMO`)

**Interfaces:**
- Consumes: nada.
- Produces: la columna `sucursales.google_reviews_url` disponible en el tipo `Sucursal` (`string | null` en `Row`, opcional en `Insert`/`Update`).

- [ ] **Step 1: Crear el archivo de migración**

`src/docs/vibemenu_migracion_contacto_sucursal.sql`:

```sql
-- ============================================================================
--  VIBEMENU — migracion: enlace de resenas por sucursal
--
--  Una columna: sucursales.google_reviews_url. El enlace de "Pedir resenas" de
--  la ficha de Google de ESA sucursal. Si es null, el menu cae al de la empresa
--  (tenants.google_reviews_url).
--
--  La policy sucursales_write_miembros ya cubre la tabla entera: sin grant extra
--  (a diferencia de tenants, donde el UPDATE esta revocado columna por columna).
--
--  Ejecutar COMPLETO en el SQL Editor de Supabase.
-- ============================================================================

begin;

alter table sucursales
  add column google_reviews_url text
    constraint sucursal_reviews_es_https
      check (google_reviews_url is null or google_reviews_url ~* '^https://');

commit;

-- ============================================================================
--  Verificar:
--
--    select column_name from information_schema.columns
--      where table_name = 'sucursales' and column_name = 'google_reviews_url';
--    -- 1 fila
--
--    -- Un miembro del tenant puede escribirla (misma policy que el resto):
--    update sucursales set google_reviews_url = 'https://g.page/r/x/review'
--      where id = '<una sucursal propia>';
-- ============================================================================
```

- [ ] **Step 2: Aplicar la migración**

Si el servidor MCP de Supabase está autorizado en la sesión:
`mcp__claude_ai_Supabase__apply_migration` con `name: "contacto_sucursal_google_reviews"` y el cuerpo del `begin;…commit;`.

Si no está autorizado: pegar el bloque completo en el SQL Editor de Supabase y ejecutar. Anotar en el PR que la migración quedó aplicada.

- [ ] **Step 3: Hand-add del tipo en `src/types/database.ts`**

En el bloque `sucursales:`, agregar `google_reviews_url` en orden alfabético (después de `direccion`) en las tres formas:

```ts
// Row:
        direccion: string | null;
        google_reviews_url: string | null;
        id: string;
// Insert:
          direccion?: string | null;
          google_reviews_url?: string | null;
          id?: string;
// Update:
          direccion?: string | null;
          google_reviews_url?: string | null;
          id?: string;
```

(Si el MCP está disponible, `mcp__claude_ai_Supabase__generate_typescript_types` y reemplazar el archivo entero es equivalente y preferible.)

- [ ] **Step 4: Agregar la columna a `SUCURSAL_DEMO`**

`src/lib/demo.ts`, dentro de `SUCURSAL_DEMO` (después de `maps_url: null,`):

```ts
  maps_url: null,
  google_reviews_url: null,
```

- [ ] **Step 5: Verificar que compila**

Run: `bun run typecheck`
Expected: PASS (sin errores nuevos). `SUCURSAL_DEMO` ahora satisface `Sucursal` con la columna nueva.

- [ ] **Step 6: Commit**

```bash
git add src/docs/vibemenu_migracion_contacto_sucursal.sql src/types/database.ts src/lib/demo.ts
git commit -m "$(cat <<'EOF'
feat: columna google_reviews_url por sucursal

Enlace de resenas de Google propio de cada sucursal, con fallback al de
la empresa. La policy de sucursales ya cubre la escritura.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Helper `whatsapp.ts`

**Files:**
- Create: `src/lib/whatsapp.ts`
- Test: `src/lib/whatsapp.test.ts`

**Interfaces:**
- Consumes: `LADA_DEFAULT` de `src/lib/paises.ts` (valor `"+52"`).
- Produces:
  - `telefonoParaWaMe(valor: string | null | undefined): string | null` — dígitos, o `null` si quedan < 8.
  - `enlaceWhatsApp(valor: string | null | undefined, mensaje?: string): string | null` — `https://wa.me/<digitos>` con `?text=` URL-encoded si hay `mensaje`.
  - `asegurarLada(valor: string | null): string | null` — antepone `LADA_DEFAULT` a un valor no vacío sin `+`; `""` y `null` pasan igual.

- [ ] **Step 1: Escribir el test que falla**

`src/lib/whatsapp.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { asegurarLada, enlaceWhatsApp, telefonoParaWaMe } from "@/lib/whatsapp";

describe("telefonoParaWaMe", () => {
  test("un numero con lada queda en digitos puros", () => {
    expect(telefonoParaWaMe("+52 55 1234 5678")).toBe("525512345678");
  });

  test("un valor legado sin lada devuelve sus digitos tal cual", () => {
    // No adivina pais: el guardado ya garantiza la lada via asegurarLada.
    expect(telefonoParaWaMe("55-1234-5678")).toBe("5512345678");
  });

  test("vacio, nulo o basura corta => null", () => {
    expect(telefonoParaWaMe("")).toBeNull();
    expect(telefonoParaWaMe(null)).toBeNull();
    expect(telefonoParaWaMe(undefined)).toBeNull();
    expect(telefonoParaWaMe("   ")).toBeNull();
    expect(telefonoParaWaMe("+1 (555) 010")).toBeNull(); // 7 digitos < 8
  });
});

describe("enlaceWhatsApp", () => {
  test("sin mensaje: solo abrir chat", () => {
    expect(enlaceWhatsApp("+52 55 1234 5678")).toBe("https://wa.me/525512345678");
  });

  test("con mensaje: lo antepone URL-encoded", () => {
    expect(enlaceWhatsApp("+52 55 1234 5678", "Hola, ¿me ayudas?")).toBe(
      "https://wa.me/525512345678?text=Hola%2C%20%C2%BFme%20ayudas%3F",
    );
  });

  test("numero no utilizable => null", () => {
    expect(enlaceWhatsApp(null)).toBeNull();
    expect(enlaceWhatsApp("123")).toBeNull();
  });
});

describe("asegurarLada", () => {
  test("antepone la lada default si falta el +", () => {
    expect(asegurarLada("55 1234 5678")).toBe("+52 55 1234 5678");
  });

  test("respeta un valor que ya trae lada", () => {
    expect(asegurarLada("+34 600 00 00 00")).toBe("+34 600 00 00 00");
  });

  test("vacio y nulo pasan igual", () => {
    expect(asegurarLada("")).toBe("");
    expect(asegurarLada(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bun test src/lib/whatsapp.test.ts`
Expected: FAIL — `Cannot find module '@/lib/whatsapp'`.

- [ ] **Step 3: Escribir la implementación**

`src/lib/whatsapp.ts`:

```ts
import { LADA_DEFAULT } from "@/lib/paises";

/** Menos de esto no es un teléfono: arma un wa.me roto, mejor no mostrarlo. */
const MIN_DIGITOS = 8;

/**
 * Convierte un teléfono guardado ("+52 55 1234 5678") en los dígitos que espera
 * wa.me ("525512345678"). No adivina lada — el guardado ya la garantiza vía
 * `asegurarLada`. Devuelve null si tras limpiar quedan menos de 8 dígitos.
 */
export function telefonoParaWaMe(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const digitos = valor.replace(/\D/g, "");
  return digitos.length >= MIN_DIGITOS ? digitos : null;
}

/**
 * Link de WhatsApp. Sin `mensaje` es solo "abrir chat"; con `mensaje` lo
 * antepone URL-encoded. Devuelve null si el número no es utilizable.
 */
export function enlaceWhatsApp(
  valor: string | null | undefined,
  mensaje?: string,
): string | null {
  const numero = telefonoParaWaMe(valor);
  if (!numero) return null;
  const base = `https://wa.me/${numero}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}

/**
 * Garantiza que un teléfono no vacío empiece con lada (+NN). Se aplica al
 * guardar, para que `telefonoParaWaMe` siempre tenga con qué trabajar. "" y
 * null pasan tal cual.
 */
export function asegurarLada(valor: string | null): string | null {
  if (valor === null) return null;
  const limpio = valor.trim();
  if (!limpio) return limpio;
  return limpio.startsWith("+") ? limpio : `${LADA_DEFAULT} ${limpio}`;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `bun test src/lib/whatsapp.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Lint + typecheck**

Run: `bun run lint && bun run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/whatsapp.ts src/lib/whatsapp.test.ts
git commit -m "$(cat <<'EOF'
feat: helper whatsapp para links wa.me

telefonoParaWaMe normaliza a digitos, enlaceWhatsApp arma el link, y
asegurarLada antepone +52 a un numero sin lada al guardar.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Helper `contacto.ts`

**Files:**
- Create: `src/lib/contacto.ts`
- Test: `src/lib/contacto.test.ts`

**Interfaces:**
- Consumes: tipos `Sucursal` y `Tenant` de `@/types/database` (con `google_reviews_url` de la Task 1).
- Produces:
  - `type ContactoResuelto = { telefono: string | null; whatsapp: string | null; googleReviewsUrl: string | null }`
  - `contactoSucursal(sucursal: Pick<Sucursal, "telefono" | "whatsapp" | "google_reviews_url"> | null, tenant: Pick<Tenant, "telefono" | "whatsapp" | "google_reviews_url">): ContactoResuelto`

- [ ] **Step 1: Escribir el test que falla**

`src/lib/contacto.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { contactoSucursal } from "@/lib/contacto";

const tenant = {
  telefono: "+52 55 0000 0000",
  whatsapp: "+52 55 0000 0001",
  google_reviews_url: "https://g.page/empresa/review",
};

describe("contactoSucursal", () => {
  test("la sucursal manda cuando tiene el dato", () => {
    const c = contactoSucursal(
      {
        telefono: "+52 33 1111 1111",
        whatsapp: "+52 33 1111 1112",
        google_reviews_url: "https://g.page/sucursal/review",
      },
      tenant,
    );
    expect(c).toEqual({
      telefono: "+52 33 1111 1111",
      whatsapp: "+52 33 1111 1112",
      googleReviewsUrl: "https://g.page/sucursal/review",
    });
  });

  test("cada campo vacio en la sucursal cae a la empresa", () => {
    const c = contactoSucursal(
      { telefono: "+52 33 1111 1111", whatsapp: null, google_reviews_url: "  " },
      tenant,
    );
    expect(c.telefono).toBe("+52 33 1111 1111");
    expect(c.whatsapp).toBe("+52 55 0000 0001");
    expect(c.googleReviewsUrl).toBe("https://g.page/empresa/review");
  });

  test("sin sucursal, todo de la empresa", () => {
    const c = contactoSucursal(null, tenant);
    expect(c).toEqual({
      telefono: "+52 55 0000 0000",
      whatsapp: "+52 55 0000 0001",
      googleReviewsUrl: "https://g.page/empresa/review",
    });
  });

  test("google_reviews_url undefined (entorno sin migracion 007) => null", () => {
    const c = contactoSucursal(
      { telefono: null, whatsapp: null, google_reviews_url: null },
      { telefono: null, whatsapp: null, google_reviews_url: undefined as unknown as string | null },
    );
    expect(c.googleReviewsUrl).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bun test src/lib/contacto.test.ts`
Expected: FAIL — `Cannot find module '@/lib/contacto'`.

- [ ] **Step 3: Escribir la implementación**

`src/lib/contacto.ts`:

```ts
import type { Sucursal, Tenant } from "@/types/database";

export type ContactoResuelto = {
  telefono: string | null;
  whatsapp: string | null;
  googleReviewsUrl: string | null;
};

type CamposSucursal = Pick<Sucursal, "telefono" | "whatsapp" | "google_reviews_url">;
type CamposTenant = Pick<Tenant, "telefono" | "whatsapp" | "google_reviews_url">;

/** Primer valor no vacío (tras `trim`), o null. */
function primero(a: string | null | undefined, b: string | null | undefined): string | null {
  const av = a?.trim();
  if (av) return av;
  const bv = b?.trim();
  return bv || null;
}

/**
 * Resuelve la cadena de fallback de contacto para el menú público. La sucursal
 * manda; cada campo cae a `tenants` solo si viene vacío. Con `sucursal` null
 * (menú general, negocio sin sucursales) usa todo de `tenants`.
 */
export function contactoSucursal(
  sucursal: CamposSucursal | null,
  tenant: CamposTenant,
): ContactoResuelto {
  return {
    telefono: primero(sucursal?.telefono, tenant.telefono),
    whatsapp: primero(sucursal?.whatsapp, tenant.whatsapp),
    googleReviewsUrl: primero(sucursal?.google_reviews_url, tenant.google_reviews_url),
  };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `bun test src/lib/contacto.test.ts`
Expected: PASS.

- [ ] **Step 5: Suite completa + lint + typecheck**

Run: `bun test src/lib && bun run lint && bun run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/contacto.ts src/lib/contacto.test.ts
git commit -m "$(cat <<'EOF'
feat: helper contactoSucursal con fallback a la empresa

telefono, whatsapp y enlace de resenas: la sucursal manda, cada campo
cae a tenants si viene vacio.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Editor de sucursal — campo de reseñas + lada segura

**Files:**
- Modify: `src/hooks/useSucursales.ts` (`BorradorSucursal`, ~línea 20-27)
- Modify: `src/components/admin/EditorSucursal.tsx` (imports; estado; `alGuardar` `datos`; JSX de los campos)

**Interfaces:**
- Consumes: `asegurarLada` de `@/lib/whatsapp`; `esUrlValida` de `@/lib/url` (ya importado).
- Produces: `BorradorSucursal` gana `google_reviews_url: string | null`. Sin cambios en firmas de hooks.

- [ ] **Step 1: `BorradorSucursal` gana el campo**

`src/hooks/useSucursales.ts`, en el tipo `BorradorSucursal` (después de `maps_url`):

```ts
export type BorradorSucursal = {
  nombre: string;
  slug: string;
  direccion: string | null;
  /** Enlace de Google Maps del negocio. Si falta, se arma uno con la dirección. */
  maps_url: string | null;
  /** Enlace de "Pedir reseñas" de la ficha de Google de esta sucursal. */
  google_reviews_url: string | null;
  telefono: string | null;
  whatsapp: string | null;
  timezone: string;
};
```

- [ ] **Step 2: Verificar que `tsc` ahora exige el campo en el editor**

Run: `bun run typecheck`
Expected: FAIL en `EditorSucursal.tsx` — `datos` no incluye `google_reviews_url`. (Confirma que el tipo llega al call site.)

- [ ] **Step 3: Editor — import + estado**

`src/components/admin/EditorSucursal.tsx`:

Import (junto a los de `@/lib`):

```ts
import { asegurarLada } from "@/lib/whatsapp";
```

Estado (después de `const [mapsUrl, setMapsUrl] = useState(...)`):

```ts
const [reviewsUrl, setReviewsUrl] = useState(sucursal?.google_reviews_url ?? "");
```

- [ ] **Step 4: Editor — validación y `datos` en `alGuardar`**

Dentro de `alGuardar`, tras la validación de `maps`:

```ts
    const reviews = reviewsUrl.trim();
    if (reviews && !esUrlValida(reviews)) {
      setError("El enlace de reseñas debe empezar por https://");
      return;
    }
```

Y en el objeto `datos` de `guardar.mutateAsync`:

```ts
        datos: {
          nombre: nombre.trim(),
          slug: slug.trim(),
          direccion: direccion.trim() || null,
          maps_url: maps || null,
          google_reviews_url: reviews || null,
          telefono: asegurarLada(telefono.trim() || null),
          whatsapp: asegurarLada(whatsapp.trim() || null),
          timezone,
        },
```

- [ ] **Step 5: Editor — JSX del campo de reseñas + microcopy de lada**

Agregar un campo nuevo. Ubicación: justo **después** del `<p>` de vista previa del mapa (`"Sin dirección ni enlace, el menú no muestra mapa."`) y **antes** de la cuadrícula de Teléfono/WhatsApp:

```tsx
          <div>
            <label htmlFor="s-reviews" className="text-sm font-medium text-vm-ink">
              Reseñas en Google <span className="font-normal text-vm-body">(opcional)</span>
            </label>
            <input
              id="s-reviews"
              type="url"
              inputMode="url"
              value={reviewsUrl}
              onChange={(e) => setReviewsUrl(e.target.value)}
              placeholder="https://g.page/r/…/review"
              className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary"
            />
            <p className="mt-1.5 text-xs text-vm-body">
              En tu ficha de Google entra a «Pedir reseñas» y copia el enlace corto. Si lo dejas
              vacío, el menú usa el de tu negocio.
            </p>
          </div>
```

Y bajo la cuadrícula de Teléfono/WhatsApp (después del `</div>` que cierra el `grid sm:grid-cols-2` de esos dos campos), agregar:

```tsx
          <p className="-mt-2 text-xs text-vm-body">
            Con lada de país — así el botón de «Pedir por WhatsApp» del menú funciona.
          </p>
```

- [ ] **Step 6: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 7: Verificación manual**

`bun run dev`, entrar a una sucursal en el panel:
- Guardar un enlace de reseñas sin `https://` → error inline, no guarda.
- Guardar uno válido y un teléfono sin tocar el selector de lada → reabrir el editor: el teléfono se ve con `+52`.
- Confirmar en Supabase (tabla `sucursales`) que `google_reviews_url` y `whatsapp` (con `+52`) quedaron guardados.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useSucursales.ts src/components/admin/EditorSucursal.tsx
git commit -m "$(cat <<'EOF'
feat: enlace de resenas por sucursal en el editor

Campo nuevo "Resenas en Google" con validacion https. Al guardar,
telefono y whatsapp pasan por asegurarLada para que el link wa.me
siempre tenga pais.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Empresa — notas de fallback + lada segura

**Files:**
- Modify: `src/pages/admin/Empresa.tsx` (import; `alGuardar` ~línea 170-176; nota del bloque "Contacto"; nota junto a "Reseñas")

**Interfaces:**
- Consumes: `asegurarLada` de `@/lib/whatsapp`.
- Produces: nada nuevo (solo ajustes de copy y normalización al guardar).

- [ ] **Step 1: Import**

`src/pages/admin/Empresa.tsx`, junto a los imports de `@/lib`:

```ts
import { asegurarLada } from "@/lib/whatsapp";
```

- [ ] **Step 2: `asegurarLada` al guardar**

En `alGuardar`, dentro de `actualizar.mutateAsync({...})`, reemplazar:

```ts
        telefono: telefono.trim() || null,
        whatsapp: whatsapp.trim() || null,
```

por:

```ts
        telefono: asegurarLada(telefono.trim() || null),
        whatsapp: asegurarLada(whatsapp.trim() || null),
```

- [ ] **Step 3: Nota del bloque "Contacto"**

Buscar el `<Bloque titulo="Contacto" nota="...">` y cambiar la `nota` a:

```tsx
        <Bloque
          titulo="Contacto"
          nota="Se usan cuando una sucursal no tiene los suyos. Si defines contacto en la sucursal, ese manda en su menú."
        >
```

- [ ] **Step 4: Nota junto a "Reseñas en Google"**

Al final del `<Bloque titulo="Redes sociales" ...>`, el `<p>` que hoy dice _"Para las reseñas, en tu ficha de Google entra a «Pedir reseñas»…"_ — reemplazar su texto por:

```tsx
          <p className="mt-4 text-xs text-vm-body">
            Para las reseñas, en tu ficha de Google entra a «Pedir reseñas» y copia el enlace corto.
            Cada sucursal puede tener el suyo; este es el que se usa cuando no lo tiene.
          </p>
```

- [ ] **Step 5: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/Empresa.tsx
git commit -m "$(cat <<'EOF'
refactor: Empresa deja claro que su contacto es el respaldo

Notas nuevas en Contacto y Resenas: la sucursal manda. Telefono y
whatsapp de la empresa tambien pasan por asegurarLada.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Estrella de reseñas en la cabecera respeta el fallback

**Files:**
- Modify: `src/components/menu/RedesSociales.tsx` (`tieneRedes` ~línea 40; props del componente ~43-50; `visibles` y `href` ~52-80)
- Modify: `src/components/menu/HeaderMenu.tsx` (import; cálculo; el bloque `{tieneRedes(tenant) && (...)}` ~127-131)

**Interfaces:**
- Consumes: `contactoSucursal` de `@/lib/contacto`.
- Produces:
  - `RedesSociales` acepta prop opcional `resenasUrlOverride?: string | null`.
  - `tieneRedes(tenant: Tenant, resenasUrlOverride?: string | null): boolean`.
  - Semántica: si `resenasUrlOverride` es `undefined` → comportamiento actual (`tenant.google_reviews_url`); si es `string` o `null` → reemplaza al de `tenant` para la estrella.

- [ ] **Step 1: `RedesSociales` — resolver el href de reseñas**

En `src/components/menu/RedesSociales.tsx`, reemplazar `tieneRedes` y la lógica de `visibles`/`href`:

```ts
/**
 * Href real de cada enlace. Para reseñas, `resenasUrlOverride` (si se pasa,
 * incluido `null` explícito) manda sobre `tenant.google_reviews_url` — así la
 * cabecera de una sucursal apunta a las reseñas de ESA sucursal.
 */
function hrefDe(
  tenant: Tenant,
  clave: Enlace["clave"],
  resenasUrlOverride: string | null | undefined,
): string | null {
  if (clave === "google_reviews_url" && resenasUrlOverride !== undefined) {
    return resenasUrlOverride;
  }
  return tenant[clave] ?? null;
}

/** Sin ningún enlace, la cabecera no debe reservar espacio para la fila. */
export const tieneRedes = (tenant: Tenant, resenasUrlOverride?: string | null): boolean =>
  ENLACES.some(({ clave }) => Boolean(hrefDe(tenant, clave, resenasUrlOverride)));
```

En la firma del componente:

```ts
export default function RedesSociales({
  tenant,
  sobreOscuro = false,
  resenasUrlOverride,
}: {
  tenant: Tenant;
  /** En fondo completo el texto ya es blanco: los iconos también. */
  sobreOscuro?: boolean;
  /** Reseñas de la sucursal activa (o null si no tiene ni ella ni la empresa). */
  resenasUrlOverride?: string | null;
}) {
```

En el cuerpo, reemplazar el cálculo de `visibles` y el `href`:

```ts
  const visibles = ENLACES.filter(({ clave }) =>
    Boolean(hrefDe(tenant, clave, resenasUrlOverride)),
  );
  if (visibles.length === 0) return null;
```

```tsx
        <a
          key={clave}
          href={hrefDe(tenant, clave, resenasUrlOverride)!}
```

- [ ] **Step 2: `HeaderMenu` — calcular y pasar el override**

`src/components/menu/HeaderMenu.tsx`:

Import:

```ts
import { contactoSucursal } from "@/lib/contacto";
```

Después de `const sucursal = sucursalActiva ?? sucursales[0] ?? null;`:

```ts
  const resenas = contactoSucursal(sucursal, tenant).googleReviewsUrl;
```

Reemplazar el bloque de redes:

```tsx
      {tieneRedes(tenant, resenas) && (
        <div className="mx-auto mt-3 flex max-w-2xl">
          <RedesSociales tenant={tenant} sobreOscuro={sobreOscuro} resenasUrlOverride={resenas} />
        </div>
      )}
```

- [ ] **Step 3: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 4: Verificación manual**

`bun run dev` + `/demo`: la estrella de reseñas sigue apareciendo (usa `TENANT_DEMO.google_reviews_url`). En un menú real con dos sucursales y `google_reviews_url` distinto por sucursal, cambiar de sucursal en el selector → la estrella apunta al enlace de la sucursal activa.

- [ ] **Step 5: Commit**

```bash
git add src/components/menu/RedesSociales.tsx src/components/menu/HeaderMenu.tsx
git commit -m "$(cat <<'EOF'
feat: la estrella de resenas de la cabecera usa la de la sucursal

RedesSociales acepta resenasUrlOverride; HeaderMenu lo resuelve con
contactoSucursal (sucursal -> empresa).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `ContactoMenu` al pie del menú público

**Files:**
- Create: `src/components/menu/ContactoMenu.tsx`
- Modify: `src/pages/MenuPublico.tsx` (import; `cuerpo` ~línea con `<Formato .../>` + `{data.marcaAgua && <MarcaAgua />}`)
- Modify: `src/pages/Demo.tsx` (import; rama no-TikTok, después de `<Formato .../>`)

**Interfaces:**
- Consumes: `contactoSucursal` (`@/lib/contacto`), `enlaceWhatsApp` (`@/lib/whatsapp`), `enlaceMaps` (`@/lib/maps`).
- Produces: `export default function ContactoMenu({ tenant: Tenant, sucursal: Sucursal | null }): ReactElement | null`.

- [ ] **Step 1: Crear el componente**

`src/components/menu/ContactoMenu.tsx`:

```tsx
import type { ReactElement } from "react";
import { MapPin, MessageCircle, Phone, Star } from "lucide-react";
import { contactoSucursal } from "@/lib/contacto";
import { enlaceMaps } from "@/lib/maps";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import type { Sucursal, Tenant } from "@/types/database";

type Fila = {
  etiqueta: string;
  href: string;
  externo: boolean;
  Icono: React.ComponentType<{ className?: string }>;
};

/**
 * Fila de contacto al pie del menú: llamar, WhatsApp, cómo llegar, reseñas.
 * Cada dato se resuelve sucursal → empresa (`contactoSucursal`). Solo pinta
 * las filas con dato; sin ninguna, no se monta. Usa el tema del tenant, nunca
 * colores de marca externos — igual que `RedesSociales`.
 *
 * El WhatsApp aquí es "abrir chat" a secas. El botón de pedido con carrito es
 * otra cosa (sub-proyecto #3).
 */
export default function ContactoMenu({
  tenant,
  sucursal,
}: {
  tenant: Tenant;
  sucursal: Sucursal | null;
}): ReactElement | null {
  const c = contactoSucursal(sucursal, tenant);
  const mapa = enlaceMaps(
    { direccion: sucursal?.direccion ?? null, maps_url: sucursal?.maps_url ?? null },
    tenant.nombre_negocio,
  );
  const wa = enlaceWhatsApp(c.whatsapp);
  const tel = c.telefono ? `tel:${c.telefono.replace(/[^\d+]/g, "")}` : null;

  const filas: Fila[] = [];
  if (tel) filas.push({ etiqueta: "Llamar", href: tel, externo: false, Icono: Phone });
  if (wa) filas.push({ etiqueta: "WhatsApp", href: wa, externo: true, Icono: MessageCircle });
  if (mapa) filas.push({ etiqueta: "Cómo llegar", href: mapa, externo: true, Icono: MapPin });
  if (c.googleReviewsUrl) {
    filas.push({ etiqueta: "Reseñas", href: c.googleReviewsUrl, externo: true, Icono: Star });
  }

  if (filas.length === 0) return null;

  return (
    <nav className="mx-auto mt-6 flex max-w-2xl flex-wrap gap-2 px-4 pb-8" aria-label="Contacto">
      {filas.map(({ etiqueta, href, externo, Icono }) => (
        <a
          key={etiqueta}
          href={href}
          {...(externo ? { target: "_blank", rel: "noreferrer noopener" } : {})}
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-opacity hover:opacity-75"
          style={{
            background: "color-mix(in srgb, var(--menu-primario) 10%, transparent)",
            color: "var(--menu-primario)",
          }}
        >
          <Icono className="size-4" aria-hidden />
          {etiqueta}
        </a>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Montar en `MenuPublico.tsx`**

Import (junto a `HeaderMenu`, `MarcaAgua`):

```ts
import ContactoMenu from "@/components/menu/ContactoMenu";
```

En `const cuerpo = (...)`, entre el `<Formato .../>` (o el `<p>` de "sin productos") y `{data.marcaAgua && <MarcaAgua />}`:

```tsx
      {data.categorias.length === 0 ? (
        <p className="px-4 py-20 text-center text-sm" style={{ color: "var(--menu-texto-suave)" }}>
          Este menú todavía no tiene productos.
        </p>
      ) : (
        <Formato {...propsFormato} />
      )}

      <ContactoMenu tenant={data.tenant} sucursal={data.sucursalActiva} />

      {data.marcaAgua && <MarcaAgua />}
```

(La rama TikTok no usa `cuerpo` — queda sin `ContactoMenu`, como se quiere.)

- [ ] **Step 3: Montar en `Demo.tsx`**

Import:

```ts
import ContactoMenu from "@/components/menu/ContactoMenu";
```

En la rama no-TikTok, después del `<Formato .../>` con `categorias={CATEGORIAS_DEMO}`:

```tsx
              <Formato
                categorias={CATEGORIAS_DEMO}
                logoUrl={TENANT_DEMO.logo_url}
                inicial={TENANT_DEMO.nombre_negocio.slice(0, 1)}
              />
              <ContactoMenu tenant={TENANT_DEMO} sucursal={SUCURSAL_DEMO} />
```

- [ ] **Step 4: typecheck + lint + suite**

Run: `bun test src/lib && bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 5: Verificación manual**

`bun run dev`:
- `/demo` → al pie aparece "Cómo llegar" (dirección de `SUCURSAL_DEMO`) y "Reseñas" (`TENANT_DEMO.google_reviews_url`); no aparecen Llamar/WhatsApp (demo los tiene en `null`). En TikTok no aparece la fila.
- Menú real con una sucursal con teléfono, WhatsApp, dirección y reseñas → las 4 filas; "WhatsApp" abre `wa.me/<numero>`; "Llamar" abre el marcador.
- Menú real con sucursal sin WhatsApp pero empresa con WhatsApp → la fila WhatsApp usa el número de la empresa.
- Sucursal sin ningún dato y empresa igual → la fila no se monta.

- [ ] **Step 6: Commit**

```bash
git add src/components/menu/ContactoMenu.tsx src/pages/MenuPublico.tsx src/pages/Demo.tsx
git commit -m "$(cat <<'EOF'
feat: bloque de contacto al pie del menu publico

Llamar, WhatsApp, como llegar y resenas, resueltos sucursal -> empresa.
Fuera de TikTok (fullscreen). Visible en todos los planes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Verificación final

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Suite + typecheck + lint + build**

Run: `bun test src/lib && bun run typecheck && bun run lint && bun run build`
Expected: los cuatro PASS.

- [ ] **Step 2: Revisar el diff completo contra el spec**

Run: `git diff main...HEAD --stat`
Confirmar que los archivos tocados coinciden con la tabla "File Structure" y que no hay cambios colaterales.

- [ ] **Step 3: Checklist de QA manual del spec**

Recorrer la sección "QA manual" de `docs/superpowers/specs/2026-08-28-contacto-resenas-sucursal-design.md` de punta a punta y anotar el resultado de cada punto en el PR.

- [ ] **Step 4: Abrir el PR**

```bash
git push -u origin feat/contacto-resenas-sucursal
gh pr create --base main --title "feat: contacto y reseñas por sucursal (sub-proyecto #1)" --body "$(cat <<'EOF'
Implementa `docs/superpowers/specs/2026-08-28-contacto-resenas-sucursal-design.md`.

## Qué incluye
- Migración: `sucursales.google_reviews_url` (aplicada en Supabase).
- Helpers `src/lib/whatsapp.ts` y `src/lib/contacto.ts` con suites en CI.
- Editor de sucursal: campo "Reseñas en Google" + normalización de lada al guardar.
- Empresa: notas de fallback + normalización de lada.
- Menú público: `ContactoMenu` al pie + la estrella de reseñas de la cabecera respeta el fallback por sucursal.

## Fuera de alcance (specs aparte)
- #2 Embudo a reseñas · #3 Carrito de WhatsApp.

## QA manual
<!-- pegar resultados del checklist del spec -->

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**

| Requisito del spec | Task |
|---|---|
| Migración `sucursales.google_reviews_url` + check https, sin grant | Task 1 |
| `whatsapp.ts` (`telefonoParaWaMe`, `enlaceWhatsApp`, `asegurarLada`) + tests | Task 2 |
| `contacto.ts` (`contactoSucursal`, fallback) + tests | Task 3 |
| `BorradorSucursal` gana `google_reviews_url` | Task 4 |
| `EditorSucursal`: campo reseñas, `asegurarLada` al guardar, microcopy lada | Task 4 |
| `Empresa`: notas de fallback + `asegurarLada` | Task 5 |
| `RedesSociales` prop `resenasUrlOverride` + `tieneRedes` 2º param | Task 6 |
| `HeaderMenu` calcula y pasa el override | Task 6 |
| `ContactoMenu` (tel, wa simple, maps, reseñas), fuera de TikTok, todos los planes | Task 7 |
| Montaje en `MenuPublico` (`cuerpo`) y `Demo` | Task 7 |
| Tipos `database.ts` + `demo.ts` | Task 1 |
| QA manual del spec | Task 8 |

Sin huecos.

**2. Placeholder scan:** sin "TBD"/"TODO"/"manejar edge cases". Cada step de código trae el código real. ✅

**3. Type consistency:**
- `asegurarLada(valor: string | null): string | null` — definido en Task 2, usado idéntico en Tasks 4 y 5.
- `contactoSucursal(sucursal | null, tenant)` → `{ telefono, whatsapp, googleReviewsUrl }` — definido en Task 3, consumido en Tasks 6 (`.googleReviewsUrl`) y 7 (los tres campos). ✅
- `enlaceWhatsApp(valor, mensaje?)` — Task 2; en Task 7 se llama con un solo argumento. ✅
- `tieneRedes(tenant, resenasUrlOverride?)` y `RedesSociales`'s `resenasUrlOverride` — mismo nombre en Tasks 6. ✅
- `google_reviews_url` (snake_case, columna/tipo DB) vs `googleReviewsUrl` (camelCase, campo de `ContactoResuelto`) — consistente en todo el plan. ✅
