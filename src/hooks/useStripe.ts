import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { IntervaloCobro, MonedaCobro } from "@/types/database";

/**
 * Checkout y portal de facturacion.
 *
 * El precio nunca viaja desde aqui: las Edge Functions lo leen de la tabla
 * `planes` con el service_role_key. Si el navegador pudiera mandarlo, cualquiera
 * se suscribiria a Pro por un peso.
 */

type ErrorFuncion = { error?: string };

const GENERICO = "No pudimos abrir Stripe. Vuelve a intentar en un momento.";

/**
 * Traduce los errores de las Edge Functions a copy de cara al usuario.
 *
 * Ojo con la diferencia entre "no existe" y "no la pude contactar". Un fallo de
 * CORS llega como error de red ("Failed to send a request…") y durante un rato
 * lo tradujimos como "falta desplegar", lo cual mandaba a depurar al lugar
 * equivocado: las funciones estaban desplegadas y sanas.
 */
function traducir(mensaje: string): string {
  if (/404|not found/i.test(mensaje)) {
    return "Esa función de Stripe no está desplegada.";
  }
  if (/failed to send|failed to fetch|networkerror/i.test(mensaje)) {
    return "No pudimos contactar el servidor de pagos. Revisa tu conexión y vuelve a intentar.";
  }
  if (mensaje.includes("falta_STRIPE_SECRET_KEY")) {
    return "Falta configurar la llave de Stripe en el servidor.";
  }
  if (mensaje.includes("falta_stripe_price_id")) {
    return "Este plan todavía no tiene precio configurado en Stripe.";
  }
  if (mensaje.includes("sin_customer_de_stripe")) {
    return "Todavía no tienes un plan de pago, así que no hay nada que administrar.";
  }
  if (mensaje.includes("solo_el_owner")) {
    return "Solo el dueño administra la facturación.";
  }
  return GENERICO;
}

/**
 * supabase-js envuelve cualquier respuesta no-2xx en un FunctionsHttpError cuyo
 * mensaje es siempre el mismo texto genérico. El motivo real viaja en el cuerpo,
 * así que hay que leerlo para poder traducirlo.
 */
async function motivoReal(error: unknown): Promise<string> {
  const conRespuesta = error as { context?: Response; message?: string };
  try {
    const cuerpo = (await conRespuesta.context?.clone().json()) as ErrorFuncion | undefined;
    if (cuerpo?.error) return cuerpo.error;
  } catch {
    /* la respuesta no era JSON */
  }
  return conRespuesta.message ?? "";
}

async function invocar(nombre: string, cuerpo: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ url?: string } & ErrorFuncion>(nombre, {
    body: { ...cuerpo, url_retorno: `${window.location.origin}/admin/suscripcion` },
  });

  if (error) throw new Error(traducir(await motivoReal(error)));
  if (data?.error) throw new Error(traducir(data.error));
  if (!data?.url) throw new Error(GENERICO);
  return data.url;
}

export function useCheckout() {
  return useMutation({
    mutationFn: async (args: {
      tenantId: string;
      planId: string;
      moneda: MonedaCobro;
      intervalo: IntervaloCobro;
    }) => {
      const url = await invocar("crear-checkout", {
        tenant_id: args.tenantId,
        plan_id: args.planId,
        moneda: args.moneda,
        intervalo: args.intervalo,
      });
      window.location.href = url;
    },
  });
}

export function usePortalStripe() {
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const url = await invocar("portal-stripe", { tenant_id: tenantId });
      window.location.href = url;
    },
  });
}
