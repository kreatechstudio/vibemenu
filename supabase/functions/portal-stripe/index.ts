// Edge Function: portal-stripe
//
// Abre el Customer Portal de Stripe, donde el dueño cambia su tarjeta, descarga
// facturas o cancela. Necesita `tenants.stripe_customer_id`, que escribe el
// webhook al completarse el primer checkout.
//
// Desplegar:
//   supabase functions deploy portal-stripe --project-ref iaiiwtqqiaqxnzxjqcnt
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

  const { tenant_id, url_retorno } = await req.json().catch(() => ({}));
  if (!tenant_id) return json({ error: "faltan_datos" }, 400);

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
  if (!esOwner) return json({ error: "solo_el_owner_factura" }, 403);

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: tenant } = await db
    .from("tenants")
    .select("stripe_customer_id")
    .eq("id", tenant_id)
    .single();

  if (!tenant?.stripe_customer_id) return json({ error: "sin_customer_de_stripe" }, 400);

  const sesion = await stripeClient().billingPortal.sessions.create({
    customer: tenant.stripe_customer_id,
    return_url: url_retorno,
  });

  return json({ url: sesion.url });
});
