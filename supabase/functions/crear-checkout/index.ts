// Edge Function: crear-checkout
//
// Abre una sesión de Stripe Checkout para un plan. El precio NO viaja desde el
// navegador: se lee de la tabla `planes` con el service_role_key. Si viniera del
// cliente, cualquiera podría suscribirse a Pro por un peso.
//
// Desplegar:
//   supabase functions deploy crear-checkout --project-ref iaiiwtqqiaqxnzxjqcnt
//
// Secretos: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY

import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  // supabase-js SIEMPRE manda x-client-info y apikey. Si no se permiten aqui,
  // el navegador bloquea la peticion real y el fallo llega como un error de red,
  // no como un 4xx: parece que la funcion no existe.
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!Deno.env.get("STRIPE_SECRET_KEY")) {
    return json({ error: "falta_STRIPE_SECRET_KEY" }, 500);
  }

  const autorizacion = req.headers.get("Authorization");
  if (!autorizacion) return json({ error: "sin_sesion" }, 401);

  const {
    tenant_id,
    plan_id,
    moneda,
    intervalo = "mensual",
    url_retorno,
  } = await req.json().catch(() => ({}));
  if (!tenant_id || !plan_id) return json({ error: "faltan_datos" }, 400);
  if (moneda !== "usd" && moneda !== "mxn") return json({ error: "moneda_invalida" }, 400);
  if (intervalo !== "mensual" && intervalo !== "anual") {
    return json({ error: "intervalo_invalido" }, 400);
  }

  // Solo el dueño paga. Se valida con la sesión de quien llama, no con el body.
  const comoUsuario = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: autorizacion } },
    },
  );

  const { data: esOwner } = await comoUsuario.rpc("es_owner_de_tenant", {
    check_tenant_id: tenant_id,
  });
  if (!esOwner) return json({ error: "solo_el_owner_paga" }, 403);

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: plan, error: errorPlan } = await db
    .from("planes")
    .select(
      "nombre, stripe_price_id_usd, stripe_price_id_mxn, stripe_price_id_usd_anual, stripe_price_id_mxn_anual, precio_usd",
    )
    .eq("id", plan_id)
    .single();
  if (errorPlan) return json({ error: errorPlan.message }, 400);

  if (plan.precio_usd === 0) return json({ error: "el_plan_free_no_se_cobra" }, 400);

  const priceId =
    intervalo === "anual"
      ? moneda === "mxn"
        ? plan.stripe_price_id_mxn_anual
        : plan.stripe_price_id_usd_anual
      : moneda === "mxn"
        ? plan.stripe_price_id_mxn
        : plan.stripe_price_id_usd;
  if (!priceId) return json({ error: "falta_stripe_price_id" }, 400);

  const { data: tenant } = await db
    .from("tenants")
    .select("stripe_customer_id, nombre_negocio")
    .eq("id", tenant_id)
    .single();

  // Si ya hay una suscripción activa, esto es un cambio de plan, no un alta:
  // se modifica la suscripción existente en Stripe en vez de abrir un Checkout
  // nuevo. Antes esto creaba una SEGUNDA suscripción cobrando en paralelo.
  const { data: vigente } = await db
    .from("suscripciones")
    .select("stripe_subscription_id")
    .eq("tenant_id", tenant_id)
    .eq("estado", "activa")
    .maybeSingle();

  if (vigente?.stripe_subscription_id) {
    const suscripcion = await stripeClient().subscriptions.retrieve(vigente.stripe_subscription_id);
    const item = suscripcion.items.data[0];
    if (!item) return json({ error: "suscripcion_sin_items" }, 400);

    await stripeClient().subscriptions.update(vigente.stripe_subscription_id, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: "create_prorations",
      // El webhook de customer.subscription.updated compara este plan_id
      // contra el vigente en la base para decidir si abre un periodo nuevo.
      metadata: { tenant_id, plan_id, moneda, intervalo },
    });

    return json({ ok: true });
  }

  const sesion = await stripeClient().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer: tenant?.stripe_customer_id ?? undefined,
    client_reference_id: tenant_id,
    // El webhook lee esto para saber a quién y a qué plan pertenece el pago.
    // `intervalo` es solo trazabilidad -- abrirPeriodo() sigue congelando el
    // precio de lista MENSUAL sin importar como se cobre, porque Stripe ya
    // protege el monto real de la suscripcion por su cuenta.
    metadata: { tenant_id, plan_id, moneda, intervalo },
    subscription_data: { metadata: { tenant_id, plan_id, moneda, intervalo } },
    success_url: `${url_retorno}?checkout=ok`,
    cancel_url: `${url_retorno}?checkout=cancelado`,
  });

  return json({ url: sesion.url });
});
