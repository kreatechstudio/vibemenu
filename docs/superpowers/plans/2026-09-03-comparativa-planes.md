# Comparativa completa de planes — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La página `/precios` muestra una "Comparación rápida" y, debajo, una matriz completa función-por-función de los 4 planes, incluidas las 5 funciones de P1/P2 ya en producción; el doc de alcance y los headlines de plan quedan alineados.

**Architecture:** El modelo de datos de la tabla sale del componente a un módulo puro `src/lib/comparativa.ts` (patrón `src/lib/plan.ts`), con pruebas `bun:test`. `Precios.tsx` extrae un componente `TablaComparativa` y lo renderiza dos veces (rápida = `soloDestacadas`, completa = todo). Docs y copy se actualizan a mano.

**Tech Stack:** React 19 + TanStack Router/Query, Tailwind, framer-motion, lucide-react, bun:test.

**Spec:** `docs/superpowers/specs/2026-09-03-comparativa-planes-design.md`

## Global Constraints

- TS estricto; `bunx tsc --noEmit` y `bunx eslint .` con 0 errores (los ~15 warnings `react-refresh` preexistentes se toleran).
- `bun test` verde; baseline 199 tests, no deben bajar.
- Copy en español de México (tú/tu), sin signos de admiración de más (regla de `src/lib/copy.ts`).
- La comparativa nunca hardcodea un límite numérico: sale de la fila de `planes`. Las filas de valor fijo en los 4 planes son la única excepción y van comentadas como tal.
- No se tocan: precios, columnas de `planes`, gating real, ni `src/pages/admin/Suscripcion.tsx`.

---

### Task 1: Módulo puro `src/lib/comparativa.ts` + pruebas

**Files:**
- Create: `src/lib/comparativa.ts`
- Test: `src/lib/comparativa.test.ts`

**Interfaces:**
- Consumes: `src/lib/plan.ts` (`fuentesDelPlan`, `modosImagenDelPlan`, `permiteColorModificadores`, `permiteDesenfoque`, `permiteQrAvanzado`, `permiteQrColor`, `textoLimite`), `src/lib/fuentes.ts` (`CLAVES_FUENTE`), `src/types/database.ts` (`Plan`, `NombrePlan`).
- Produces:
  - `GRUPOS_COMPARATIVA: readonly GrupoComparativa[]` — orden canónico de los 8 grupos.
  - `type GrupoComparativa`
  - `type FilaComparativa = { grupo: GrupoComparativa; etiqueta: string; valor: (p: Plan) => string | boolean; destacada?: boolean }`
  - `FILAS_COMPARATIVA: FilaComparativa[]`
  - `filasDeGrupo(grupo: GrupoComparativa, soloDestacadas?: boolean): FilaComparativa[]`
  - `gruposConFilas(soloDestacadas?: boolean): GrupoComparativa[]`

- [ ] **Step 1: Escribir las pruebas**

Crear `src/lib/comparativa.test.ts`. Usa un factory de `Plan` parcial como el de `src/lib/plan.test.ts` (castea `as Plan`, solo llena lo que la fila necesita):

```ts
import { describe, expect, test } from "bun:test";
import {
  FILAS_COMPARATIVA,
  GRUPOS_COMPARATIVA,
  filasDeGrupo,
  gruposConFilas,
} from "@/lib/comparativa";
import type { Plan } from "@/types/database";

const plan = (parcial: Partial<Plan>): Plan =>
  ({
    id: "p",
    nombre: "free",
    precio_usd: 0,
    precio_mxn: 0,
    precio_usd_anual: null,
    precio_mxn_anual: null,
    limite_sucursales: 1,
    limite_productos: 20,
    limite_usuarios: 1,
    limite_grupos_modificadores: 2,
    limite_formatos: 1,
    formatos_permitidos: ["clasico"],
    fuentes_permitidas: ["fraunces", "inter"],
    modos_imagen_permitidos: [],
    menu_independiente_por_sucursal: false,
    marca_agua: true,
    permite_multiusuario: false,
    permite_dominio_propio: false,
    permite_color_modificadores: false,
    permite_desenfoque: false,
    qr_color: false,
    qr_avanzado: false,
    permite_pedidos_whatsapp: false,
    permite_embudo_resenas: false,
    permite_reservaciones: false,
    permite_analitica_platillo: false,
    permite_lealtad: false,
    ...parcial,
  }) as Plan;

const FREE = plan({});
const ENTERPRISE = plan({
  nombre: "enterprise",
  precio_mxn_anual: 6990,
  precio_usd_anual: 390,
  limite_sucursales: null,
  limite_productos: null,
  limite_usuarios: null,
  limite_grupos_modificadores: null,
  limite_formatos: null,
  formatos_permitidos: ["clasico", "pinterest", "instagram", "tiktok"],
  fuentes_permitidas: Array(12).fill("x"),
  modos_imagen_permitidos: ["marco", "completo"],
  menu_independiente_por_sucursal: true,
  marca_agua: false,
  permite_multiusuario: true,
  permite_dominio_propio: true,
  permite_color_modificadores: true,
  permite_desenfoque: true,
  qr_color: true,
  qr_avanzado: true,
  permite_pedidos_whatsapp: true,
  permite_embudo_resenas: true,
  permite_reservaciones: true,
  permite_analitica_platillo: true,
  permite_lealtad: true,
});

const ETIQUETAS_FIJAS = new Set([
  "1 foto por producto",
  "Video por URL embebida",
  "Color de acento, fondo y texto",
  "QR imprimible con tu nombre",
  "Soporte por correo",
  "Precio congelado al suscribirte",
]);

describe("cobertura", () => {
  test("cada función de conversión/fidelización tiene su fila", () => {
    const etiquetas = FILAS_COMPARATIVA.map((f) => f.etiqueta);
    for (const e of [
      "Pedir por WhatsApp",
      "Embudo a reseñas de Google",
      "Reservaciones",
      "Tarjeta de lealtad con QR",
      "Analítica por platillo",
    ]) {
      expect(etiquetas).toContain(e);
    }
  });

  test("toda fila declara un grupo válido", () => {
    for (const f of FILAS_COMPARATIVA) {
      expect(GRUPOS_COMPARATIVA).toContain(f.grupo);
    }
  });
});

describe("valores por plan", () => {
  test("Free: las booleanas son false salvo las fijas", () => {
    for (const f of FILAS_COMPARATIVA) {
      const v = f.valor(FREE);
      if (typeof v === "boolean" && !ETIQUETAS_FIJAS.has(f.etiqueta)) {
        expect(v).toBe(false);
      }
    }
  });

  test("Enterprise: ninguna booleana es false", () => {
    for (const f of FILAS_COMPARATIVA) {
      const v = f.valor(ENTERPRISE);
      if (typeof v === "boolean") expect(v).toBe(true);
    }
  });

  test("Soporte prioritario solo en enterprise", () => {
    const fila = FILAS_COMPARATIVA.find((f) => f.etiqueta === "Soporte prioritario")!;
    expect(fila.valor(FREE)).toBe(false);
    expect(fila.valor(plan({ nombre: "pro" }))).toBe(false);
    expect(fila.valor(ENTERPRISE)).toBe(true);
  });

  test("Descuento en plan anual sigue a precio_mxn_anual", () => {
    const fila = FILAS_COMPARATIVA.find((f) => f.etiqueta === "Descuento en plan anual")!;
    expect(fila.valor(FREE)).toBe(false);
    expect(fila.valor(plan({ precio_mxn_anual: 1690 }))).toBe(true);
  });
});

describe("agrupado", () => {
  test("gruposConFilas respeta el orden canónico", () => {
    const g = gruposConFilas(false);
    expect(g).toEqual([...GRUPOS_COMPARATIVA].filter((x) => g.includes(x)));
  });

  test("las destacadas son un subconjunto", () => {
    const rapida = gruposConFilas(true);
    const completa = gruposConFilas(false);
    for (const x of rapida) expect(completa).toContain(x);
  });

  test("filasDeGrupo(g, true) son todas destacadas", () => {
    for (const g of GRUPOS_COMPARATIVA) {
      for (const f of filasDeGrupo(g, true)) expect(f.destacada).toBe(true);
    }
  });

  test("hay entre 7 y 10 filas destacadas", () => {
    const n = FILAS_COMPARATIVA.filter((f) => f.destacada).length;
    expect(n).toBeGreaterThanOrEqual(7);
    expect(n).toBeLessThanOrEqual(10);
  });
});
```

- [ ] **Step 2: Correr las pruebas — deben fallar**

Run: `bun test src/lib/comparativa.test.ts`
Expected: FAIL — `Cannot find module '@/lib/comparativa'`.

- [ ] **Step 3: Escribir `src/lib/comparativa.ts`**

Copiar **exactamente** el bloque de código de la sección "`src/lib/comparativa.ts`" del spec (`docs/superpowers/specs/2026-09-03-comparativa-planes-design.md`). Es el contenido completo del archivo, sin cambios.

- [ ] **Step 4: Correr las pruebas — deben pasar**

Run: `bun test src/lib/comparativa.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Suite completa + tipos + lint**

Run: `bun test && bunx tsc --noEmit && bunx eslint src/lib/comparativa.ts src/lib/comparativa.test.ts`
Expected: 210+ tests verde, 0 errores tsc, 0 errores eslint.

- [ ] **Step 6: Commit**

```bash
git add src/lib/comparativa.ts src/lib/comparativa.test.ts
git commit -m "feat(precios): modelo puro de la comparativa de planes con las funciones nuevas"
```

---

### Task 2: `Precios.tsx` — dos tablas (rápida + completa)

**Files:**
- Modify: `src/pages/Precios.tsx`
- Modify: `src/lib/copy.ts` (solo el objeto `PRECIOS`)

**Interfaces:**
- Consumes de Task 1: `GRUPOS_COMPARATIVA`, `filasDeGrupo`, `gruposConFilas`, `type FilaComparativa`.
- Produces: nada para tareas posteriores.

- [ ] **Step 1: Añadir copy a `PRECIOS` en `src/lib/copy.ts`**

En el objeto `export const PRECIOS = { ... } as const;`, añadir dos claves:

```ts
  comparativaCompletaTitulo: "Todo lo que incluye cada plan",
  comparativaCompletaNota:
    "Cada función, en cada plan. Lo que tu plan no incluye aparece con una raya (–).",
```

- [ ] **Step 2: Reescribir `src/pages/Precios.tsx`**

Cambios:

1. **Borrar** el tipo local `type Fila`, el array `const CARACTERISTICAS`, y el `const GRUPOS`.
2. **Imports:** quitar los helpers de `@/lib/plan` que ya solo usaba `CARACTERISTICAS` y que ahora no se usan en el archivo (`fuentesDelPlan`, `modosImagenDelPlan`, `permiteColorModificadores`, `permiteDesenfoque`, `permiteQrAvanzado`, `permiteQrColor`, `textoLimite`) — **verificar uno por uno con búsqueda en el archivo antes de quitarlo**; `formatearPrecio`, `precioDelPlan`, `porcentajeAhorroAnual` se quedan. Quitar `import { CLAVES_FUENTE } from "@/lib/fuentes";` si queda sin uso. Añadir:

```ts
import {
  filasDeGrupo,
  gruposConFilas,
  type FilaComparativa,
} from "@/lib/comparativa";
```

3. **`Celda`** no cambia.

4. **Nuevo componente** (encima de `Precios`), que es la tabla actual parametrizada:

```tsx
function TablaComparativa({
  planes,
  titulo,
  soloDestacadas = false,
}: {
  planes: Plan[];
  titulo: string;
  soloDestacadas?: boolean;
}) {
  const grupos = gruposConFilas(soloDestacadas);
  return (
    <div className="mx-auto max-w-5xl overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 overflow-hidden rounded-xl border">
        <thead>
          <tr className="bg-vm-bg-soft">
            <th className="px-5 py-4 text-left text-sm font-medium text-vm-ink">{titulo}</th>
            {planes.map((p) => (
              <th key={p.id} className="px-5 py-4 text-center text-sm font-medium text-vm-ink">
                {NOMBRE_PLAN[p.nombre as NombrePlan]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => (
            <Fragment key={grupo}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={planes.length + 1}
                  className="border-t bg-vm-bg-soft/60 px-5 py-2.5 text-left text-xs font-medium tracking-wide text-vm-primary"
                >
                  {grupo.toUpperCase()}
                </th>
              </tr>
              {filasDeGrupo(grupo, soloDestacadas).map((fila: FilaComparativa) => (
                <tr key={fila.etiqueta}>
                  <th
                    scope="row"
                    className="border-t px-5 py-3.5 text-left text-sm font-normal text-vm-body"
                  >
                    {fila.etiqueta}
                  </th>
                  {planes.map((p) => (
                    <td key={p.id} className="border-t px-5 py-3.5 text-center">
                      <Celda valor={fila.valor(p)} />
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

5. **En `Precios()`**, reemplazar el bloque actual `<div className="mx-auto mt-20 max-w-5xl overflow-x-auto"> <table>…</table> </div>` por:

```tsx
            <div className="mt-16">
              <TablaComparativa planes={planes} titulo="Comparación rápida" soloDestacadas />
            </div>

            <div className="mx-auto mt-20 max-w-5xl text-center">
              <h2 className="text-2xl md:text-3xl">{PRECIOS.comparativaCompletaTitulo}</h2>
              <p className="mt-3 text-sm text-vm-body">{PRECIOS.comparativaCompletaNota}</p>
            </div>
            <div className="mt-8">
              <TablaComparativa planes={planes} titulo="Comparar todo" />
            </div>
```

(La `notaPrecioCongelado` que ya está arriba de esto no se toca.)

- [ ] **Step 3: Tipos + lint + build**

Run: `bunx tsc --noEmit && bunx eslint src/pages/Precios.tsx src/lib/copy.ts && bun run build`
Expected: 0 errores tsc, 0 errores eslint (warnings `react-refresh` preexistentes OK), build OK.

- [ ] **Step 4: Suite completa**

Run: `bun test`
Expected: verde, sin bajar de 210.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Precios.tsx src/lib/copy.ts
git commit -m "feat(precios): comparativa rápida + matriz completa de planes en /precios"
```

---

### Task 3: Alinear `vibemenu_alcance.md` y `PLANES_COPY`

**Files:**
- Modify: `src/lib/copy.ts` (solo `PLANES_COPY`)
- Modify: `src/docs/vibemenu_alcance.md`

**Interfaces:** ninguna — cambio de contenido aislado.

- [ ] **Step 1: `PLANES_COPY` en `src/lib/copy.ts`**

Reemplazar los objetos `basic`, `pro`, `enterprise` por los del spec (sección "`src/lib/copy.ts` — `PLANES_COPY`"). `free` no cambia. No tocar `headline` de `basic`/`pro` (se mantienen); solo cambian los `descripcion` de `basic`/`pro` y el `descripcion` de `enterprise`.

- [ ] **Step 2: Tabla de planes en `vibemenu_alcance.md`**

En la tabla "## Modelo de negocio — Planes", columna **Extras**:
- Fila Basic: `Sin marca de agua · Pedir por WhatsApp · Embudo a reseñas`
- Fila Pro: `Todo lo de Basic · Reservaciones · Tarjeta de lealtad · Dominio propio (CNAME)`
- Fila Enterprise: `Todo lo de Pro · Analítica por platillo · Soporte prioritario`

- [ ] **Step 3: Nueva tabla en `vibemenu_alcance.md`**

Justo después de la tabla "Personalización del menú por plan" y su párrafo "Modos de imagen", insertar:

```markdown
## Funciones de conversión y fidelización por plan

| Función | Free | Basic | Pro | Enterprise | Columna en `planes` |
| --- | :-: | :-: | :-: | :-: | --- |
| Pedir por WhatsApp | ❌ | ✅ | ✅ | ✅ | `permite_pedidos_whatsapp` |
| Embudo a reseñas de Google | ❌ | ✅ | ✅ | ✅ | `permite_embudo_resenas` |
| Reservaciones | ❌ | ❌ | ✅ | ✅ | `permite_reservaciones` |
| Tarjeta de lealtad con QR | ❌ | ❌ | ✅ | ✅ | `permite_lealtad` |
| Analítica por platillo | ❌ | ❌ | ❌ | ✅ | `permite_analitica_platillo` |

El gating real vive en los triggers/RPC de Postgres; la página de precios y el
panel solo leen estas columnas para mostrar u ocultar.
```

- [ ] **Step 4: Corregir número de migración huérfano**

En la sección de reservaciones, si el encabezado dice `(Pro/Enterprise, migración 012)`, dejarlo `(Pro/Enterprise)`. Buscar también `migración 012` en el resto del archivo; si aparece con ese sentido, quitar el número. No inventar números nuevos.

- [ ] **Step 5: Verificar**

Run: `bun test && bunx tsc --noEmit && bunx eslint src/lib/copy.ts`
Expected: verde, 0 / 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/copy.ts src/docs/vibemenu_alcance.md
git commit -m "docs(precios): alinea alcance.md y headlines de plan con las funciones nuevas"
```

---

## Self-Review

- **Cobertura del spec:** Task 1 = módulo + pruebas; Task 2 = dos tablas en `/precios` + copy de sección; Task 3 = alcance.md + PLANES_COPY. Las 3 superficies del spec cubiertas.
- **Sin placeholders:** el código de Task 1 vive en el spec y se copia literal; Task 2 y 3 traen el código/markdown exacto.
- **Consistencia de tipos:** `FilaComparativa` / `filasDeGrupo` / `gruposConFilas` se definen en Task 1 y se consumen con la misma firma en Task 2. `Plan`, `NombrePlan`, `NOMBRE_PLAN`, `Fragment` ya están importados en `Precios.tsx`.
