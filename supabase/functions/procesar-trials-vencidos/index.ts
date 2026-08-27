// Edge Function: procesar-trials-vencidos
//
// Tarea diaria (ver .github/workflows/procesar-trials.yml), no un endpoint de
// usuario: no la llama el frontend. Hace tres cosas:
//
//   1. Aviso: entre 11 y 14 dias desde `trial_iniciado_at`, manda un correo
//      una sola vez (marca `aviso_trial_enviado_at`).
//   2. Vencimiento: pasados los 14 dias, baja `plan_id` a Free. Reutiliza los
//      triggers que YA existen para downgrade (trg_tenants_20_formatos,
//      trg_tenants_25_tema): recortan formatos/tema en silencio, igual que
//      si el dueño hubiera bajado de plan a mano. `estado` sigue en 'trial'
//      -- nunca pago, asi que sigue siendo verdad.
//   3. Suspende (estado='suspendido') a los tenants con pago fallido cuya
//      gracia de 7 dias ya vencio (pago_fallido_desde lo pone stripe-webhook).
//
// Las cosas 1 y 2 solo aplican a tenants en `estado = 'trial'` que siguen en el
// plan Pro (nunca pagaron).
//
// Protegida con un secreto compartido (no con sesion de usuario: nadie tiene
// sesion en un cron). `verify_jwt=true` a nivel de plataforma exige ademas
// un JWT valido de Supabase en el Authorization -- el workflow manda el
// service_role_key, que ya lo es.
//
// Desplegar:
//   supabase functions deploy procesar-trials-vencidos --project-ref iaiiwtqqiaqxnzxjqcnt
//
// Secretos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET

import { createClient } from "jsr:@supabase/supabase-js@2";

const SITIO = "https://vibemenu.com.mx";
const DIAS_TRIAL = 14;
const DIAS_AVISO_ANTES = 3;

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function plantillaAviso(negocioNombre: string, diasRestantes: number) {
  const urlSuscripcion = `${SITIO}/admin/suscripcion`;
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tu prueba de Vibemenu está por terminar</title>
  </head>
  <body style="margin:0; padding:0; background-color:#F5F6F9;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      En ${diasRestantes} días ${negocioNombre} baja a Free si no eliges un plan.
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
                  Tu prueba de Pro termina en ${diasRestantes} días.
                </h1>
                <p style="margin:18px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:1.6; color:#4B4E5A;">
                  <strong style="color:#0B0B0F;">${negocioNombre}</strong> lleva 14 días usando
                  todo Pro sin costo. Si no eliges un plan, baja a Free automáticamente — sin
                  perder tu menú, solo con los límites del plan gratuito.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:#2B4EFF; border-radius:12px;">
                      <a href="${urlSuscripcion}"
                         style="display:inline-block; padding:15px 28px; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; font-weight:600; color:#FFFFFF; text-decoration:none; border-radius:12px;">
                        Elegir mi plan
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

async function enviarAviso(email: string, negocioNombre: string, diasRestantes: number) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("falta_RESEND_API_KEY");

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Vibemenu <hola@vibemenu.com.mx>",
      to: [email],
      subject: `Tu prueba de Pro en ${negocioNombre} termina en ${diasRestantes} días`,
      html: plantillaAviso(negocioNombre, diasRestantes),
    }),
  });

  if (!resp.ok) throw new Error(`resend_error: ${await resp.text()}`);
}

type TenantEnTrial = {
  id: string;
  nombre_negocio: string;
  trial_iniciado_at: string;
  planes: { nombre: string } | null;
};

Deno.serve(async (req) => {
  const secreto = Deno.env.get("CRON_SECRET");
  if (!secreto || req.headers.get("x-cron-secret") !== secreto) {
    return new Response("no_autorizado", { status: 401 });
  }

  const ahora = Date.now();
  const msPorDia = 24 * 60 * 60 * 1000;

  // ---- 1. Avisos: entre 11 y 14 dias, una sola vez ----------------------
  const { data: porAvisar, error: errorAviso } = await db
    .from("tenants")
    .select("id, nombre_negocio, trial_iniciado_at, planes(nombre)")
    .eq("estado", "trial")
    .is("aviso_trial_enviado_at", null)
    .lte(
      "trial_iniciado_at",
      new Date(ahora - (DIAS_TRIAL - DIAS_AVISO_ANTES) * msPorDia).toISOString(),
    )
    .gt("trial_iniciado_at", new Date(ahora - DIAS_TRIAL * msPorDia).toISOString());

  if (errorAviso) {
    console.error("error consultando avisos:", errorAviso);
    return new Response(JSON.stringify({ error: errorAviso.message }), { status: 500 });
  }

  let avisados = 0;
  for (const t of (porAvisar ?? []) as TenantEnTrial[]) {
    if (t.planes?.nombre !== "pro") continue;

    const { data: owner } = await db
      .from("tenant_usuarios")
      .select("user_id")
      .eq("tenant_id", t.id)
      .eq("rol", "owner")
      .maybeSingle();
    if (!owner) continue;

    const { data: usuario } = await db.auth.admin.getUserById(owner.user_id);
    if (!usuario?.user?.email) continue;

    const diasTranscurridos = Math.floor(
      (ahora - new Date(t.trial_iniciado_at).getTime()) / msPorDia,
    );
    const diasRestantes = Math.max(1, DIAS_TRIAL - diasTranscurridos);

    try {
      await enviarAviso(usuario.user.email, t.nombre_negocio, diasRestantes);
      await db
        .from("tenants")
        .update({ aviso_trial_enviado_at: new Date().toISOString() })
        .eq("id", t.id);
      avisados++;
    } catch (e) {
      console.error("no se pudo avisar a", t.id, e);
    }
  }

  // ---- 2. Vencimiento: pasados los 14 dias, baja a Free ------------------
  const { data: planFree } = await db.from("planes").select("id").eq("nombre", "free").single();

  const { data: vencidos, error: errorVencidos } = await db
    .from("tenants")
    .select("id, planes(nombre)")
    .eq("estado", "trial")
    .lt("trial_iniciado_at", new Date(ahora - DIAS_TRIAL * msPorDia).toISOString());

  if (errorVencidos) {
    console.error("error consultando vencidos:", errorVencidos);
    return new Response(JSON.stringify({ error: errorVencidos.message }), { status: 500 });
  }

  let bajados = 0;
  if (planFree) {
    for (const t of (vencidos ?? []) as TenantEnTrial[]) {
      if (t.planes?.nombre !== "pro") continue;
      const { error } = await db.from("tenants").update({ plan_id: planFree.id }).eq("id", t.id);
      if (!error) bajados++;
    }
  }

  // ---- 3. Pago fallido: suspender tras 7 dias de gracia -----------------
  // stripe-webhook pone pago_fallido_desde en el PRIMER past_due/unpaid y lo
  // limpia si el tenant se pone al corriente. Aqui se corta a los que llevan
  // >= 7 dias sin regularizar. La suscripcion de Stripe NO se toca: sigue su
  // propio dunning; si al final Stripe la borra, cae en subscription.deleted
  // -> baja a Free. Ver docs/superpowers/specs/2026-08-27-endurecer-facturacion-design.md
  const DIAS_GRACIA = 7;
  const limiteGracia = new Date(ahora - DIAS_GRACIA * msPorDia).toISOString();

  const { data: enGracia, error: errorGracia } = await db
    .from("tenants")
    .select("id")
    .lt("pago_fallido_desde", limiteGracia)
    .neq("estado", "suspendido");

  if (errorGracia) {
    console.error("error consultando gracia vencida:", errorGracia);
    return new Response(JSON.stringify({ error: errorGracia.message }), { status: 500 });
  }

  let suspendidos = 0;
  for (const t of enGracia ?? []) {
    const { error } = await db.from("tenants").update({ estado: "suspendido" }).eq("id", t.id);
    if (!error) suspendidos++;
  }

  return new Response(JSON.stringify({ ok: true, avisados, bajados, suspendidos }), {
    headers: { "Content-Type": "application/json" },
  });
});
