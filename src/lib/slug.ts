/** Longitud minima y maxima del slug publico (vibemenu.com.mx/<slug>). */
export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

/**
 * Normaliza a slug: minusculas, sin acentos, guiones entre palabras.
 * "Café Aurora" -> "cafe-aurora"
 */
export function normalizarSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita diacriticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX);
}

export type ErrorSlug = "corto" | "largo" | "formato";

export function validarFormatoSlug(slug: string): ErrorSlug | null {
  if (slug.length < SLUG_MIN) return "corto";
  if (slug.length > SLUG_MAX) return "largo";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "formato";
  return null;
}

export const MENSAJE_ERROR_SLUG: Record<ErrorSlug, string> = {
  corto: `Usa al menos ${SLUG_MIN} caracteres.`,
  largo: `Usa como máximo ${SLUG_MAX} caracteres.`,
  formato: "Solo letras, números y guiones.",
};
