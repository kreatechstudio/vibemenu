/**
 * Compresion de imagenes antes de subirlas.
 *
 * El mayor riesgo de costo del plan Free perpetuo es Supabase Storage. Un dueno
 * de negocio sube la foto tal cual sale del celular: 4 MB, 4032x3024. En el menu
 * se muestra a 900px como mucho. Esto la reduce a WebP, tipicamente 10-20 veces
 * mas pequena, sin diferencia visible.
 *
 * Todo se guarda en WebP. Lo soportan todos los navegadores desde 2020, y el
 * fallback cubre el caso raro en que el canvas no sepa codificarlo.
 */

export type Proposito = "producto" | "fondo" | "logo";

/** Lado mayor y calidad por uso. Un logo pequeño no necesita 1600px. */
const AJUSTES: Record<Proposito, { ladoMaximo: number; calidad: number }> = {
  producto: { ladoMaximo: 1200, calidad: 0.82 },
  fondo: { ladoMaximo: 1920, calidad: 0.8 },
  logo: { ladoMaximo: 512, calidad: 0.9 },
};

const TIPOS_ACEPTADOS = ["image/jpeg", "image/png", "image/webp"];

export class ErrorImagen extends Error {}

function cargar(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolver(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new ErrorImagen("no_pudimos_leer_la_imagen"));
    };
    img.src = url;
  });
}

/**
 * Devuelve un WebP redimensionado. Si el navegador no sabe codificar WebP,
 * devuelve el archivo original: mejor una foto pesada que ninguna foto.
 */
export async function comprimir(
  archivo: File,
  proposito: Proposito,
): Promise<{ blob: Blob; extension: string; tipo: string }> {
  if (!TIPOS_ACEPTADOS.includes(archivo.type)) {
    throw new ErrorImagen("formato_imagen_invalido");
  }

  const { ladoMaximo, calidad } = AJUSTES[proposito];
  const img = await cargar(archivo);

  // Nunca se agranda: una foto de 400px se queda en 400px.
  const escala = Math.min(1, ladoMaximo / Math.max(img.width, img.height));
  const ancho = Math.round(img.width * escala);
  const alto = Math.round(img.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;

  const ctx = canvas.getContext("2d");
  if (!ctx) return { blob: archivo, extension: extensionDe(archivo.type), tipo: archivo.type };

  ctx.drawImage(img, 0, 0, ancho, alto);

  const webp = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", calidad));
  if (!webp) {
    return { blob: archivo, extension: extensionDe(archivo.type), tipo: archivo.type };
  }

  // Si el original ya pesaba menos (un PNG diminuto), no tiene sentido rehacerlo.
  if (webp.size >= archivo.size && archivo.type === "image/webp") {
    return { blob: archivo, extension: "webp", tipo: "image/webp" };
  }

  return { blob: webp, extension: "webp", tipo: "image/webp" };
}

const extensionDe = (tipo: string) =>
  tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "jpg";

/**
 * Ruta dentro del bucket a partir de la URL publica.
 * `https://<ref>.supabase.co/storage/v1/object/public/vibemenu-media/<ruta>`
 *
 * Devuelve null si la URL no es de nuestro bucket: un tenant pudo pegar un
 * enlace externo antes de que la subida fuera obligatoria.
 */
export function rutaDeUrlPublica(url: string | null | undefined): string | null {
  if (!url) return null;
  const marca = "/storage/v1/object/public/vibemenu-media/";
  const i = url.indexOf(marca);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marca.length).split("?")[0]);
}
