// Edge Function: invitar-encargado
//
// Crear un usuario en Auth exige el service_role_key. Ese secreto vive AQUI y en
// ningun otro lado — jamas en el frontend, jamas en el repo.
//
// Desplegar:
//   supabase functions deploy invitar-encargado --project-ref iaiiwtqqiaqxnzxjqcnt
//
// Secretos que necesita (Dashboard → Edge Functions → Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
//
// El limite de usuarios NO se valida aqui: lo impone el trigger
// `trg_limite_usuarios` al insertar en tenant_usuarios. Si el plan ya topo,
// el insert falla y se devuelve el slug tal cual para que el frontend lo traduzca.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const autorizacion = req.headers.get("Authorization");
  if (!autorizacion) return json({ error: "sin_sesion" }, 401);

  const { tenant_id, email } = await req.json().catch(() => ({}));
  if (!tenant_id || !email) return json({ error: "faltan_datos" }, 400);

  // Cliente con la sesion de quien llama: sirve para comprobar que es el owner
  // de ese tenant, respetando RLS. Nunca se confia en el tenant_id del body.
  const comoUsuario = createClient(url, anon, {
    global: { headers: { Authorization: autorizacion } },
  });

  const { data: esOwner, error: errorOwner } = await comoUsuario.rpc("es_owner_de_tenant", {
    check_tenant_id: tenant_id,
  });
  if (errorOwner) return json({ error: errorOwner.message }, 400);
  if (!esOwner) return json({ error: "solo_el_owner_invita" }, 403);

  const comoAdmin = createClient(url, service, { auth: { persistSession: false } });

  // Si el correo ya existe, no se crea de nuevo: se reutiliza ese usuario.
  const { data: invitado, error: errorInvitacion } =
    await comoAdmin.auth.admin.inviteUserByEmail(email);

  let userId = invitado?.user?.id;

  if (errorInvitacion) {
    const yaExiste = /already been registered|already exists/i.test(errorInvitacion.message);
    if (!yaExiste) return json({ error: errorInvitacion.message }, 400);

    const { data: lista } = await comoAdmin.auth.admin.listUsers();
    userId = lista?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (!userId) return json({ error: "no_encontramos_ese_usuario" }, 400);
  }

  // El trigger trg_limite_usuarios rechaza esto si el plan no da para mas.
  const { error: errorVinculo } = await comoAdmin
    .from("tenant_usuarios")
    .insert({ tenant_id, user_id: userId, rol: "encargado" });

  if (errorVinculo) {
    // `message` trae el slug del trigger; `details`, el numero real del plan.
    return json({ error: errorVinculo.message, detail: errorVinculo.details }, 400);
  }

  return json({ ok: true, user_id: userId });
});
