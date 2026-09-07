# Preparación para las primeras ventas — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los huecos del super-admin para acompañar al primer cliente (churn, cancelación programada, respuestas de onboarding, señales de salud) y dejar listas 3 cosas de pre-cobro: canal de contacto, página de Términos, y un guion de prueba de Stripe.

**Architecture:** Toda la lógica nueva de "situación comercial" y "señales de salud" vive en `src/lib/superadmin.ts` como funciones puras con pruebas (patrón `src/lib/plan.ts`). Los hooks de `useSuperAdmin.ts` solo extienden sus `select` y arman los tipos. Las dos páginas de super-admin consumen eso. Contacto, Términos y el guion de Stripe son cambios aislados. Sin tocar gating, precios ni el webhook de Stripe.

**Tech Stack:** React 19 + TanStack Router/Query, Tailwind, lucide-react, bun:test, Supabase (RLS).

**Spec:** `docs/superpowers/specs/2026-09-03-preparacion-primeras-ventas-design.md`

## Global Constraints

- TS estricto; `bunx tsc --noEmit` y `bunx eslint .` con 0 errores (los ~15 warnings `react-refresh` preexistentes se toleran).
- `bun test` verde; baseline **211** tests, no deben bajar.
- Copy en español de México (tú/tu), sin signos de admiración de más (regla de `src/lib/copy.ts`).
- Los helpers de `src/lib/superadmin.ts` son puros y con pruebas. El super-admin nunca cruza tenants — lo garantiza la RLS `es_super_admin()` en Postgres, no el frontend.
- No se tocan: `planes`, gating real, precios, `stripe-webhook`, el cron de dunning.
- **La migración ya está aplicada a prod** (`onboarding_respuestas_select_super_admin`) y el archivo `src/docs/vibemenu_migracion_onboarding_lectura.sql` ya existe. Ninguna tarea aplica SQL. Los tipos de `src/types/database.ts` no cambian (una policy no altera columnas).

---

### Task 1: `src/lib/superadmin.ts` — helpers de situación comercial y salud (+ pruebas)

**Files:**
- Modify: `src/lib/superadmin.ts` (hoy exporta `FECHA`, `FECHA_HORA`, `COLOR_ESTADO`, `NOMBRE_ESTADO` — no tocar esos)
- Create: `src/lib/superadmin.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces:
  - `type SituacionComercial` (unión discriminada por `tipo`)
  - `type SuscripcionMin = { estado: string; motivo_cambio: string | null; fecha_fin: string | null; fecha_renovacion: string | null }`
  - `situacionComercial(tenant: { estado: string; cancela_al_terminar: boolean | null }, suscripciones: readonly SuscripcionMin[]): SituacionComercial`
  - `bajoEnUltimosDias(s: SituacionComercial, dias: number, ahora?: Date): boolean`
  - `ETIQUETA_SITUACION: Record<SituacionComercial["tipo"], string>`
  - `PREGUNTAS_ONBOARDING: { clave: string; etiqueta: string }[]`
  - `type Senal = { etiqueta: string; ok: boolean; detalle?: string }`
  - `senalesDeSalud(input): Senal[]`

- [ ] **Step 1: Escribir las pruebas**

Crear `src/lib/superadmin.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  bajoEnUltimosDias,
  senalesDeSalud,
  situacionComercial,
  type SuscripcionMin,
} from "@/lib/superadmin";

const susc = (p: Partial<SuscripcionMin>): SuscripcionMin => ({
  estado: "activa",
  motivo_cambio: null,
  fecha_fin: null,
  fecha_renovacion: null,
  ...p,
});

describe("situacionComercial", () => {
  test("fila activa + sin cancelar = pagando", () => {
    const s = situacionComercial({ estado: "activo", cancela_al_terminar: false }, [susc({})]);
    expect(s.tipo).toBe("pagando");
  });

  test("fila activa + cancela_al_terminar = cancela_al_terminar con fecha", () => {
    const s = situacionComercial({ estado: "activo", cancela_al_terminar: true }, [
      susc({ fecha_renovacion: "2026-11-14T00:00:00Z" }),
    ]);
    expect(s).toEqual({ tipo: "cancela_al_terminar", hasta: "2026-11-14T00:00:00Z" });
  });

  test("sin activa, con canceladas = bajo con la fecha_fin más reciente", () => {
    const s = situacionComercial({ estado: "activo", cancela_al_terminar: false }, [
      susc({ estado: "cancelada", fecha_fin: "2026-05-01T00:00:00Z" }),
      susc({ estado: "cancelada", fecha_fin: "2026-09-01T00:00:00Z" }),
      susc({ estado: "reemplazada", fecha_fin: "2026-03-01T00:00:00Z" }),
    ]);
    expect(s).toEqual({ tipo: "bajo", desde: "2026-09-01T00:00:00Z" });
  });

  test("sin filas + trial = trial", () => {
    expect(situacionComercial({ estado: "trial", cancela_al_terminar: false }, []).tipo).toBe("trial");
  });

  test("sin filas + activo = nunca_pago", () => {
    expect(situacionComercial({ estado: "activo", cancela_al_terminar: null }, []).tipo).toBe(
      "nunca_pago",
    );
  });
});

describe("bajoEnUltimosDias", () => {
  const ahora = new Date("2026-09-20T00:00:00Z");
  test("bajó hace 10 días, ventana 30 = true", () => {
    expect(
      bajoEnUltimosDias({ tipo: "bajo", desde: "2026-09-10T00:00:00Z" }, 30, ahora),
    ).toBe(true);
  });
  test("bajó hace 40 días, ventana 30 = false", () => {
    expect(
      bajoEnUltimosDias({ tipo: "bajo", desde: "2026-08-11T00:00:00Z" }, 30, ahora),
    ).toBe(false);
  });
  test("fecha en el futuro = false", () => {
    expect(
      bajoEnUltimosDias({ tipo: "bajo", desde: "2026-10-01T00:00:00Z" }, 30, ahora),
    ).toBe(false);
  });
  test("no es baja = false", () => {
    expect(bajoEnUltimosDias({ tipo: "pagando" }, 30, ahora)).toBe(false);
  });
});

describe("senalesDeSalud", () => {
  const base = {
    tenant: {
      created_at: "2026-09-10T00:00:00Z",
      lealtad_activa: false,
      formato_activo: "clasico",
      logo_url: null,
      tema: {},
    },
    productos: 0,
    algunaSucursalConReservas: false,
    visitas30: 0,
    ahora: new Date("2026-09-20T00:00:00Z"),
  };

  test("tenant nuevo sin nada: solo 'Días desde el alta' ok", () => {
    const s = senalesDeSalud(base);
    const publico = s.find((x) => x.etiqueta === "Publicó menú")!;
    const dias = s.find((x) => x.etiqueta === "Días desde el alta")!;
    expect(publico.ok).toBe(false);
    expect(dias.ok).toBe(true);
    expect(dias.detalle).toBe("10");
  });

  test("con productos, visitas y lealtad: esas tres ok", () => {
    const s = senalesDeSalud({
      ...base,
      productos: 12,
      visitas30: 40,
      tenant: { ...base.tenant, lealtad_activa: true },
    });
    expect(s.find((x) => x.etiqueta === "Publicó menú")!.ok).toBe(true);
    expect(s.find((x) => x.etiqueta === "Su menú recibe visitas")!.ok).toBe(true);
    expect(s.find((x) => x.etiqueta === "Activó tarjeta de lealtad")!.ok).toBe(true);
  });

  test("personalizó diseño = tema con llaves o logo", () => {
    expect(
      senalesDeSalud({ ...base, tenant: { ...base.tenant, tema: { primario: "#fff" } } }).find(
        (x) => x.etiqueta === "Personalizó diseño",
      )!.ok,
    ).toBe(true);
    expect(
      senalesDeSalud({ ...base, tenant: { ...base.tenant, logo_url: "x.png" } }).find(
        (x) => x.etiqueta === "Personalizó diseño",
      )!.ok,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Correr las pruebas — deben fallar**

Run: `bun test src/lib/superadmin.test.ts`
Expected: FAIL — export no existe.

- [ ] **Step 3: Implementar en `src/lib/superadmin.ts`**

Añadir al final del archivo (sin tocar lo existente):

```ts
export type SituacionComercial =
  | { tipo: "pagando" }
  | { tipo: "cancela_al_terminar"; hasta: string | null }
  | { tipo: "bajo"; desde: string | null }
  | { tipo: "trial" }
  | { tipo: "nunca_pago" };

/** Resumen mínimo de una fila de `suscripciones` que estas funciones necesitan. */
export type SuscripcionMin = {
  estado: string;
  motivo_cambio: string | null;
  fecha_fin: string | null;
  fecha_renovacion: string | null;
};

/**
 * Situación de cobro de un tenant, a partir de su historial de `suscripciones`.
 * Regla del webhook: una fila `estado='activa'` ⟺ está pagando ahora; un tenant
 * que nunca pagó no tiene ninguna fila. Ver el spec, sección "Ciclo de vida".
 */
export function situacionComercial(
  tenant: { estado: string; cancela_al_terminar: boolean | null },
  suscripciones: readonly SuscripcionMin[],
): SituacionComercial {
  const activa = suscripciones.find((s) => s.estado === "activa");
  if (activa) {
    return tenant.cancela_al_terminar
      ? { tipo: "cancela_al_terminar", hasta: activa.fecha_renovacion }
      : { tipo: "pagando" };
  }
  const canceladas = suscripciones.filter((s) => s.estado === "cancelada");
  if (canceladas.length > 0) {
    const desde =
      canceladas
        .map((s) => s.fecha_fin)
        .filter((f): f is string => Boolean(f))
        .sort()
        .at(-1) ?? null;
    return { tipo: "bajo", desde };
  }
  if (tenant.estado === "trial") return { tipo: "trial" };
  return { tipo: "nunca_pago" };
}

/** ¿Se dio de baja dentro de los últimos `dias` días? Para el total "Bajas (30 d)". */
export function bajoEnUltimosDias(
  s: SituacionComercial,
  dias: number,
  ahora: Date = new Date(),
): boolean {
  if (s.tipo !== "bajo" || !s.desde) return false;
  const ms = ahora.getTime() - new Date(s.desde).getTime();
  return ms >= 0 && ms <= dias * 86_400_000;
}

export const ETIQUETA_SITUACION: Record<SituacionComercial["tipo"], string> = {
  pagando: "Pagando",
  cancela_al_terminar: "Cancela al terminar",
  bajo: "Bajó",
  trial: "En prueba",
  nunca_pago: "Nunca pagó",
};

/** Las 3 preguntas de `PasoMetricas.tsx`. Las respuestas "Otro" traen `${clave}_otro`. */
export const PREGUNTAS_ONBOARDING: { clave: string; etiqueta: string }[] = [
  { clave: "como_manejas_menu", etiqueta: "¿Cómo manejaba su menú?" },
  { clave: "dolor_principal", etiqueta: "Su mayor dolor de cabeza" },
  { clave: "como_nos_conociste", etiqueta: "Cómo nos conoció" },
];

export type Senal = { etiqueta: string; ok: boolean; detalle?: string };

/** Señales de enganche del tenant, para la ficha de super-admin. Pura. */
export function senalesDeSalud(input: {
  tenant: {
    created_at: string;
    lealtad_activa: boolean | null;
    formato_activo: string | null;
    logo_url: string | null;
    tema: unknown;
  };
  productos: number;
  algunaSucursalConReservas: boolean;
  visitas30: number | null;
  ahora?: Date;
}): Senal[] {
  const dias = Math.floor(
    ((input.ahora ?? new Date()).getTime() - new Date(input.tenant.created_at).getTime()) /
      86_400_000,
  );
  const temaTocado =
    !!input.tenant.tema &&
    typeof input.tenant.tema === "object" &&
    Object.keys(input.tenant.tema as object).length > 0;
  return [
    {
      etiqueta: "Publicó menú",
      ok: input.productos > 0,
      detalle: `${input.productos} productos`,
    },
    {
      etiqueta: "Su menú recibe visitas",
      ok: (input.visitas30 ?? 0) > 0,
      detalle: `${input.visitas30 ?? 0} en 30 d`,
    },
    {
      etiqueta: "Personalizó diseño",
      ok: temaTocado || !!input.tenant.logo_url,
    },
    { etiqueta: "Activó tarjeta de lealtad", ok: !!input.tenant.lealtad_activa },
    { etiqueta: "Activó reservaciones", ok: input.algunaSucursalConReservas },
    { etiqueta: "Días desde el alta", ok: true, detalle: String(dias) },
  ];
}
```

- [ ] **Step 4: Pruebas verdes**

Run: `bun test src/lib/superadmin.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Suite + tipos + lint**

Run: `bun test && bunx tsc --noEmit && bunx eslint src/lib/superadmin.ts src/lib/superadmin.test.ts`
Expected: ≥225 tests verde, 0 / 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/superadmin.ts src/lib/superadmin.test.ts
git commit -m "feat(superadmin): helpers puros de situación comercial y señales de salud"
```

---

### Task 2: `useSuperAdmin.ts` — extender los dos queries

**Files:**
- Modify: `src/hooks/useSuperAdmin.ts`

**Interfaces:**
- Consumes de Task 1: `situacionComercial`, `type SituacionComercial`, `type SuscripcionMin`.
- Produces (para Tasks 3 y 4):
  - `TenantSuperAdmin` gana `situacion: SituacionComercial` y `cancela_al_terminar: boolean | null`.
  - `DetalleTenantSuperAdmin` gana:
    - `onboarding: { respuestas: Record<string, string>; created_at: string } | null`
    - `salud: { productos: number; algunaSucursalConReservas: boolean }`

- [ ] **Step 1: `useTenantsSuperAdmin`**

En el `select` string, cambiar la parte de `suscripciones(...)` para incluir los campos nuevos y añadir `cancela_al_terminar` al tenant:

```ts
.select(
  "id, nombre_negocio, slug, estado, created_at, cancela_al_terminar, dominio_personalizado, dominio_estado, dominio_diagnostico, plan:planes(nombre), suscripciones(estado, motivo_cambio, fecha_fin, fecha_renovacion, precio_congelado_usd, precio_congelado_mxn, moneda_cobro)",
)
```

Actualizar `SuscripcionResumen` para incluir `motivo_cambio: string | null; fecha_fin: string | null` (ya tiene `estado`, `fecha_renovacion`, precios, moneda).

Actualizar `FilaTenantSuperAdmin` con `cancela_al_terminar: boolean | null`.

Actualizar `TenantSuperAdmin`:
```ts
export type TenantSuperAdmin = Omit<FilaTenantSuperAdmin, "suscripciones"> & {
  suscripcionActiva: SuscripcionResumen | null;
  situacion: SituacionComercial;
};
```

En el `.map`:
```ts
return (data as unknown as FilaTenantSuperAdmin[]).map(({ suscripciones, ...t }) => ({
  ...t,
  suscripcionActiva: suscripciones.find((s) => s.estado === "activa") ?? null,
  situacion: situacionComercial(
    { estado: t.estado, cancela_al_terminar: t.cancela_al_terminar },
    suscripciones,
  ),
}));
```

`calcularMrr` no cambia (sigue leyendo `suscripcionActiva`).

Import al inicio del archivo: `import { situacionComercial, type SituacionComercial } from "@/lib/superadmin";`

- [ ] **Step 2: `useDetalleTenantSuperAdmin` — 3 consultas más**

Añadir al `Promise.all` (después de `invitacionesRes`):

```ts
supabase
  .from("onboarding_respuestas")
  .select("respuestas, created_at")
  .eq("tenant_id", tenantId!)
  .maybeSingle(),
supabase
  .from("productos")
  .select("id", { count: "exact", head: true })
  .eq("tenant_id", tenantId!),
supabase.from("sucursales").select("acepta_reservaciones").eq("tenant_id", tenantId!),
```

Renombrar el destructuring: `const [tenantRes, suscripcionesRes, pagosRes, equipoRes, invitacionesRes, onboardingRes, productosRes, sucursalesRes] = await Promise.all([...])`.

Manejo de errores:
- `onboardingRes.error`: **no lanzar** — la fila puede no existir. `maybeSingle` sin fila da `data: null, error: null`. Si `error` viene por otra razón, `console.error` y tratar como `null`.
- `productosRes.error` / `sucursalesRes.error`: `console.error` y usar `0` / `[]` (no romper la ficha por una señal).
- Los 5 `if (xxxRes.error) throw` originales se quedan.

Tipo `DetalleTenantSuperAdmin`:
```ts
onboarding: { respuestas: Record<string, string>; created_at: string } | null;
salud: { productos: number; algunaSucursalConReservas: boolean };
```

Return:
```ts
onboarding: onboardingRes.data
  ? {
      respuestas: (onboardingRes.data.respuestas ?? {}) as Record<string, string>,
      created_at: onboardingRes.data.created_at,
    }
  : null,
salud: {
  productos: productosRes.count ?? 0,
  algunaSucursalConReservas: (sucursalesRes.data ?? []).some((s) => s.acepta_reservaciones === true),
},
```

- [ ] **Step 3: Tipos + lint**

Run: `bunx tsc --noEmit && bunx eslint src/hooks/useSuperAdmin.ts`
Expected: 0 / 0. (Si `productos`/`sucursales` no están en los tipos con esas columnas, castear el resultado como en el resto del archivo con `as unknown as ...` — pero `sucursales.acepta_reservaciones` y `productos` ya existen en `src/types/database.ts`.)

- [ ] **Step 4: Suite**

Run: `bun test`
Expected: verde, sin bajar de 225.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSuperAdmin.ts
git commit -m "feat(superadmin): los queries traen situación comercial, onboarding y señales"
```

---

### Task 3: `SuperAdmin.tsx` — churn en la lista

**Files:**
- Modify: `src/pages/SuperAdmin.tsx`

**Interfaces:**
- Consumes: `TenantSuperAdmin.situacion` (Task 2), `bajoEnUltimosDias`, `ETIQUETA_SITUACION` (Task 1).

- [ ] **Step 1: Imports**

`import { COLOR_ESTADO, FECHA, ETIQUETA_SITUACION, bajoEnUltimosDias } from "@/lib/superadmin";`

- [ ] **Step 2: Filtro "Bajas"**

`FILTROS_ESTADO` se queda igual. Añadir estado local:
```ts
const [soloBajas, setSoloBajas] = useState(false);
```
Un chip aparte, después de los de `FILTROS_ESTADO`:
```tsx
<button
  type="button"
  onClick={() => setSoloBajas((v) => !v)}
  className={cn(
    "rounded-full px-3 py-1.5 text-xs font-medium",
    soloBajas ? "bg-vm-primary text-white" : "bg-vm-bg-soft text-vm-body hover:text-vm-ink",
  )}
>
  Bajas
</button>
```
En `visibles`:
```ts
const visibles = (tenants ?? []).filter(
  (t) =>
    coincide(t, busqueda) &&
    (filtroEstado === "todos" || t.estado === filtroEstado) &&
    (!soloBajas || t.situacion.tipo === "bajo"),
);
```

- [ ] **Step 3: Tarjeta "Bajas (30 d)"**

Añadir al bloque de tarjetas (cambiar `lg:grid-cols-5` → `lg:grid-cols-6`):
```ts
const bajas30 = (tenants ?? []).filter((t) => bajoEnUltimosDias(t.situacion, 30)).length;
```
```tsx
<div className="rounded-xl border p-5">
  <p className="text-xs text-vm-body">Bajas (30 d)</p>
  <p className="vm-data mt-2 text-2xl text-vm-ink">{bajas30}</p>
</div>
```

- [ ] **Step 4: Badge de situación en la columna Estado**

En la celda de `Estado` (hoy solo el badge de `t.estado`), añadir debajo un segundo badge cuando la situación lo amerite:

```tsx
<td className="px-4 py-3.5">
  <div className="flex flex-col items-start gap-1">
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium capitalize", COLOR_ESTADO[t.estado] ?? "bg-vm-bg-soft text-vm-body")}>
      {t.estado}
    </span>
    {t.situacion.tipo === "cancela_al_terminar" && (
      <span className="rounded-full bg-vm-warning-soft px-2 py-0.5 text-[11px] font-medium text-vm-warning">
        {ETIQUETA_SITUACION.cancela_al_terminar}
        {t.situacion.hasta ? ` · ${FECHA.format(new Date(t.situacion.hasta))}` : ""}
      </span>
    )}
    {t.situacion.tipo === "bajo" && (
      <span className="rounded-full bg-vm-bg-soft px-2 py-0.5 text-[11px] font-medium text-vm-body">
        {ETIQUETA_SITUACION.bajo}
        {t.situacion.desde ? ` · ${FECHA.format(new Date(t.situacion.desde))}` : ""}
      </span>
    )}
  </div>
</td>
```

- [ ] **Step 5: Verificar**

Run: `bunx tsc --noEmit && bunx eslint src/pages/SuperAdmin.tsx && bun test && bun run build`
Expected: 0 / 0, verde, build OK.

- [ ] **Step 6: Commit**

```bash
git add src/pages/SuperAdmin.tsx
git commit -m "feat(superadmin): churn en la lista — badge, filtro Bajas y total 30 d"
```

---

### Task 4: `SuperAdminDetalle.tsx` — cancelación programada, onboarding y señales

**Files:**
- Modify: `src/pages/SuperAdminDetalle.tsx`

**Interfaces:**
- Consumes de Task 2: `detalle.onboarding`, `detalle.salud`, `detalle.historialSuscripciones`, `detalle.tenant.cancela_al_terminar`.
- Consumes de Task 1: `PREGUNTAS_ONBOARDING`, `senalesDeSalud`.
- Reusa el `visitas` que la ficha ya monta (`useVisitas`).

- [ ] **Step 1: Imports**

`import { COLOR_ESTADO, FECHA, FECHA_HORA, NOMBRE_ESTADO, PREGUNTAS_ONBOARDING, senalesDeSalud } from "@/lib/superadmin";`

- [ ] **Step 2: Badge "Cancela el …" en el encabezado**

Junto al badge de estado del encabezado (dentro del `<div className="flex flex-wrap items-center gap-2.5">`):
```tsx
{detalle.tenant.cancela_al_terminar && (
  <span className="rounded-full bg-vm-warning-soft px-2.5 py-1 text-xs font-medium text-vm-warning">
    Cancela el{" "}
    {(() => {
      const activa = detalle.historialSuscripciones.find((s) => s.estado === "activa");
      return activa?.fecha_renovacion
        ? FECHA.format(new Date(activa.fecha_renovacion))
        : "terminar el periodo";
    })()}
  </span>
)}
```

- [ ] **Step 3: Bloque "Qué nos dijo al registrarse"**

Después del bloque "Visitas al menú" (dentro del segundo `grid` o como bloque nuevo antes de "Equipo" — colócalo en el `grid` de "Equipo/Pagos" haciéndolo de 3, o mejor: bloque propio de ancho completo antes de ese grid). Ancho completo:

```tsx
<div className="mt-5">
  <Bloque titulo="Qué nos dijo al registrarse">
    {detalle.onboarding === null ? (
      <p className="text-sm text-vm-body">No respondió el cuestionario del registro.</p>
    ) : (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {PREGUNTAS_ONBOARDING.map(({ clave, etiqueta }) => {
          const r = detalle.onboarding!.respuestas[clave];
          const otro = detalle.onboarding!.respuestas[`${clave}_otro`];
          return (
            <Fragment key={clave}>
              <dt className="text-vm-body">{etiqueta}</dt>
              <dd className="text-vm-ink">
                {r ? (
                  <>
                    {r}
                    {otro ? ` (${otro})` : ""}
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </Fragment>
          );
        })}
      </dl>
    )}
  </Bloque>
</div>
```

Import `Fragment` de `react` (o usar `<div>` en vez de `<Fragment>` si prefieres no importar).

- [ ] **Step 4: Bloque "Señales"**

Junto a "Uso contra su plan" / "Visitas" (en el primer `grid gap-5 lg:grid-cols-2`), añadir un `<Bloque titulo="Señales">`:

```tsx
<Bloque titulo="Señales">
  <div>
    {senalesDeSalud({
      tenant: {
        created_at: detalle.tenant.created_at,
        lealtad_activa: detalle.tenant.lealtad_activa,
        formato_activo: detalle.tenant.formato_activo,
        logo_url: detalle.tenant.logo_url,
        tema: detalle.tenant.tema,
      },
      productos: detalle.salud.productos,
      algunaSucursalConReservas: detalle.salud.algunaSucursalConReservas,
      visitas30: visitas?.ultimos30 ?? null,
    }).map((s) => (
      <div
        key={s.etiqueta}
        className="flex items-center justify-between border-t py-2.5 text-sm first:border-t-0 first:pt-0"
      >
        <span className="flex items-center gap-2 text-vm-body">
          {s.ok ? (
            <Check className="size-4 text-vm-success" aria-label="Sí" />
          ) : (
            <Minus className="size-4 text-vm-border" aria-label="No" />
          )}
          {s.etiqueta}
        </span>
        {s.detalle && <span className="vm-data text-vm-ink">{s.detalle}</span>}
      </div>
    ))}
  </div>
</Bloque>
```

Import `Check, Minus` de `lucide-react` (ya se importan `ArrowLeft, ExternalLink, Loader2, LogOut` — añadir a esa línea).

Como ahora el primer `grid` tiene 3 bloques (`Contacto`, `Cambiar estado`, `Uso`, `Visitas`, `Señales` = 5), quedan en 2 columnas y fluyen — está bien. Verifica que se vea ordenado; si no, mueve "Señales" al segundo grid.

- [ ] **Step 5: Verificar**

Run: `bunx tsc --noEmit && bunx eslint src/pages/SuperAdminDetalle.tsx && bun test && bun run build`
Expected: 0 / 0, verde, build OK.

- [ ] **Step 6: Commit**

```bash
git add src/pages/SuperAdminDetalle.tsx
git commit -m "feat(superadmin): ficha con cancelación programada, onboarding y señales de salud"
```

---

### Task 5: Canal de contacto — `legal.ts`, `Precios.tsx`, `Footer.tsx`

**Files:**
- Modify: `src/lib/legal.ts`
- Modify: `src/pages/Precios.tsx`
- Modify: `src/components/layout/Footer.tsx`

**Interfaces:**
- Produces: `CONTACTO` en `legal.ts`.

- [ ] **Step 1: `CONTACTO` en `src/lib/legal.ts`**

Después de `EMPRESA`:

```ts
/** Canal de ventas y soporte. El WhatsApp es el principal; el correo, alternativa. */
export const CONTACTO = {
  whatsapp: "+528671268563",
  whatsappTexto: "Hola, me interesa Vibemenu para mi negocio.",
  correo: "clopez@kreatechstudio.com.mx",
} as const;
```

- [ ] **Step 2: `Precios.tsx` — CTA de Enterprise a WhatsApp**

En `TarjetaPlan`, el `<Link to="/registro">` con `{copy.cta}`: cuando `nombre === "enterprise"`, renderizar un `<a>` a WhatsApp en vez del `<Link>`. Import: `import { CONTACTO } from "@/lib/legal";` y `import { enlaceWhatsApp } from "@/lib/whatsapp";`.

```tsx
{nombre === "enterprise" ? (
  <a
    href={enlaceWhatsApp(CONTACTO.whatsapp, CONTACTO.whatsappTexto)}
    target="_blank"
    rel="noreferrer"
    className={cn(
      "mt-6 inline-flex h-12 items-center justify-center rounded-lg text-sm font-medium transition-colors",
      "border text-vm-ink hover:bg-vm-bg-soft",
    )}
  >
    {copy.cta}
  </a>
) : (
  <Link
    to="/registro"
    className={cn(
      "mt-6 inline-flex h-12 items-center justify-center rounded-lg text-sm font-medium transition-colors",
      esRecomendado
        ? "bg-vm-primary text-white hover:bg-vm-primary-hover"
        : "border text-vm-ink hover:bg-vm-bg-soft",
    )}
  >
    {copy.cta}
  </Link>
)}
```

Borrar el comentario `{/* Enterprise dice "Contactar ventas" pero por ahora cae al mismo registro… */}` (ya no aplica).

Verificar la firma real de `enlaceWhatsApp` en `src/lib/whatsapp.ts` antes de llamarla — es `enlaceWhatsApp(telefono, texto?)`. Si el segundo argumento no existe, pásalo como corresponda a esa firma.

- [ ] **Step 3: `Footer.tsx` — enlaces de contacto**

Añadir una `<nav aria-label="Contacto">` como cuarta columna (el grid ya es `md:grid-cols-[2fr_1fr_1fr_1fr]` = 4 columnas; hoy hay 4 navs contando la marca → en realidad hay marca + 3 navs. Cambiar a `md:grid-cols-[2fr_1fr_1fr_1fr_1fr]` y añadir la 4ª nav), o —más simple— añadir 2 `<li>` a la nav "Cuenta":

```tsx
<li>
  <a href={enlaceWhatsApp(CONTACTO.whatsapp, CONTACTO.whatsappTexto)} target="_blank" rel="noreferrer" className="hover:text-vm-ink">
    WhatsApp
  </a>
</li>
<li>
  <a href={`mailto:${CONTACTO.correo}`} className="hover:text-vm-ink">
    Escríbenos
  </a>
</li>
```

Imports: `CONTACTO` de `@/lib/legal`, `enlaceWhatsApp` de `@/lib/whatsapp`.

- [ ] **Step 4: Verificar**

Run: `bunx tsc --noEmit && bunx eslint src/lib/legal.ts src/pages/Precios.tsx src/components/layout/Footer.tsx && bun test && bun run build`
Expected: 0 / 0, verde, build OK.

- [ ] **Step 5: Commit**

```bash
git add src/lib/legal.ts src/pages/Precios.tsx src/components/layout/Footer.tsx
git commit -m "feat(contacto): CTA de ventas y footer a WhatsApp y correo reales"
```

---

### Task 6: Página `/terminos`

**Files:**
- Create: `src/pages/Terminos.tsx`
- Create: `src/routes/terminos.tsx`
- Modify: `src/components/layout/Footer.tsx` (nav "Legal")
- Modify: `src/components/registro/pasos/PasoCuenta.tsx`
- Modify: `src/lib/legal.ts` (`VIGENCIA_LEGAL`)

**Interfaces:**
- Consumes: `PaginaLegal` de `@/components/legal/PaginaLegal`, `EMPRESA` de `@/lib/legal`.

- [ ] **Step 1: `src/routes/terminos.tsx`**

Copiar el patrón de `src/routes/privacidad.tsx` (verlo primero):

```tsx
import { createFileRoute } from "@tanstack/react-router";
import Terminos from "@/pages/Terminos";

export const Route = createFileRoute("/terminos")({
  component: Terminos,
});
```

(Si `privacidad.tsx` tiene loader/head, replícalo igual.)

- [ ] **Step 2: `src/pages/Terminos.tsx`**

Estructura idéntica a `src/pages/Privacidad.tsx`: un array `SECCIONES: SeccionLegal[]` con las 17 secciones del spec (sección "Contenido"), y el `export default` que devuelve `<PaginaLegal titulo="Términos y Condiciones" resumen="…" secciones={SECCIONES} />`.

- Cada sección: `{ id: "kebab-id", titulo: "N. Título", contenido: <>…</> }`.
- Usar `{EMPRESA.razonSocial}`, `{EMPRESA.responsable}`, `{EMPRESA.domicilio}`, `{EMPRESA.correoContacto}` donde el spec los cita.
- Los enlaces internos con `<Link to="/privacidad">` y `<Link to="/precios">`.
- El texto de cada sección sale **literal del spec** (sección "Contenido", puntos 1–17). No parafrasear.
- Resumen: "Las reglas de uso de Vibemenu: qué te damos, qué esperamos de ti, cómo funciona el cobro y qué pasa si algo sale mal."

- [ ] **Step 3: `Footer.tsx` — enlace en "Legal"**

En la `<nav aria-label="Legal">`, añadir como primer `<li>` (antes de Privacidad):
```tsx
<li>
  <Link to="/terminos" className="hover:text-vm-ink">
    Términos
  </Link>
</li>
```

- [ ] **Step 4: `PasoCuenta.tsx` — mención en el registro**

Cambiar el `<p className="text-xs …">` de "Al crear tu cuenta aceptas el Aviso de Privacidad" por:
```tsx
<p className="text-xs leading-relaxed text-vm-body">
  Al crear tu cuenta aceptas los{" "}
  <Link to="/terminos" className="text-vm-primary hover:underline">
    Términos y Condiciones
  </Link>{" "}
  y el{" "}
  <Link to="/privacidad" className="text-vm-primary hover:underline">
    Aviso de Privacidad
  </Link>{" "}
  de Vibemenu.
</p>
```

- [ ] **Step 5: `legal.ts` — `VIGENCIA_LEGAL`**

Cambiar `export const VIGENCIA_LEGAL = "20 de agosto de 2026";` a la fecha de hoy en el mismo formato ("3 de septiembre de 2026"). El comentario dice que es la misma para los 3 documentos — está bien, Privacidad y Cookies también la muestran actualizada.

- [ ] **Step 6: Verificar**

Run: `bunx tsc --noEmit && bunx eslint src/pages/Terminos.tsx src/routes/terminos.tsx src/components/layout/Footer.tsx src/components/registro/pasos/PasoCuenta.tsx src/lib/legal.ts && bun test && bun run build`
Expected: 0 / 0, verde, build OK. La ruta `/terminos` compila en el route tree.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Terminos.tsx src/routes/terminos.tsx src/components/layout/Footer.tsx src/components/registro/pasos/PasoCuenta.tsx src/lib/legal.ts
git commit -m "feat(legal): página de Términos y Condiciones + enlaces"
```

---

### Task 7: Guion de prueba de Stripe

**Files:**
- Create: `docs/pruebas-stripe-test.md`

**Interfaces:** ninguna — documento.

- [ ] **Step 1: Escribir `docs/pruebas-stripe-test.md`**

Documento en español con el contenido de la sección "D" del spec, redactado como guía paso a paso. Estructura:

- **Antes de empezar**: modo test en Stripe; confirmar que la Edge Function `stripe-webhook` tiene `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` **de test** (no live); un tenant de prueba con correo real tuyo; tarjetas de test de Stripe (lista: `4242 4242 4242 4242` éxito; `4000 0000 0000 0341` falla en cobro recurrente; `4000 0000 0000 9995` fondos insuficientes).
- **Cómo adelantar el tiempo**: usar "Test clock" de Stripe (Billing → Test clocks) para no esperar 30 días — crear el customer dentro de un test clock y avanzarlo.
- **7 pasos** (alta, upgrade/downgrade, fallo de pago, gracia vencida, recuperación, cancelación, revisión en /superadmin) — cada uno con sub-secciones **"Qué hacer"** y **"Qué revisar"** citando las columnas exactas (`tenants.estado`, `tenants.pago_fallido_desde`, `tenants.cancela_al_terminar`, `suscripciones.estado`, `suscripciones.motivo_cambio`, `suscripciones.fecha_fin`) y los correos esperados (bienvenida, aviso de pago fallido).
- **Checklist final** con casillas `- [ ]` de todo lo que debe quedar confirmado antes de abrir cobros reales.

Tomar los detalles de comportamiento del spec (sección D) y de `src/docs/` si hace falta precisar nombres (`vibemenu_stripe.md`).

- [ ] **Step 2: Commit**

```bash
git add docs/pruebas-stripe-test.md
git commit -m "docs: guion de prueba del ciclo de cobro de Stripe en modo test"
```

---

### Task 8: "Pedir por WhatsApp" también en Free — textos

**Files:**
- Modify: `src/docs/vibemenu_alcance.md`
- Modify: `src/lib/copy.ts` (`PLANES_COPY`)
- Modify: `src/lib/comparativa.test.ts`

**Contexto:** El controlador ya aplicó a prod `update planes set permite_pedidos_whatsapp = true where nombre = 'free'` (migración `free_permite_pedidos_whatsapp`, archivo `src/docs/vibemenu_migracion_free_whatsapp.sql` ya commiteado). `src/lib/comparativa.ts` **no cambia** — lee el valor vivo de `planes`, así que `/precios` ya muestra ✓ para Free en "Pedir por WhatsApp". Esta tarea solo alinea los textos hardcodeados.

**Interfaces:** ninguna.

- [ ] **Step 1: `vibemenu_alcance.md` — tabla "Funciones de conversión y fidelización por plan"**

Cambiar la fila (línea ~70):
```
| Pedir por WhatsApp | ❌ | ✅ | ✅ | ✅ | `permite_pedidos_whatsapp` |
```
por:
```
| Pedir por WhatsApp | ✅ | ✅ | ✅ | ✅ | `permite_pedidos_whatsapp` |
```

- [ ] **Step 2: `vibemenu_alcance.md` — tabla "Modelo de negocio — Planes", columna Extras**

- Fila **Free** (hoy `Marca de agua "Hecho con Vibemenu"`): → `Pedir por WhatsApp · Marca de agua "Hecho con Vibemenu"`
- Fila **Basic** (hoy `Sin marca de agua · Pedir por WhatsApp · Embudo a reseñas`): → `Todo lo de Free · Sin marca de agua · Embudo a reseñas` (WhatsApp ya no es su diferenciador; queda cubierto por "Todo lo de Free")

- [ ] **Step 3: `src/lib/copy.ts` — `PLANES_COPY`**

- `free.descripcion` (hoy `"Ideal para probar Vibemenu con tu menú real. Gratis para siempre, hasta 20 productos."`):
  → `"Ideal para probar Vibemenu con tu menú real. Hasta 20 productos, con pedidos por WhatsApp incluidos. Gratis para siempre."`
- `basic.descripcion` (hoy `"Productos ilimitados, sin marca de agua, con pedidos por WhatsApp y embudo a reseñas de Google."`):
  → `"Productos ilimitados, sin marca de agua y con embudo a reseñas de Google."`
- `pro` y `enterprise` no cambian.

- [ ] **Step 4: `src/lib/comparativa.test.ts` — reflejar que Free ya trae WhatsApp**

El test "Free: las booleanas son false salvo las fijas" usa un `FREE` hipotético totalmente restringido — **déjalo así** (es un invariante válido: "un plan sin nada muestra ✗ salvo filas fijas"). Añadir un test nuevo en el `describe("valores por plan")`:

```ts
test("Pedir por WhatsApp ahora es de todos los planes", () => {
  const fila = FILAS_COMPARATIVA.find((f) => f.etiqueta === "Pedir por WhatsApp")!;
  expect(fila.valor(plan({ permite_pedidos_whatsapp: true }))).toBe(true);
  expect(fila.valor(BASIC)).toBe(true);
  expect(fila.valor(ENTERPRISE)).toBe(true);
});
```

- [ ] **Step 5: Verificar**

Run: `bun test && bunx tsc --noEmit && bunx eslint src/lib/copy.ts src/lib/comparativa.test.ts`
Expected: verde (≥224), 0 / 0.

- [ ] **Step 6: Commit**

```bash
git add src/docs/vibemenu_alcance.md src/lib/copy.ts src/lib/comparativa.test.ts
git commit -m "feat(planes): 'pedir por WhatsApp' también en Free — alinea textos"
```

---

## Self-Review

- **Cobertura del spec:** A0→Task 1; A1→Task 3; A2/A3/A4→Task 4 (+ Task 2 los datos); B→Task 5; C→Task 6; D→Task 7. Task 8 = añadido del usuario mid-ejecución (Free + WhatsApp). Migraciones: ambas ya aplicadas por el controlador antes de la ejecución (`onboarding_respuestas_select_super_admin`, `free_permite_pedidos_whatsapp`).
- **Sin placeholders:** Task 1 trae el código completo; Tasks 2–6 traen los diffs concretos; Task 7 es un documento con estructura fija y fuente (spec §D).
- **Consistencia de tipos:** `SituacionComercial` / `SuscripcionMin` / `Senal` se definen en Task 1 y se consumen con la misma firma en Tasks 2–4. `TenantSuperAdmin.situacion` (Task 2) → usado en Task 3. `DetalleTenantSuperAdmin.onboarding` / `.salud` (Task 2) → usados en Task 4. `CONTACTO` (Task 5) reusado en Task… solo Task 5. `VIGENCIA_LEGAL` lo tocan Task 6.
- **Orden:** 1 (lib) → 2 (hooks) → 3, 4 (páginas, dependen de 2) → 5, 6, 7 (independientes). 5 y 6 tocan ambos `Footer.tsx` y `legal.ts` — secuenciales, nunca en paralelo; regiones distintas (5: nav Cuenta + `CONTACTO`; 6: nav Legal + `VIGENCIA_LEGAL`).
