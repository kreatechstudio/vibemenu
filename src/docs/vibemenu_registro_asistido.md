# Registro asistido — Spec

> Wizard que reemplaza el formulario de registro de una sola pantalla por un flujo guiado,
> paso a paso, con la misma calidez de marca del resto de VibeMenu. Mockup clicleable de
> referencia: ver enlace compartido en la conversación de diseño (Claude Design canvas).

**Aprobado:** dirección visual y estructura de pasos confirmadas por el dueño del producto.
Pendiente de detallar solo el pulido de estilo fino (se hace en otra pasada, no bloquea esta
implementación).

---

## 1. Objetivo

Sustituir el registro de una sola pantalla (`Registro.tsx`) y su formulario de respaldo para
usuarios de Google (`Onboarding.tsx`) por **un único componente de wizard** que:

1. Crea la cuenta (o continúa si ya existe sesión, caso OAuth).
2. Da de alta el negocio con la información esencial que hoy vive repartida entre el registro
   y "Mi negocio".
3. Recolecta 3 preguntas rápidas de producto (no bloquean el alta) para entender mejor a los
   negocios que se registran.
4. Cierra con una pantalla de felicidades y manda al usuario a `/admin`.

Fuera de este documento (explícitamente **no** se construye ahora):

- **Tour guiado dentro del panel** (crear producto, modificadores, Diseño, QR). Se documenta
  la dirección más abajo (§6) pero no se implementa: el área de Diseño sigue en cambios
  activos y construir el mecanismo ahora arriesga retrabajo.
- **Dominio personalizado.** No se pide en el wizard — deja de funcionar en cuanto vence la
  prueba si el tenant baja a Free, así que no tiene sentido pedirlo en el alta. Se sigue
  gestionando solo desde "Mi negocio", como hoy.
- **Redes sociales y descripción del negocio.** Hoy `tenants` tiene estas columnas pero la
  política RLS actual (`grant update` en `src/docs/vibemenu_base-datos.md:460-467`) no las
  incluye en la lista de columnas editables desde el cliente. Agregarlas requeriría una
  migración de RLS aparte — se deja fuera para no mezclarla con esta feature. Se siguen
  editando solo desde "Mi negocio".

---

## 2. Flujo de pasos

Un solo componente de wizard, sin rutas nuevas — estado interno + progreso persistido en
`localStorage` (extiende el patrón que ya existe en `src/lib/registro.ts` con
`guardarTenantPendiente`).

| # | Paso | Campos | Obligatorio |
|---|------|--------|--------------|
| 0 | Bienvenida | — (solo copy + CTA) | — |
| 1 | Cuenta | email, password, captcha | Sí (se omite si ya hay sesión — caso OAuth) |
| 2 | Tu negocio | nombre del negocio, giro¹, dirección del menú (slug) | Sí |
| 3 | Contacto | teléfono (con lada), WhatsApp (con lada) | Sí |
| 4 | Logo | imagen de logo | No — "Lo hago después" |
| 5 | Cuéntanos más | 3 preguntas de opción única | No — "Omitir" salta las 3 |
| 6 | Felicidades | resumen + CTA "Ir a mi panel" | — |

¹ `giro` es opcional dentro del paso — mismo comportamiento que tiene hoy `Registro.tsx`
(`src/pages/Registro.tsx:58`). "Sí/No" en la tabla indica si el PASO se puede saltar
completo, no si cada campo dentro de él es obligatorio.

**Momento de creación del tenant: justo al terminar el paso 2 (Tu negocio)** — igual que hoy.
Esto es clave para el paso de Logo: `subirImagen()` (`src/hooks/useCarta.ts:171`) exige que la
ruta de storage empiece con `{tenant_id}/`, así que el tenant tiene que existir antes de subir
el logo. Los pasos 3, 4 y 5 dejan de trabajar sobre un borrador en memoria y pasan a hacer
`UPDATE`/`INSERT` directos contra el tenant ya creado:

- Paso 3 (Contacto) → `useActualizarTenant` (el mismo hook que usa `Diseno.tsx` para guardar
  `tema`) actualiza `telefono` y `whatsapp`. Ambas columnas ya están en la lista RLS permitida.
- Paso 4 (Logo) → `subirImagen(tenant.id, archivo, "logos")` + `useActualizarTenant` para
  `logo_url`. Reutiliza el mismo flujo que ya usa `Diseno.tsx` para la imagen de fondo.
- Paso 5 (Métricas) → un solo `insert` en la tabla nueva `onboarding_respuestas` (§4) con lo
  que se haya contestado.

**Consecuencia aceptada:** si el usuario abandona después del paso 2, ya tiene un tenant
funcional y `AdminLayout` lo deja entrar directo a `/admin` en su próxima visita — no vuelve al
wizard. Es el mismo comportamiento de hoy (registro mínimo + completar después desde "Mi
negocio"), solo que ahora el wizard le ofrece completarlo en el momento en vez de mandarlo
directo al panel.

**Draft en localStorage:** solo cubre los pasos previos a la creación del tenant (0, 1, 2) —
mismo alcance que el `guardarTenantPendiente` actual, sin cambios de formato más allá de
agregar `giro` si no estuviera ya.

### 2.1 Paso 3 — Contacto: lada de país

Se agrega un selector de lada junto a cada campo (teléfono y WhatsApp). Lista curada (no las
~195 lada del mundo, solo los mercados relevantes de LatAm + España + Norteamérica), definida
en `src/lib/paises.ts`:

```
México +52 (default), Estados Unidos +1, Canadá +1, Guatemala +502, Belice +501,
El Salvador +503, Honduras +504, Nicaragua +505, Costa Rica +506, Panamá +507,
Colombia +57, Venezuela +58, Ecuador +593, Perú +51, Bolivia +591, Chile +56,
Argentina +54, Uruguay +598, Paraguay +595, República Dominicana +1, Puerto Rico +1,
España +34
```

**Sin cambio de esquema:** `tenants.telefono` y `tenants.whatsapp` siguen siendo `text` libre.
El wizard combina lada + número en un solo string al guardar (ej. `+52 55 1234 5678`) — mismo
campo que ya edita "Mi negocio" hoy, solo que el wizard ayuda a construirlo bien formado desde
el inicio. No se toca la tabla `tenants` para esto.

### 2.2 Paso 5 — Cuéntanos más: las 3 preguntas completas

Las 3 preguntas se muestran juntas en una sola pantalla (no una por pantalla — mantiene el
wizard corto). Cada una es de opción única (chips seleccionables, igual estilo que "Giro" en
el paso 2):

1. **¿Cómo manejas tu menú hoy?**
   Papel o impreso · PDF o Word · Redes sociales · Otra app de menú digital · Aún no tengo uno

2. **¿Cuál es tu mayor dolor de cabeza con tu menú actual?**
   Actualizar precios es lento · No se ve profesional · Batallo para tomar pedidos ·
   Los clientes no ven fotos u opciones claras · Otro *(al elegir "Otro" aparece un campo de
   texto libre corto)*

3. **¿Cómo nos conociste?**
   Redes sociales · Recomendación · Búsqueda en Google · Otro *(mismo campo de texto libre)*

"Omitir" salta las 3 sin guardar nada. Si contestó al menos una, se guarda solo lo contestado
(no se fuerza a completar las 3 para poder avanzar).

---

## 3. Componentes

Reemplaza los dos formularios actuales por un wizard compartido:

```
src/components/registro/
  RegistroAsistido.tsx      # contenedor: progreso, navegación entre pasos, persistencia
  pasos/
    PasoCuenta.tsx          # email, password, captcha (se omite si ya hay sesión)
    PasoNegocio.tsx         # nombre, giro, slug — crea el tenant al continuar
    PasoContacto.tsx        # teléfono + whatsapp con selector de lada
    PasoLogo.tsx            # subida de logo, opcional
    PasoMetricas.tsx        # 3 preguntas, opcional
    PasoFelicidades.tsx     # resumen + CTA a /admin
src/lib/paises.ts           # lista curada de lada de país (§2.1)
```

- `src/pages/Registro.tsx` (ruta `/registro`) → wrapper delgado: `<RegistroAsistido arrancaEnCuenta />`.
- `src/pages/Onboarding.tsx` (ruta `/onboarding`) → wrapper delgado: `<RegistroAsistido arrancaEnCuenta={false} />` (ya hay sesión, arranca en "Tu negocio").
- `src/lib/registro.ts`:
  - `crearTenant()` se mantiene igual (nombre, giro, slug) — el resto de campos se agregan
    después vía `UPDATE`, no en el insert inicial.
  - Nueva función `guardarRespuestasOnboarding(tenantId, respuestas)` — insert best-effort en
    `onboarding_respuestas`, igual patrón fire-and-forget que ya usa el envío de
    `enviar-bienvenida` (línea 50): si falla, no bloquea ni se le muestra error al usuario.

---

## 4. Datos: tabla nueva `onboarding_respuestas`

```sql
create table public.onboarding_respuestas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  respuestas jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.onboarding_respuestas enable row level security;

-- Insert-only: un miembro del tenant puede crear (una vez) la fila de su propio tenant.
-- Reusa el mismo patrón de pertenencia a tenant_usuarios que las demás tablas tenant-scoped.
-- Sin policy de select/update/delete para authenticated/anon — es dato de producto, no
-- operativo; se consulta desde el dashboard de Supabase o con service_role.
```

`respuestas` guarda solo lo que el usuario contestó, ej.:

```json
{
  "como_manejas_menu": "PDF o Word",
  "dolor_principal": "Otro",
  "dolor_principal_otro": "No tengo tiempo de actualizarlo",
  "como_nos_conociste": "Recomendación"
}
```

Jsonb en vez de columnas fijas: si se agregan/quitan preguntas más adelante no hace falta
migración — justo lo que pidió el dueño del producto ("que tú determines las preguntas... no
quiero que sean demasiadas").

Migración a crear como `src/docs/vibemenu_migracion_onboarding_respuestas.sql`, aplicada con
la tool `apply_migration` del MCP de Supabase — mismo patrón que
`vibemenu_migracion_dominio_estado.sql`.

---

## 5. Fuera de alcance (recordatorio)

- Dominio personalizado — no se pide en el wizard (ver §1).
- Redes sociales / descripción del negocio — quedan en "Mi negocio", requieren migración RLS
  aparte que no es parte de esta feature.
- Subida de logo con recorte/edición de imagen — se sube tal cual, igual que la imagen de
  fondo en Diseño hoy. Sin editor de imagen.
- Reenvío ni edición posterior de las respuestas de `onboarding_respuestas` desde la UI — es
  de una sola vez, en el registro.

---

## 6. Tour guiado en el panel (dirección, no implementación)

Documentado para no perder el hilo cuando se retome, **sin construir nada todavía**:

- Mecanismo: coachmarks/tooltips contextuales que aparecen la primera vez que el usuario entra
  a cada pestaña relevante (`Mi carta`, `Modificadores`, `Diseño`, `QR`), no un tour de un
  jalón. Esto además es la práctica recomendada (progressive disclosure / time-to-value
  rápido) según la investigación hecha durante el diseño de esta feature.
- Progreso: una fila nueva por tenant (o una columna jsonb en `tenants`, a decidir cuando se
  construya) que marca qué pestañas ya vio el usuario, para no repetir el coachmark.
- Bloqueado por: los cambios activos en `Diseno.tsx` — construir el mecanismo ahora arriesga
  reescribir los coachmarks cuando cambie el layout de esa pantalla.
- Se retoma en una sesión aparte, con su propio spec corto (es un cambio acotado sobre pantallas
  que ya existen, no necesita todo este proceso de nuevo).

---

## 7. Testing

- `src/lib/registro.ts`: tests existentes se mantienen; agregar cobertura para
  `guardarRespuestasOnboarding` (best-effort, no lanza si falla) y para el armado del string
  de teléfono con lada.
- `src/lib/paises.ts`: test de que la lista no tiene ladas vacías y que México es el default.
- Wizard: probar manualmente el flujo completo (ambos casos: email/password y OAuth) en
  `bun dev` antes de dar por cerrada la tarea — es un flujo de UI crítico (primer contacto de
  todo usuario nuevo).
