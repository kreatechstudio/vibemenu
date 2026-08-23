// Edge Function: verificar-dominios-pendientes
//
// Dos formas de dispararla:
//   1. Cron diario (.github/workflows/verificar-dominios.yml), protegida por
//      DOMINIO_CRON_SECRET -- mismo patron que procesar-trials-vencidos.
//      Revisa TODOS los tenants en dominio_estado = 'pendiente'.
//   2. Boton "Verificar ahora" en SuperAdmin.tsx, con la sesion del propio
//      super-admin (sin secreto: la tabla `super_admins` con su RLS de
//      "solo tu propia fila" ya es la autorizacion). Revisa un tenant.
//
// POST /verify (no solo GET) para forzar a Vercel a re-evaluar el DNS en el
// momento, en vez de leer un estado que pudo quedar cacheado.
//
// Desplegar:
//   supabase functions deploy verificar-dominios-pendientes --project-ref iaiiwtqqiaqxnzxjqcnt
//
// Secretos: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//           VERCEL_API_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID,
//           DOMINIO_CRON_SECRET, RESEND_API_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";

const SITIO = "https://vibemenu.com.mx";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function plantillaDominioListo(negocioNombre: string, dominio: string) {
  const urlEmpresa = `${SITIO}/admin/empresa`;
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tu dominio ya está listo</title>
  </head>
  <body style="margin:0; padding:0; background-color:#F5F6F9;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      ${dominio} ya está sirviendo el menú de ${negocioNombre}.
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
                  Tu dominio ya está listo.
                </h1>
                <p style="margin:18px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:1.6; color:#4B4E5A;">
                  <strong style="color:#0B0B0F;">${dominio}</strong> ya está sirviendo el menú de
                  ${negocioNombre}, sin pasar por vibemenu.com.mx.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:#2B4EFF; border-radius:12px;">
                      <a href="${urlEmpresa}"
                         style="display:inline-block; padding:15px 28px; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; font-weight:600; color:#FFFFFF; text-decoration:none; border-radius:12px;">
                        Ver mi negocio
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
                <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; font-weight:600; color:#0B0B0F;">
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

type TenantPendiente = { id: string; nombre_negocio: string; dominio_personalizado: string };

async function verificarUno(
  vercelToken: string,
  vercelProject: string,
  vercelTeam: string,
  t: TenantPendiente,
) {
  const resp = await fetch(
    `https://api.vercel.com/v9/projects/${vercelProject}/domains/${t.dominio_personalizado}/verify?teamId=${vercelTeam}`,
    { method: "POST", headers: { Authorization: `Bearer ${vercelToken}` } },
  );

  if (!resp.ok) {
    const detalle = await resp.text();
    console.error(
      `vercel_verify_fallo (${resp.status}) para ${t.dominio_personalizado}:`,
      detalle,
    );
    // Un 404 aqui significa que el dominio nunca se registro en Vercel (p.ej. el intento
    // inicial de agregar-dominio-vercel fallo, o los secretos apenas se configuraron). Lo
    // agregamos ahora; la siguiente corrida del cron ya lo encuentra y lo verifica -- asi el
    // reintento automatico que promete el spec y el comentario de esta funcion es real.
    if (resp.status === 404) {
      const alta = await fetch(
        `https://api.vercel.com/v10/projects/${vercelProject}/domains?teamId=${vercelTeam}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: t.dominio_personalizado }),
        },
      );
      if (!alta.ok) {
        console.error(
          `vercel_add_domain_fallo (${alta.status}) para ${t.dominio_personalizado}:`,
          await alta.text(),
        );
      }
    }
    return false;
  }

  const data = (await resp.json()) as { verified?: boolean };
  if (!data.verified) return false;

  const { error: errorEstado } = await db
    .from("tenants")
    .update({ dominio_estado: "verificado" })
    .eq("id", t.id);
  if (errorEstado) {
    console.error("no se pudo marcar dominio_estado='verificado' para", t.id, errorEstado);
    return false;
  }

  const { data: owner } = await db
    .from("tenant_usuarios")
    .select("user_id")
    .eq("tenant_id", t.id)
    .eq("rol", "owner")
    .maybeSingle();
  if (!owner) return true;

  const { data: usuario } = await db.auth.admin.getUserById(owner.user_id);
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!usuario?.user?.email || !apiKey) return true;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Vibemenu <hola@vibemenu.com.mx>",
      to: [usuario.user.email],
      subject: `${t.dominio_personalizado} ya está listo`,
      html: plantillaDominioListo(t.nombre_negocio, t.dominio_personalizado),
    }),
  }).catch((e) => console.error("no se pudo avisar dominio listo a", t.id, e));

  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const vercelToken = Deno.env.get("VERCEL_API_TOKEN");
  const vercelProject = Deno.env.get("VERCEL_PROJECT_ID");
  const vercelTeam = Deno.env.get("VERCEL_TEAM_ID");
  if (!vercelToken || !vercelProject || !vercelTeam) {
    return json({ error: "falta_configuracion_vercel" }, 500);
  }

  const secretoCron = Deno.env.get("DOMINIO_CRON_SECRET");
  const esCron = Boolean(secretoCron) && req.headers.get("x-cron-secret") === secretoCron;

  let tenants: TenantPendiente[] = [];

  if (esCron) {
    const { data, error } = await db
      .from("tenants")
      .select("id, nombre_negocio, dominio_personalizado")
      .eq("dominio_estado", "pendiente")
      .not("dominio_personalizado", "is", null);
    if (error) return json({ error: error.message }, 500);
    tenants = (data ?? []) as TenantPendiente[];
  } else {
    // No es el cron: exige sesion de un super_admin, y solo revisa un tenant.
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

    // RLS de super_admins solo deja leer la propia fila: si no existe, no es admin.
    const { data: esAdmin } = await comoUsuario
      .from("super_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!esAdmin) return json({ error: "sin_permiso" }, 403);

    let tenantId: string | undefined;
    try {
      ({ tenant_id: tenantId } = await req.json());
    } catch {
      return json({ error: "body_invalido" }, 400);
    }
    if (!tenantId) return json({ error: "falta_tenant_id" }, 400);

    const { data, error } = await db
      .from("tenants")
      .select("id, nombre_negocio, dominio_personalizado")
      .eq("id", tenantId)
      .eq("dominio_estado", "pendiente")
      .not("dominio_personalizado", "is", null);
    if (error) return json({ error: error.message }, 500);
    tenants = (data ?? []) as TenantPendiente[];
  }

  let verificados = 0;
  for (const t of tenants) {
    try {
      if (await verificarUno(vercelToken, vercelProject, vercelTeam, t)) verificados++;
    } catch (e) {
      console.error("error verificando", t.id, e);
    }
  }

  return json({ ok: true, revisados: tenants.length, verificados });
});
