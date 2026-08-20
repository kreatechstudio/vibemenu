/**
 * Un enlace que el dueno del negocio pega a mano: su mapa, su Instagram, sus
 * resenas de Google.
 *
 * Se guarda tal cual, sin normalizar: los acortadores de Maps y los enlaces de
 * resena de Google tienen formas raras y cualquier "arreglo" nuestro los rompe.
 * Lo unico que se exige es que sea http(s) — `javascript:` en un `href` que
 * pinta el menu publico seria un XSS regalado.
 */
export const esUrlValida = (valor: string): boolean => {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};
