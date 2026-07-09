# Vibemenu — Prompt para Stitch

> Pegar el bloque completo de abajo en Stitch, en un proyecto nuevo.
> Stitch se detiene al final de cada fase y espera que escribas `CONTINUAR FASE N`.
> El resultado de la Fase 0 es lo que después se exporta a `/docs/DESIGN.md`.

---

## Prompt (copiar desde aquí)

Eres el diseñador de producto de **Vibemenu**, un SaaS multi-tenant de menú digital.

Vas a diseñar **28 pantallas repartidas en 8 fases**. Léelo todo antes de empezar.

---

### PROTOCOLO DE FASES — OBLIGATORIO

1. Trabaja **una fase a la vez**, en orden, empezando por la Fase 0.
2. Al terminar una fase, genera **solo** las pantallas de esa fase.
3. Después, escribe un resumen de una línea por pantalla y termina **exactamente** con:
   `FASE N COMPLETADA. Escribe CONTINUAR FASE N+1 para seguir.`
4. **No empieces la siguiente fase** hasta que yo escriba literalmente `CONTINUAR FASE N+1`.
5. Si te falta información para una pantalla, **pregunta antes de inventar**. No rellenes con supuestos.
6. Nunca uses Lorem Ipsum ni texto placeholder. Todo el copy real está en este prompt.

---

### IDENTIDAD VISUAL (aplica a TODAS las fases)

Idioma de toda la interfaz: **español de México**.

**Colores** (usa estos hex exactos, nunca colores por defecto de una librería):

| Token | Hex | Uso |
|---|---|---|
| Primario | `#2B4EFF` | Azul eléctrico. CTAs primarios, links activos, acentos de marca |
| Primario hover | `#1E3AE0` | Hover de botones primarios |
| Tinta | `#0B0B0F` | Negro casi puro. Headlines, texto principal |
| Cuerpo | `#4B4E5A` | Gris. Texto secundario, párrafos |
| Fondo | `#FFFFFF` | Fondo principal |
| Fondo suave | `#F5F6F9` | Secciones alternas, cards del dashboard |
| Borde | `#E4E6ED` | Bordes de cards e inputs |
| Éxito | `#16A34A` | Estados "activo", "abierto" |
| Advertencia | `#D97706` | Estados "trial", límite por alcanzarse |
| Peligro | `#DC2626` | Estados "cerrado", "suspendido", errores |

**Tipografía:**
- Headlines y hero: **Space Grotesk**, bold 700–800, tracking ajustado (negativo).
- Cuerpo y UI: **Inter**, regular 400, medium 500 para labels.
- Datos numéricos (precios, métricas del dashboard): **JetBrains Mono**.
- Nunca uses Inter para headlines.

**Estilo:**
- Esquinas redondeadas moderadas (12–16 px). **Nunca botones tipo píldora.**
- Sombras muy sutiles, casi planas. Nada de glassmorphism ni sombras dramáticas.
- Mucho aire entre secciones: padding vertical generoso.
- Badges tipo píldora gris claro para metadata y estados.
- **Calibración de temperatura:** el sistema es un SaaS limpio de fondo blanco y azul eléctrico,
  pero la sensación general debe acercarse a **Airbnb o Resy**, no a un dashboard frío:
  la fotografía de comida es protagonista y ocupa mucho espacio, las tarjetas son grandes y
  respiran, y el lenguaje es cercano. El azul es el acento, no el protagonista.

**Reglas anti-genérico (no negociables):**
- El hero de la landing muestra **un preview real del panel admin funcionando**, con datos de un
  negocio ficticio realista: **"Café Aurora"**. Nunca una ilustración ni un mockup abstracto.
- Los 4 formatos de menú público **no comparten layout**. No son la misma tarjeta con distinto grid:
  son experiencias de navegación distintas.
- Nada de íconos de stock sin contexto. La sección de formatos usa **mockups reales de cada formato**,
  no íconos genéricos de "grid" o "lista".
- El azul `#2B4EFF` es exclusivo de la marca Vibemenu (landing y admin). **Jamás** aparece como color
  por defecto de un menú público de tenant: cada negocio tiene su propio tema.
- Datos de negocios ficticios permitidos: **"Café Aurora"**, **"Tacos El Primo"**. Nada de "Restaurante 1".

---

## FASE 0 — Sistema de diseño (0 pantallas)

No diseñes ninguna pantalla todavía. Produce una **guía de estilo** con:

- Los 10 colores de arriba, con su nombre de token y su uso.
- Escala tipográfica completa: display, h1, h2, h3, body large, body, small, caption.
  Indica familia, peso, tamaño, line-height y tracking de cada nivel.
- Escala de espaciado y radios de borde.
- Los tres niveles de sombra.
- Componentes base, en sus estados normal / hover / focus / disabled:
  botón primario, botón secundario, input de texto, select, toggle, card, badge de estado,
  tab, tooltip, modal, toast.
- Un badge de estado en sus cuatro variantes: activo (verde), trial (ámbar), suspendido (rojo), cerrado (rojo).

Al terminar: `FASE 0 COMPLETADA. Escribe CONTINUAR FASE 1 para seguir.`

---

## FASE 1 — Landing pública (3 pantallas · web)

**1.1 — Landing `/` (desktop)**

Secciones en orden:

- **Navbar:** logo Vibemenu a la izquierda. Links: `Producto · Formatos · Precios · Demo`.
  CTA a la derecha: `Empezar gratis`.
- **Hero centrado**, con badge pequeño arriba del headline.
  - Headline: **Tu menú, como tú lo imaginas.**
  - Subheadline: *Vibemenu convierte tu carta en una experiencia visual moderna — elige entre 4 formatos, personalízalo en minutos y compártelo con un QR. Sin apps, sin complicaciones.*
  - CTA primario (azul sólido): `Prueba gratis, sin tarjeta`
  - CTA secundario (gris, sin borde): `Ver demo en vivo`
- **Preview del panel admin**, inmediatamente debajo del hero, ligeramente recortado por abajo.
  Muestra el dashboard real de "Café Aurora" con tarjetas de métricas: **Total productos: 34**,
  **Sucursales: 2**, **Plan: Pro**, **Formato activo: Pinterest**. Números en JetBrains Mono,
  labels en gris, mayúsculas, pequeñas.
- **Sección Formatos.** Cuatro bloques, cada uno con un mockup real del formato (no un ícono):
  | Formato | Título | Descripción |
  |---|---|---|
  | Clásico | La carta de siempre, mejor | Texto claro, categorías, precios y modificadores — ideal si quieres simplicidad con estilo. Personalizable en tipografía, color y fondo. |
  | Pinterest | Que se vea antes de que se pida | Un mosaico de fotos que invita a explorar tu menú como una galería. Perfecto para negocios donde la presentación vende. |
  | Instagram | Tu menú, como tu feed | Cuadrícula tipo publicación — tus clientes navegan tu carta igual que navegan Instagram. Familiar desde el primer scroll. |
  | TikTok | Deja que tu comida hable | Video vertical de tus platillos en pantalla completa. Sube tu reel o video de YouTube y conviértelo en tu vitrina. |
- **Sección "Cómo funciona".**
  - Título: **De tu carta a tu QR, en tres pasos**
  - Párrafo: *Configura tu menú, elige tu formato favorito y descarga tu código QR para imprimir. Así de simple. Sin depender de nadie para actualizar un precio o agregar un platillo nuevo.*
  - Dos estadísticas grandes: **4 formatos visuales incluidos** · **Menú siempre actualizado, sin reimprimir**
- **Testimonios.** Dos tarjetas:
  - *"Cambié mi menú impreso por Vibemenu y mis clientes empezaron a pedir cosas que ni sabían que teníamos — el formato Pinterest les encantó."*
  - *"Actualizo precios desde mi celular en el momento. Ya no gasto en reimprimir cada vez que cambia algo."*
- **CTA final.**
  - Headline: **Tu menú merece verse tan bien como sabe tu comida.**
  - Subheadline: *Empieza gratis hoy — sin tarjeta de crédito, sin compromiso.*
  - Botón: `Crear mi menú gratis`
- **Footer.** Tagline: *Tu menú, tu formato.*
  Descripción: *Vibemenu es la plataforma de menú digital que se adapta a cómo tu negocio quiere mostrarse — no al revés.*

**1.2 — Landing `/` (mobile).** Misma estructura, navbar colapsada en menú hamburguesa,
formatos en carrusel horizontal en vez de cuatro columnas.

**1.3 — Precios `/precios` (desktop + mobile).**
- Toggle de moneda: `USD / MXN`. Toggle de periodo: `Mensual` (anual deshabilitado, con tooltip "Próximamente").
- Cuatro tarjetas de plan. **Pro es la recomendada**: borde azul de 2 px y badge `Más popular`.

  | Plan | Precio | Headline | Descripción |
  |---|---|---|---|
  | Free perpetuo | $0 | Empieza sin arriesgar nada | Ideal para probar Vibemenu con tu menú real. Gratis para siempre, hasta 20 productos. |
  | Basic | $9 / $169 MXN | Para un solo local, sin límites de menú | Productos ilimitados, sin marca de agua, con el formato Clásico y uno más a tu elección. |
  | Pro | $19 / $349 MXN | Para negocios que quieren destacar | Los 4 formatos, hasta 3 sucursales con menús independientes, tu propio dominio. |
  | Enterprise | $39 / $699 MXN | Para cadenas y grupos restauranteros | Sucursales ilimitadas, equipo completo con múltiples usuarios, soporte prioritario. |

- CTA de Free: `Empezar gratis`. CTA de Basic y Pro: `Elegir plan`. CTA de Enterprise: `Contactar ventas`.
- Debajo de las tarjetas, en gris pequeño:
  *Tu precio no sube mientras sigas activo, aunque lancemos nuevos precios más adelante.*
- Tabla comparativa de características debajo: sucursales, productos, usuarios, grupos de
  modificadores, formatos, menú independiente por sucursal, marca de agua, dominio propio.

Al terminar: `FASE 1 COMPLETADA. Escribe CONTINUAR FASE 2 para seguir.`

---

## FASE 2 — Registro y acceso (2 pantallas · web)

**2.1 — `/registro`.** Formulario de una sola columna, centrado, con el preview del menú a la derecha
en desktop. Campos: nombre del negocio, giro, email, contraseña, y **slug**.

El campo de slug es el protagonista. Se muestra como `vibemenu.com/` + input. Valida en vivo y tiene
tres estados visibles, diseña los tres:
- Disponible: check verde.
- Ocupado: borde rojo + *Ese nombre ya está en uso — prueba con otra variante.*
- Reservado (palabras como `admin`, `api`, `login`): mismo tratamiento que ocupado.

Botón: `Prueba gratis, sin tarjeta`. Debajo: *Sin tarjeta de crédito. Gratis para siempre.*

**2.2 — `/login`.** Email, contraseña, "¿Olvidaste tu contraseña?", botón `Entrar`.
Link a registro: *¿Aún no tienes menú? Crea el tuyo gratis.*

Al terminar: `FASE 2 COMPLETADA. Escribe CONTINUAR FASE 3 para seguir.`

---

## FASE 3 — Menú público, los 4 formatos (6 pantallas · mobile primero)

Estas pantallas las ve un comensal que acaba de escanear un QR en la mesa. **Diseña mobile primero.**
Ninguna usa el azul de Vibemenu: cada tenant tiene su propio tema. Usa el tema de **"Café Aurora"**
(terracota cálido sobre crema) para todas.

Todas llevan un header compacto: logo del negocio, nombre, y un **badge de estado**:
`Abierto` en verde, o `Cerrado ahora — vuelve a visitarnos en nuestro próximo horario.` en rojo.

**3.1 — Formato Clásico.**
Nombres de producto en serif elegante (Fraunces o Playfair Display), descripciones en sans.
Fondo de color sólido o imagen tenue con overlay oscuro, texto crema.
Lista vertical por categoría. Precio alineado a la derecha, unido al nombre por la **línea punteada
clásica de menú de restaurante**.

**3.2 — Formato Pinterest.**
Grid masonry de columnas con alturas variables según la proporción de cada foto.
Fondo blanco o gris muy claro. Las fotos mandan. Sin bordes visibles entre tarjetas.
Incluye el estado expandido: al tocar una foto crece a detalle de producto.

**3.3 — Formato Instagram.**
Header de perfil simulado arriba: logo del tenant, nombre, bio corta con dirección y horario.
Debajo, grid perfecto de 3 columnas con fotos cuadradas.
Incluye la vista de producto abierto tipo "post": foto grande arriba; nombre, precio y descripción
abajo; los modificadores presentados como si fueran detalles del post.

**3.4 — Formato TikTok.**
Fullscreen vertical, un producto a la vez. Overlay de texto en la parte inferior sobre un degradado
oscuro para legibilidad: nombre, precio, descripción corta.
Diseña dos variantes: **con video** (controles mínimos) y **sin video** (foto con zoom lento).
Los modificadores suben desde abajo como un sheet, igual que un CTA de TikTok Shop.

**3.5 — Vista por sucursal `/:slug/sucursal/:sucursal_slug`.**
Selector de sucursal en el header (Café Aurora tiene "Centro" y "Roma Norte"), con la dirección y el
badge de abierto/cerrado de esa sucursal específica. El resto es el formato activo del tenant.

**3.6 — `/demo`.**
Los 4 formatos navegables con un switcher persistente arriba. Datos de "Tacos El Primo".
Sin ningún control de edición visible.

**Extras de esta fase, diséñalos como estados dentro de las pantallas anteriores:**
- Marca de agua **"Hecho con Vibemenu"** discreta al pie, solo para plan Free.
- Estado de menú inexistente: *Este menú no existe o ya no está disponible.*

Al terminar: `FASE 3 COMPLETADA. Escribe CONTINUAR FASE 4 para seguir.`

---

## FASE 4 — Panel admin: núcleo (5 pantallas · web)

**4.1 — Shell del panel.**
Sidebar izquierda fija con: Dashboard, Menú, Modificadores, Sucursales, Diseño, QR, Equipo, Suscripción.
Los ítems bloqueados por plan (Equipo en Free y Basic) llevan **candado** y tooltip.
Abajo de la sidebar: nombre del negocio, badge de plan (`Free` ámbar, `Pro` azul) y avatar.
Topbar: breadcrumb, botón `Copiar enlace` y botón `Ver mi menú`.

**4.2 — `/admin` Dashboard.**
Cuatro tarjetas de métrica, número grande en JetBrains Mono y label gris en mayúsculas pequeñas:
**Total productos** (34) · **Sucursales** (2 de 3) · **Plan actual** (Pro) · **Formato activo** (Pinterest).
Debajo: una barra de progreso de uso del plan (productos usados sobre el límite) y accesos rápidos
a "Añadir producto" y "Descargar mi QR".

> No incluyas ninguna métrica de escaneos, vistas ni analytics. No existen en esta versión.

**4.3 — `/admin/menu`.**
Columna izquierda: lista de categorías reordenables por arrastre, con contador de productos.
Columna derecha: productos de la categoría seleccionada, en tarjetas con foto, nombre, precio y
un toggle de activo/inactivo. Botón `Añadir producto`.
Si el plan permite menú independiente por sucursal, cada categoría y cada producto muestra un
selector de sucursal con la opción **"Todas las sucursales"** como valor por defecto.

**4.4 — Editor de producto** (panel lateral que se desliza, no modal centrado).
Campos: nombre, descripción, precio, **una sola foto** (con zona de arrastre), URL de video opcional
(YouTube o Reel, con nota "se usa en el formato TikTok"), sucursal, y asignación de grupos de
modificadores mediante chips seleccionables.
Botón: `Guardar cambios`.

**4.5 — `/admin/modificadores`.**
Catálogo de grupos reutilizables. Cada grupo es una tarjeta expandible: nombre ("Tamaño de café",
"Tipo de leche", "Extras"), tipo de selección (única o múltiple), obligatorio sí/no, mínimo y máximo
de selecciones, y sus opciones con precio extra.
Botón: `Añadir modificador`.

Al terminar: `FASE 4 COMPLETADA. Escribe CONTINUAR FASE 5 para seguir.`

---

## FASE 5 — Panel admin: sucursales, diseño y QR (4 pantallas · web)

**5.1 — `/admin/sucursales`.**
Lista de sucursales con nombre, dirección, badge de abierto/cerrado y un contador de límite de plan
arriba a la derecha: `2 de 3 sucursales`. Cuando se alcanza el límite, el botón `Añadir sucursal`
se deshabilita y aparece: *Tu plan actual permite hasta 3 sucursales. Actualiza tu plan para agregar más.*

**5.2 — Editor de sucursal.**
Datos: nombre, slug de sucursal, dirección, teléfono, WhatsApp con selector de código de país.
**Selector de zona horaria** (IANA, con buscador; por defecto `America/Mexico_City`), con la nota:
*Se usa para calcular si tu negocio está abierto ahora.*
Debajo, **horarios**: siete filas, una por día. Cada fila tiene un toggle "Cerrado" y dos campos de
hora. Diseña el caso en que el cierre es **más temprano que la apertura** (20:00 → 02:00): debe
mostrarse una etiqueta discreta `+1 día` junto a la hora de cierre.

**5.3 — `/admin/diseno`.**
Arriba: los cuatro formatos como tarjetas grandes con preview real. El activo lleva borde azul.
Los que el plan no permite llevan **candado** y un botón `Actualizar plan`.
En Basic, donde el usuario elige Clásico + uno más: los ya desbloqueados se ven normales, y al
intentar activar un tercero aparece *Tu plan permite 2 formatos desbloqueados.*
Abajo: personalización del tema del tenant — color primario, color de fondo, tipografía e imagen de
fondo, con preview en vivo del menú a la derecha.
Botón: `Cambiar formato de menú`.

**5.4 — `/admin/qr`.**
El QR grande y centrado sobre fondo suave, con el logo del negocio al centro del código.
La URL debajo: `vibemenu.com/cafe-aurora`, con botón `Copiar enlace`.
Botones de descarga: `Descargar mi QR` con selector de formato PNG o SVG.
A la derecha, un mockup de cómo se ve el QR impreso en un tent de mesa.

Al terminar: `FASE 5 COMPLETADA. Escribe CONTINUAR FASE 6 para seguir.`

---

## FASE 6 — Panel admin: equipo, suscripción y límites (4 pantallas · web)

**6.1 — `/admin/equipo`.**
Tabla de usuarios: avatar, nombre, email, rol (`Owner` o `Encargado`), fecha de alta.
El owner no se puede eliminar.
Botón `Invitar encargado`, con contador `1 de 2 usuarios`.
**Diseña también el estado bloqueado**, que es lo que ven Free y Basic: la tabla difuminada detrás de
una tarjeta central que dice *El trabajo en equipo es parte de Pro.* con botón `Actualizar plan`.

**6.2 — `/admin/suscripcion`.**
Arriba, tarjeta del plan actual: nombre del plan, precio que paga el tenant, moneda, fecha de próxima
renovación, badge de estado. Junto al precio, una nota en gris:
*Este es tu precio congelado. No sube mientras sigas activo.*
Botón principal: `Administrar mi plan` (abre el portal de Stripe).

Debajo, **historial de suscripciones**: una tabla con una fila por periodo, columnas
`Plan · Precio · Moneda · Desde · Hasta · Estado · Motivo`.
Los estados posibles son `Activa` (verde), `Reemplazada` (gris), `Cancelada` (rojo), `Vencida` (ámbar).
Los motivos son `Alta`, `Upgrade`, `Downgrade`, `Reactivación`, `Cancelación`, `Vencimiento`.
Deja una columna vacía a la derecha, con encabezado `Recibo` y el texto `Próximamente` en gris —
la facturación llega después.

**6.3 — Modal de límite alcanzado.**
Se dispara al intentar pasarse del plan. Diseña la variante de productos:
*Llegaste al límite de productos de tu plan actual. Actualiza tu plan para seguir agregando.*
Muestra el plan actual y el siguiente lado a lado, con lo que se desbloquea resaltado.
Botones: `Actualizar plan` (azul) y `Ahora no` (gris).

**6.4 — Comparativa de planes dentro del admin.**
La misma tabla comparativa de `/precios`, pero con el plan actual marcado y los CTAs
cambiados a `Cambiar a este plan`.

Al terminar: `FASE 6 COMPLETADA. Escribe CONTINUAR FASE 7 para seguir.`

---

## FASE 7 — Estados vacíos, errores y mobile (5 pantallas)

Todos los estados vacíos comparten anatomía: ilustración mínima monocroma en azul claro, título en
Space Grotesk, una línea de texto en gris, y un solo CTA azul.

**7.1 — Estados vacíos.** Diseña los tres:
- Sin productos: *Todavía no tienes productos en tu menú. Añade el primero para empezar a construir tu carta.* → `Añadir producto`
- Sin categorías: *Crea tu primera categoría para empezar a organizar tu menú.*
- Sin sucursales: *Aún no has agregado ninguna sucursal.*

**7.2 — Errores.**
- Error de imagen: *No pudimos subir tu imagen. Verifica el formato (JPG o PNG) y vuelve a intentar.*
- Menú no encontrado (público, sin sidebar): *Este menú no existe o ya no está disponible.*

**7.3 — Toast de éxito.** *Cambios guardados. Tu menú ya está actualizado.*
Aparece abajo a la derecha, con check verde.

**7.4 — Panel admin en mobile.** Sidebar colapsada en bottom tab bar de 5 ítems
(Dashboard, Menú, Sucursales, QR, Más). El editor de producto ocupa la pantalla completa.

**7.5 — Marca de agua del plan Free.** Cómo se ve "Hecho con Vibemenu" al pie de cada uno de los
4 formatos públicos, sin estorbar el contenido.

Al terminar: `FASE 7 COMPLETADA. Diseño terminado.`

---

## Fin del prompt

---

## Después de Stitch

1. Exporta el sistema de diseño de la Fase 0 a `src/docs/DESIGN.md`.
2. `DESIGN.md` pasa a ser la fuente de verdad pixel-level; `vibemenu_diseño.md` sigue siendo la base
   de identidad de marca.
3. Recién entonces se puede empezar a construir componentes (regla 7 del proyecto).

## Decisiones tomadas al escribir este prompt

- **Sin métrica de "QR Scans"** en el dashboard, aunque `vibemenu_diseño.md` la menciona dos veces:
  `vibemenu_alcance.md` pone analytics de escaneos explícitamente fuera del MVP, y la base de datos
  no tiene dónde guardarla. Las cuatro tarjetas son Total productos, Sucursales, Plan actual y
  Formato activo.
- **Ruta `/admin/diseno` sin eñe.** `alcance.md` la escribe `/admin/diseño` y `diseño.md` la escribe
  `/admin/diseno`. Una eñe en la URL obliga a percent-encoding (`/admin/dise%C3%B1o`) y ensucia
  enlaces y analytics. Se elige la versión sin eñe.
- **Airbnb / Resy como referencia de temperatura**, no de paleta. Los tokens azul-sobre-blanco de
  `diseño.md` se respetan tal cual; la referencia solo calibra el peso de la fotografía, el tamaño
  de las tarjetas y la cercanía del lenguaje.
