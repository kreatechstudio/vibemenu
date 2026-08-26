# Vibemenu — Diseño y Brand

> Leer este archivo COMPLETO antes de crear cualquier componente visual.
> El copy real vive en /docs/copywriting.md — usar ese texto, nunca Lorem Ipsum.

---

## Identidad visual — Vibemenu (landing + panel admin)

Referencia base: mockup limpio, tipo SaaS profesional — fondo blanco, headlines negros en bold extremo, un solo azul eléctrico como acento, mucho whitespace, cards con bordes suaves y sombra sutil.

### Colores

| Token                | Hex       | Uso                                                              |
| -------------------- | --------- | ---------------------------------------------------------------- |
| `--vm-primary`       | `#2B4EFF` | Azul eléctrico — CTAs primarios, links activos, acentos de marca |
| `--vm-primary-hover` | `#1E3AE0` | Hover de botones primarios                                       |
| `--vm-ink`           | `#0B0B0F` | Negro casi puro — headlines, texto principal                     |
| `--vm-body`          | `#4B4E5A` | Gris — texto secundario, párrafos                                |
| `--vm-bg`            | `#FFFFFF` | Fondo principal                                                  |
| `--vm-bg-soft`       | `#F5F6F9` | Fondo de secciones alternas, cards del dashboard                 |
| `--vm-border`        | `#E4E6ED` | Bordes de cards, inputs                                          |
| `--vm-success`       | `#16A34A` | Estados "activo", "abierto"                                      |
| `--vm-warning`       | `#D97706` | Estados "trial", límite cerca de alcanzarse                      |
| `--vm-danger`        | `#DC2626` | Estados "cerrado", "suspendido", errores                         |

### Tipografía

- **Headlines / hero:** Space Grotesk, bold (700-800) — el mismo peso extremo que la referencia (letras grandes, tracking ajustado)
- **Cuerpo / UI:** Inter, regular (400) / medium (500) para labels
- **Datos numéricos (precios, stats del dashboard):** JetBrains Mono — refuerza la sensación "producto técnico confiable"

### Estilo general

- Bordes redondeados moderados (`rounded-xl`, no `rounded-full` en botones — la referencia usa esquinas suaves, no pill-shape)
- Sombras muy sutiles, casi planas — nada de sombras dramáticas o glassmorphism
- Mucho aire entre secciones (padding vertical generoso, como en la referencia)
- Badges tipo "ID: VM-2024 | REV: A" de la referencia → usar ese patrón de badge pill gris claro para etiquetas de estado o metadata técnica en el dashboard

---

## Referencias del cliente

- Screenshot de referencia proporcionado por Carlos: landing genérica de "Vibemenu" con navbar simple, hero centrado con badge superior, dos CTAs (uno azul sólido, uno gris), y debajo un preview del panel de administración con cards de métricas (Total Items, Suscripción, QR Scans).
- Ese layout de hero + preview de producto debajo es el patrón a seguir para la landing real — el preview de producto no es genérico, debe mostrar datos de un tenant demo real ("Café Aurora" o similar), no placeholders tipo "124" sin contexto.

---

## Diferenciadores de diseño (qué lo hace NO genérico)

- El hero de la landing SIEMPRE muestra un preview real del panel funcionando, no un mockup ilustrado — refuerza que es un producto de verdad, no una promesa
- Los 4 formatos de menú público (ver abajo) tienen identidad visual TOTALMENTE distinta entre sí — no son la misma card con diferente grid, son experiencias de navegación distintas
- Nunca usar íconos de stock de shadcn sin contexto — cada ícono de sección debe reforzar el copy real (ej. sección de formatos usa mockups reales de cada formato, no íconos genéricos de "grid" o "list")
- El azul `#2B4EFF` es exclusivo de Vibemenu (landing/admin) — NUNCA se usa como color por defecto de los menús públicos de los tenants, cada tenant tiene su propio tema

---

## Paleta de componentes — Landing y Panel Admin

| Elemento                                  | Color / estilo                                                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Navbar                                    | Fondo blanco, borde inferior `--vm-border`, logo en `--vm-ink`, link activo subrayado en `--vm-primary`                                   |
| Botón primario                            | Fondo `--vm-primary`, texto blanco, `rounded-xl`, hover `--vm-primary-hover`                                                              |
| Botón secundario                          | Fondo `--vm-bg-soft`, texto `--vm-ink`, sin borde                                                                                         |
| Cards de plan (precios)                   | Fondo blanco, borde `--vm-border`, plan recomendado (Pro) con borde `--vm-primary` de 2px y badge "Más popular"                           |
| Cards del dashboard admin                 | Fondo blanco, borde `--vm-border`, número grande en JetBrains Mono, label en gris uppercase pequeño (como "TOTAL ITEMS" de la referencia) |
| Badge de estado (activo/trial/suspendido) | Pill pequeño, fondo suave del color de estado al 10% opacidad, texto del color sólido                                                     |
| Inputs de formulario                      | Borde `--vm-border`, focus ring `--vm-primary`                                                                                            |

---

## Los 4 formatos de menú público — identidad visual independiente

Cada formato tiene su propio set de defaults (el tenant los puede personalizar en `/admin/diseno`, esto es el punto de partida):

### Clásico

- Tipografía: serif elegante (ej. Fraunces o Playfair Display) para nombres de producto, sans-serif para descripciones
- Fondo: color sólido o imagen tenue con overlay oscuro, texto blanco/crema
- Layout: lista vertical por categoría, precios alineados a la derecha con línea punteada clásica de menú de restaurante

### Pinterest

- Grid tipo masonry (columnas de alturas variables según proporción de la foto)
- Fondo blanco o gris muy claro, las fotos son el protagonista
- Al tocar una foto, expande a detalle del producto con animación de escala

### Instagram

- Grid perfecto 3 columnas, fotos cuadradas (crop automático)
- Al abrir producto: vista tipo "post" con foto grande arriba, nombre/precio/descripción abajo, modificadores como si fueran "detalles del post"
- Usa un header de perfil simulado arriba del grid: logo del tenant + nombre + bio corta (dirección/horario)

### TikTok

- Fullscreen vertical, un producto a la vez, swipe/scroll vertical entre productos
- Si hay video: autoplay muteado con controles mínimos; si no hay video, foto con animación de zoom lento (Ken Burns)
- Overlay de texto (nombre, precio, descripción corta) sobre la parte inferior del video/foto, con gradiente oscuro para legibilidad
- Botón de modificadores flota como un "sheet" que sube desde abajo, igual que un CTA de TikTok Shop

---

## Instrucciones anti-genérico obligatorias para Claude Code

```
INSTRUCCIONES PARA CLAUDE CODE — DISEÑO:
- NO usar colores por defecto de Tailwind (blue-500, green-400, etc) — usar SIEMPRE los tokens
  --vm-primary, --vm-ink, --vm-bg-soft, etc. definidos en este archivo
- NO usar tipografía Inter para headlines sin validar — Inter es solo para cuerpo/UI, headlines van en Space Grotesk
- El hero de la landing SIEMPRE debe incluir el preview real del panel admin, no una ilustración genérica
- Los 4 formatos de menú público NO pueden compartir el mismo componente de layout — cada uno vive en
  components/formatos/ como su propio sistema visual
- NO usar avatares o imágenes placeholder en el resultado final — usar datos de un tenant demo realista
  ("Café Aurora", "Tacos El Primo") en /demo y en el preview del hero
- SIEMPRE personalizar componentes shadcn/ui con los tokens de color de este documento
- USAR Framer Motion para: entrada de secciones (fadeInUp), hover de cards de precios (scaleIn + hoverScale),
  transición entre los 4 formatos en /demo (crossfade), swipe vertical del formato TikTok
- USAR Magic UI para: Blur Fade (entrada de secciones de landing), Border Beam (card del plan Pro destacado),
  Animated List (feed del formato Instagram), Number Ticker (stats del dashboard admin: total productos, QR scans)
- El diseño de referencia detallado está en /docs/DESIGN.md (generado por Stitch) — este archivo es la base
  de identidad, DESIGN.md es la fuente de verdad pixel-level una vez exista
```

---

## Notas de copy (reforzando /docs/copywriting.md)

- El copy real de cada sección ya está en `/docs/copywriting.md` — Stitch y Claude Code deben usar ese texto exacto, no generar copy nuevo
- El diferenciador de los 4 formatos debe estar visualmente presente en la landing (sección "Formatos"), no solo mencionado en texto
