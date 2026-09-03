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

export const REGISTRO = {
  nota: "Sin tarjeta de crédito. 14 días con todo Pro, luego Free para siempre.",
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
  estadoLabel: "Estado del servicio",
  // Instatus (plan gratuito). Fuera de src/docs: no hay cuenta ni secreto que
  // documentar, es una pagina publica de terceros que solo lee vibemenu.com.mx.
  estadoUrl: "https://vibemenu.instatus.com",
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
  notaAhorroAnual: (porcentaje: number) => `Ahorra ${porcentaje}% pagando anual`,
  comparativaCompletaTitulo: "Todo lo que incluye cada plan",
  comparativaCompletaNota:
    "Cada función, en cada plan. Lo que tu plan no incluye aparece con una raya (–).",
} as const;

export const FACTURACION = {
  titulo: "Datos de facturación",
  nota: "Por ahora Vibemenu no emite facturas fiscales (CFDI). Guarda tus datos aquí y en cuanto lancemos esa opción, ya estarán listos — sin que tengas que volver a capturarlos.",
  campos: {
    rfc: "RFC",
    razonSocial: "Razón social",
    codigoPostal: "Código postal fiscal",
    regimenFiscal: "Régimen fiscal",
    usoCfdi: "Uso de CFDI",
    email: "Correo para facturas",
  },
  placeholderRazonSocial: "Como aparece en tu constancia de situación fiscal",
  placeholderEmail: "contabilidad@tunegocio.com",
  seleccionar: "Selecciona una opción",
  errorRfc: "Ese RFC no tiene un formato válido.",
  errorCp: "El código postal debe tener 5 dígitos.",
  guardado: "Datos de facturación guardados.",
} as const;

export const BOTONES = {
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

/**
 * Botón de ayuda en el header de /admin — abre un modal manual, nunca se
 * abre solo. `secciones` va en el mismo orden que `NAV` en AdminLayout.tsx;
 * los íconos se emparejan por posición ahí, no viven en este archivo.
 */
export const TUTORIAL = {
  boton: "Ayuda",
  titulo: "Guía rápida de Vibemenu",
  intro: "Un vistazo rápido a cada sección de tu panel.",
  secciones: [
    {
      etiqueta: "Resumen",
      descripcion:
        "Un vistazo a cómo va tu negocio: visitas a tu menú, tu plan y tu estado de cuenta.",
    },
    {
      etiqueta: "Mi carta",
      descripcion:
        "Aquí armas tu menú: categorías, productos, precios, fotos y modificadores como tamaños o extras.",
    },
    {
      etiqueta: "Mi negocio",
      descripcion: "Datos de contacto, sucursales, tu equipo y tu plan de suscripción.",
    },
    {
      etiqueta: "Diseño",
      descripcion:
        "Elige el formato visual de tu menú (Clásico, Pinterest, Instagram o TikTok) y personaliza colores y tipografía.",
    },
    {
      etiqueta: "QR",
      descripcion: "Descarga el código QR de tu menú, listo para imprimir y poner en tus mesas.",
    },
  ],
} as const;
