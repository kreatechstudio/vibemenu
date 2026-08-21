/**
 * Tarjeta imprimible del codigo QR.
 *
 * El mismo archivo gobierna la vista previa (DOM escalado) y la exportacion
 * (canvas). Si las medidas vivieran en dos lados, lo que el dueno ve y lo que
 * manda a la imprenta acabarian siendo distintos.
 *
 * Regla dura: el codigo QR se dibuja SIEMPRE sobre un panel blanco opaco. La
 * imagen de fondo del tema va detras de la tarjeta, nunca detras del codigo:
 * un lector de celular necesita contraste, y una foto lo destruye.
 */

export const ESCALA_PNG = 2;

/** Lienzo logico. Todo lo demas se posiciona dentro de estas medidas. */
export const LIENZO = { ancho: 1000, alto: 1400 } as const;

const MARGEN = 80;

/** Ancho util para cualquier texto de la tarjeta. */
export const ANCHO_TEXTO = LIENZO.ancho - MARGEN * 2;

export const MEDIDAS = {
  titulo: { y: 168, tamanoMaximo: 68 },
  sucursal: { y: 232, tamano: 34 },
  panel: { x: 170, y: 300, lado: 660, radio: 44 },
  qr: { x: 220, y: 350, lado: 560 },
  /** Cuadro blanco con el logo, al centro del codigo. Exige nivel de correccion H. */
  logo: { lado: 128, radio: 28, relleno: 18 },
  llamada: { tamano: 38 },
  descripcion: { tamano: 26, interlinea: 34, maxLineas: 2 },
  /** La ruta baja a `tamanoMinimo` y, si aun no cabe, se parte en dos renglones. */
  pie: { tamano: 30, tamanoMinimo: 24, interlinea: 34 },
  marca: { y: 1330, tamano: 24 },
} as const;

/** El bloque de texto de abajo se centra entre el panel del codigo y la marca. */
const CENTRO_BLOQUE = 1135;

export const FUENTE_MONO = '"JetBrains Mono", ui-monospace, monospace';

export type OpcionesTarjeta = {
  /** A donde apunta el codigo. */
  url: string;
  titulo: string;
  /** Nombre de la sucursal, o null si es el menu general. */
  sucursal: string | null;
  /** Descripcion del negocio. El dueno decide si la imprime. */
  descripcion: string | null;
  /** `vibemenu.com.mx/cafe-charly`, para que se pueda teclear sin escanear. */
  pie: string;
  fuenteCss: string;
  colorFondo: string;
  colorTexto: string;
  colorQr: string;
  imagenFondoUrl: string | null;
  logoUrl: string | null;
  marcaAgua: boolean;
};

/* ── Contraste ─────────────────────────────────────────────────────── */

function canales(hex: string): [number, number, number] | null {
  const limpio = hex.trim().replace(/^#/, "");
  const largo =
    limpio.length === 3
      ? limpio
          .split("")
          .map((c) => c + c)
          .join("")
      : limpio;
  if (!/^[0-9a-fA-F]{6}$/.test(largo)) return null;
  return [
    parseInt(largo.slice(0, 2), 16),
    parseInt(largo.slice(2, 4), 16),
    parseInt(largo.slice(4, 6), 16),
  ];
}

/** Luminancia relativa (WCAG). 0 = negro, 1 = blanco. */
export function luminancia(hex: string): number {
  const rgb = canales(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** Un lector de celular necesita 4:1 largo. Por debajo, el codigo se pinta negro. */
export const CONTRASTE_MINIMO_QR = 4;

const NEGRO = "#0B0B0F";

/**
 * Color del codigo sobre el panel blanco. Si el color de marca es demasiado
 * claro, gana la legibilidad: un QR bonito que no escanea no sirve de nada.
 *
 * `degradado` distingue "bajamos tu color" de "no habia color que bajar": lo que
 * no es un hex ni siquiera llego a intentarlo, y no hay nada que avisarle al dueno.
 */
export function colorLegibleParaQr(preferido: string): { color: string; degradado: boolean } {
  if (!canales(preferido)) return { color: NEGRO, degradado: false };

  if (contraste(preferido, "#FFFFFF") >= CONTRASTE_MINIMO_QR) {
    return { color: preferido, degradado: false };
  }
  return { color: NEGRO, degradado: true };
}

/* ── Tipografia ────────────────────────────────────────────────────── */

let lienzoDeMedida: HTMLCanvasElement | null = null;

function medidor(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  lienzoDeMedida ??= document.createElement("canvas");
  return lienzoDeMedida.getContext("2d");
}

/**
 * Ancho de un texto. Sin canvas —tests, SSR— estima 0.55em por caracter, que es
 * la media de una sans. Basta para decidir si algo cabe; el navegador, que es
 * quien pinta, siempre tiene canvas.
 */
function ancho(texto: string, tamano: number, familia: string, peso = 400): number {
  const ctx = medidor();
  if (!ctx) return texto.length * tamano * 0.55;
  ctx.font = `${peso} ${tamano}px ${familia}`;
  return ctx.measureText(texto).width;
}

/**
 * Baja el tamano hasta que el titulo entra en el ancho. Se mide con canvas y el
 * resultado se usa TAMBIEN en la vista previa del DOM, para que no se separen.
 */
export function tamanoTitulo(texto: string, fuenteCss: string): number {
  const { tamanoMaximo } = MEDIDAS.titulo;
  if (!texto) return tamanoMaximo;

  for (let tamano = tamanoMaximo; tamano > 24; tamano -= 2) {
    if (ancho(texto, tamano, fuenteCss, 600) <= ANCHO_TEXTO) return tamano;
  }
  return 24;
}

/** Corta por palabras. Lo que no cabe en `maxLineas` se recorta con puntos suspensivos. */
function partirEnLineas(
  texto: string,
  tamano: number,
  familia: string,
  maxLineas: number,
): string[] {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [];

  const lineas: string[] = [];
  let actual = "";
  let i = 0;

  while (i < palabras.length && lineas.length < maxLineas) {
    const tentativa = actual ? `${actual} ${palabras[i]}` : palabras[i];

    if (ancho(tentativa, tamano, familia) <= ANCHO_TEXTO) {
      actual = tentativa;
      i++;
      continue;
    }

    // Ni la palabra sola cabe: se queda igual y desborda un poco. Mejor que un bucle infinito.
    if (!actual) {
      lineas.push(palabras[i]);
      i++;
      continue;
    }

    lineas.push(actual);
    actual = "";
  }

  if (actual && lineas.length < maxLineas) {
    lineas.push(actual);
    actual = "";
  }

  // Quedó texto fuera: el último renglón lo admite con "…" en vez de mentir.
  const sobra = actual !== "" || i < palabras.length;
  if (sobra && lineas.length > 0) {
    let ultima = lineas[lineas.length - 1];
    while (ultima.length > 1 && ancho(`${ultima}…`, tamano, familia) > ANCHO_TEXTO) {
      ultima = ultima.slice(0, -1);
    }
    lineas[lineas.length - 1] = `${ultima}…`;
  }

  return lineas;
}

/**
 * La ruta del menu. Primero intenta un renglon; si no cabe, achica; y si aun asi
 * se sale, la parte despues de una barra. `vibemenu.com.mx/cafe-charly/sucursal/…`
 * no cabe en 840px por mucho que se encoja, y recortarla la vuelve intecleable.
 */
export function partirPie(pie: string): { lineas: string[]; tamano: number } {
  const { tamano, tamanoMinimo } = MEDIDAS.pie;

  for (const t of [tamano, tamanoMinimo]) {
    if (ancho(pie, t, FUENTE_MONO) <= ANCHO_TEXTO) return { lineas: [pie], tamano: t };
  }

  const cabe = (t: string) => ancho(t, tamanoMinimo, FUENTE_MONO) <= ANCHO_TEXTO;

  // El corte más tardío que quepa: deja la primera línea lo más larga posible.
  for (let i = pie.length - 1; i > 0; i--) {
    if (pie[i] !== "/") continue;
    const primera = pie.slice(0, i + 1);
    const segunda = pie.slice(i + 1);
    if (cabe(primera) && cabe(segunda)) return { lineas: [primera, segunda], tamano: tamanoMinimo };
  }

  // Sin barras útiles (un slug larguísimo de una pieza): se parte por la mitad.
  const mitad = Math.ceil(pie.length / 2);
  return { lineas: [pie.slice(0, mitad), pie.slice(mitad)], tamano: tamanoMinimo };
}

export type Renglon = { texto: string; y: number; tamano: number };

export type Disposicion = {
  llamada: Renglon;
  descripcion: Renglon[];
  pie: Renglon[];
};

/**
 * Reparto vertical del bloque de abajo. Lo calcula UNA vez y lo consumen el canvas
 * y la vista previa: si cada uno lo hiciera a su manera, el PNG y lo que el dueno
 * ve en pantalla se irian separando renglon a renglon.
 *
 * `y` es la linea base, como la quiere `ctx.fillText`.
 */
export function disposicion(opciones: OpcionesTarjeta): Disposicion {
  const LLAMADA = "Escanea para ver la carta";
  const { llamada, descripcion, pie } = MEDIDAS;

  const lineasDesc = opciones.descripcion
    ? partirEnLineas(
        opciones.descripcion,
        descripcion.tamano,
        opciones.fuenteCss,
        descripcion.maxLineas,
      )
    : [];

  const pieCortado = partirPie(opciones.pie);

  const altoLlamada = llamada.tamano + 12;
  const altoDesc = lineasDesc.length ? lineasDesc.length * descripcion.interlinea + 10 : 0;
  const altoPie = pieCortado.lineas.length * pie.interlinea;

  let top = CENTRO_BLOQUE - (altoLlamada + altoDesc + altoPie) / 2;

  const base = (tamano: number) => top + tamano * 0.78;

  const salida: Disposicion = {
    llamada: { texto: LLAMADA, y: base(llamada.tamano), tamano: llamada.tamano },
    descripcion: [],
    pie: [],
  };
  top += altoLlamada;

  for (const texto of lineasDesc) {
    salida.descripcion.push({ texto, y: base(descripcion.tamano), tamano: descripcion.tamano });
    top += descripcion.interlinea;
  }
  if (lineasDesc.length) top += 10;

  for (const texto of pieCortado.lineas) {
    salida.pie.push({ texto, y: base(pieCortado.tamano), tamano: pieCortado.tamano });
    top += pie.interlinea;
  }

  return salida;
}

/** El canvas dibuja con la fuente que ya cargó el documento, no con la del CSS. */
export async function esperarFuente(fuenteCss: string): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`600 ${MEDIDAS.titulo.tamanoMaximo}px ${fuenteCss}`),
      document.fonts.load(`400 ${MEDIDAS.llamada.tamano}px ${fuenteCss}`),
    ]);
  } catch {
    // Fuente no disponible: el canvas cae al fallback de la familia. No es fatal.
  }
}

/* ── Imagenes ──────────────────────────────────────────────────────── */

/**
 * Devuelve null en vez de reventar. Sin `crossOrigin` el canvas queda "tainted"
 * y `toDataURL` lanza SecurityError: la descarga fallaria sin decir por que.
 */
export function cargarImagen(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolver) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolver(img);
    img.onerror = () => resolver(null);
    img.src = url;
  });
}

function caja(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ancho: number,
  alto: number,
  radio: number,
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, ancho, alto, radio);
  else ctx.rect(x, y, ancho, alto);
  ctx.closePath();
}

/** Recorta como `object-fit: cover`. */
function dibujarCubriendo(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  ancho: number,
  alto: number,
) {
  const escala = Math.max(ancho / img.width, alto / img.height);
  const w = img.width * escala;
  const h = img.height * escala;
  ctx.drawImage(img, (ancho - w) / 2, (alto - h) / 2, w, h);
}

/* ── Pintado ───────────────────────────────────────────────────────── */

/** El SVG del codigo, ya serializado desde el DOM, como imagen dibujable. */
function svgComoImagen(svg: string): Promise<HTMLImageElement | null> {
  const codificado = btoa(unescape(encodeURIComponent(svg)));
  return cargarImagen(`data:image/svg+xml;base64,${codificado}`);
}

/**
 * Pinta la tarjeta completa en un canvas listo para `toDataURL`.
 *
 * `svgQr` es el <svg> que react-qr-code ya renderizo en la pagina: se reusa en vez
 * de recalcular la matriz, y asi el PNG y la vista previa muestran el mismo codigo.
 */
export async function pintarTarjeta(
  opciones: OpcionesTarjeta,
  svgQr: string,
): Promise<HTMLCanvasElement | null> {
  const canvas = document.createElement("canvas");
  canvas.width = LIENZO.ancho * ESCALA_PNG;
  canvas.height = LIENZO.alto * ESCALA_PNG;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(ESCALA_PNG, ESCALA_PNG);

  await esperarFuente(opciones.fuenteCss);

  const [fondo, logo, qr] = await Promise.all([
    opciones.imagenFondoUrl ? cargarImagen(opciones.imagenFondoUrl) : null,
    opciones.logoUrl ? cargarImagen(opciones.logoUrl) : null,
    svgComoImagen(svgQr),
  ]);

  // Fondo. Con foto, el texto va en blanco sobre un velo: igual que el menú.
  if (fondo) {
    dibujarCubriendo(ctx, fondo, LIENZO.ancho, LIENZO.alto);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, LIENZO.ancho, LIENZO.alto);
  } else {
    ctx.fillStyle = opciones.colorFondo;
    ctx.fillRect(0, 0, LIENZO.ancho, LIENZO.alto);
  }

  const colorTexto = fondo ? "#FFFFFF" : opciones.colorTexto;

  // Panel blanco del código.
  const { x, y, lado, radio } = MEDIDAS.panel;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#FFFFFF";
  caja(ctx, x, y, lado, lado, radio);
  ctx.fill();
  ctx.restore();

  if (qr) ctx.drawImage(qr, MEDIDAS.qr.x, MEDIDAS.qr.y, MEDIDAS.qr.lado, MEDIDAS.qr.lado);

  // Logo al centro del código. Nivel H aguanta que tape hasta un 30%.
  if (logo) {
    const l = MEDIDAS.logo.lado;
    const cx = MEDIDAS.qr.x + MEDIDAS.qr.lado / 2 - l / 2;
    const cy = MEDIDAS.qr.y + MEDIDAS.qr.lado / 2 - l / 2;

    ctx.fillStyle = "#FFFFFF";
    caja(ctx, cx, cy, l, l, MEDIDAS.logo.radio);
    ctx.fill();

    const r = MEDIDAS.logo.relleno;
    ctx.save();
    caja(ctx, cx + r, cy + r, l - r * 2, l - r * 2, MEDIDAS.logo.radio / 2);
    ctx.clip();
    ctx.drawImage(logo, cx + r, cy + r, l - r * 2, l - r * 2);
    ctx.restore();
  }

  ctx.textAlign = "center";
  const centro = LIENZO.ancho / 2;

  ctx.fillStyle = colorTexto;
  ctx.font = `600 ${tamanoTitulo(opciones.titulo, opciones.fuenteCss)}px ${opciones.fuenteCss}`;
  ctx.fillText(opciones.titulo, centro, MEDIDAS.titulo.y);

  if (opciones.sucursal) {
    ctx.globalAlpha = 0.75;
    ctx.font = `400 ${MEDIDAS.sucursal.tamano}px ${opciones.fuenteCss}`;
    ctx.fillText(opciones.sucursal, centro, MEDIDAS.sucursal.y);
    ctx.globalAlpha = 1;
  }

  const bloque = disposicion(opciones);

  ctx.font = `400 ${bloque.llamada.tamano}px ${opciones.fuenteCss}`;
  ctx.fillText(bloque.llamada.texto, centro, bloque.llamada.y);

  for (const renglon of bloque.descripcion) {
    ctx.globalAlpha = 0.8;
    ctx.font = `400 ${renglon.tamano}px ${opciones.fuenteCss}`;
    ctx.fillText(renglon.texto, centro, renglon.y);
  }

  ctx.globalAlpha = 0.7;
  for (const renglon of bloque.pie) {
    ctx.font = `400 ${renglon.tamano}px ${FUENTE_MONO}`;
    ctx.fillText(renglon.texto, centro, renglon.y);
  }

  if (opciones.marcaAgua) {
    ctx.globalAlpha = 0.55;
    ctx.font = `400 ${MEDIDAS.marca.tamano}px "Inter", system-ui, sans-serif`;
    ctx.fillText("Hecho con Vibemenu", centro, MEDIDAS.marca.y);
  }
  ctx.globalAlpha = 1;

  return canvas;
}

/* ── Descargas ─────────────────────────────────────────────────────── */

export function descargar(nombre: string, url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
}

/** Serializa el <svg> que react-qr-code ya puso en el DOM. */
export function svgSerializado(contenedor: HTMLElement): string | null {
  const svg = contenedor.querySelector("svg");
  if (!svg) return null;
  const clon = svg.cloneNode(true) as SVGElement;
  clon.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clon);
}
