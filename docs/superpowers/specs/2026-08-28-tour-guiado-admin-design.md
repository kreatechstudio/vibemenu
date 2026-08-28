# Tour guiado en el panel — Spec

> Retoma la dirección documentada (sin implementar) en
> `src/docs/vibemenu_registro_asistido.md` §6 — el bloqueo original ("cambios activos en
> Diseno.tsx") ya no aplica: ese archivo no se toca desde el 2026-08-20. Esta spec cambia el
> mecanismo de disparo respecto a lo que ese documento previó (ver §5, "Relación con §6").

**Aprobado:** mecanismo (coachmarks manuales, Siguiente/Atrás/Salir — no gateado por acción
real), alcance (Mi carta, Diseño, QR — no Resumen ni Mi negocio) y librería (`driver.js`)
confirmados por el dueño del producto.

---

## 1. Objetivo

Que cada uno de los 3 ítems "creables/personalizables" del modal de ayuda (`TutorialAyuda.tsx`,
ver feature anterior) abra, al hacer clic, un recorrido guiado tipo spotlight sobre la página
real — señalando los controles reales con los que se crea, edita o personaliza — en vez de
solo describir la sección en texto plano como hace hoy.

## 2. Alcance

**Dentro:**

- Tour para **Mi carta** (`/admin/menu`): crear categoría, crear producto, editar producto,
  activar/desactivar.
- Tour para **Diseño** (`/admin/diseno`): elegir formato, tipografía, colores, imagen de
  fondo, vista previa, guardar.
- Tour para **QR** (`/admin/qr`): vista previa, copiar link, descargar, personalización,
  sucursal (si aplica).

**Fuera (por decisión de producto, no técnica):**

- Tours para **Resumen** y **Mi negocio** — son de solo-lectura/datos, no de crear-editar-
  personalizar. Sus ítems en el modal de ayuda se quedan como filas informativas, sin la
  opción "Ver tour". Se agregan después si hace falta.
- Auto-disparo en la primera visita a una pestaña (lo que sí preveía §6 del doc de registro
  asistido). Este mecanismo es 100% manual: solo arranca si el usuario hace clic en "Ver
  tour" desde el modal de ayuda.
- Progreso persistido (qué tours ya vio el usuario) — no aplica, al ser manual y repetible.

## 3. Mecanismo

### 3.1 Disparo desde el modal de ayuda

En `TutorialAyuda.tsx`, los 3 ítems dentro de alcance (Mi carta, Diseño, QR) se vuelven
botones clicables con un afordance visual ("Ver tour" + chevron); Resumen y Mi negocio se
quedan como filas planas, sin ese estilo ni comportamiento — la diferencia debe ser visible,
no solo funcional (para no invitar un clic que no hace nada).

Al hacer clic en un ítem con tour:

1. Cierra el modal.
2. Navega a la ruta de esa sección con un query param: `?tour=1` (vía `navigate({ to, search
})` de TanStack Router).

### 3.2 Arranque en la página destino

Cada una de las 3 páginas lee su propio `Route.useSearch()` por `tour`. Si viene presente:

1. Espera a que el propio loading state de la página (el que ya existe — productos/categorías
   cargando en Menu.tsx, tema cargando en Diseno.tsx, etc.) esté en `false`, para garantizar
   que los elementos del DOM que el tour señala ya existen.
2. Arranca el tour (`driver().drive()`).
3. Limpia el query param inmediatamente (`navigate({ search: { tour: undefined }, replace:
true })`) — así un refresh o "atrás" del navegador no lo vuelve a disparar solo.

No hay mecanismo para "reabrir donde se quedó" — si el usuario sale a medias, puede volver a
abrirlo completo desde el modal de ayuda cuando quiera.

### 3.3 Librería: `driver.js`

Elegida sobre `react-joyride`/`shepherd.js` por: ~5KB gzip, sin dependencia de React (opera
sobre el DOM real vía querySelector, cero riesgo de incompatibilidad de versiones con React
18/19), licencia MIT, mantenimiento activo, y trae de fábrica spotlight + popover + navegación
Siguiente/Atrás/Cerrar — exactamente lo aprobado en §3.1 de la conversación de diseño (avance
manual, no gateado por acción real).

API relevante (v1.x, import con nombre, no default):

```ts
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const tour = driver({
  showProgress: true,
  nextBtnText: "Siguiente",
  prevBtnText: "Atrás",
  doneBtnText: "Listo",
  steps: [
    { popover: { title: "...", description: "..." } }, // sin `element`: paso centrado, sin spotlight
    { element: '[data-tour="carta-nueva-categoria"]', popover: { title: "...", description: "..." } },
    // ...
  ],
});
tour.drive();
```

## 4. Componentes / arquitectura

```
src/lib/tour.ts                 # wrapper: crearTour(pasos) -> instancia driver.js
                                 # ya con nextBtnText/prevBtnText/doneBtnText en español
src/styles.css                  # overrides de .driver-popover / .driver-popover-title /
                                 # .driver-popover-navigation-btns para que combine con los
                                 # tokens vm-* ya definidos (tipografía, radios, color de botón)
src/components/layout/TutorialAyuda.tsx   # 3 de los 5 ítems se vuelven botones "Ver tour"
src/pages/admin/Menu.tsx        # atributos data-tour + PASOS_TOUR_CARTA + arranque por ?tour=1
src/pages/admin/Diseno.tsx      # atributos data-tour + PASOS_TOUR_DISENO + arranque por ?tour=1
src/pages/admin/QR.tsx          # atributos data-tour + PASOS_TOUR_QR + arranque por ?tour=1
```

`crearTour(pasos)` en `src/lib/tour.ts` centraliza los textos de los botones y el theming —
cada página solo declara su propio array de pasos (`element` + `título` + `descripción`) y
llama `crearTour(misPasos).drive()`.

## 5. Contenido de cada tour

Verificado contra el código real (no genérico) — nombres de `data-tour` propuestos aquí; el
plan de implementación puede ajustar el nombre exacto siempre que quede consistente entre el
array de pasos y el atributo en el JSX.

### 5.1 Mi carta (`Menu.tsx`) — 6 pasos

| # | `data-tour` | Elemento real | Qué explica |
|---|---|---|---|
| 1 | — (sin `element`) | — | "Aquí armas tu menú: categorías a la izquierda, productos a la derecha." |
| 2 | `carta-nueva-categoria` | Botón "Nueva" (línea ~237) | "Empieza creando una categoría, como 'Bebidas' o 'Entradas'." |
| 3 | `carta-lista-categorias` | Lista de categorías (línea ~252) | "Elige una categoría para ver y agregar sus productos." |
| 4 | `carta-agregar-producto` | Botón "Agregar Producto" (línea ~201) | "Agrega tus platillos: nombre, precio, foto y descripción." |
| 5 | `carta-productos` | Grid de productos (línea ~312) | "Haz clic en cualquier producto para editarlo o agregarle modificadores (tamaños, extras)." |
| 6 | `carta-activo-borrador` | Toggle activo/borrador (línea ~358) | "Desactiva un producto sin borrarlo si se te acaba por un día." |

### 5.2 Diseño (`Diseno.tsx`) — 6 pasos

| # | `data-tour` | Elemento real | Qué explica |
|---|---|---|---|
| 1 | `diseno-formatos` | Tarjetas de formato (línea ~186) | "Elige cómo se ve tu menú: Clásico, Pinterest, Instagram o TikTok." |
| 2 | `diseno-tipografia` | Selector de fuente (línea ~257) | "Elige la tipografía que combine con tu marca." |
| 3 | `diseno-colores` | Los 4 color pickers (línea ~297) | "Personaliza los colores de acento, fondo, texto y modificadores." |
| 4 | `diseno-fondo` | Botón subir imagen (línea ~376) | "Sube una imagen de fondo para darle más personalidad." |
| 5 | `diseno-preview` | Sidebar de vista previa (línea ~153) | "Aquí ves los cambios en tiempo real antes de guardar." |
| 6 | `diseno-guardar` | Botón Guardar (línea ~475) | "No olvides guardar cuando termines." |

### 5.3 QR (`QR.tsx`) — 4 o 5 pasos (el 5º es condicional)

| # | `data-tour` | Elemento real | Qué explica |
|---|---|---|---|
| 1 | `qr-preview` | Tarjeta QR (línea ~225) | "Este es el código QR de tu menú, listo para compartir." |
| 2 | `qr-copiar` | Botón copiar link (línea ~229) | "Copia el link directo si prefieres compartirlo por WhatsApp o redes." |
| 3 | `qr-descargar` | Botones PNG/SVG (línea ~240) | "Descarga la tarjeta en PNG para imprimir, o el SVG si quieres editarlo con un diseñador." |
| 4 | `qr-personalizacion` | Checkboxes de personalización (línea ~285) | "Decide qué información se ve en la tarjeta: descripción, colores, tipografía, tu logo o tu imagen de fondo." |
| 5 | `qr-sucursal` | Selector de sucursal (línea ~186) | "Si tienes varias sucursales, cada una puede tener su propio QR." — **solo si `sucursales.length > 0`**, se arma el array de pasos condicionalmente. |

## 6. Testing

Mismo patrón que el resto de la UI del panel: sin tests automatizados de componentes en este
repo. Verificación:

- `bun run typecheck` — los `data-tour` son solo atributos JSX, no deberían romper nada.
- `bun run lint`.
- Prueba manual en `bun dev`: abrir el modal de ayuda, hacer clic en "Ver tour" de cada una de
  las 3 secciones, confirmar que navega, arranca el tour apuntando al elemento correcto, y que
  Siguiente/Atrás/Salir funcionan. Probar también QR con y sin sucursales (para el paso
  condicional).

## 7. Relación con §6 de `vibemenu_registro_asistido.md`

Ese documento preveía coachmarks que se disparan solos la primera vez que el usuario entra a
una pestaña, con progreso guardado por tenant. Esta spec construye el mecanismo base
(driver.js, pasos, theming) pero con disparo 100% manual desde el modal de ayuda — más simple,
sin tabla ni columna nueva. Si más adelante se quiere agregar el auto-disparo en primera
visita, el trabajo de esta spec (librería, wrapper, contenido de los pasos) se reutiliza tal
cual; solo hace falta agregar la lógica de "ya lo vio" y el disparo automático — no hay
retrabajo de lo construido aquí.
