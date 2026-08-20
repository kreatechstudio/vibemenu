import { toast } from "sonner";
import { ESTADOS } from "@/lib/copy";

/**
 * Avisos de la marca. Envuelven a sonner para que ningun componente escriba texto
 * suelto: el copy real vive en copywriting.md y llega aqui via lib/copy.ts.
 *
 * El toast va abajo a la derecha, con check verde, como pide el diseno.
 */

/** "Cambios guardados. Tu menú ya está actualizado." */
export const avisarGuardado = () => toast.success(ESTADOS.exitoGuardar);

export const avisarExito = (mensaje: string) => toast.success(mensaje);

export const avisarError = (mensaje: string) => toast.error(mensaje);
