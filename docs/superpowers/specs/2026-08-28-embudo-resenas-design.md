# Embudo a reseñas de Google — Diseño

**Fecha:** 2026-08-28
**Rama:** feat/embudo-resenas (parte de `main`)
**Origen:** Auditoría Vibemenu (artifact `8d645623`), sección 04 "Extras vendibles" (Embudo a reseñas) y sección 07 P1.
**Predecesor:** `docs/superpowers/specs/2026-08-28-contacto-resenas-sucursal-design.md` (sub-proyecto #1, mergeado). Este es el **sub-proyecto #2 de 3**. Independiente del #3 (carrito de WhatsApp).

## Problema

Tras un rato en el menú público, un aviso discreto pregunta "¿cómo te fue?". Si la respuesta es buena, lleva al comensal a dejar reseña en Google; si es mala o regular, la queja se queda dentro de Vibemenu (el dueño la ve en el panel) y no llega a Google. Cierra una fuga silenciosa: hoy el enlace de reseñas solo vive como un icono de estrella en la cabecera, sin nada que empuje al comensal contento a usarlo.

## Decisiones tomadas (con el usuario, 2026-08-28)

1. **Gating:** planes de pago (Basic/Pro/Enterprise). Free no lo tiene. Flag nuevo `planes.permite_embudo_resenas` (patrón de `marca_agua` / `permite_dominio_propio`), no un check por nombre de plan.
2. **Disparo:** a los ~20 s en el menú, una hoja discreta abajo. **Una vez por navegador y por tenant** (`localStorage`). Si ya respondió **o si cerró la hoja**, no reaparece.
3. **Sentimiento:** 3 opciones — bien / regular / mal. **Bien** → abre el enlace de reseñas de Google en pestaña nueva. **Regular / mal** → mini-formulario de comentario y se guarda en Vibemenu, no llega a Google.
4. **Feedback negativo:** **solo comentario anónimo opcional** + sentimiento + sucursal + fecha. Sin nombre, sin teléfono, sin ningún dato de contacto. El dueño ve la queja pero no puede responderle al comensal — es deliberado (baja fricción, y encaja con "se queda dentro").
5. **Vista en el panel:** pestaña nueva **"Opiniones"** en "Mi negocio" (junto a Perfil / Sucursales / Equipo / Suscripción), con acción de **marcar como resuelto** por opinión y filtro por sucursal.
6. **Enlace de reseñas:** se reusa `contactoSucursal(sucursal, tenant).googleReviewsUrl` del sub-proyecto #1 — sucursal → empresa. El embudo solo aparece si ese enlace resuelve a algo.

## Alcance

1. Migración: flag de plan + tabla `feedback_privado` + función `registrar_feedback` (SECURITY DEFINER, patrón `registrar_visita`).
2. Helper puro `src/lib/embudo.ts` (guard de "ya respondió" sobre un storage inyectable) + suite.
3. `EmbudoResenas.tsx` en el menú público, montado en `MenuPublico.tsx` (los 3 formatos de tarjeta; **no** TikTok, **no** `/demo`).
4. `useMenuPublico` expone `permiteEmbudoResenas`.
5. Ruta + página `/admin/opiniones`, pestaña nueva en `PESTANAS_NEGOCIO`, hooks `useOpiniones` + `useMarcarOpinionResuelta`.
6. Tipos (`src/types/database.ts`) y una línea en `/privacidad`.

## Fuera de alcance

- Responder al comensal / capturar su contacto (decisión 4).
- Notificar al dueño por correo/WhatsApp cuando entra una opinión negativa (posible fase posterior; hoy la ve al entrar al panel).
- El sentimiento **bien** NO se guarda en `feedback_privado` — solo abre el enlace. No hay métrica de "cuántos dijeron bien" en esta entrega.
- Analítica agregada del embudo (tasa de conversión a reseña). Fase posterior si se pide.
- Tocar TikTok o `/demo`.
- El carrito de WhatsApp (sub-proyecto #3).

## Lo que ya existe (contexto, no se reescribe)

- **`src/lib/contacto.ts`** — `contactoSucursal(sucursal, tenant): { telefono, whatsapp, googleReviewsUrl }`, fallback sucursal→empresa. Del sub-proyecto #1.
- **`registrar_visita(p_tenant_id uuid, p_sucursal_id uuid default null)`** — RPC `SECURITY DEFINER`, `grant execute ... to anon, authenticated`, valida que la sucursal sea del tenant, falla en silencio. Modelo exacto para `registrar_feedback`. (migración 007)
- **`visitas_menu`** — tabla con RLS, `select` para miembros vía `pertenece_a_tenant(tenant_id)`, `revoke all from anon, authenticated` + `grant select`. Modelo para `feedback_privado`.
- **`src/hooks/useVisitas.ts`** — `useVisitas` (query con `retry: false` "sin la migración la tabla no existe"), y `useRegistrarVisita` (efecto que llama la RPC desde el navegador con un guard `sessionStorage`, fire-and-forget). Modelo para los hooks nuevos.
- **`pertenece_a_tenant(check_tenant_id uuid)`** — `security definer`, filtra por `auth.uid()`. Se usa en las policies de lectura.
- **`src/components/layout/PillTabs.tsx`** — `PESTANAS_NEGOCIO: Pestana[]` (`{ a, etiqueta }`), 4 entradas hoy. `PillTabs` marca activa por `pathname === p.a`.
- **`src/routes/admin.equipo.tsx`** — patrón de ruta: `createFileRoute("/admin/equipo")({ component: Equipo })`. `routeTree.gen.ts` se autogenera (plugin de Vite) — **no se edita a mano**.
- **`src/pages/admin/Equipo.tsx`** — patrón de página: `export default function Equipo() { return <AdminLayout><Contenido/></AdminLayout> }`, con `<PillTabs pestanas={PESTANAS_NEGOCIO} />`, y muro con `Lock` + `<Link to="/admin/suscripcion">` + tabla de ejemplo difuminada cuando el plan no lo permite (`alcanzoLimite` / `ctx.plan`).
- **`src/hooks/useTenantActual.ts`** — `select("rol, tenant:tenants(*, plan:planes(*))")`; expone `ctx.tenant` y `ctx.plan` (fila completa de `planes`).
- **`src/hooks/useSucursales.ts`** — `useSucursales(tenantId)` → `Sucursal[]` (para resolver nombres de sucursal en la vista de Opiniones).
- **`src/hooks/useMenuPublico.ts`** — `select("*, plan:planes(marca_agua, menu_independiente_por_sucursal)")`; arma `MenuPublico` con `marcaAgua`, `menuIndependiente`, `sucursalActiva`. `armarMenuPublico` hace `plan?.marca_agua ?? true`.
- **`src/pages/MenuPublico.tsx`** — `const cuerpo = (<><HeaderMenu/>{…categorias…}<ContactoMenu/>{marcaAgua && <MarcaAgua/>}</>)`. La rama `data.formato === "tiktok"` NO usa `cuerpo`. `ContactoMenu` (sub-proyecto #1) ya se monta ahí — el embudo va al lado.
- **`src/components/menu/*`** — los componentes del menú usan variables CSS del tema (`--menu-primario`, `--menu-texto`, `--menu-texto-suave`, `--menu-fondo`) y nunca el azul de Vibemenu. `RedesSociales` / `ContactoMenu` son la referencia de estilo.
- **`src/pages/Privacidad.tsx`** — `SECCIONES: SeccionLegal[]`; la sección `datos-que-recabamos` dice hoy "Si escaneas un menú público: … Registramos únicamente un conteo agregado de visitas … nunca una fila por persona". Hay que matizarla.

## Arquitectura

### 1. Migración (`src/docs/vibemenu_migracion_embudo_resenas.sql`)

```sql
begin;

-- ── flag de plan ────────────────────────────────────────────────────────────
alter table planes
  add column permite_embudo_resenas boolean not null default false;

update planes set permite_embudo_resenas = true where nombre <> 'free';

-- ── tabla de opiniones privadas ─────────────────────────────────────────────
create table feedback_privado (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  -- on delete set null (no cascade): una queja no se pierde porque borren
  -- o renombren una sucursal. null = menú general, sin sucursal en la ruta.
  sucursal_id uuid references sucursales(id) on delete set null,
  sentimiento text not null check (sentimiento in ('regular','mal')),
  comentario  text check (comentario is null or length(comentario) <= 500),
  resuelto    boolean not null default false,
  creado_at   timestamptz not null default now()
);

create index idx_feedback_tenant on feedback_privado (tenant_id, creado_at desc);

alter table feedback_privado enable row level security;

-- Lectura: cualquier miembro del tenant.
create policy "feedback_select_miembros" on feedback_privado for select
  to authenticated using (pertenece_a_tenant(tenant_id));

-- Escritura desde el panel: solo marcar resuelto. La columna se restringe con
-- el grant de abajo; la policy cubre la fila.
create policy "feedback_update_miembros" on feedback_privado for update
  to authenticated using (pertenece_a_tenant(tenant_id))
  with check (pertenece_a_tenant(tenant_id));

revoke all on feedback_privado from anon, authenticated;
grant select on feedback_privado to authenticated;
grant update (resuelto) on feedback_privado to authenticated;

-- ── registrar_feedback: único camino de escritura del comensal ──────────────
-- El comensal no tiene sesión. Igual que registrar_visita: SECURITY DEFINER,
-- valida pertenencia, y NUNCA revienta — un menú público no se rompe por esto.
-- Orden de params: los que tienen default van al final (regla de Postgres).
-- El cliente llama con params nombrados, así que el orden no le afecta.
create or replace function registrar_feedback(
  p_tenant_id   uuid,
  p_sentimiento text,
  p_sucursal_id uuid default null,
  p_comentario  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comentario text := nullif(btrim(p_comentario), '');
begin
  if p_sentimiento not in ('regular','mal') then
    return;
  end if;

  if not exists (select 1 from tenants t where t.id = p_tenant_id) then
    return;
  end if;

  -- Sucursal de otro tenant (o inexistente) → se guarda como menú general.
  if p_sucursal_id is not null and not exists (
    select 1 from sucursales s where s.id = p_sucursal_id and s.tenant_id = p_tenant_id
  ) then
    p_sucursal_id := null;
  end if;

  -- Recorte defensivo: el check de columna es 500, pero no queremos que un
  -- payload gigante llegue siquiera a evaluarse.
  if v_comentario is not null then
    v_comentario := left(v_comentario, 500);
  end if;

  insert into feedback_privado (tenant_id, sucursal_id, sentimiento, comentario)
  values (p_tenant_id, p_sucursal_id, p_sentimiento, v_comentario);
end;
$$;

revoke execute on function registrar_feedback(uuid, text, uuid, text) from public;
grant  execute on function registrar_feedback(uuid, text, uuid, text) to anon, authenticated;

commit;

-- ── Verificar ──────────────────────────────────────────────────────────────
--   select nombre, permite_embudo_resenas from planes order by precio_usd;
--   -- free=false, resto=true
--
--   select registrar_feedback(t.id, null, 'mal', '  el café llegó frío  ')
--     from tenants t limit 1;
--   select tenant_id, sentimiento, comentario, resuelto from feedback_privado;
--   -- comentario trim-eado, resuelto=false
--
--   select registrar_feedback('00000000-0000-0000-0000-000000000000'::uuid, null, 'mal', 'x');
--   -- void, sin fila nueva
--
--   select registrar_feedback(t.id, null, 'bien', 'x') from tenants t limit 1;
--   -- void, sin fila nueva (bien no se guarda)
```

### 2. `src/lib/embudo.ts` (nuevo) + `src/lib/embudo.test.ts`

Guard de "una vez por navegador y por tenant", con el storage inyectable para poder probarlo (el patrón `yaContada` de `useVisitas` no es testeable porque usa `sessionStorage` global).

```ts
export type SentimientoEmbudo = "bien" | "regular" | "mal";

/** localStorage (persiste entre sesiones, a diferencia de las visitas). */
export const claveEmbudo = (tenantId: string): string => `vm:embudo:${tenantId}`;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/**
 * ¿Ya respondió (o cerró) el embudo en este navegador para este tenant?
 * Cualquier fallo de storage (modo privado, cuota) cuenta como "no respondió":
 * peor mostrarlo dos veces que tragarse una reseña.
 */
export function yaRespondioEmbudo(tenantId: string, storage: StorageLike | undefined): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(claveEmbudo(tenantId)) !== null;
  } catch {
    return false;
  }
}

export function marcarEmbudoRespondido(tenantId: string, storage: StorageLike | undefined): void {
  if (!storage) return;
  try {
    storage.setItem(claveEmbudo(tenantId), new Date().toISOString());
  } catch {
    /* modo privado: se aceptará mostrarlo otra vez */
  }
}
```

El componente llama `yaRespondioEmbudo(id, typeof window !== "undefined" ? window.localStorage : undefined)`.

Tests (`src/lib/embudo.test.ts`, `bun:test`):
- `claveEmbudo("abc")` → `"vm:embudo:abc"`.
- Con un `Map`-backed fake storage: `yaRespondioEmbudo` es `false` antes, `true` después de `marcarEmbudoRespondido`.
- `storage` `undefined` → `yaRespondioEmbudo` `false`, `marcarEmbudoRespondido` no lanza.
- Un `storage` cuyo `getItem`/`setItem` lanza → `yaRespondioEmbudo` `false`, `marcarEmbudoRespondido` no propaga.

### 3. `src/components/menu/EmbudoResenas.tsx` (nuevo)

```tsx
export default function EmbudoResenas({
  tenant,
  sucursal,
  habilitado,          // plan.permite_embudo_resenas
}: {
  tenant: Tenant;
  sucursal: Sucursal | null;
  habilitado: boolean;
}): ReactElement | null
```

- **Gate temprano (antes de cualquier hook de estado que importe, respetando reglas de hooks):**
  - `habilitado === true`
  - `resenasUrl = contactoSucursal(sucursal, tenant).googleReviewsUrl` no es `null`
  - `!yaRespondioEmbudo(tenant.id, window.localStorage)`
  Si algo falla → `return null` (después de declarar los hooks; ver nota de implementación).
- **Estado:** `fase: "oculto" | "pregunta" | "comentario" | "gracias"`, `comentario: string`, `sentimiento: "regular" | "mal" | null`.
- **Efecto:** `setTimeout(() => setFase("pregunta"), 20_000)` al montar; `clearTimeout` en cleanup. No arranca el timer si el gate ya falló.
- **Fase `pregunta`:** hoja fija abajo (`position: fixed; inset-inline: 0; bottom: 0`), `max-width` centrado, entra con translgüe/opacidad (framer-motion, como el resto del menú). Texto "¿Cómo estuvo tu visita?" + 3 botones con iconos lucide `Smile` / `Meh` / `Frown` y etiqueta. Botón X arriba a la derecha.
  - `Smile` (bien) → `window.open(resenasUrl, "_blank", "noopener,noreferrer")`, `marcarEmbudoRespondido`, `setFase("oculto")`.
  - `Meh` / `Frown` → `setSentimiento("regular" | "mal")`, `setFase("comentario")`.
  - X → `marcarEmbudoRespondido`, `setFase("oculto")`.
- **Fase `comentario`:** "¿Qué podríamos mejorar?" + `<textarea maxLength={500}>` opcional + botón "Enviar". Al enviar:
  - `void supabase.rpc("registrar_feedback", { p_tenant_id: tenant.id, p_sucursal_id: sucursal?.id ?? undefined, p_sentimiento: sentimiento, p_comentario: comentario.trim() || undefined })` — **fire-and-forget**, sin await, sin bloquear la UI (patrón `useRegistrarVisita`).
  - `marcarEmbudoRespondido`, `setFase("gracias")`.
  - También hay "Ahora no" que solo cierra (`marcarEmbudoRespondido`, `setFase("oculto")`).
- **Fase `gracias`:** "Gracias, lo tomamos en cuenta." — se cierra sola a los 3 s (`setTimeout`).
- **Estilo:** variables del tema (`--menu-primario`, `--menu-fondo`, `--menu-texto`, `--menu-texto-suave`), sombra suave, borde redondeado arriba. Nada de azul de Vibemenu. `z-index` por encima del contenido pero el resto de la página sigue scrolleable.
- **Accesibilidad:** `role="dialog"`, `aria-label`, foco al abrir, `Esc` cierra (= X).

**Nota de implementación (reglas de hooks):** los `useState`/`useEffect` se declaran siempre; el gate se evalúa dentro del efecto y del render (`if (!puedeMostrar || fase === "oculto") return null`). `puedeMostrar` se calcula con `useMemo` sobre `habilitado`, `resenasUrl`, y una lectura única de `yaRespondioEmbudo` (en `useState(() => …)` para que no se re-evalúe en cada render).

### 4. `MenuPublico.tsx` — montaje

`useMenuPublico` (`armarMenuPublico`):
```ts
.select("*, plan:planes(marca_agua, menu_independiente_por_sucursal, permite_embudo_resenas)")
```
`MenuPublico` type gana `permiteEmbudoResenas: boolean`; `armarMenuPublico` añade `permiteEmbudoResenas: plan?.permite_embudo_resenas ?? false`.

En `MenuPublico.tsx`, dentro de `cuerpo`, **después** de `<ContactoMenu … />` y **antes** de `{data.marcaAgua && <MarcaAgua />}` (o fuera de `cuerpo`, al mismo nivel — es `position: fixed`, la posición en el árbol solo importa para que NO esté en la rama TikTok):

```tsx
<EmbudoResenas
  tenant={data.tenant}
  sucursal={data.sucursalActiva}
  habilitado={data.permiteEmbudoResenas}
/>
```

La rama `data.formato === "tiktok"` no lo monta. `Demo.tsx` no lo monta.

### 5. Admin — `/admin/opiniones`

**Ruta** `src/routes/admin.opiniones.tsx`:
```tsx
import { createFileRoute } from "@tanstack/react-router";
import Opiniones from "@/pages/admin/Opiniones";
export const Route = createFileRoute("/admin/opiniones")({ component: Opiniones });
```
`routeTree.gen.ts` se regenera solo al correr `bun run dev` / `bun run build` (plugin TanStack Router). El plan debe correr uno de los dos y commitear el `routeTree.gen.ts` resultante.

**Pestaña** en `PillTabs.tsx`:
```ts
export const PESTANAS_NEGOCIO: Pestana[] = [
  { a: "/admin/empresa", etiqueta: "Perfil" },
  { a: "/admin/sucursales", etiqueta: "Sucursales" },
  { a: "/admin/equipo", etiqueta: "Equipo" },
  { a: "/admin/opiniones", etiqueta: "Opiniones" },
  { a: "/admin/suscripcion", etiqueta: "Suscripción" },
];
```

**Hooks** `src/hooks/useOpiniones.ts`:
```ts
export type Opinion = {
  id: number;
  sucursal_id: string | null;
  sentimiento: "regular" | "mal";
  comentario: string | null;
  resuelto: boolean;
  creado_at: string;
};

export function useOpiniones(tenantId: string | undefined) // useQuery, retry:false
//   .from("feedback_privado").select("id, sucursal_id, sentimiento, comentario, resuelto, creado_at")
//   .eq("tenant_id", tenantId).order("creado_at", { ascending:false })

export function useMarcarOpinionResuelta(tenantId: string | undefined) // useMutation
//   .from("feedback_privado").update({ resuelto:true }).eq("id", id)
//   onSuccess: invalida ["opiniones", tenantId]
```

**Página** `src/pages/admin/Opiniones.tsx`:
- `export default function Opiniones() { return <AdminLayout><Contenido/></AdminLayout> }`.
- `Contenido`: `useTenantActual()` → `ctx.plan.permite_embudo_resenas`, `ctx.tenant.id`.
  - **Sin permiso:** muro con `Lock` + copy ("Las opiniones de tus clientes son parte de los planes de pago.") + `<Link to="/admin/suscripcion">`, con una lista de ejemplo difuminada detrás (patrón `Equipo.tsx` `EJEMPLO`).
  - **Con permiso:** `useOpiniones(ctx.tenant.id)` + `useSucursales(ctx.tenant.id)` (para nombres). Estado local: `filtroSucursal: string | "todas"`, `verResueltas: boolean` (default `false`).
    - Chips de filtro: "Todas" + una por sucursal + (si hay filas con `sucursal_id === null`) "Menú general".
    - Toggle "Ver resueltas".
    - Lista filtrada, más reciente primero. Cada fila:
      - Icono `Meh` (regular) / `Frown` (mal), color `vm-warning` / `vm-danger`.
      - Comentario en `vm-ink`, o "Sin comentario" en `vm-body` itálica.
      - `nombre de sucursal · fecha relativa` (`Intl.RelativeTimeFormat` o el `FECHA` de `Equipo.tsx` para fecha absoluta — usar el mismo `new Intl.DateTimeFormat("es-MX", …)` que ya usa `Equipo.tsx`).
      - Si `!resuelto`: botón "Marcar resuelto" → `useMarcarOpinionResuelta`. Si `resuelto`: badge `Check` verde "Resuelto".
    - Empty state: "Todavía no hay opiniones" con un ícono.
- No hay paginación en esta entrega (volumen bajo; `order + limit 200` implícito de PostgREST está bien, pero fijar `.limit(200)` explícito).

### 6. Tipos y privacidad

**`src/types/database.ts`** — hand-add (o regenerar con el MCP si está autorizado):
- `planes`: `permite_embudo_resenas: boolean` en `Row`, `?: boolean` en `Insert`/`Update`.
- `feedback_privado`: tabla nueva. `Row` = `{ id: number; tenant_id: string; sucursal_id: string | null; sentimiento: string; comentario: string | null; resuelto: boolean; creado_at: string }`. `Insert` con `id?`, `resuelto?`, `creado_at?`, `comentario?`, `sucursal_id?`. `Update` todo opcional. `Relationships` a `tenants` y `sucursales` como en las tablas vecinas.
- Función `registrar_feedback` en el bloque `Functions` si está tipado (mirar cómo quedó `registrar_visita`).

**`src/pages/Privacidad.tsx`** — en la sección `datos-que-recabamos`, el párrafo "Si escaneas un menú público", añadir una frase:
> "Si dejas un comentario en el aviso de '¿cómo estuvo tu visita?', se guarda ese texto tal cual, sin ligarlo a tu identidad ni a tu dispositivo."

Y revisar si la tabla de proveedores necesita algo — no: no entra ningún proveedor nuevo.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/docs/vibemenu_migracion_embudo_resenas.sql` | nuevo |
| `src/lib/embudo.ts` + `.test.ts` | nuevo |
| `src/components/menu/EmbudoResenas.tsx` | nuevo |
| `src/hooks/useMenuPublico.ts` | select de plan + `permiteEmbudoResenas` en el tipo y en `armarMenuPublico` |
| `src/pages/MenuPublico.tsx` | monta `<EmbudoResenas/>` fuera de la rama TikTok |
| `src/routes/admin.opiniones.tsx` | nuevo |
| `src/routeTree.gen.ts` | regenerado (no a mano) |
| `src/components/layout/PillTabs.tsx` | entrada "Opiniones" en `PESTANAS_NEGOCIO` |
| `src/hooks/useOpiniones.ts` | nuevo |
| `src/pages/admin/Opiniones.tsx` | nuevo |
| `src/types/database.ts` | `feedback_privado`, `planes.permite_embudo_resenas`, `registrar_feedback` |
| `src/pages/Privacidad.tsx` | una frase en `datos-que-recabamos` |

## Secuencia

1. Migración (MCP `apply_migration` o SQL Editor). **Igual que en #1: si no se puede aplicar en la sesión, queda como paso manual antes del deploy.** A diferencia de #1, un fallo aquí degrada suave: `useOpiniones` tiene `retry:false` y el menú público hace `try/catch` implícito en el RPC — pero la pestaña Opiniones mostraría error hasta que la tabla exista.
2. Regenerar tipos.
3. Helper + tests.
4. `useMenuPublico` + `EmbudoResenas` + montaje.
5. Ruta + pestaña + hooks + página de admin. Correr `bun run dev` o `build` una vez para regenerar `routeTree.gen.ts`, commitearlo.
6. Privacidad.
7. `bun test src/lib && bun run typecheck && bun run lint && bun run build`.

## QA manual

- **Menú público, plan de pago, con enlace de reseñas configurado:** a los 20 s aparece la hoja. 🙂 abre Google Reviews en pestaña nueva y no vuelve a aparecer (recargar, sigue sin aparecer). 🙁 → comentario → Enviar → "gracias" → cierra. En Supabase, una fila en `feedback_privado` con el comentario trim-eado, `resuelto=false`, `sentimiento='mal'`.
- **Plan Free (o `permite_embudo_resenas=false`):** nunca aparece la hoja.
- **Sin enlace de reseñas (ni sucursal ni empresa):** nunca aparece.
- **Cerrar con la X sin responder:** no reaparece en ese navegador.
- **Formato TikTok:** no aparece. **`/demo`:** no aparece.
- **Sucursal de otro tenant en la URL (manipulada):** el RPC guarda la fila como "menú general", no revienta.
- **Panel → Opiniones (plan de pago):** la fila creada arriba aparece; filtro por sucursal funciona; "Marcar resuelto" la mueve a resueltas; "Ver resueltas" la muestra con badge.
- **Panel → Opiniones (Free):** muro con candado y CTA a Suscripción.
- **Comentario de 500+ caracteres** (vía devtools): la fila guarda 500, no revienta.
- Regenerar `src/types/database.ts` y comparar con el hand-add.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Migración no aplicada antes del deploy | A diferencia de #1, no rompe escrituras existentes. La pestaña Opiniones falla suave (`retry:false`) y el `rpc` del menú es fire-and-forget. Aun así, documentar como gate en el PR. |
| El embudo molesta y baja la percepción del menú | Una sola vez por navegador, 20 s de espera, hoja discreta y descartable. Gating a planes de pago limita el blast radius. |
| Spam de `registrar_feedback` (sin sesión, `grant to anon`) | Sin rate-limit en esta entrega. `left(…,500)` acota el payload; `feedback_privado` no tiene lectura pública; el volumen esperado es bajo. Si aparece abuso, un `rate limit` por IP en la Edge/DB es fase posterior — anotado. |
| `sentimiento='bien'` llega al RPC | El RPC lo ignora (`return` temprano) — el cliente tampoco lo manda, pero la función es defensiva. |
| Otra sesión toca `MenuPublico.tsx` / `PillTabs.tsx` | La implementación espera a que el árbol quede libre. |
| `routeTree.gen.ts` conflictúa en merge | Es autogenerado; ante conflicto, regenerar (`bun run build`) y recommitear en vez de resolver a mano. |
