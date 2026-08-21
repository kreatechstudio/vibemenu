// Edge Function: aceptar-invitacion
//
// Resuelve /invitacion/:token. Es el punto donde se decide, de forma explicita,
// si el invitado crea una cuenta nueva o se une con una que ya tenia — nunca
// silencioso. Casos que cubre:
//
//   1. Correo sin cuenta todavia -> crea el usuario (con la password que puso
//      en el formulario) y lo vincula al tenant en el mismo paso.
//   2. Correo con cuenta existente, sin sesion activa (o con sesion de OTRO
//      correo) -> no vincula nada. Pide iniciar sesion con ESE correo primero.
//   3. Correo con cuenta existente que YA administra otro negocio -> rechaza
//      con un error explicito. `uniq_tenant_por_usuario` (ver migracion
//      vibemenu_migracion_invitaciones.sql) lo impediria de todas formas a
//      nivel de base, pero aqui se devuelve un mensaje claro en vez de un
//      unique_violation crudo.
//   4. Correo con cuenta existente, sin tenant propio, con sesion activa que
//      coincide -> vincula directo.
//
// Desplegar:
//   supabase functions deploy aceptar-invitacion --project-ref iaiiwtqqiaqxnzxjqcnt
//
// Secretos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

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

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const { token, password } = await req.json().catch(() => ({}));
  if (!token) return json({ error: "faltan_datos" }, 400);

  const comoAdmin = createClient(url, service, { auth: { persistSession: false } });

  const { data: invitacion, error: errorInvitacion } = await comoAdmin
    .from("invitaciones")
    .select("id, tenant_id, email, estado, expira_at")
    .eq("token", token)
    .maybeSingle();

  if (errorInvitacion) return json({ error: errorInvitacion.message }, 400);
  if (!invitacion) return json({ error: "invitacion_no_encontrada" }, 404);
  if (invitacion.estado === "cancelada") return json({ error: "invitacion_cancelada" }, 400);
  if (invitacion.estado === "aceptada") return json({ error: "invitacion_ya_aceptada" }, 400);
  if (new Date(invitacion.expira_at) < new Date()) {
    return json({ error: "invitacion_vencida" }, 400);
  }

  const correo = invitacion.email.toLowerCase();

  // Autenticacion opcional: functions.invoke siempre manda un Authorization
  // (cae a la anon key si no hay sesion), asi que la unica forma confiable de
  // saber si hay una persona real logueada es preguntarle a Auth.
  const autorizacion = req.headers.get("Authorization");
  let sesionActual: { id: string; email: string } | null = null;
  if (autorizacion) {
    const comoUsuario = createClient(url, anon, {
      global: { headers: { Authorization: autorizacion } },
    });
    const { data } = await comoUsuario.auth.getUser();
    if (data.user?.email) sesionActual = { id: data.user.id, email: data.user.email.toLowerCase() };
  }

  // Mismo limite de paginado que invitar-encargado -- ver el comentario ahi.
  const { data: listaUsuarios } = await comoAdmin.auth.admin.listUsers({ perPage: 1000 });
  const existente = listaUsuarios?.users.find((u) => u.email?.toLowerCase() === correo);

  async function vincular(userId: string) {
    const { error: errorVinculo } = await comoAdmin
      .from("tenant_usuarios")
      .insert({ tenant_id: invitacion!.tenant_id, user_id: userId, rol: "encargado" });
    // trg_limite_usuarios puede rechazarlo si el plan ya topo; el mensaje real
    // viaja en errorVinculo.message/.details, igual que en invitar-encargado.
    if (errorVinculo) return errorVinculo;

    await comoAdmin
      .from("invitaciones")
      .update({ estado: "aceptada", aceptada_at: new Date().toISOString() })
      .eq("id", invitacion!.id);

    return null;
  }

  if (existente) {
    const { data: yaEnTenant } = await comoAdmin
      .from("tenant_usuarios")
      .select("tenant_id")
      .eq("user_id", existente.id)
      .maybeSingle();

    // Doble click o el mismo invitado aceptando dos veces: no es un error.
    if (yaEnTenant?.tenant_id === invitacion.tenant_id) {
      await comoAdmin
        .from("invitaciones")
        .update({ estado: "aceptada", aceptada_at: new Date().toISOString() })
        .eq("id", invitacion.id);
      return json({ ok: true });
    }

    if (yaEnTenant) {
      return json({ error: "correo_ya_administra_otro_negocio" }, 400);
    }

    if (!sesionActual || sesionActual.email !== correo) {
      // No basta con saber el token: si ya existe cuenta, hay que probar que
      // se tiene la contraseña (o la sesion de Google) de ESE correo antes de
      // vincularlo a un negocio nuevo.
      return json({ error: "inicia_sesion_para_aceptar", requiere_login: true }, 401);
    }

    const errorVinculo = await vincular(existente.id);
    if (errorVinculo)
      return json({ error: errorVinculo.message, detail: errorVinculo.details }, 400);
    return json({ ok: true });
  }

  // Correo sin cuenta: la crea con la password que puso en el formulario.
  // email_confirm:true porque el token del correo YA es la prueba de que el
  // destinatario controla esa bandeja de entrada.
  if (!password || String(password).length < 6) {
    return json({ error: "falta_password" }, 400);
  }

  const { data: nuevoUsuario, error: errorCrear } = await comoAdmin.auth.admin.createUser({
    email: correo,
    password: String(password),
    email_confirm: true,
  });
  if (errorCrear || !nuevoUsuario.user) {
    return json({ error: errorCrear?.message ?? "no_pudimos_crear_la_cuenta" }, 400);
  }

  const errorVinculo = await vincular(nuevoUsuario.user.id);
  if (errorVinculo) return json({ error: errorVinculo.message, detail: errorVinculo.details }, 400);

  return json({ ok: true, creado: true });
});
