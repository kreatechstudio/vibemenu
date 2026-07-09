// Edge Function: stripe-webhook
//
// El unico lugar de todo el sistema que escribe en `suscripciones`. La RLS no
// tiene policy de insert ni update para esa tabla: solo el service_role_key
// puede tocarla, y ese secreto vive AQUI y en ningun otro lado.
//
// Desplegar (sin verificacion de JWT: Stripe no manda un token de Supabase):
//   supabase functions deploy stripe-webhook --no-verify-jwt \
//     --project-ref iaiiwtqqiaqxnzxjqcnt
//
// Secretos (Dashboard → Edge Functions → Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
//
// Contrato del historial (ver vibemenu_base-datos.md, seccion 7):
//   - `suscripciones` guarda UNA FILA POR PERIODO, nunca se muta el historial.
//   - Un indice unico parcial garantiza una sola fila 'activa' por tenant.
//   - Al cambiar de plan, la fila vigente pasa a 'reemplazada' con su fecha_fin
//     y se inserta una nueva con el precio de lista CONGELADO en ese instante.

import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Cliente perezoso. Construir Stripe a nivel de modulo con la llave ausente
// mata el worker al importar, y la plataforma solo responde WORKER_ERROR: un
// 500 opaco, hasta en un OPTIONS. Asi el fallo es explicito.
let _stripe: Stripe | null = null;
function stripeClient(): Stripe {
  if (_stripe) return _stripe;
  const llave = Deno.env.get("STRIPE_SECRET_KEY");
  if (!llave) throw new Error("falta_STRIPE_SECRET_KEY");
  // Sin apiVersion fija: se usa la de la cuenta. Fijar una vieja rompe los
  // campos que Stripe movio de sitio (ver renovacionDe en stripe-webhook).
  _stripe = new Stripe(llave);
  return _stripe;
}

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

type MotivoCambio = "alta" | "upgrade" | "downgrade" | "reactivacion";

/** Cierra la fila vigente y abre una nueva con el precio de lista de HOY. */
async function abrirPeriodo(opciones: {
  tenantId: string;
  planId: string;
  moneda: "usd" | "mxn";
  stripeSubscriptionId: string | null;
  fechaRenovacion: string | null;
}) {
  const { tenantId, planId, moneda, stripeSubscriptionId, fechaRenovacion } = opciones;

  const { data: plan, error: errorPlan } = await db
    .from("planes")
    .select("precio_usd, precio_mxn, nombre")
    .eq("id", planId)
    .single();
  if (errorPlan) throw errorPlan;

  const { data: vigente } = await db
    .from("suscripciones")
    .select("id, plan_id, planes(precio_usd)")
    .eq("tenant_id", tenantId)
    .eq("estado", "activa")
    .maybeSingle();

  let motivo: MotivoCambio = "alta";

  if (vigente) {
    // El motivo se deduce comparando precios de lista, no nombres de plan.
    const antes = (vigente as { planes: { precio_usd: number } | null }).planes?.precio_usd ?? 0;
    motivo =
      plan.precio_usd > antes ? "upgrade" : plan.precio_usd < antes ? "downgrade" : "reactivacion";

    const { error } = await db
      .from("suscripciones")
      .update({ estado: "reemplazada", fecha_fin: new Date().toISOString() })
      .eq("id", vigente.id);
    if (error) throw error;
  }

  // Se congelan AMBAS monedas, aunque solo se cobre una.
  const { error: errorInsert } = await db.from("suscripciones").insert({
    tenant_id: tenantId,
    plan_id: planId,
    precio_congelado_usd: plan.precio_usd,
    precio_congelado_mxn: plan.precio_mxn,
    moneda_cobro: moneda,
    stripe_subscription_id: stripeSubscriptionId,
    estado: "activa",
    motivo_cambio: motivo,
    fecha_renovacion: fechaRenovacion,
  });
  if (errorInsert) throw errorInsert;

  // Cambiar plan_id dispara trg_tenants_20_formatos y trg_tenants_25_tema:
  // recortan formatos y tema a lo que permita el plan nuevo.
  const { error: errorTenant } = await db
    .from("tenants")
    .update({ plan_id: planId, estado: "activo" })
    .eq("id", tenantId);
  if (errorTenant) throw errorTenant;
}

async function cerrarPeriodo(stripeSubscriptionId: string, estado: "cancelada" | "vencida") {
  const { data: fila } = await db
    .from("suscripciones")
    .select("id, tenant_id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .eq("estado", "activa")
    .maybeSingle();
  if (!fila) return;

  await db
    .from("suscripciones")
    .update({
      estado,
      fecha_fin: new Date().toISOString(),
      motivo_cambio: estado === "cancelada" ? "cancelacion" : "vencimiento",
    })
    .eq("id", fila.id);

  await db.from("tenants").update({ estado: "suspendido" }).eq("id", fila.tenant_id);
}

const iso = (segundos: number | null | undefined) =>
  segundos ? new Date(segundos * 1000).toISOString() : null;

/**
 * Fecha de renovacion de una suscripcion, sin importar la version de la API.
 *
 * Hasta 2024-12-18.acacia, `current_period_end` vivia en el objeto Subscription.
 * A partir de 2025 se movio a cada item: `subscription.items.data[].current_period_end`.
 *
 * El endpoint de webhooks entrega los eventos en la version de la CUENTA, mientras
 * que `subscriptions.retrieve` responde en la version del SDK. Leer solo un lado
 * dejaba `fecha_renovacion` en null segun por donde llegara el dato.
 */
function renovacionDe(s: unknown): string | null {
  const sub = s as {
    current_period_end?: number | null;
    items?: { data?: { current_period_end?: number | null }[] };
  };
  return iso(sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end);
}

Deno.serve(async (req) => {
  // Sin esto, un secreto ausente se reportaria como "firma invalida", que miente
  // sobre la causa y manda a depurar al lugar equivocado.
  const secretoFirma = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secretoFirma) return new Response("falta STRIPE_WEBHOOK_SECRET", { status: 500 });
  if (!Deno.env.get("STRIPE_SECRET_KEY")) {
    return new Response("falta STRIPE_SECRET_KEY", { status: 500 });
  }

  const firma = req.headers.get("stripe-signature");
  if (!firma) return new Response("sin firma", { status: 400 });

  let evento: Stripe.Event;
  try {
    // constructEventAsync, no constructEvent: en Deno el crypto es asincrono.
    evento = await stripeClient().webhooks.constructEventAsync(
      await req.text(),
      firma,
      secretoFirma,
    );
  } catch (e) {
    return new Response(`firma invalida: ${(e as Error).message}`, { status: 400 });
  }

  try {
    switch (evento.type) {
      case "checkout.session.completed": {
        const sesion = evento.data.object;
        const { tenant_id, plan_id, moneda } = sesion.metadata ?? {};
        if (!tenant_id || !plan_id) break;

        const suscripcionId =
          typeof sesion.subscription === "string" ? sesion.subscription : sesion.subscription?.id;

        let renovacion: string | null = null;
        if (suscripcionId) {
          renovacion = renovacionDe(await stripeClient().subscriptions.retrieve(suscripcionId));
        }

        await abrirPeriodo({
          tenantId: tenant_id,
          planId: plan_id,
          moneda: (moneda as "usd" | "mxn") ?? "usd",
          stripeSubscriptionId: suscripcionId ?? null,
          fechaRenovacion: renovacion,
        });

        // El customer se guarda para poder abrir el portal de facturacion.
        if (typeof sesion.customer === "string") {
          await db
            .from("tenants")
            .update({ stripe_customer_id: sesion.customer })
            .eq("id", tenant_id);
        }
        break;
      }

      case "customer.subscription.updated": {
        const s = evento.data.object;
        // Solo sincroniza la renovacion. Un cambio de plan real llega como
        // checkout.session.completed, que es quien congela el precio nuevo.
        await db
          .from("suscripciones")
          .update({ fecha_renovacion: renovacionDe(s) })
          .eq("stripe_subscription_id", s.id)
          .eq("estado", "activa");

        if (s.status === "past_due" || s.status === "unpaid") {
          await cerrarPeriodo(s.id, "vencida");
        }
        break;
      }

      case "customer.subscription.deleted": {
        await cerrarPeriodo(evento.data.object.id, "cancelada");
        break;
      }
    }
  } catch (e) {
    // 500 hace que Stripe reintente. Es lo que queremos ante un fallo transitorio.
    console.error(evento.type, e);
    return new Response(`error procesando: ${(e as Error).message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ recibido: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
