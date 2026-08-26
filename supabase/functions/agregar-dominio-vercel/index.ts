// Edge Function: agregar-dominio-vercel
//
// Se invoca desde Empresa.tsx justo despues de guardar un dominio_personalizado
// nuevo -- fire and forget, mismo patron que enviar-bienvenida: si esto falla,
// el tenant ya guardo su dominio de todos modos (dominio_estado se queda en
// 'pendiente', puesto por el trigger validar_dominio_tenant). El cron de
// verificar-dominios-pendientes vuelve a intentarlo despues sin que nadie
// tenga que reintentar nada a mano.
//
// Relee el dominio con service_role en vez de confiar en lo que mande el
// cliente: la unica fuente de verdad es la fila de `tenants`.
//
// Desplegar:
//   supabase functions deploy agregar-dominio-vercel --project-ref iaiiwtqqiaqxnzxjqcnt
//
// Secretos: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//           VERCEL_API_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const autorizacion = req.headers.get("Authorization");
  if (!autorizacion) return json({ error: "sin_sesion" }, 401);

  const comoUsuario = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: autorizacion } } },
  );

  const {
    data: { user },
  } = await comoUsuario.auth.getUser();
  if (!user) return json({ error: "sin_sesion" }, 401);

  let tenantId: string | undefined;
  try {
    ({ tenant_id: tenantId } = await req.json());
  } catch {
    return json({ error: "body_invalido" }, 400);
  }
  if (!tenantId) return json({ error: "falta_tenant_id" }, 400);

  // RLS de tenant_usuarios_select exige pertenece_a_tenant: si quien llama no
  // pertenece a este tenant, la consulta de abajo (con la sesion del usuario,
  // no con service_role) simplemente no encuentra nada.
  const { data: pertenece } = await comoUsuario
    .from("tenant_usuarios")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!pertenece) return json({ error: "sin_permiso" }, 403);

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: tenant, error: errorTenant } = await db
    .from("tenants")
    .select("dominio_personalizado")
    .eq("id", tenantId)
    .single();

  if (errorTenant) return json({ error: errorTenant.message }, 400);
  if (!tenant.dominio_personalizado) return json({ error: "sin_dominio" }, 400);

  const vercelToken = Deno.env.get("VERCEL_API_TOKEN");
  const vercelProject = Deno.env.get("VERCEL_PROJECT_ID");
  const vercelTeam = Deno.env.get("VERCEL_TEAM_ID");
  if (!vercelToken || !vercelProject || !vercelTeam) {
    return json({ error: "falta_configuracion_vercel" }, 500);
  }

  const resp = await fetch(
    `https://api.vercel.com/v10/projects/${vercelProject}/domains?teamId=${vercelTeam}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: tenant.dominio_personalizado }),
    },
  );

  // No se propaga como error al cliente en ningun caso -- fire and forget.
  // Si Vercel dice "ya existe" (el dominio se agrego antes, a mano o por un
  // guardado previo) tambien cuenta como exito: el objetivo ya esta cumplido.
  const cuerpo = await resp.text();
  if (!resp.ok) {
    console.error(
      `vercel_add_domain_fallo (${resp.status}) para ${tenant.dominio_personalizado}:`,
      cuerpo,
    );
  }

  return json({ ok: true, vercel_status: resp.status });
});
