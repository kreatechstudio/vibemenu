/**
 * Catalogo de tipografias para los menus publicos.
 *
 * Las claves viven tambien en la restriccion `fuentes_permitidas_validas` de la
 * tabla `planes`. Si se agrega una fuente hay que tocarla en los dos lados,
 * y agregarla al <link> de Google Fonts en src/routes/__root.tsx.
 *
 * Ninguna de estas es Space Grotesk ni Inter en su papel de marca: aqui son
 * opciones del tenant, no la identidad de Vibemenu.
 */

export type ClaveFuente =
  | "fraunces"
  | "playfair"
  | "lora"
  | "cormorant"
  | "inter"
  | "manrope"
  | "outfit"
  | "dm-sans"
  | "space-grotesk"
  | "bebas"
  | "caveat"
  | "anton";

export type CategoriaFuente = "Serif" | "Sans" | "Display" | "Carácter";

export const FUENTES: Record<
  ClaveFuente,
  { nombre: string; css: string; categoria: CategoriaFuente; nota: string }
> = {
  fraunces: {
    nombre: "Fraunces",
    css: "'Fraunces', Georgia, serif",
    categoria: "Serif",
    nota: "Cálida, de carta de autor",
  },
  playfair: {
    nombre: "Playfair Display",
    css: "'Playfair Display', Georgia, serif",
    categoria: "Serif",
    nota: "Elegante, de mantel largo",
  },
  lora: {
    nombre: "Lora",
    css: "'Lora', Georgia, serif",
    categoria: "Serif",
    nota: "Legible, sin pretensión",
  },
  cormorant: {
    nombre: "Cormorant Garamond",
    css: "'Cormorant Garamond', Georgia, serif",
    categoria: "Serif",
    nota: "Fina, muy editorial",
  },
  inter: {
    nombre: "Inter",
    css: "'Inter', system-ui, sans-serif",
    categoria: "Sans",
    nota: "Neutra, se lee siempre",
  },
  manrope: {
    nombre: "Manrope",
    css: "'Manrope', system-ui, sans-serif",
    categoria: "Sans",
    nota: "Redondeada, amable",
  },
  outfit: {
    nombre: "Outfit",
    css: "'Outfit', system-ui, sans-serif",
    categoria: "Sans",
    nota: "Geométrica, moderna",
  },
  "dm-sans": {
    nombre: "DM Sans",
    css: "'DM Sans', system-ui, sans-serif",
    categoria: "Sans",
    nota: "Compacta, muy limpia",
  },
  "space-grotesk": {
    nombre: "Space Grotesk",
    css: "'Space Grotesk', system-ui, sans-serif",
    categoria: "Display",
    nota: "Técnica, con carácter",
  },
  bebas: {
    nombre: "Bebas Neue",
    css: "'Bebas Neue', Impact, sans-serif",
    categoria: "Display",
    nota: "Condensada, de pizarrón",
  },
  caveat: {
    nombre: "Caveat",
    css: "'Caveat', cursive",
    categoria: "Carácter",
    nota: "Manuscrita, de gis",
  },
  anton: {
    nombre: "Anton",
    css: "'Anton', Impact, sans-serif",
    categoria: "Carácter",
    nota: "Gruesa, grita el platillo",
  },
};

export const CLAVES_FUENTE = Object.keys(FUENTES) as ClaveFuente[];

export const esClaveFuente = (v: unknown): v is ClaveFuente =>
  typeof v === "string" && v in FUENTES;

/** URL de Google Fonts con las 12 familias. El navegador solo descarga las que se usan. */
export const URL_GOOGLE_FONTS =
  "https://fonts.googleapis.com/css2" +
  "?family=Fraunces:opsz,wght@9..144,400;9..144,600" +
  "&family=Playfair+Display:wght@400;600" +
  "&family=Lora:wght@400;600" +
  "&family=Cormorant+Garamond:wght@400;600" +
  "&family=Inter:wght@400;500;600" +
  "&family=Manrope:wght@400;600" +
  "&family=Outfit:wght@400;600" +
  "&family=DM+Sans:wght@400;600" +
  "&family=Space+Grotesk:wght@400;500;600;700;800" +
  "&family=Bebas+Neue" +
  "&family=Caveat:wght@400;600" +
  "&family=Anton" +
  "&family=JetBrains+Mono:wght@400;500" +
  "&display=swap";
