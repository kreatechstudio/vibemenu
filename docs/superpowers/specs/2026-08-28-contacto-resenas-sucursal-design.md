# Contacto y reseñas por sucursal — Diseño

**Fecha:** 2026-08-28
**Rama:** dev
**Origen:** Auditoría Vibemenu (artifact `8d645623`), sección 04 "Extras vendibles" (Pedir por WhatsApp, Embudo a reseñas) y sección 07 "Por dónde empezar" (P1).
**Alcance de este documento:** sub-proyecto **#1 de 3** — la capa de datos y de admin que habilita las otras dos features. No construye ni el carrito de WhatsApp ni el embudo de reseñas; deja el terreno listo para ambos.

## Contexto: qué pidió el usuario

Las dos features P1 del artifact necesitan, por sucursal:

- **Pedir por WhatsApp** — un número de WhatsApp con lada de país por sucursal, para armar un link `wa.me`.
- **Embudo a reseñas** — un enlace de reseñas de Google por sucursal (hoy solo existe a nivel empresa).

Y el usuario quiere que el menú público **muestre**, por sucursal: teléfono, WhatsApp, dirección en Maps y el enlace de reseñas.

Las redes sociales (Facebook/Instagram/TikTok) **siguen siendo de la empresa**, no de la sucursal — no se tocan.

## Decisiones tomadas (con el usuario, 2026-08-28)

1. **Lada de país:** el teléfono/WhatsApp **sigue siendo una sola columna de texto**. El `PhoneInput` que ya usan `Empresa.tsx` y `EditorSucursal.tsx` antepone la lada (`+52 …`) al valor guardado. No se agregan columnas de lada. Se añade un helper que normaliza ese texto a dígitos para `wa.me`, y el guardado garantiza que todo valor no vacío quede con prefijo `+NN`.
2. **Contacto de la empresa (`tenants.whatsapp` / `telefono`):** se queda **como fallback**. Un negocio recién registrado tiene 0 sucursales y el onboarding solo captura el contacto de la empresa; sin fallback, su menú y su botón de WhatsApp quedarían sin número. La sucursal siempre manda cuando tiene el dato.
3. **Enlace de reseñas:** columna nueva **`sucursales.google_reviews_url`**, con fallback a `tenants.google_reviews_url`. Cada local suele tener su propia ficha de Google; el de empresa cubre el caso de una sola sucursal o el que no lo llenó.
4. **Mapa a nivel empresa:** no aplica — ya es solo por sucursal (`sucursales.maps_url`). Nada que quitar.
5. **Bloque de contacto en el menú público:** visible en **todos los planes** (incluido Free). Es información del negocio, como el nombre o el horario — no una feature de upsell. El *gating* vive en las features que se apoyan encima (embudo → sub-proyecto #2, carrito → sub-proyecto #3).

## Alcance de este sub-proyecto

1. Migración: `sucursales.google_reviews_url`.
2. Helpers puros nuevos: `src/lib/whatsapp.ts` y `src/lib/contacto.ts` (con suites en CI).
3. `EditorSucursal.tsx`: campo "Reseñas en Google"; normalización de lada al guardar; microcopy en los campos de teléfono.
4. `Empresa.tsx`: ajuste de notas (contacto y reseñas de empresa = respaldo) + misma normalización de lada al guardar.
5. Menú público: componente `ContactoMenu.tsx` en el cuerpo del menú (todos los formatos salvo TikTok), y la estrella de reseñas de la cabecera respeta el fallback sucursal→empresa.
6. Tipos (`src/types/database.ts`) y datos de demo (`src/lib/demo.ts`).

## Fuera de alcance (van en sus propios specs)

- **Sub-proyecto #2 — Embudo a reseñas:** componente `EmbudoResenas.tsx` en el menú público, tabla `feedback_privado` + función `registrar_feedback`, flag `planes.permite_embudo_resenas`, pestaña "Opiniones" en el admin. Depende de #1.
- **Sub-proyecto #3 — Pedir por WhatsApp (carrito):** `useCarritoWhatsApp`, stepper por producto en los 4 formatos, barra flotante, hoja de resumen, constructor de mensaje de pedido, flag `planes.permite_pedidos_whatsapp`. Depende de #1. Independiente de #2.
- Columnas de lada separadas, formato E.164, migración de los valores de teléfono existentes.
- Selección de modificadores en cualquier flujo de WhatsApp (queda para una v2 de #3 si se valida demanda).

## Lo que ya existe (contexto, no se reescribe)

- **`sucursales`** — `direccion`, `telefono`, `whatsapp`, `maps_url` (migración 004), `timezone`. La policy `sucursales_write_miembros` cubre la tabla entera: una columna nueva **no** necesita `grant` extra a `authenticated` (a diferencia de `tenants`, donde el `update` está revocado columna por columna).
- **`tenants`** — `whatsapp`, `telefono`, `descripcion` (004), `facebook_url` / `instagram_url` / `tiktok_url` / `google_reviews_url` (007).
- **`src/lib/maps.ts`** — `enlaceMaps(sucursal, nombreNegocio)`: usa `maps_url` o arma una búsqueda de Google Maps con `direccion`. Devuelve `null` si no hay ninguno. Sin cambios.
- **`src/components/ui/phone-input.tsx`** — `PhoneInput` con selector de lada (`CODIGOS_PAIS`, 10 países). Guarda `"+52 55 1234 5678"` en una sola cadena; `partirNumero` la separa al abrir el editor y cae a `+52` si no reconoce prefijo. Sin cambios estructurales.
- **`src/lib/paises.ts`** — `PAISES_LADA`, `LADA_DEFAULT = "+52"`, `combinarTelefono(lada, numero)`. Lo usa el onboarding (`PasoContacto.tsx`).
- **`src/components/menu/HeaderMenu.tsx`** — cabecera común a los 4 formatos. Muestra el nombre de la sucursal como enlace a `enlaceMaps()` y `<RedesSociales tenant={...} />`. **No muestra teléfono ni WhatsApp hoy.** TikTok es fullscreen y no la usa.
- **`src/components/menu/RedesSociales.tsx`** — pinta hasta 4 iconos (`instagram_url`, `facebook_url`, `tiktok_url`, `google_reviews_url`) leyéndolos de `tenant[clave]`. La estrella = reseñas de Google.
- **`src/hooks/useMenuPublico.ts`** — `select("*")` sobre `tenants` y `sucursales`: las columnas nuevas llegan solas. El join de plan es `planes(marca_agua, menu_independiente_por_sucursal)`.
- **`src/hooks/useSucursales.ts`** — `BorradorSucursal`, `useGuardarSucursal` (upsert de sucursal + 7 horarios). `select("*")`.
- **`src/pages/MenuPublico.tsx`** — arma `cuerpo` = `<HeaderMenu/>` + formato + `<MarcaAgua/>`. El bloque de contacto entra aquí. TikTok tiene su propia rama sin `cuerpo`.
- **`src/lib/demo.ts`** — `TENANT_DEMO`, `SUCURSAL_DEMO` como objetos literales tipados: cualquier columna nueva hay que agregarla a mano o `tsc` truena.

## Arquitectura

### 1. Migración (`src/docs/vibemenu_migracion_contacto_sucursal.sql`)

```sql
begin;

alter table sucursales
  add column google_reviews_url text
    constraint sucursal_reviews_es_https
      check (google_reviews_url is null or google_reviews_url ~* '^https://');

commit;

-- Verificar:
--   select column_name from information_schema.columns
--     where table_name = 'sucursales' and column_name = 'google_reviews_url';
--   -- La policy sucursales_write_miembros ya cubre la escritura; sin grant extra.
```

Se aplica vía MCP `apply_migration` (cuando el servidor de Supabase esté autorizado en la sesión) o pegándola en el SQL Editor.

### 2. `src/lib/whatsapp.ts` (nuevo)

```ts
/**
 * Convierte un teléfono guardado ("+52 55 1234 5678") en los dígitos que
 * espera wa.me ("525512345678"). Devuelve null si tras limpiar quedan menos
 * de 8 dígitos: un valor así arma un link roto, mejor no mostrarlo.
 */
export function telefonoParaWaMe(valor: string | null | undefined): string | null;

/**
 * Link de WhatsApp. Sin `mensaje` es solo "abrir chat"; con `mensaje` lo
 * antepone URL-encoded. Devuelve null si el número no es utilizable.
 */
export function enlaceWhatsApp(valor: string | null | undefined, mensaje?: string): string | null;

/**
 * Garantiza que un teléfono no vacío empiece con lada (+NN). Si ya trae "+",
 * lo deja igual; si no, antepone LADA_DEFAULT. Se aplica al guardar, para que
 * telefonoParaWaMe siempre tenga con qué trabajar. "" y null pasan tal cual.
 */
export function asegurarLada(valor: string | null): string | null;
```

`asegurarLada` importa `LADA_DEFAULT` de `paises.ts`.

Suite `src/lib/whatsapp.test.ts`:
- `"+52 55 1234 5678"` → `"525512345678"`.
- `"55-1234-5678"` (sin lada, legado) → `"5512345678"` (10 dígitos ≥ 8, devuelve dígitos tal cual). `telefonoParaWaMe` **no adivina** lada — el guardado ya la garantiza vía `asegurarLada`. El test deja documentado que un valor legado sin renormalizar sale sin país (riesgo aceptado, ver Riesgos).
- `""` / `null` / `"   "` → `null`.
- `"+1 (555) 010"` → `"1555010"` → 7 dígitos < 8 → `null`.
- `enlaceWhatsApp("+52 55 1234 5678", "Hola")` → `"https://wa.me/525512345678?text=Hola"`.
- `enlaceWhatsApp(null)` → `null`.
- `asegurarLada("55 1234 5678")` → `"+52 55 1234 5678"`; `asegurarLada("+34 600 00 00 00")` → sin cambio; `asegurarLada("")` → `""`; `asegurarLada(null)` → `null`.

### 3. `src/lib/contacto.ts` (nuevo)

```ts
import type { Sucursal, Tenant } from "@/types/database";

export type ContactoResuelto = {
  telefono: string | null;       // sucursal → empresa
  whatsapp: string | null;       // sucursal → empresa
  googleReviewsUrl: string | null; // sucursal → empresa
};

/**
 * Resuelve la cadena de fallback de contacto para el menú público. La
 * sucursal manda; cada campo cae a `tenants` solo si viene vacío. Con
 * `sucursal` null (menú general, negocio sin sucursales) usa todo de `tenants`.
 */
export function contactoSucursal(
  sucursal: Pick<Sucursal, "telefono" | "whatsapp" | "google_reviews_url"> | null,
  tenant: Pick<Tenant, "telefono" | "whatsapp" | "google_reviews_url">,
): ContactoResuelto;
```

`google_reviews_url` en `tenant` puede llegar `undefined` (sin migración 007 en un entorno viejo): el helper trata `undefined` como `null`. Igual `sucursal.google_reviews_url` antes de la migración de este spec.

Suite `src/lib/contacto.test.ts`:
- Sucursal con los 3 campos → devuelve los de la sucursal.
- Sucursal con `whatsapp` null, empresa con `whatsapp` → devuelve el de empresa.
- `sucursal = null` → todo de empresa.
- Empresa con `google_reviews_url: undefined` y sucursal sin él → `googleReviewsUrl: null`.
- Cadena vacía `""` en la sucursal se trata como ausente (cae a empresa).

### 4. Admin — `EditorSucursal.tsx`

- **Campo nuevo "Reseñas en Google"** (URL, opcional), en la misma cuadrícula que "Enlace de Google Maps". Valida con `esUrlValida` (ya importado): si no empieza por `https://`, error `"El enlace de reseñas debe empezar por https://"`. Nota debajo: _"En tu ficha de Google entra a «Pedir reseñas» y copia el enlace corto."_ (mismo texto que `Empresa.tsx`).
- **Estado nuevo:** `const [reviewsUrl, setReviewsUrl] = useState(sucursal?.google_reviews_url ?? "")`.
- **Al guardar:** los campos de teléfono/WhatsApp pasan por `asegurarLada` antes de mandarse:
  ```ts
  telefono: asegurarLada(telefono.trim() || null),
  whatsapp: asegurarLada(whatsapp.trim() || null),
  google_reviews_url: reviewsUrl.trim() || null,
  ```
- **Microcopy** bajo el par teléfono/WhatsApp: _"Con lada de país — así el botón de «Pedir por WhatsApp» del menú funciona."_
- `useSucursales.ts`: `BorradorSucursal` gana `google_reviews_url: string | null`. `useGuardarSucursal` no cambia (hace `update(datos)` / `insert({...datos})` genéricos).

### 5. Admin — `Empresa.tsx`

Sin campos nuevos. Cambios:

- Nota del bloque **"Contacto"**: de _"Los de tu negocio. Cada sucursal puede tener los suyos, y esos mandan en su menú."_ a _"Se usan cuando una sucursal no tiene los suyos. Si defines contacto en la sucursal, ese manda en su menú."_
- Nota junto a **"Reseñas en Google"** (dentro del bloque Redes): añadir _"Cada sucursal puede tener su propio enlace de reseñas; este es el que se usa cuando no lo tiene."_
- **Al guardar:** `telefono` y `whatsapp` pasan por `asegurarLada` igual que en el editor de sucursal (consistencia: la empresa también alimenta el `wa.me` por fallback).

### 6. Menú público — `ContactoMenu.tsx` (nuevo)

`src/components/menu/ContactoMenu.tsx`. Fila de acciones al pie del menú, con el tema del tenant (mismo patrón visual que `RedesSociales`: `--menu-primario`, sin colores de marca externos).

```tsx
export default function ContactoMenu({
  tenant,
  sucursal,
}: {
  tenant: Tenant;
  sucursal: Sucursal | null;
}): ReactElement | null
```

- Resuelve `const c = contactoSucursal(sucursal, tenant)` y `const mapa = enlaceMaps({ direccion: sucursal?.direccion ?? null, maps_url: sucursal?.maps_url ?? null }, tenant.nombre_negocio)`.
- Pinta solo las filas con dato:
  | Dato | Enlace | Icono (lucide) |
  |---|---|---|
  | Teléfono | `tel:` + dígitos (`telefonoParaWaMe` sirve para limpiar; si `null`, usa el texto crudo en `tel:`) | `Phone` |
  | WhatsApp | `enlaceWhatsApp(c.whatsapp)` — chat simple, sin mensaje de pedido (eso es #3) | `MessageCircle` |
  | Cómo llegar | `mapa` | `MapPin` |
  | Reseñas | `c.googleReviewsUrl` | `Star` |
- Si no hay ninguna fila → `return null` (no reserva espacio).
- `target="_blank" rel="noreferrer noopener"` en los externos; `tel:` sin target.
- Se monta en `MenuPublico.tsx` dentro de `cuerpo`, después del formato y antes de `<MarcaAgua/>`:
  ```tsx
  <ContactoMenu tenant={data.tenant} sucursal={data.sucursalActiva} />
  ```
  **No** se monta en la rama TikTok (fullscreen, sin `cuerpo`) — igual que `HeaderMenu`.
- `/demo` (`Demo.tsx`): montarlo también, con `SUCURSAL_DEMO`.

**Nota de solapamiento:** la cabecera ya muestra "Cómo llegar" (el nombre de la sucursal enlaza al mapa). Repetirlo al pie es aceptable y consistente con tener todo el contacto en un solo lugar; no se quita de la cabecera.

### 7. Menú público — estrella de reseñas en la cabecera

Hoy `RedesSociales` lee `tenant.google_reviews_url` directo. Con reseñas por sucursal, cuando hay sucursal activa debe usarse el enlace resuelto.

- `RedesSociales` gana una prop opcional: `resenasUrlOverride?: string | null`. Si se pasa (incluido `null` explícito), reemplaza a `tenant.google_reviews_url` para decidir si se pinta la estrella y a dónde apunta. Si no se pasa (`undefined`), comportamiento actual.
- `tieneRedes(tenant)` gana un segundo parámetro opcional con el mismo override, para que la cabecera no reserve espacio si al final no hay ningún icono.
- `HeaderMenu` calcula `const resenas = contactoSucursal(sucursalActiva, tenant).googleReviewsUrl` y lo pasa como override a `RedesSociales` y a `tieneRedes`.

### 8. Tipos y demo

- **`src/types/database.ts`** — regenerar desde Supabase tras la migración (`generate_typescript_types` del MCP, o el script del repo). Hand-add si no se puede regenerar: `google_reviews_url: string | null` en `sucursales` `Row`, y `google_reviews_url?: string | null` en `Insert` y `Update`.
- **`src/lib/demo.ts`** — `SUCURSAL_DEMO` gana `google_reviews_url: null`. `TENANT_DEMO` ya tiene `google_reviews_url`.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/docs/vibemenu_migracion_contacto_sucursal.sql` | nuevo — 1 columna |
| `src/lib/whatsapp.ts` + `.test.ts` | nuevo |
| `src/lib/contacto.ts` + `.test.ts` | nuevo |
| `src/hooks/useSucursales.ts` | `BorradorSucursal` gana `google_reviews_url` |
| `src/components/admin/EditorSucursal.tsx` | campo reseñas + `asegurarLada` al guardar + microcopy |
| `src/pages/admin/Empresa.tsx` | notas + `asegurarLada` al guardar |
| `src/components/menu/ContactoMenu.tsx` | nuevo |
| `src/components/menu/RedesSociales.tsx` | prop `resenasUrlOverride` en el componente y en `tieneRedes` |
| `src/components/menu/HeaderMenu.tsx` | calcula y pasa el override de reseñas |
| `src/pages/MenuPublico.tsx` | monta `<ContactoMenu/>` en `cuerpo` |
| `src/pages/Demo.tsx` | monta `<ContactoMenu/>` |
| `src/types/database.ts` | `sucursales.google_reviews_url` |
| `src/lib/demo.ts` | `SUCURSAL_DEMO.google_reviews_url` |

## Secuencia

1. Migración (MCP `apply_migration` o SQL Editor).
2. Regenerar `src/types/database.ts`.
3. Helpers + tests (`bun test src/lib/whatsapp.test.ts src/lib/contacto.test.ts`).
4. Admin (editor de sucursal, Empresa).
5. Menú público (`ContactoMenu`, cabecera, demo).
6. `tsc` + `eslint` + suite completa. Vercel despliega en el push.

## QA manual

- **Editor de sucursal:** guardar una sucursal con teléfono sin tocar la lada → en la base queda `"+52 …"`. Guardar un enlace de reseñas que no empieza por `https://` → error inline, no guarda. Guardarlo bien → persiste.
- **Menú público, sucursal con todo:** el pie muestra las 4 filas; el enlace de WhatsApp abre un chat al número de la sucursal; "Reseñas" abre la ficha de la sucursal.
- **Menú público, sucursal con WhatsApp vacío pero empresa con WhatsApp:** el pie muestra WhatsApp con el número de la empresa.
- **Negocio sin sucursales (recién registrado):** el menú general muestra el contacto de la empresa; nada truena con `sucursal = null`.
- **Sucursal sin ningún contacto ni reseñas ni dirección y empresa igual:** `ContactoMenu` no aparece (no reserva espacio).
- **Cabecera:** con sucursal activa que tiene `google_reviews_url` propio distinto al de la empresa, la estrella de la cabecera apunta al de la sucursal.
- **Formato TikTok:** no aparece el bloque de contacto (esperado).
- **`/demo`:** el bloque aparece con los datos de demo.
- Regenerar tipos y confirmar que el hand-add (si se hizo) coincide.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Teléfonos ya guardados sin lada (`"5512345678"`) arman un `wa.me` con número corto/incorrecto | `asegurarLada` corre en cada guardado desde ahora; los valores viejos se corrigen la próxima vez que el dueño edita esa sucursal/empresa. Volumen actual: casi nulo (producto pre-lanzamiento). No se hace migración masiva de datos por eso. |
| `telefonoParaWaMe` produce un link a un número equivocado si el texto trae extensiones o notas ("55 1234 5678 ext 3") | El campo es `type="tel"` y el placeholder guía el formato; el guard de ≥ 8 dígitos evita los casos más rotos. Aceptado. |
| El bloque de contacto al pie duplica "Cómo llegar" de la cabecera | Decisión de diseño: tener todo el contacto agrupado vale la repetición. Sin cambio en la cabecera. |
| `RedesSociales` se usa en más de un sitio y la prop nueva rompe un call site | La prop es opcional con fallback al comportamiento actual; `grep` de `<RedesSociales` confirma los call sites antes de tocar. |
| Otra sesión toca los mismos archivos del menú público | La implementación espera a que el árbol quede libre. |
