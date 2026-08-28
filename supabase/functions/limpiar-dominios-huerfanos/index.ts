// Edge Function: limpiar-dominios-huerfanos
//
// Barrido nocturno (.github/workflows/limpiar-dominios.yml), protegido por
// DOMINIO_CRON_SECRET -- mismo patron que verificar-dominios-pendientes.
//
// Borra del proyecto de Vercel los dominios que ya ningun tenant usa. La cola
// la llena el trigger validar_dominio_tenant() cada vez que un tenant cambia,
// quita, o pierde (por downgrade) su dominio. Ver
// docs/superpowers/specs/2026-08-28-endurecer-dominios-design.md
//
// Desplegar:
//   supabase functions deploy limpiar-dominios-huerfanos --project-ref iaiiwtqqiaqxnzxjqcnt
//
// Secretos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VERCEL_API_TOKEN,
//           VERCEL_PROJECT_ID, VERCEL_TEAM_ID, DOMINIO_CRON_SECRET, RESEND_API_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";
import { fetchVercelConReintento, RateLimitError, urlBorrarDominio } from "../_shared/vercel.ts";

const SITIO = "https://vibemenu.com.mx";

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function plantillaDominioDesactivado(negocioNombre: string, dominio: string) {
  const urlSuscripcion = `${SITIO}/admin/suscripcion`;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Tu dominio propio se desactivó</title></head>
<body style="margin:0;padding:0;background-color:#F5F6F9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F6F9;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E4E6ED;border-radius:16px;">
        <tr><td style="padding:32px 40px 0 40px;">
          <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#0B0B0F;">Vibemenu</span>
        </td></tr>
        <tr><td style="padding:28px 40px 0 40px;">
          <h1 style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;line-height:1.2;letter-spacing:-0.03em;font-weight:700;color:#0B0B0F;">Tu dominio propio se desactivó.</h1>
          <p style="margin:18px 0 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#4B4E5A;">
            <strong style="color:#0B0B0F;">${dominio}</strong> dejó de servir el menú de ${negocioNombre} porque tu plan ya no incluye dominio propio. Tu menú sigue disponible en vibemenu.com.mx. Si vuelves a Pro, puedes reconectarlo desde tu panel.
          </p>
        </td></tr>
        <tr><td style="padding:32px 40px 40px 40px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#2B4EFF;border-radius:12px;">
            <a href="${urlSuscripcion}" style="display:inline-block;padding:15px 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:12px;">Ver mi plan</a>
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function avisarDesactivado(tenantId: string, dominio: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return;
  const { data: t } = await db
    .from("tenants")
    .select("nombre_negocio")
    .eq("id", tenantId)
    .maybeSingle();
  const { data: owner } = await db
    .from("tenant_usuarios")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("rol", "owner")
    .maybeSingle();
  if (!owner) return;
  const { data: usuario } = await db.auth.admin.getUserById(owner.user_id);
  if (!usuario?.user?.email) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Vibemenu <hola@vibemenu.com.mx>",
      to: [usuario.user.email],
      subject: `${dominio} ya no sirve tu menú`,
      html: plantillaDominioDesactivado(t?.nombre_negocio ?? "tu negocio", dominio),
    }),
  }).catch((e) => console.error("no se pudo avisar desactivado a", tenantId, e));
}

Deno.serve(async (req) => {
  const secreto = Deno.env.get("DOMINIO_CRON_SECRET");
  if (!secreto || req.headers.get("x-cron-secret") !== secreto) {
    return json({ error: "no_autorizado" }, 401);
  }

  const vercelToken = Deno.env.get("VERCEL_API_TOKEN");
  const vercelProject = Deno.env.get("VERCEL_PROJECT_ID");
  const vercelTeam = Deno.env.get("VERCEL_TEAM_ID");
  if (!vercelToken || !vercelProject || !vercelTeam) {
    return json({ error: "falta_configuracion_vercel" }, 500);
  }

  const { data: filas, error } = await db
    .from("dominios_huerfanos")
    .select("dominio, tenant_id")
    .is("borrado_at", null);
  if (error) return json({ error: error.message }, 500);

  let borrados = 0;
  let corteRateLimit = false;

  for (const fila of filas ?? []) {
    try {
      // Guard anti-borrado: alguien pudo re-agregar el dominio.
      const { data: enUso } = await db
        .from("tenants")
        .select("id")
        .eq("dominio_personalizado", fila.dominio)
        .maybeSingle();
      if (enUso) {
        await db
          .from("dominios_huerfanos")
          .update({ borrado_at: new Date().toISOString() })
          .eq("dominio", fila.dominio);
        continue;
      }

      const resp = await fetchVercelConReintento(
        urlBorrarDominio(vercelProject, vercelTeam, fila.dominio),
        { method: "DELETE", headers: { Authorization: `Bearer ${vercelToken}` } },
      );

      if (resp.ok || resp.status === 404) {
        await resp.body?.cancel();
        await db
          .from("dominios_huerfanos")
          .update({ borrado_at: new Date().toISOString() })
          .eq("dominio", fila.dominio);
        borrados++;

        // Correo solo si fue una revocacion por downgrade.
        if (fila.tenant_id) {
          const { data: t } = await db
            .from("tenants")
            .select("dominio_revocado_por_plan")
            .eq("id", fila.tenant_id)
            .maybeSingle();
          if (t?.dominio_revocado_por_plan) {
            await avisarDesactivado(fila.tenant_id, fila.dominio);
            await db
              .from("tenants")
              .update({ dominio_revocado_por_plan: false })
              .eq("id", fila.tenant_id);
          }
        }
      } else {
        console.error(
          `vercel_delete_fallo (${resp.status}) para ${fila.dominio}:`,
          await resp.text(),
        );
        // Deja borrado_at null: reintento la proxima noche. 409 conflict_aliases = fuera de alcance.
      }
    } catch (e) {
      if (e instanceof RateLimitError) {
        corteRateLimit = true;
        break;
      }
      console.error("error limpiando huerfano", fila.dominio, e);
    }
  }

  return json({
    ok: true,
    revisados: (filas ?? []).length,
    borrados,
    corte_rate_limit: corteRateLimit,
  });
});
