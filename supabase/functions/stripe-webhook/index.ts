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
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//   RESEND_API_KEY (correo de aviso de pago fallido)
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

const SITIO = "https://vibemenu.com.mx";

/**
 * Aviso de pago fallido. Se dispara en `invoice.payment_failed` -- la señal
 * mas temprana, antes de que Stripe agote sus reintentos y la suscripcion
 * pase a `past_due`/`unpaid` (eso lo maneja `cerrarPeriodo`, que ya suspende
 * el tenant; este correo NO cambia estado, solo avisa).
 */
async function avisarPagoFallido(tenantId: string, negocioNombre: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("falta_RESEND_API_KEY: no se pudo avisar pago fallido a", tenantId);
    return;
  }

  const { data: owner } = await db
    .from("tenant_usuarios")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("rol", "owner")
    .maybeSingle();
  if (!owner) return;

  const { data: usuario } = await db.auth.admin.getUserById(owner.user_id);
  const email = usuario?.user?.email;
  if (!email) return;

  const urlSuscripcion = `${SITIO}/admin/suscripcion`;
  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>No pudimos cobrar tu suscripción</title>
  </head>
  <body style="margin:0; padding:0; background-color:#F5F6F9;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      Actualiza tu método de pago para que ${negocioNombre} no pierda su plan.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background-color:#F5F6F9; padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
                 style="max-width:600px; width:100%; background-color:#FFFFFF; border:1px solid #E4E6ED; border-radius:16px;">
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-right:8px; vertical-align:middle;">
                      <img src="${SITIO}/logo-email.png" width="22" height="22" alt=""
                           style="display:block; width:22px; height:22px;" />
                    </td>
                    <td style="vertical-align:middle;">
                      <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:20px; font-weight:700; letter-spacing:-0.02em; color:#0B0B0F;">
                        Vibemenu
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 0 40px;">
                <h1 style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:30px; line-height:1.2; letter-spacing:-0.03em; font-weight:700; color:#0B0B0F;">
                  No pudimos cobrar tu suscripción.
                </h1>
                <p style="margin:18px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:1.6; color:#4B4E5A;">
                  El cobro de <strong style="color:#0B0B0F;">${negocioNombre}</strong> no pasó.
                  Vamos a reintentarlo en los próximos días, pero para no arriesgar tu plan,
                  actualiza tu método de pago cuando puedas.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:#2B4EFF; border-radius:12px;">
                      <a href="${urlSuscripcion}"
                         style="display:inline-block; padding:15px 28px; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; font-weight:600; color:#FFFFFF; text-decoration:none; border-radius:12px;">
                        Actualizar método de pago
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <div style="height:1px; background-color:#E4E6ED; line-height:1px; font-size:0;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 36px 40px;">
                <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; line-height:1.6; color:#4B4E5A;">
                  Si ya lo resolviste, ignora este correo — el siguiente intento lo confirma solo.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:12px; color:#4B4E5A;">
            Vibemenu · Menú digital con 4 formatos visuales
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Vibemenu <facturacion@vibemenu.com.mx>",
      to: [email],
      subject: `No pudimos cobrar la suscripción de ${negocioNombre}`,
      html,
    }),
  });

  if (!resp.ok) {
    console.error("resend_error al avisar pago fallido:", await resp.text());
  }
}

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

        // Reintento de Stripe del mismo evento: esta suscripcion ya quedo
        // activa. Sin este guard, abrirPeriodo() se repite y deja una fila
        // extra de historial marcada "reactivacion" por cada reintento.
        if (suscripcionId) {
          const { data: yaActiva } = await db
            .from("suscripciones")
            .select("id")
            .eq("stripe_subscription_id", suscripcionId)
            .eq("estado", "activa")
            .maybeSingle();
          if (yaActiva) break;
        }

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
        await db
          .from("suscripciones")
          .update({ fecha_renovacion: renovacionDe(s) })
          .eq("stripe_subscription_id", s.id)
          .eq("estado", "activa");

        if (s.status === "past_due" || s.status === "unpaid") {
          await cerrarPeriodo(s.id, "vencida");
        }

        // Cambio de plan sobre una suscripcion ya activa (ver crear-checkout):
        // la metadata trae el plan nuevo. Si difiere del vigente en la base,
        // se congela el precio de lista de HOY con el mismo stripe_subscription_id
        // -- no es un alta, es la misma suscripcion cambiando de item. Idempotente:
        // tras la primera corrida vigente.plan_id ya coincide y un reintento no-op.
        const { tenant_id, plan_id, moneda } = s.metadata ?? {};
        if (tenant_id && plan_id) {
          const { data: vigente } = await db
            .from("suscripciones")
            .select("plan_id")
            .eq("stripe_subscription_id", s.id)
            .eq("estado", "activa")
            .maybeSingle();

          if (vigente && vigente.plan_id !== plan_id) {
            await abrirPeriodo({
              tenantId: tenant_id,
              planId: plan_id,
              moneda: (moneda as "usd" | "mxn") ?? "usd",
              stripeSubscriptionId: s.id,
              fechaRenovacion: renovacionDe(s),
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        await cerrarPeriodo(evento.data.object.id, "cancelada");
        break;
      }

      case "invoice.paid": {
        const factura = evento.data.object;
        const suscripcionId =
          typeof factura.subscription === "string"
            ? factura.subscription
            : factura.subscription?.id;
        if (!suscripcionId) break;

        // El orden de llegada entre checkout.session.completed e invoice.paid no
        // esta garantizado. Si la fila de suscripciones todavia no existe, este
        // recibo puntual se pierde — aceptable para v1, no hay reintento.
        const { data: fila } = await db
          .from("suscripciones")
          .select("id, tenant_id")
          .eq("stripe_subscription_id", suscripcionId)
          .order("fecha_inicio", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!fila) break;

        // upsert + ignoreDuplicates: Stripe entrega el webhook al menos una vez,
        // un reintento no debe duplicar el recibo (stripe_invoice_id es unique).
        const { error } = await db.from("pagos").upsert(
          {
            tenant_id: fila.tenant_id,
            suscripcion_id: fila.id,
            monto: (factura.amount_paid ?? 0) / 100,
            moneda: (factura.currency ?? "usd").toLowerCase(),
            stripe_invoice_id: factura.id,
            stripe_hosted_invoice_url: factura.hosted_invoice_url ?? null,
          },
          { onConflict: "stripe_invoice_id", ignoreDuplicates: true },
        );
        if (error) throw error;
        break;
      }

      case "invoice.payment_failed": {
        const factura = evento.data.object;
        const suscripcionId =
          typeof factura.subscription === "string"
            ? factura.subscription
            : factura.subscription?.id;
        if (!suscripcionId) break;

        // No cambia estado: eso lo decide customer.subscription.updated cuando
        // Stripe agote sus reintentos y la suscripcion pase a past_due/unpaid.
        // Aqui solo se avisa, con la fila mas reciente de ese subscription_id
        // (activa o no -- un aviso tardio no hace daño, un aviso perdido si).
        const { data: fila } = await db
          .from("suscripciones")
          .select("tenant_id, tenants(nombre_negocio)")
          .eq("stripe_subscription_id", suscripcionId)
          .order("fecha_inicio", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!fila) break;

        const negocioNombre = (fila as { tenants: { nombre_negocio: string } | null }).tenants
          ?.nombre_negocio;
        if (negocioNombre) await avisarPagoFallido(fila.tenant_id, negocioNombre);
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
