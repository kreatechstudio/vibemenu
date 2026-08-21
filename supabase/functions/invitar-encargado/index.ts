// Edge Function: invitar-encargado
//
// Crea (o reenvia) una invitacion propia en la tabla `invitaciones` y manda el
// correo con el diseño de Vibemenu via Resend. Reemplaza el uso anterior de
// auth.admin.inviteUserByEmail: ese metodo loguea al invitado de inmediato con
// el template generico de Supabase, sin marca y sin forma de decidir "creas
// cuenta nueva" vs "ya tienes una en otro negocio" antes de vincularlo.
//
// Desplegar:
//   supabase functions deploy invitar-encargado --project-ref iaiiwtqqiaqxnzxjqcnt
//
// Secretos que necesita (Dashboard → Edge Functions → Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, RESEND_API_KEY
//
// Requiere la migracion vibemenu_migracion_invitaciones.sql aplicada.
//
// El limite de usuarios NO se valida aqui: lo impone el trigger
// `trg_limite_usuarios` cuando la invitacion se acepta (ver aceptar-invitacion),
// que es el momento real en que se inserta en tenant_usuarios. El plan pudo
// cambiar entre el envio y la aceptacion; validar aqui tambien seria una
// foto vieja.

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

const REMITENTE = "Vibemenu <invitaciones@vibemenu.com.mx>";
const SITIO = "https://vibemenu.com.mx";

function plantillaInvitacion(opts: {
  negocioNombre: string;
  invitanteNombre: string;
  url: string;
}) {
  const { negocioNombre, invitanteNombre, url } = opts;
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Te invitaron a Vibemenu</title>
  </head>
  <body style="margin:0; padding:0; background-color:#F5F6F9;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      ${invitanteNombre} te dio acceso para administrar el menú de ${negocioNombre}.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background-color:#F5F6F9; padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
                 style="max-width:600px; width:100%; background-color:#FFFFFF; border:1px solid #E4E6ED; border-radius:16px;">
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:20px; font-weight:700; letter-spacing:-0.02em; color:#0B0B0F;">
                  Vibemenu
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 0 40px;">
                <h1 style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:30px; line-height:1.2; letter-spacing:-0.03em; font-weight:700; color:#0B0B0F;">
                  Te invitaron a administrar un menú.
                </h1>
                <p style="margin:18px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:1.6; color:#4B4E5A;">
                  <strong style="color:#0B0B0F;">${invitanteNombre}</strong> te dio acceso como encargado de
                  <strong style="color:#0B0B0F;">${negocioNombre}</strong> en Vibemenu. Vas a poder
                  actualizar la carta, sin tocar la facturación del negocio.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:#2B4EFF; border-radius:12px;">
                      <a href="${url}"
                         style="display:inline-block; padding:15px 28px; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; font-weight:600; color:#FFFFFF; text-decoration:none; border-radius:12px;">
                        Aceptar invitación
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 0 40px;">
                <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; line-height:1.6; color:#4B4E5A;">
                  ¿No funciona el botón? Copia y pega esta dirección en tu navegador:
                </p>
                <p style="margin:8px 0 0 0; font-family:'SF Mono',Menlo,Consolas,monospace; font-size:12px; line-height:1.5; color:#2B4EFF; word-break:break-all;">
                  ${url}
                </p>
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
                  Este enlace caduca en 7 días y es personal — no lo reenvíes. Si no esperabas esta
                  invitación, ignora el correo.
                </p>
                <p style="margin:16px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; font-weight:600; color:#0B0B0F;">
                  Tu menú, tu formato.
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
}

async function enviarCorreoInvitacion(opts: {
  email: string;
  negocioNombre: string;
  invitanteNombre: string;
  token: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("falta_RESEND_API_KEY");

  const url = `${SITIO}/invitacion/${opts.token}`;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: REMITENTE,
      to: [opts.email],
      subject: `${opts.invitanteNombre} te invitó a administrar ${opts.negocioNombre} en Vibemenu`,
      html: plantillaInvitacion({
        negocioNombre: opts.negocioNombre,
        invitanteNombre: opts.invitanteNombre,
        url,
      }),
    }),
  });

  if (!resp.ok) {
    throw new Error(`resend_error: ${await resp.text()}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const autorizacion = req.headers.get("Authorization");
  if (!autorizacion) return json({ error: "sin_sesion" }, 401);

  const { tenant_id, email } = await req.json().catch(() => ({}));
  if (!tenant_id || !email) return json({ error: "faltan_datos" }, 400);

  const correo = String(email).trim().toLowerCase();

  // Cliente con la sesion de quien llama: comprueba que es el owner de ese
  // tenant respetando RLS. Nunca se confia en el tenant_id del body.
  const comoUsuario = createClient(url, anon, {
    global: { headers: { Authorization: autorizacion } },
  });

  const { data: esOwner, error: errorOwner } = await comoUsuario.rpc("es_owner_de_tenant", {
    check_tenant_id: tenant_id,
  });
  if (errorOwner) return json({ error: errorOwner.message }, 400);
  if (!esOwner) return json({ error: "solo_el_owner_invita" }, 403);

  const {
    data: { user: quienInvita },
  } = await comoUsuario.auth.getUser();

  const comoAdmin = createClient(url, service, { auth: { persistSession: false } });

  const { data: tenant, error: errorTenant } = await comoAdmin
    .from("tenants")
    .select("nombre_negocio")
    .eq("id", tenant_id)
    .single();
  if (errorTenant) return json({ error: errorTenant.message }, 400);

  // ¿Ese correo ya tiene cuenta? listUsers() es lo unico que ofrece el admin
  // API para buscar por email hasta hoy. Por defecto pagina de a 50 -- con
  // perPage alto alcanza para el tamaño actual de la plataforma, pero es un
  // limite real: pasando ese numero de usuarios totales hay que cambiar esto
  // por un filtro directo por email si Supabase llega a exponerlo.
  const { data: listaUsuarios } = await comoAdmin.auth.admin.listUsers({ perPage: 1000 });
  const existente = listaUsuarios?.users.find((u) => u.email?.toLowerCase() === correo);

  if (existente) {
    const { data: yaEnTenant } = await comoAdmin
      .from("tenant_usuarios")
      .select("tenant_id")
      .eq("user_id", existente.id)
      .maybeSingle();

    if (yaEnTenant?.tenant_id === tenant_id) {
      return json({ error: "ya_es_parte_del_equipo" }, 400);
    }
    if (yaEnTenant) {
      return json({ error: "correo_ya_administra_otro_negocio" }, 400);
    }
  }

  // Reenviar (o volver a invitar tras remover a alguien) reutiliza la misma
  // fila -- mismo token, nueva vigencia -- en vez de duplicar: el indice unico
  // uniq_invitacion_por_tenant_correo lo exige.
  const { data: invitacion, error: errorInvitacion } = await comoAdmin
    .from("invitaciones")
    .upsert(
      {
        tenant_id,
        email: correo,
        invitado_por: quienInvita!.id,
        estado: "pendiente",
        expira_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "tenant_id,email", ignoreDuplicates: false },
    )
    .select("token")
    .single();

  if (errorInvitacion) return json({ error: errorInvitacion.message }, 400);

  const invitanteNombre =
    (quienInvita?.user_metadata?.full_name as string | undefined) ??
    (quienInvita?.user_metadata?.name as string | undefined) ??
    quienInvita!.email!;

  try {
    await enviarCorreoInvitacion({
      email: correo,
      negocioNombre: tenant.nombre_negocio,
      invitanteNombre,
      token: invitacion.token,
    });
  } catch (err) {
    return json({ error: "no_pudimos_enviar_el_correo", detail: (err as Error).message }, 502);
  }

  return json({ ok: true });
});
