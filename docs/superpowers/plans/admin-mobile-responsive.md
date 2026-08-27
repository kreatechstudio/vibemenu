# Plan: arreglar el desbordamiento horizontal en /admin/qr en móvil

## Contexto

El dueño del negocio reportó que partes del panel admin no se ven bien en
celular, señalando `/admin/qr` como ejemplo confirmado. Se pidió auditar
**todo** el panel admin (`src/pages/admin/*`, `src/components/admin/*`,
`src/components/layout/AdminLayout.tsx`) en un viewport móvil real (390px)
y arreglar cualquier problema de responsividad encontrado.

La auditoría ya se hizo — con sesión autenticada real, navegador headless a
390×844, y revisando `document.documentElement.scrollWidth` vs
`clientWidth` en cada página (cualquier diferencia es desbordamiento
horizontal real, no cosmético) — cubriendo las 9 rutas del panel (Resumen,
Mi carta, Modificadores, Diseño, QR, Sucursales, Mi negocio, Equipo,
Suscripción), el modal de "Añadir producto", el modal de "Editar sucursal"
y el drawer de navegación móvil.

**Resultado: un solo bug real, en `/admin/qr`.** Las otras 8 páginas y los
dos modales probados no tienen desbordamiento ni layout roto en 390px —
xa usan los patrones responsivos correctos (`sm:grid-cols-*`, tablas con
`overflow-x-auto` + `min-w-*`, tiras horizontales `tira-scroll`). Este plan
tiene una sola tarea: no hay que inventar trabajo en páginas que ya están
bien.

## El bug (diagnóstico confirmado, no una hipótesis)

`src/components/admin/TarjetaQR.tsx` dibuja la vista previa de la tarjeta
del QR a su tamaño real — `LIENZO = { ancho: 1000, alto: 1400 }` (ver
`src/lib/qr.ts:16`) — y la encoge visualmente con `transform: scale(escala)`,
donde `escala` se calcula con un `ResizeObserver` sobre el contenedor
(`escala = contentRect.width / LIENZO.ancho`).

El problema: `<div className="mt-8 grid gap-8 lg:grid-cols-[...]">` es un
CSS Grid contenedor. Su primer item (línea 220, un `<div>` sin clase) tiene
el default de Grid `min-width: auto`, que calcula el ancho mínimo del item
basándose en el `min-content` de su contenido — el `<div>` interior de
1000px sin escala de la tarjeta. Aunque `transform: scale()` es visual
(per CSS Overflow spec, las transforms se aplican DESPUÉS de calcular
overflow), el Grid sigue midiendo el contenido no escalado (1000px) como
el ancho mínimo del item, así que expande la columna y la página entera
para caber ese contenido de 1000px.

Nota: `transform: scale()` es visual y nunca causó desbordamiento a nivel
de página en sí — el Grid es el que estira la columna basándose en el
min-content medido del contenido. El `overflow: hidden` que _no_ tenía la
tarjeta es buena práctica (defensa en profundidad) pero no causa este bug.

Confirmado en vivo: en `/admin/qr` a 390px de viewport,
`document.documentElement.scrollWidth` = **1016px** contra un
`clientWidth` de 390px — 626px de desbordamiento horizontal real, en toda
la página (arrastra la barra lateral, el header, todo). Visualmente el QR
_se ve_ del tamaño correcto (porque el `scale()` sí funciona para el
pintado), pero la página entera se vuelve horizontalmente scrolleable en
cualquier pantalla angosta, lo cual es exactamente el tipo de bug que se
reportó.

## Global Constraints

- Stack: React + TypeScript + Tailwind CSS v4 (config en CSS, sin
  `tailwind.config.js`) + TanStack Router/Start (rutas en `src/routes/`,
  SSR).
- El fix debe ser mínimo y quirúrgico: un contenedor con una caja ya
  correctamente dimensionada (el `div` `caja` en `TarjetaQR.tsx`, que ya
  calcula su alto como `LIENZO.alto * escala` para encajar exactamente con
  el hijo escalado) solo necesita recortar el desbordamiento invisible de
  su hijo. **No** rediseñar el componente, no tocar la lógica de
  `ResizeObserver` ni el cálculo de `escala` — ambos ya son correctos.
- Verificación obligatoria después del fix (todas deben pasar):
  1. `npx tsc --noEmit -p .` sin errores.
  2. `npm run lint` sin errores nuevos (los warnings preexistentes de
     `react-refresh/only-export-components` en otros archivos no cuentan).
  3. Verificación visual real: levantar el dev server
     (`npm run dev -- --port <libre>`), entrar a `/admin/qr` con una
     sesión autenticada, viewport 390×844, y confirmar con
     `document.documentElement.scrollWidth === document.documentElement.clientWidth`
     (0px de desbordamiento) — con Playwright, mismo método que se usó
     para el diagnóstico. Adjuntar screenshot antes/después en el reporte.
  4. La vista previa debe verse **visualmente idéntica** a como se ve hoy
     (el fix solo recorta el desbordamiento invisible, no cambia nada
     visible) — confirmar con el screenshot que el QR, el título y el
     texto siguen en su lugar, sin recortarse.
- Autenticación para la verificación visual: hay una sesión guardada en
  `/private/tmp/claude-502/-Users-carloseugenio-Documents-vibemenu/50c5f567-fb26-4624-a2f7-a475a3198e66/scratchpad/auth.json`
  (Playwright `storageState`) — úsala directo en el `newContext`, no hace
  falta iniciar sesión de nuevo. El tenant de prueba es "Cafe Charly"
  (slug `cafe-charly`), con logo configurado — así que la ruta ejercita
  también la rama del componente con `opciones.logoUrl` presente.
- No toques ningún otro archivo fuera de `src/components/admin/TarjetaQR.tsx`
  a menos que la verificación visual revele que el fix ahí no basta.
- Repo tiene otras sesiones trabajando en paralelo sobre `dev`/`main` en el
  checkout principal — este trabajo vive enteramente en este worktree
  (`.worktrees/admin-responsive`, rama `fix/admin-responsive`), no toques
  el checkout principal.

## Task 1: Arreglar el desbordamiento horizontal de TarjetaQR.tsx

**Archivo:** `src/components/admin/TarjetaQR.tsx`

**Cambio:** en el `<div ref={caja} className="w-full" ...>` (línea 59),
agrega `overflow-hidden` a la className. Esa caja ya tiene el ancho
correcto (100% de su padre) y el alto correcto (`LIENZO.alto * escala`,
ya coincide exactamente con el tamaño visual del hijo escalado) — solo le
falta recortar la caja de layout sin escalar de su hijo, que se sale por
fuera de esos límites aunque visualmente no se note.

```tsx
// antes
<div ref={caja} className="w-full" style={{ height: LIENZO.alto * escala }}>

// después
<div ref={caja} className="w-full overflow-hidden" style={{ height: LIENZO.alto * escala }}>
```

**Por qué este es el fix correcto y no un parche:** la caja `caja` ya está
dimensionada exactamente para coincidir con el contenido escalado (por
diseño: `escala` se deriva del ancho real de `caja` vía `ResizeObserver`,
y su alto se fija a `LIENZO.alto * escala`). El único problema es que un
hijo con `transform: scale()` conserva su caja de layout sin escalar
para efectos de desbordamiento — así que recortar en el padre, que ya
tiene las dimensiones correctas, es exactamente lo que corresponde. No
cambia nada visible: todo lo que se pinta hoy sigue pintándose igual,
porque ya cabía dentro de esos límites; solo desaparece el desbordamiento
invisible que se salía de la página.

**Verificación de este task (además de las Global Constraints):**

- Antes y después del fix, en `/admin/qr` a 390×844, captura:
  1. `document.documentElement.scrollWidth` / `clientWidth` (debe pasar de
     `1016 / 390` a `390 / 390`).
  2. Un screenshot de la página completa (`fullPage: true`) — compara que
     el título, el código QR, el texto "Escanea para ver la carta", el
     link, los botones de descarga y las opciones de personalizar abajo
     seers visualmente igual antes y después (nada debe recortarse ni
     moverse).
  3. Repite la misma prueba en un viewport de escritorio (1280×900) para
     confirmar que el fix no afecta la vista de escritorio — ahí también
     debe seguir viéndose igual que antes.
- Reporta los cuatro números (scrollWidth/clientWidth mobile antes/después)
  y las rutas de los screenshots en el reporte de la tarea.

**Reporte:** cuando termines, escribe el reporte completo en el archivo
que te indique el dispatch (junto al brief), y regresa solo el status
(DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED), los commits, un resumen
de una línea de las pruebas, y cualquier duda.
