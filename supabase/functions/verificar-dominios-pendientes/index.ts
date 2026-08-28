// Edge Function: verificar-dominios-pendientes
//
// Dos formas de dispararla:
//   1. Cron cada 6h (.github/workflows/verificar-dominios.yml), protegida por
//      DOMINIO_CRON_SECRET -- mismo patron que procesar-trials-vencidos.
//      Revisa TODOS los tenants en dominio_estado 'pendiente' o 'verificado'.
//   2. Boton "Verificar ahora" en SuperAdmin.tsx, con la sesion del propio
//      super-admin (sin secreto: la tabla `super_admins` con su RLS de
//      "solo tu propia fila" ya es la autorizacion). Revisa un tenant.
//
// Maquina de estados: pendiente -> verificado (Vercel valido el DNS) -> listo
// (una peticion HTTPS real al dominio respondio: el certificado ya sirve
// trafico). El correo "tu dominio esta listo" sale SOLO al entrar en 'listo'.
// A las 72h en 'pendiente' sin resolver, un correo de recordatorio (una vez).
// Ver docs/superpowers/specs/2026-08-28-endurecer-dominios-design.md
//
// Desplegar:
//   supabase functions deploy verificar-dominios-pendientes --project-ref iaiiwtqqiaqxnzxjqcnt
//
// Secretos: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//           VERCEL_API_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID,
//           DOMINIO_CRON_SECRET, RESEND_API_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  fetchVercelConReintento,
  normalizarRecomendados,
  RateLimitError,
  urlAgregarDominio,
  urlConfigDominio,
  urlVerificarDominio,
} from "../_shared/vercel.ts";

const SITIO = "https://vibemenu.com.mx";
const HORAS_ANTES_DE_AVISAR = 72;

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

type Diagnostico = {
  name: string;
  apexName: string;
  misconfigured: boolean;
  verification: { type: string; domain: string; value: string; reason: string }[];
  recommendedIPv4: string[];
  recommendedCNAME: string[];
  revisado_at: string;
};

/** Misma logica que src/lib/dominio.ts motivoProblemaDNS, replicada para el runtime Deno. */
function motivoLegible(diag: Diagnostico): string {
  const conReason = diag.verification.find((v) => v.reason && v.domain);
  if (conReason) {
    return `Falta el registro ${conReason.type} en ${conReason.domain}. Créalo con el valor que ves en tu panel y vuelve a intentar.`;
  }
  return "No encontramos el registro DNS, o apunta a otro lado. Revisa que coincida exactamente con lo que ves en tu panel.";
}

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

function plantillaDominioProblema(negocioNombre: string, dominio: string, motivo: string) {
  const urlEmpresa = `${SITIO}/admin/empresa`;
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tu dominio todavía no responde</title>
  </head>
  <body style="margin:0; padding:0; background-color:#F5F6F9;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      Faltan unos pasos para conectar ${dominio} al menú de ${negocioNombre}.
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
                <h1 style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:28px; line-height:1.2; letter-spacing:-0.03em; font-weight:700; color:#0B0B0F;">
                  Tu dominio todavía no responde.
                </h1>
                <p style="margin:18px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:1.6; color:#4B4E5A;">
                  Ya llevas tres días configurando <strong style="color:#0B0B0F;">${dominio}</strong>
                  para el menú de ${negocioNombre} y sigue sin verificar. ${motivo}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px 40px 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:#2B4EFF; border-radius:12px;">
                      <a href="${urlEmpresa}"
                         style="display:inline-block; padding:15px 28px; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; font-weight:600; color:#FFFFFF; text-decoration:none; border-radius:12px;">
                        Ver las instrucciones
                      </a>
                    </td>
                  </tr>
                </table>
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

type TenantPendiente = {
  id: string;
  nombre_negocio: string;
  dominio_personalizado: string;
  dominio_estado: "pendiente" | "verificado";
  dominio_asignado_at: string | null;
  dominio_aviso_error_at: string | null;
};

const COLUMNAS =
  "id, nombre_negocio, dominio_personalizado, dominio_estado, dominio_asignado_at, dominio_aviso_error_at";

async function correoAlOwner(tenantId: string, subject: string, html: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return;
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
      subject,
      html,
    }),
  }).catch((e) => console.error("no se pudo enviar correo de dominio a", tenantId, e));
}

async function avisarDominioListo(t: TenantPendiente) {
  await correoAlOwner(
    t.id,
    `${t.dominio_personalizado} ya está listo`,
    plantillaDominioListo(t.nombre_negocio, t.dominio_personalizado),
  );
}

async function avisarDominioProblema(t: TenantPendiente, diag: Diagnostico) {
  await correoAlOwner(
    t.id,
    `${t.dominio_personalizado} todavía no responde`,
    plantillaDominioProblema(t.nombre_negocio, t.dominio_personalizado, motivoLegible(diag)),
  );
}

async function verificarUno(
  vercelToken: string,
  vercelProject: string,
  vercelTeam: string,
  t: TenantPendiente,
): Promise<"listo" | "verificado" | "pendiente"> {
  const auth = { Authorization: `Bearer ${vercelToken}` };

  // 1. Forzar re-chequeo del DNS.
  const respVerify = await fetchVercelConReintento(
    urlVerificarDominio(vercelProject, vercelTeam, t.dominio_personalizado),
    { method: "POST", headers: auth },
  );

  if (respVerify.status === 404) {
    // Nunca se registro: re-alta y que la proxima corrida lo agarre.
    await fetchVercelConReintento(urlAgregarDominio(vercelProject, vercelTeam), {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name: t.dominio_personalizado }),
    }).catch((e) => console.error("re-alta fallo para", t.dominio_personalizado, e));
    return "pendiente";
  }

  const verifyData = respVerify.ok
    ? ((await respVerify.json()) as {
        verified?: boolean;
        name?: string;
        apexName?: string;
        verification?: unknown[];
      })
    : {};

  // 2. Config: registros recomendados + misconfigured.
  const configData = (await fetchVercelConReintento(
    urlConfigDominio(vercelProject, vercelTeam, t.dominio_personalizado),
    { headers: auth },
  )
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))) as {
    misconfigured?: boolean;
    recommendedIPv4?: unknown;
    recommendedCNAME?: unknown;
  };

  const diagnostico: Diagnostico = {
    name: verifyData.name ?? t.dominio_personalizado,
    apexName: verifyData.apexName ?? t.dominio_personalizado,
    misconfigured: Boolean(configData.misconfigured),
    verification: (Array.isArray(verifyData.verification)
      ? verifyData.verification
      : []) as Diagnostico["verification"],
    recommendedIPv4: normalizarRecomendados(configData.recommendedIPv4),
    recommendedCNAME: normalizarRecomendados(configData.recommendedCNAME),
    revisado_at: new Date().toISOString(),
  };
  await db.from("tenants").update({ dominio_diagnostico: diagnostico }).eq("id", t.id);

  const dnsOk = Boolean(verifyData.verified) && !diagnostico.misconfigured;

  // 3a. DNS ok: subir a 'verificado' y probar HTTPS en la misma corrida.
  if (dnsOk) {
    if (t.dominio_estado === "pendiente") {
      await db.from("tenants").update({ dominio_estado: "verificado" }).eq("id", t.id);
    }
    let httpsOk = false;
    try {
      await fetch(`https://${t.dominio_personalizado}/`, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });
      httpsOk = true; // resolvio el handshake TLS: el cert ya sirve
    } catch {
      httpsOk = false; // cert aun emitiendose: se queda en 'verificado'
    }
    if (!httpsOk) return "verificado";

    const { error: errListo } = await db
      .from("tenants")
      .update({ dominio_estado: "listo", dominio_aviso_error_at: null })
      .eq("id", t.id);
    if (errListo) {
      console.error("no se pudo marcar dominio_estado='listo' para", t.id, errListo);
      return "verificado";
    }
    await avisarDominioListo(t);
    return "listo";
  }

  // 3b. Sigue mal: correo de recordatorio a las 72h, una sola vez.
  // `respVerify.ok` exige que Vercel realmente haya respondido "no verificado" --
  // no mandamos el correo si la API de Vercel fallo (5xx / red).
  if (
    respVerify.ok &&
    t.dominio_estado === "pendiente" &&
    t.dominio_asignado_at &&
    !t.dominio_aviso_error_at &&
    Date.now() - new Date(t.dominio_asignado_at).getTime() >= HORAS_ANTES_DE_AVISAR * 3600_000
  ) {
    await avisarDominioProblema(t, diagnostico);
    await db
      .from("tenants")
      .update({ dominio_aviso_error_at: new Date().toISOString() })
      .eq("id", t.id);
  }
  return "pendiente";
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
      .select(COLUMNAS)
      .in("dominio_estado", ["pendiente", "verificado"])
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
      .select(COLUMNAS)
      .eq("id", tenantId)
      .in("dominio_estado", ["pendiente", "verificado"])
      .not("dominio_personalizado", "is", null);
    if (error) return json({ error: error.message }, 500);
    tenants = (data ?? []) as TenantPendiente[];
  }

  let verificados = 0;
  let corteRateLimit = false;
  for (const t of tenants) {
    try {
      const estado = await verificarUno(vercelToken, vercelProject, vercelTeam, t);
      if (estado === "listo") verificados++;
    } catch (e) {
      if (e instanceof RateLimitError) {
        corteRateLimit = true;
        break;
      }
      console.error("error verificando", t.id, e);
    }
  }

  return json({
    ok: true,
    revisados: tenants.length,
    verificados,
    corte_rate_limit: corteRateLimit,
  });
});
