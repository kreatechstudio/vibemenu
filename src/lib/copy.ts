/**
 * Copy real de Vibemenu. Fuente: src/docs/vibemenu_copywriting.md
 *
 * Nunca escribir texto de cara al usuario directamente en un componente.
 * Si falta una cadena, agregarla al documento primero y luego aquí.
 *
 * Tono: se habla en el lenguaje del dueño del negocio, no del desarrollador.
 * Nunca "dashboard" ni "CMS" de cara al usuario final. Evitar la palabra "app".
 */

export const HERO = {
  headline: "Tu menú, como tú lo imaginas.",
  subheadline:
    "Vibemenu convierte tu carta en una experiencia visual moderna — elige entre 4 formatos, personalízalo en minutos y compártelo con un QR. Sin apps, sin complicaciones.",
  ctaPrimario: "Prueba gratis, sin tarjeta",
  ctaSecundario: "Ver demo en vivo",
} as const;

export const NAVBAR = {
  links: ["Producto", "Formatos", "Precios", "Demo"],
  cta: "Empezar gratis",
} as const;

export const FORMATOS_COPY = {
  clasico: {
    titulo: "La carta de siempre, mejor",
    descripcion:
      "Texto claro, categorías, precios y modificadores — ideal si quieres simplicidad con estilo. Personalizable en tipografía, color y fondo.",
  },
  pinterest: {
    titulo: "Que se vea antes de que se pida",
    descripcion:
      "Un mosaico de fotos que invita a explorar tu menú como una galería. Perfecto para negocios donde la presentación vende.",
  },
  instagram: {
    titulo: "Tu menú, como tu feed",
    descripcion:
      "Cuadrícula tipo publicación — tus clientes navegan tu carta igual que navegan Instagram. Familiar desde el primer scroll.",
  },
  tiktok: {
    titulo: "Deja que tu comida hable",
    descripcion:
      "Video vertical de tus platillos en pantalla completa. Sube tu reel o video de YouTube y conviértelo en tu vitrina.",
  },
} as const;

export const COMO_FUNCIONA = {
  titulo: "De tu carta a tu QR, en tres pasos",
  parrafo:
    "Configura tu menú, elige tu formato favorito y descarga tu código QR para imprimir. Así de simple. Sin depender de nadie para actualizar un precio o agregar un platillo nuevo.",
  estadisticas: ["4 formatos visuales incluidos", "Menú siempre actualizado, sin reimprimir"],
} as const;

export const TESTIMONIOS = [
  {
    nombre: "[Nombre cliente]",
    negocio: "[Cafetería/Restaurante]",
    texto:
      "Cambié mi menú impreso por Vibemenu y mis clientes empezaron a pedir cosas que ni sabían que teníamos — el formato Pinterest les encantó.",
  },
  {
    nombre: "[Nombre cliente]",
    negocio: "[Negocio]",
    texto:
      "Actualizo precios desde mi celular en el momento. Ya no gasto en reimprimir cada vez que cambia algo.",
  },
] as const;

export const CTA_FINAL = {
  headline: "Tu menú merece verse tan bien como sabe tu comida.",
  subheadline: "Empieza gratis hoy — sin tarjeta de crédito, sin compromiso.",
  boton: "Crear mi menú gratis",
} as const;

export const FOOTER = {
  tagline: "Tu menú, tu formato.",
  descripcion:
    "Vibemenu es la plataforma de menú digital que se adapta a cómo tu negocio quiere mostrarse — no al revés.",
} as const;

export const PLANES_COPY = {
  free: {
    headline: "Empieza sin arriesgar nada",
    descripcion:
      "Ideal para probar Vibemenu con tu menú real. Gratis para siempre, hasta 20 productos.",
    cta: "Empezar gratis",
  },
  basic: {
    headline: "Para un solo local, sin límites de menú",
    descripcion:
      "Productos ilimitados, sin marca de agua, con el formato Clásico y uno más a tu elección.",
    cta: "Elegir plan",
  },
  pro: {
    headline: "Para negocios que quieren destacar",
    descripcion: "Los 4 formatos, hasta 3 sucursales con menús independientes, tu propio dominio.",
    cta: "Elegir plan",
  },
  enterprise: {
    headline: "Para cadenas y grupos restauranteros",
    descripcion:
      "Sucursales ilimitadas, equipo completo con múltiples usuarios, soporte prioritario.",
    cta: "Contactar ventas",
  },
} as const;

export const PRECIOS = {
  notaPrecioCongelado:
    "Tu precio no sube mientras sigas activo, aunque lancemos nuevos precios más adelante.",
  togglePeriodo: "Mensual",
  periodoAnualProximamente: "Próximamente",
} as const;

export const BOTONES = {
  registro: "Prueba gratis, sin tarjeta",
  verDemo: "Ver demo en vivo",
  descargarQR: "Descargar mi QR",
  cambiarFormato: "Cambiar formato de menú",
  agregarProducto: "Añadir producto",
  agregarModificador: "Añadir modificador",
  guardarCambios: "Guardar cambios",
  irASuscripcion: "Administrar mi plan",
  copiarLink: "Copiar enlace",
} as const;

/**
 * Estados vacíos y errores. Los que llevan `[N]` reciben el límite real
 * de la tabla `planes` — nunca se hardcodea el número.
 */
export const ESTADOS = {
  sinProductos:
    "Todavía no tienes productos en tu menú. Añade el primero para empezar a construir tu carta.",
  sinCategorias: "Crea tu primera categoría para empezar a organizar tu menú.",
  sinSucursales: "Aún no has agregado ninguna sucursal.",
  slugNoDisponible: "Ese nombre ya está en uso — prueba con otra variante.",
  limiteProductos:
    "Llegaste al límite de productos de tu plan actual. Actualiza tu plan para seguir agregando.",
  limiteSucursales: (n: number) =>
    `Tu plan actual permite hasta ${n} sucursales. Actualiza tu plan para agregar más.`,
  errorImagen: "No pudimos subir tu imagen. Verifica el formato (JPG o PNG) y vuelve a intentar.",
  exitoGuardar: "Cambios guardados. Tu menú ya está actualizado.",
  menuNoEncontrado: "Este menú no existe o ya no está disponible.",
  negocioCerrado: "Cerrado ahora — vuelve a visitarnos en nuestro próximo horario.",
} as const;

export const SEO = {
  title: "Vibemenu — Menú Digital con 4 Formatos Visuales",
  description:
    "Crea tu menú digital en minutos. Elige entre 4 formatos visuales, personalízalo y compártelo con un QR. Prueba gratis, sin tarjeta.",
} as const;

export const MARCA_AGUA = "Hecho con Vibemenu";
