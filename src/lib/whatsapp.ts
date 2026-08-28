import { LADA_DEFAULT } from "@/lib/paises";

/** Menos de esto no es un teléfono: arma un wa.me roto, mejor no mostrarlo. */
const MIN_DIGITOS = 8;

/**
 * Convierte un teléfono guardado ("+52 55 1234 5678") en los dígitos que espera
 * wa.me ("525512345678"). No adivina lada — el guardado ya la garantiza vía
 * `asegurarLada`. Devuelve null si tras limpiar quedan menos de 8 dígitos.
 */
export function telefonoParaWaMe(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const digitos = valor.replace(/\D/g, "");
  return digitos.length >= MIN_DIGITOS ? digitos : null;
}

/**
 * Link de WhatsApp. Sin `mensaje` es solo "abrir chat"; con `mensaje` lo
 * antepone URL-encoded. Devuelve null si el número no es utilizable.
 */
export function enlaceWhatsApp(valor: string | null | undefined, mensaje?: string): string | null {
  const numero = telefonoParaWaMe(valor);
  if (!numero) return null;
  const base = `https://wa.me/${numero}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}

/**
 * Garantiza que un teléfono no vacío empiece con lada (+NN). Se aplica al
 * guardar, para que `telefonoParaWaMe` siempre tenga con qué trabajar. "" y
 * null pasan tal cual.
 */
export function asegurarLada(valor: string | null): string | null {
  if (valor === null) return null;
  const limpio = valor.trim();
  if (!limpio) return limpio;
  return limpio.startsWith("+") ? limpio : `${LADA_DEFAULT} ${limpio}`;
}
