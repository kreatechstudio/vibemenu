// Edge Function: enviar-bienvenida
//
// Correo de bienvenida, disparado desde `crearTenant()` (src/lib/registro.ts)
// justo despues del insert en `tenants` -- unico chokepoint de los 3 caminos
// que crean un negocio (Registro.tsx, Onboarding.tsx, asegurarTenantDelUsuario).
//
// A diferencia de invitar-encargado/aceptar-invitacion, esta funcion NUNCA
// necesita el service_role_key: solo manda un correo al propio usuario
// autenticado, sobre su propio tenant. Todo corre con su sesion, respetando
// RLS (tenant_usuarios_select ya exige pertenece_a_tenant).
//
// Si falla, no debe tumbar el registro: el llamador la invoca "fire and
// forget" y traga el error.
//
// Desplegar:
//   supabase functions deploy enviar-bienvenida --project-ref iaiiwtqqiaqxnzxjqcnt
//
// Secretos: SUPABASE_URL, SUPABASE_ANON_KEY, RESEND_API_KEY

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

const REMITENTE = "Vibemenu <hola@vibemenu.com.mx>";
const SITIO = "https://vibemenu.com.mx";

function plantillaBienvenida(opts: { negocioNombre: string; slug: string }) {
  const { negocioNombre, slug } = opts;
  const urlAdmin = `${SITIO}/admin`;
  const urlMenu = `${SITIO}/${slug}`;
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bienvenido a Vibemenu</title>
  </head>
  <body style="margin:0; padding:0; background-color:#F5F6F9;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      ${negocioNombre} ya tiene menú digital. Carga tus productos y comparte el QR.
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
                  ${negocioNombre} ya está en Vibemenu.
                </h1>
                <p style="margin:18px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:1.6; color:#4B4E5A;">
                  Tres pasos y tu carta queda lista para compartir por QR: carga tus productos,
                  elige el formato que más te guste y descarga tu código.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:#2B4EFF; border-radius:12px;">
                      <a href="${urlAdmin}"
                         style="display:inline-block; padding:15px 28px; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; font-weight:600; color:#FFFFFF; text-decoration:none; border-radius:12px;">
                        Ir a mi panel
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 0 40px;">
                <p style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; line-height:1.6; color:#4B4E5A;">
                  Tu menú público ya vive en esta dirección, aunque todavía esté vacío:
                </p>
                <p style="margin:8px 0 0 0; font-family:'SF Mono',Menlo,Consolas,monospace; font-size:12px; line-height:1.5; color:#2B4EFF; word-break:break-all;">
                  ${urlMenu}
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
  if (!user?.email) return json({ error: "sin_sesion" }, 401);

  // RLS de tenant_usuarios_select ya exige pertenece_a_tenant: esto solo puede
  // devolver el tenant propio de quien llama, nunca el de otro negocio.
  const { data: fila, error } = await comoUsuario
    .from("tenant_usuarios")
    .select("tenant:tenants(nombre_negocio, slug)")
    .limit(1)
    .maybeSingle();

  if (error) return json({ error: error.message }, 400);
  if (!fila?.tenant) return json({ error: "sin_tenant_todavia" }, 400);

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json({ error: "falta_RESEND_API_KEY" }, 500);

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: REMITENTE,
      to: [user.email],
      subject: `${fila.tenant.nombre_negocio} ya está en Vibemenu`,
      html: plantillaBienvenida({
        negocioNombre: fila.tenant.nombre_negocio,
        slug: fila.tenant.slug,
      }),
    }),
  });

  if (!resp.ok) {
    return json({ error: "no_pudimos_enviar_el_correo", detail: await resp.text() }, 502);
  }

  return json({ ok: true });
});
