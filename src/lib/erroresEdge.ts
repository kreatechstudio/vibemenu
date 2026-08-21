import { FunctionsHttpError } from "@supabase/supabase-js";

/**
 * Slugs que devuelven las Edge Functions de invitaciones (`invitar-encargado`,
 * `aceptar-invitacion`) en el cuerpo `{ error: "<slug>" }`. A diferencia de
 * `errores.ts` (triggers de Postgres), estos vienen del `json(...)` de cada
 * función — ver supabase/functions/*.
 */
const MENSAJES: Record<string, string> = {
  sin_sesion: "Tu sesión expiró. Vuelve a entrar e intenta de nuevo.",
  faltan_datos: "Faltan datos para completar la acción.",
  solo_el_owner_invita: "Solo el dueño del negocio puede invitar.",
  ya_es_parte_del_equipo: "Ese correo ya es parte de tu equipo.",
  correo_ya_administra_otro_negocio:
    "Ese correo ya administra otro negocio en Vibemenu. Usa un correo distinto para esta invitación.",
  no_pudimos_enviar_el_correo:
    "No pudimos enviar el correo de invitación. Intenta de nuevo en un momento.",
  invitacion_no_encontrada: "Ese enlace de invitación no es válido.",
  invitacion_cancelada: "Esta invitación fue cancelada.",
  invitacion_ya_aceptada: "Esta invitación ya fue aceptada.",
  invitacion_vencida: "Esta invitación ya venció. Pide que te inviten de nuevo.",
  inicia_sesion_para_aceptar: "Ya existe una cuenta con este correo. Inicia sesión para aceptar.",
  falta_password: "Elige una contraseña de al menos 6 caracteres.",
  no_pudimos_crear_la_cuenta: "No pudimos crear tu cuenta. Intenta de nuevo.",
};

/**
 * Lee el cuerpo real de una FunctionsHttpError (supabase-js no lo expone en
 * `.message`, solo en `.context`, que es el Response crudo) y lo traduce.
 * Si no hay cuerpo interpretable, cae a los mismos casos genéricos que antes
 * (función no desplegada / sin red).
 */
export async function traducirErrorEdge(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const cuerpo = await error.context.json();
      const slug = cuerpo?.error as string | undefined;
      if (slug && slug in MENSAJES) return MENSAJES[slug];
    } catch {
      // El cuerpo no era JSON legible: cae al mensaje generico de abajo.
    }
  }

  const mensaje = (error as Error)?.message ?? "";
  if (/404|not found/i.test(mensaje)) return "Esa función no está desplegada.";
  if (/failed to send|failed to fetch/i.test(mensaje)) {
    return "No pudimos contactar el servidor. Revisa tu conexión y vuelve a intentar.";
  }
  return "Algo salió mal. Vuelve a intentar en un momento.";
}
