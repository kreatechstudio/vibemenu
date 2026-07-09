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

| Rol | Descripción | Accesos |
|-----|-------------|---------|
| Visitante público | Cliente del restaurante que escanea el QR | Solo lectura del menú público en `/:slug` |
| Owner (dueño) | Usuario principal del tenant, existe en todos los planes | Panel admin completo: menú, sucursales, horarios, diseño, suscripción |
| Encargado | Usuario adicional del panel admin | Solo planes Pro/Enterprise. Mismo acceso que owner excepto facturación/suscripción |
| Super admin (KreaTech) | Carlos, gestión interna de la plataforma | Panel interno fuera de MVP — revisar en fase 2 |

## Stack
- Frontend: React + Vite + TypeScript + TailwindCSS + shadcn/ui + Framer Motion
- Componentes premium: Magic UI
- Backend: Supabase (DB + Auth + Storage + RLS)
- Pagos: Stripe (suscripciones recurrentes, Checkout + Customer Portal, multi-moneda USD/MXN)
- Deploy: Lovable
- Dominio: Vercel (comprado, pendiente de conectar) — a futuro dominio personalizado por tenant en plan Pro/Enterprise vía CNAME

## Modelo de negocio — Planes

| Plan | Precio USD/mes | Precio MXN/mes | Sucursales | Menú por sucursal | Formatos | Multi-usuario | Fotos/producto | Extras |
|------|----------------|----------------|------------|--------------------|----------|----------------|-----------------|--------|
| Free perpetuo | $0 | $0 | 1 | N/A | Solo Clásico | No | 1 | 20 productos máx, marca de agua "Hecho con Vibemenu", sin video |
| Basic | $9 | $169 | 1 | Compartido (no aplica) | Clásico + 1 a elegir | No | 1 | Sin marca de agua, productos ilimitados |
| Pro | $19 | $349 | hasta 3 | Independiente por sucursal | Los 4 | Sí (owner + encargado) | 1 | Modificadores ilimitados, dominio propio (CNAME) |
| Enterprise | $39 | $699 | Ilimitado | Independiente por sucursal | Los 4 | Sí (ilimitado) | 1 | Soporte prioritario |

**Regla de precio congelado:** el precio se fija al momento en que el tenant se suscribe a un plan (`suscripciones.precio_congelado_usd/mxn`). Si en el futuro se sube el precio de lista en la tabla `planes`, los tenants ya suscritos NO se ven afectados — solo aplica a nuevas altas o upgrades.

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
- [ ] CRUD de sucursales: nombre, dirección, teléfono, WhatsApp (con selector de código de país)
- [ ] Horarios por día de la semana por sucursal → cálculo en vivo de abierto/cerrado en el menú público
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
- [ ] Descarga en PNG/SVG para imprimir

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
- Analytics de escaneos/vistas por producto (fase 2)
- Dominio personalizado real vía CNAME (arquitectura se deja lista, activación manual en fase 2)

## Rutas y páginas

| Ruta | Nombre | Descripción | Rol |
|------|--------|-------------|-----|
| `/` | Landing | Venta del servicio | Público |
| `/precios` | Precios | Tabla de planes | Público |
| `/demo` | Demo | 4 formatos navegables, sin edición | Público |
| `/registro` | Registro | Alta de tenant + elección de slug | Público |
| `/login` | Login | Acceso al panel admin | Público |
| `/:slug` | Menú público | Menú del tenant en su formato activo | Público |
| `/:slug/sucursal/:sucursal_slug` | Menú por sucursal | Solo si plan permite menú independiente | Público |
| `/admin` | Dashboard | Resumen del tenant | Owner/Encargado |
| `/admin/menu` | Gestión de menú | Categorías y productos | Owner/Encargado |
| `/admin/modificadores` | Modificadores | Catálogo de grupos y opciones | Owner/Encargado |
| `/admin/sucursales` | Sucursales | CRUD + horarios | Owner/Encargado |
| `/admin/diseño` | Diseño | Formato activo, colores, tipografía | Owner/Encargado |
| `/admin/qr` | QR | Descarga de código QR | Owner/Encargado |
| `/admin/equipo` | Equipo | Multi-usuario (Pro/Enterprise) | Owner |
| `/admin/suscripcion` | Suscripción | Plan actual, Stripe Customer Portal | Owner |

## Tiempos estimados

| Fase | Duración estimada |
|------|--------------------|
| Documentación (Fases 1-3) | Completada |
| Setup Lovable + IDX + Stitch (Fases 4-6) | 1 semana |
| Desarrollo core (Fase 7) | 3-4 semanas |
| SQL + Stripe + QA (Fase 8-9) | 1 semana |
| Lanzamiento beta | 1 semana |

## Notas especiales
- Este es producto propio, no hay contrato con cliente ni anticipos — el modelo de pago es recurrente vía Stripe, distinto al modelo de pago único de KreaTech Studio para clientes.
- El riesgo de costo más alto es Supabase Storage en el plan Free perpetuo — por eso 1 foto por producto y sin subida de video (solo URL embebida) en TODOS los planes.
- La lógica de "menú compartido vs independiente por sucursal" se resuelve con `sucursal_id` nullable en `categorias` y `productos` — no se requiere una tabla `menus` separada.
- Slugs reservados (admin, api, app, login, registro, precios, demo, docs, blog, soporte, etc.) deben bloquearse en el registro.
