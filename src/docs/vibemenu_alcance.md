# Vibemenu — Alcance y Especificaciones

## Proyecto

- Producto propio de KreaTech Studio (no es un desarrollo para cliente — es un SaaS a vender)
- Responsable: Carlos López
- Dominio objetivo: vibemenu.com (a comprar más adelante; por lo pronto se usa subdominio de Lovable)

## Descripción

Vibemenu es una plataforma SaaS multi-tenant de menú digital. Cada negocio (restaurante, cafetería, taquería, etc.) se registra, configura su menú (productos, precios, modificadores), su(s) sucursal(es) con horarios, y elige un formato de visualización para su menú público. El menú se comparte por un slug único (`vibemenu.com/slug`) y por un código QR descargable para imprimir.

## Objetivo principal

Ofrecer una alternativa a menús impresos con una experiencia visual moderna (4 formatos distintos de presentación) y autoservicio total para el dueño del negocio — sin depender de un desarrollador para actualizar su menú.

## Usuarios y roles

| Rol                    | Descripción                                              | Accesos                                                                            |
| ---------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Visitante público      | Cliente del restaurante que escanea el QR                | Solo lectura del menú público en `/:slug`                                          |
| Owner (dueño)          | Usuario principal del tenant, existe en todos los planes | Panel admin completo: menú, sucursales, horarios, diseño, suscripción              |
| Encargado              | Usuario adicional del panel admin                        | Solo planes Pro/Enterprise. Mismo acceso que owner excepto facturación/suscripción |
| Super admin (KreaTech) | Carlos, gestión interna de la plataforma                 | Panel interno fuera de MVP — revisar en fase 2                                     |

## Stack

- Frontend: React + Vite + TypeScript + TailwindCSS + shadcn/ui + Framer Motion
- Componentes premium: Magic UI
- Backend: Supabase (DB + Auth + Storage + RLS)
- Pagos: Stripe (suscripciones recurrentes, Checkout + Customer Portal, multi-moneda USD/MXN)
- Deploy: Lovable
- Dominio: Vercel (comprado, pendiente de conectar) — a futuro dominio personalizado por tenant en plan Pro/Enterprise vía CNAME

## Modelo de negocio — Planes

| Plan          | USD/mes | MXN/mes | Sucursales | Productos  | Usuarios              | Grupos modif. | Formatos                                                     | Menú por sucursal | Extras                                      |
| ------------- | ------- | ------- | ---------- | ---------- | --------------------- | ------------- | ------------------------------------------------------------ | ----------------- | ------------------------------------------- |
| Free perpetuo | $0      | $0      | 1          | 20         | 1                     | 2             | Solo Clásico                                                 | N/A               | Marca de agua "Hecho con Vibemenu"          |
| Basic         | $9      | $169    | 1          | Ilimitados | 1                     | 5             | Clásico + **1 a elegir** entre Pinterest, Instagram y TikTok | Compartido        | Sin marca de agua · Pedir por WhatsApp · Embudo a reseñas |
| Pro           | $19     | $349    | hasta 3    | Ilimitados | 2 (owner + encargado) | Ilimitados    | Los 4                                                        | Independiente     | Todo lo de Basic · Reservaciones · Tarjeta de lealtad · Dominio propio (CNAME) |
| Enterprise    | $39     | $699    | Ilimitado  | Ilimitados | Ilimitados            | Ilimitados    | Los 4                                                        | Independiente     | Todo lo de Pro · Analítica por platillo · Soporte prioritario |

Todos los planes: 1 foto por producto, video solo por URL embebida (nunca subido).

**Cómo se modelan los formatos.** `planes.formatos_permitidos` es el _pool_ elegible y `planes.limite_formatos` cuántos puede tener desbloqueados a la vez. Basic tiene pool de los 4 y límite 2, lo que da "Clásico + 1 a elegir". El tenant guarda su elección en `tenants.formatos_desbloqueados`, y `tenants.formato_activo` es el que se muestra. `'clasico'` siempre está desbloqueado.

## Personalización del menú por plan

La segunda palanca de venta, además de los formatos. Todo vive en `tenants.tema` (jsonb) y lo valida el trigger `validar_tema_tenant` contra las columnas de `planes`.

| Capacidad                      | Free | Basic      | Pro              | Enterprise       | Columna en `planes`           |
| ------------------------------ | ---- | ---------- | ---------------- | ---------------- | ----------------------------- |
| Tipografías del catálogo       | 2    | 6          | 12               | 12               | `fuentes_permitidas`          |
| Color de acento, fondo y texto | ✅   | ✅         | ✅               | ✅               | —                             |
| Color de los modificadores     | ❌   | ✅         | ✅               | ✅               | `permite_color_modificadores` |
| Imagen de fondo                | ❌   | modo marco | marco + completo | marco + completo | `modos_imagen_permitidos`     |
| Desenfoque detrás del texto    | ❌   | ❌         | ✅               | ✅               | `permite_desenfoque`          |

**Modos de imagen.** `marco` = la foto enmarca y la carta va en una tarjeta al centro, siempre legible. `completo` = la foto ocupa la pantalla a sangre, con velo oscuro; en ese modo los colores de texto del tenant se sobreescriben por blancos, o el menú se vuelve ilegible.

**Al bajar de plan, el trigger limpia el tema en silencio**: quita la fuente si ya no está en el pool, apaga el modo de imagen si no lo permite, y borra el color de modificadores y el desenfoque. Igual que hace `trg_tenants_20_formatos` con los formatos. Nadie queda con un menú que su plan no soporta.

El catálogo de las 12 fuentes vive en `src/lib/fuentes.ts` y en la restricción `fuentes_permitidas_validas` de la tabla. Agregar una exige tocar los dos lados y el `<link>` de Google Fonts en `__root.tsx`.

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

## QR imprimible por plan

La tarjeta del QR reutiliza el tema del menú: no hay un editor de QR aparte. Lo que el dueño elige en **Diseño** es lo que sale impreso.

| Capacidad                                                    | Free | Basic | Pro | Enterprise | Columna en `planes` |
| ------------------------------------------------------------ | ---- | ----- | --- | ---------- | ------------------- |
| Tarjeta con el nombre del negocio y de la sucursal           | ✅   | ✅    | ✅  | ✅         | —                   |
| Colores del tema (fondo y código)                            | ❌   | ✅    | ✅  | ✅         | `qr_color`          |
| Tipografía del tema, logo dentro del código, imagen de fondo | ❌   | ❌    | ✅  | ✅         | `qr_avanzado`       |
| «Hecho con Vibemenu» al pie                                  | sí   | no    | no  | no         | `marca_agua`        |

La descripción del negocio es opcional en la tarjeta y se corta a dos renglones. La ruta se imprime abajo para poder teclearla sin escanear: si no cabe, primero se achica y solo entonces se parte después de una barra.

**Dos reglas duras que ningún plan negocia.** El código se dibuja siempre sobre un panel blanco opaco: la imagen de fondo va detrás de la tarjeta, nunca detrás del código. Y si el color de acento del tenant no llega a 4:1 de contraste contra ese panel, el código se imprime en negro y se le avisa al dueño — un QR con los colores correctos que ningún celular lee no sirve de nada. Cuando el logo va al centro, el código se genera con corrección de errores nivel `H`.

Las medidas de la tarjeta (1000×1400) viven una sola vez, en `src/lib/qr.ts`. La vista previa las usa escalando el DOM y la exportación a PNG las usa pintando un canvas: lo que se ve es lo que se imprime.

## Redes sociales y visitas (migración 007)

Cuatro enlaces en `tenants`: Facebook, Instagram, TikTok y las reseñas de Google. Van en el negocio, no en la sucursal — una cafetería tiene un Instagram aunque tenga cinco locales. El mapa sí es de cada sucursal (`sucursales.maps_url`). Se pintan como iconos en la cabecera del menú con `--menu-primario`, así que combinan solos con el tema; nunca con el azul de Facebook ni el degradado de Instagram.

**Visitas.** `visitas_menu` guarda un contador por `(tenant, sucursal, día)`, no una fila por visita: eso crece sin techo y no aporta nada que el contador no diga. El comensal no tiene sesión, así que no puede escribir en la tabla; el único camino es la función `registrar_visita`, SECURITY DEFINER, que valida que la sucursal sea del tenant. Se llama **desde el navegador**, nunca desde el loader del servidor: ahí contaríamos los prefetch del router y cada rastreador que pase. Una visita = una sesión del navegador por menú; recargar la página no cuenta otra vez.

El día se calcula con la zona horaria de la sucursal. Con `current_date` a secas, un negocio en México vería las visitas de las 18:00 contadas al día siguiente, que es UTC.

## Reservaciones simples (Pro/Enterprise)

Formulario breve en el menú público (nombre, personas, fecha/hora, teléfono con lada, nota, email opcional) para que el comensal solicite mesa. El restaurante recibe un aviso por correo vía Resend. **No es un sistema de reservas con mesas ni disponibilidad** — es captar la intención antes de que se vaya a otro lado. El restaurante gestiona las solicitudes en `/admin/reservaciones` con estados `nueva → atendida | cancelada`. Opt-in por sucursal (`sucursales.acepta_reservaciones` + `reservaciones_email`). Anti-spam: Turnstile verificado en la Edge Function `crear-reservacion` + rate-limit (20/sucursal/hora, 3/IP/hora). Ventana de fecha: hoy … +60 días. Purga a los 90 días por cron GitHub Actions.

## Analítica por platillo (Enterprise, migración analitica_platillo)

Contador de `vistas` (abrir el detalle en Pinterest/Instagram, o ≥2 s en un slide de TikTok — Clásico no aporta vistas) y `agregados` (meter el platillo al carrito de WhatsApp) por `(sucursal, platillo, día, hora)`, en la zona horaria de la sucursal. Panel `/admin/analitica`: ranking con tasa de conversión (agregados/vistas), curva por hora de un platillo, platillos ignorados (< 3 vistas en el rango), y tendencia diaria. **No guarda nada del comensal** — es un contador agregado, sin IP ni identificador. Dedup 1 por platillo por sesión por hora (en el navegador). El chequeo de plan (Enterprise) vive dentro de la RPC `registrar_interaccion_producto`; sin insert público directo. Purga a 180 días por cron GitHub Actions.

## Tarjeta de lealtad (Pro/Enterprise, migración lealtad)

Programa de sellos, uno por negocio. El comensal crea su tarjeta desde un banner en el menú (UUID en `localStorage`, URL `/{slug}/lealtad/{uuid}`); el encargado la sella o canjea desde `/admin/lealtad` con un código de 6 caracteres o su QR, **tope 1 sello por tarjeta por día** (zona horaria de la sucursal). Premio de un solo nivel (`N sellos = premio`, `sellos -= N` al canjear). Campo de contacto opcional (teléfono/correo, con consentimiento) para recuperar la tarjeta y para promociones futuras. `movimientos_lealtad` guarda cada sello/canje (sucursal, encargado). Purga: tarjetas sin uso a 14 días, inactivas a 12 meses. Sin Edge Function; sin Wallet en v1.

## Precios distintos por sucursal

Un producto, un precio base en `productos.precio`, y cero o más filas en `precios_sucursal (producto_id, sucursal_id, precio)`. Si una sucursal no tiene fila, cobra el precio base. **No se duplica el producto por local**: no hay dos fichas que mantener sincronizadas.

Solo los planes con `menu_independiente_por_sucursal` pueden escribir ahí, y el trigger `validar_precio_sucursal` además exige que el producto y la sucursal sean del mismo tenant. Un producto exclusivo de una sucursal no admite precios por sucursal: su precio ya es el de su local.

**Regla de precio congelado:** el precio se fija al momento en que el tenant se suscribe a un plan (`suscripciones.precio_congelado_usd/mxn`, ambas monedas). Si en el futuro se sube el precio de lista en la tabla `planes`, los tenants ya suscritos NO se ven afectados — solo aplica a nuevas altas o upgrades.

**Historial de suscripciones:** `suscripciones` guarda una fila por periodo de plan, no una sola fila mutable. Un índice único parcial garantiza una sola fila `'activa'` por tenant; el resto queda como historial visible para el owner. Los recibos fiscales son fase 2 (tabla `pagos` alimentada por `invoice.paid`).

**Enforcement de límites:** todo límite vive en la tabla `planes` y se aplica con triggers en Postgres, no solo en la UI. Un `null` en cualquier columna `limite_*` significa ilimitado. El frontend lee `planes` para mostrar u ocultar controles; la base de datos es la que realmente bloquea.

## Alcance incluido

### Onboarding y cuenta

- [ ] Registro con email/password (Supabase Auth)
- [ ] Elección de slug único al registrarse, editable después (validación en tiempo real + tabla de slugs reservados)
- [ ] Prueba gratuita perpetua sin tarjeta requerida
- [ ] Upgrade/downgrade de plan vía Stripe Checkout + Customer Portal
- [ ] Webhooks de Stripe (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`) vía Edge Function con service role key

### Gestión de menú (panel admin)

- [ ] CRUD de categorías (con orden)
- [ ] CRUD de productos: nombre, descripción, precio, 1 foto, video opcional (URL de YouTube/Reel — si hay video se usa en formato TikTok, si no, cae a la foto)
- [ ] Catálogo de grupos de modificadores reutilizables (ej. "Tamaño", "Tipo de leche", "Extras") con selección única o múltiple, obligatorio/opcional, mínimo/máximo de selecciones
- [ ] Asignación de uno o más grupos de modificadores a cada producto
- [ ] Si el plan permite menú independiente por sucursal (Pro/Enterprise): productos y categorías pueden asignarse a una sucursal específica o a "todas"
- [ ] Si el plan es compartido (Free/Basic): un solo menú visible en la única sucursal

### Sucursales y horarios

- [ ] CRUD de sucursales: nombre, dirección, teléfono, WhatsApp (con selector de código de país), zona horaria IANA
- [ ] Horarios por día de la semana por sucursal → cálculo de abierto/cerrado **en el servidor**, con la zona horaria de la sucursal (función `sucursal_esta_abierta`), nunca con la hora del navegador del visitante
- [ ] Soporte de turnos que cruzan medianoche (ej. 20:00 → 02:00)
- [ ] Límite de sucursales según plan

### Formatos de visualización (público, `/:slug`)

- [ ] **Clásico/Carta** — texto, categorías, precios y modificadores; editable en tipografía, color y foto de fondo
- [ ] **Pinterest** — grid tipo masonry con fotos de producto
- [ ] **Instagram** — feed en cuadrícula + vista tipo "post" al abrir producto
- [ ] **TikTok** — swipe vertical fullscreen con video embebido (YouTube/Reel) o foto si no hay video
- [ ] Selector de formato activo en el panel admin (limitado por plan)
- [ ] Theming por tenant: colores, tipografía, imagen de fondo — independiente del branding de Vibemenu

### QR y compartir

- [ ] Generación de QR on-the-fly a partir del slug
- [ ] Un QR por sucursal, apuntando a `/:slug/sucursal/:sucursalSlug`
- [ ] Tarjeta imprimible con el tema del tenant, escalonada por plan (`qr_color`, `qr_avanzado`)
- [ ] Descarga: PNG de la tarjeta completa, SVG del código solo

### Landing pública de Vibemenu

- [ ] Landing de venta del servicio (hero, planes, CTA registro)
- [ ] Página `/demo` — los 4 formatos navegables con datos ficticios, sin controles de edición visibles
- [ ] Página `/precios`

## Fuera del alcance (MVP)

- Ordering / pago dentro del menú (solo visualización — el modelo de Vibemenu es "reemplazo de menú impreso", no POS)
- Multi-idioma / auto-traducción
- Panel de super-admin interno para Carlos (gestión de tenants, soporte)
- App móvil nativa
- Múltiples fotos por producto (queda para fase 2 si se valida demanda)
- Dominio personalizado real vía CNAME (arquitectura se deja lista, activación manual en fase 2)

## Rutas y páginas

| Ruta                             | Nombre            | Descripción                               | Rol             |
| -------------------------------- | ----------------- | ----------------------------------------- | --------------- |
| `/`                              | Landing           | Venta del servicio                        | Público         |
| `/precios`                       | Precios           | Tabla de planes                           | Público         |
| `/demo`                          | Demo              | 4 formatos navegables, sin edición        | Público         |
| `/registro`                      | Registro          | Alta de tenant + elección de slug         | Público         |
| `/login`                         | Login             | Acceso al panel admin                     | Público         |
| `/:slug`                         | Menú público      | Menú del tenant en su formato activo      | Público         |
| `/:slug/sucursal/:sucursal_slug` | Menú por sucursal | Solo si plan permite menú independiente   | Público         |
| `/:slug/lealtad/:uuid`           | Tarjeta de sellos | La tarjeta del comensal                    | Público         |
| `/admin`                         | Dashboard         | Resumen del tenant                        | Owner/Encargado |
| `/admin/menu`                    | Gestión de menú   | Categorías y productos                    | Owner/Encargado |
| `/admin/modificadores`           | Modificadores     | Catálogo de grupos y opciones             | Owner/Encargado |
| `/admin/sucursales`              | Sucursales        | CRUD + horarios + enlace de Google Maps   | Owner/Encargado |
| `/admin/empresa`                 | Mi negocio        | Nombre, slug, logo, descripción, contacto | Owner/Encargado |
| `/admin/diseno`                  | Diseño            | Formato activo, colores, tipografía       | Owner/Encargado |
| `/admin/qr`                      | QR                | Tarjeta imprimible, un QR por sucursal    | Owner/Encargado |
| `/admin/reservaciones`           | Reservaciones     | Solicitudes de mesa, con estados          | Owner/Encargado |
| `/admin/analitica`               | Analítica         | Vistas y agregados por platillo           | Owner/Encargado |
| `/admin/lealtad`                 | Lealtad           | Configurar y validar sellos               | Owner/Encargado |
| `/admin/equipo`                  | Equipo            | Multi-usuario (Pro/Enterprise)            | Owner           |
| `/admin/suscripcion`             | Suscripción       | Plan actual, Stripe Customer Portal       | Owner           |

## Tiempos estimados

| Fase                                     | Duración estimada |
| ---------------------------------------- | ----------------- |
| Documentación (Fases 1-3)                | Completada        |
| Setup Lovable + IDX + Stitch (Fases 4-6) | 1 semana          |
| Desarrollo core (Fase 7)                 | 3-4 semanas       |
| SQL + Stripe + QA (Fase 8-9)             | 1 semana          |
| Lanzamiento beta                         | 1 semana          |

## Notas especiales

- Este es producto propio, no hay contrato con cliente ni anticipos — el modelo de pago es recurrente vía Stripe, distinto al modelo de pago único de KreaTech Studio para clientes.
- El riesgo de costo más alto es Supabase Storage en el plan Free perpetuo — por eso 1 foto por producto y sin subida de video (solo URL embebida) en TODOS los planes.
- La lógica de "menú compartido vs independiente por sucursal" se resuelve con `sucursal_id` nullable en `categorias` y `productos` — no se requiere una tabla `menus` separada.
- Slugs reservados (admin, api, app, login, registro, precios, demo, docs, blog, soporte, etc.) deben bloquearse en el registro.
- Al bajar de plan, los formatos desbloqueados se recortan solos vía trigger. Los productos y sucursales que excedan el nuevo límite NO se borran: los triggers solo bloquean `INSERT`. Definir en fase 2 si se ocultan o se le pide al tenant cuáles conservar.
