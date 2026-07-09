# Vibemenu — Sistema de Diseño

> Generado por Stitch (proyecto "Vibemenu SaaS Platform", Fase 0).
> Fuente de verdad pixel-level. La identidad de marca vive en `vibemenu_diseño.md`.
> Los tokens de aquí están implementados en `src/styles.css` como variables CSS.

---

## 1. Colores

| Token | Hex | Variable CSS | Uso |
|---|---|---|---|
| Primario | `#2B4EFF` | `--vm-primary` | Azul eléctrico. CTAs primarios, links activos, acentos de marca |
| Primario hover | `#1E3AE0` | `--vm-primary-hover` | Hover de botones primarios |
| Tinta | `#0B0B0F` | `--vm-ink` | Negro casi puro. Headlines, texto principal |
| Cuerpo | `#4B4E5A` | `--vm-body` | Gris. Texto secundario, párrafos |
| Fondo | `#FFFFFF` | `--vm-bg` | Fondo principal |
| Fondo suave | `#F5F6F9` | `--vm-bg-soft` | Secciones alternas, cards del dashboard |
| Borde | `#E4E6ED` | `--vm-border` | Bordes de cards e inputs |
| Éxito | `#16A34A` | `--vm-success` | Estados "activo", "abierto" |
| Advertencia | `#D97706` | `--vm-warning` | Estados "trial", límite por alcanzarse |
| Peligro | `#DC2626` | `--vm-danger` | Estados "cerrado", "suspendido", errores |

### Badges de estado (píldora)

| Estado | Fondo | Texto |
|---|---|---|
| Activo / Abierto | `#DCFCE7` | `#16A34A` |
| Trial | `#FEF3C7` | `#D97706` |
| Suspendido / Cerrado | `#FEE2E2` | `#DC2626` |

---

## 2. Tipografía

Estrategia de tres fuentes. Nunca usar Inter para headlines.

### Headlines y hero — Space Grotesk
Peso bold (700–800), tracking negativo.

| Nivel | Tamaño | Peso | Line-height | Tracking |
|---|---|---|---|---|
| Display | 64px | 800 | 1.1 | -0.04em |
| H1 | 48px | 800 | 1.1 | -0.04em |
| H2 | 32px | 700 | 1.2 | -0.02em |
| H2 mobile | 28px | 700 | 1.2 | -0.02em |
| H3 | 24px | 700 | 1.3 | -0.01em |

### Cuerpo y UI — Inter
Regular (400), medium (500) para labels.

| Nivel | Tamaño | Line-height |
|---|---|---|
| Body large | 18px | 1.6 |
| Body | 16px | 1.5 |
| Small | 14px | 1.5 |
| Caption | 12px | 1.4 |
| Label | 14px | 1.0 (tracking 0.02em, peso 500) |

### Datos numéricos — JetBrains Mono
Estrictamente para precios en los menús y métricas del dashboard. Señala precisión.

| Nivel | Tamaño | Peso | Tracking |
|---|---|---|---|
| Data large | 20px | 500 | -0.02em |
| Data medium | 14px | 400 | 0 |

En tablas y listas de menú, los datos en JetBrains Mono van **alineados a la derecha**, para que
los decimales y símbolos de moneda formen una línea vertical limpia.

---

## 3. Espaciado y forma

Ritmo sobre base de 4px.

| Token | Valor |
|---|---|
| base | 4px |
| xs | 8px |
| sm | 16px |
| md | 24px |
| lg | 48px |
| xl | 80px |
| gutter | 24px |
| margen mobile | 16px |
| margen desktop | 40px |

**Radios.** El lenguaje de forma es "soft-square". Se evita la píldora (redondeo total)
excepto en badges.

| Uso | Radio |
|---|---|
| Botones, inputs, componentes pequeños | 12px |
| Cards, módulos del dashboard, modales | 16px |
| Badges | píldora |

Los elementos anidados usan un radio igual o menor que su contenedor.

---

## 4. Elevación

Capas tonales más sombras ambientales. Sin gradientes pesados.

| Nivel | Uso | Sombra |
|---|---|---|
| 0 — Suelo | Fondo principal | ninguna |
| 1 — Cards | Fondo suave sin sombra, o blanco con borde 1px | `0 1px 2px 0 rgba(0,0,0,0.05)` |
| 2 — Interactivo | Card en hover, dropdown | `0 4px 12px rgba(11,11,15,0.05)` |
| 3 — Modales | Diálogos | `0 12px 32px rgba(11,11,15,0.1)` |

---

## 5. Componentes base

**Botón primario.** Altura mínima 48px. Fondo `#2B4EFF`, texto blanco, radio 12px.
Hover `#1E3AE0`. Disabled: opacidad 50%, `cursor: not-allowed`. Nunca píldora.

**Botón secundario.** Fondo transparente, borde 1px `#E4E6ED`, texto `#0B0B0F`.

**Inputs y selects.** Fondo `#FFFFFF`, borde 1px `#E4E6ED`, texto `#0B0B0F`.
En focus el borde pasa a `#2B4EFF` con ring sutil. Labels en estilo `label` sobre `--vm-ink`.

**Cards.** Borde 1px `#E4E6ED`. En el dashboard, cuerpo con fondo suave para separarlo
del área de trabajo.

**Badges y chips.** Radio de píldora, versiones de baja opacidad de los colores semánticos
con texto de alto contraste.

**Listas y menús.** Padding vertical generoso — mayor que el horizontal. Los precios siempre
en JetBrains Mono.

**Navegación.** Sidebar vertical en el panel, texto en tinta de alto contraste e indicador
azul primario para el estado activo.

---

## 6. Filosofía

El sistema busca el punto medio entre la fiabilidad técnica de un SaaS y la calidez de la
hospitalidad. Autoritario pero acogedor: claridad para el operador del restaurante,
escaneabilidad sin esfuerzo para el comensal.

Se apoya en el aire y en la tipografía, no en el ornamento. Grid de 12 columnas en desktop;
en mobile, columna única con márgenes de 16px. Espaciado `lg` o `xl` entre secciones mayores.

El azul primario es el ancla interactiva, no el protagonista. En los menús públicos **no
aparece nunca**: cada tenant tiene su propio tema.
