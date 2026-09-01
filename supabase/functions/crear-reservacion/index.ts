// Edge Function: crear-reservacion
//
// Unico camino de escritura de una reservacion. El comensal NO tiene sesion, asi
// que aqui se usa service_role (no la sesion del que llama). Antes de escribir:
//  1. verifica el token de Turnstile contra Cloudflare (siteverify),
//  2. lee sucursal + tenant + plan y confirma que la feature esta activa,
//  3. rate-limita por sucursal y por IP,
//  4. arma fecha_hora en la zona de la sucursal (RPC combinar_fecha_hora_sucursal),
//  5. inserta (el trigger validar_reservacion es la ultima red),
//  6. avisa al restaurante por Resend.
//
// Desplegar:
//   supabase functions deploy crear-reservacion --project-ref iaiiwtqqiaqxnzxjqcnt
//
// Secretos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, TURNSTILE_SECRET_KEY
//
// Requiere la migracion vibemenu_migracion_reservaciones.sql aplicada.

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

// El comensal no tiene sesion y controla nombre/nota/telefono/subject: escapar
// antes de meterlos en el HTML del correo al restaurante (anti-phishing).
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const LIMITE_POR_SUCURSAL_HORA = 5;
const LIMITE_POR_IP_HORA = 3;

type Entrada = {
  sucursal_id: string;
  nombre: string;
  personas: number;
  fecha: string;
  hora: string;
  telefono: string;
  email: string | null;
  nota: string | null;
  consentimiento: boolean;
  turnstile_token: string | null;
};

function parseEntrada(x: unknown): Entrada | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const sucursal_id = str(o.sucursal_id);
  const nombre = str(o.nombre)?.trim() ?? null;
  const fecha = str(o.fecha);
  const hora = str(o.hora);
  const telefono = str(o.telefono)?.trim() ?? null;
  const personas = typeof o.personas === "number" ? o.personas : NaN;
  if (!sucursal_id || !nombre || !fecha || !hora || !telefono) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return null;
  if (!Number.isInteger(personas) || personas < 1 || personas > 99) return null;
  if (nombre.length < 2 || nombre.length > 120) return null;
  if (telefono.length < 6 || telefono.length > 30) return null;
  if (o.consentimiento !== true) return null;
  const email = str(o.email)?.trim() || null;
  const nota = str(o.nota)?.trim() || null;
  if (nota && nota.length > 500) return null;
  return {
    sucursal_id,
    nombre,
    personas,
    fecha,
    hora,
    telefono,
    email,
    nota,
    consentimiento: true,
    turnstile_token: str(o.turnstile_token),
  };
}

async function verificarTurnstile(token: string | null, ip: string | null): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return true; // dev sin configurar: no bloquea (igual que captchaHabilitado)
  if (!token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const data = await resp.json().catch(() => null);
  return data?.success === true;
}

function plantillaReservacion(o: {
  negocio: string;
  sucursal: string;
  nombre: string;
  personas: number;
  cuando: string;
  telefonoWa: string;
  telefonoRaw: string;
  nota: string | null;
}) {
  const urlPanel = `${SITIO}/admin/reservaciones`;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Nueva reservación</title></head>
<body style="margin:0;padding:0;background-color:#F5F6F9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F6F9;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E4E6ED;border-radius:16px;">
        <tr><td style="padding:32px 40px 0 40px;">
          <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#0B0B0F;">Vibemenu</span>
        </td></tr>
        <tr><td style="padding:28px 40px 0 40px;">
          <h1 style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:26px;line-height:1.2;letter-spacing:-0.03em;font-weight:700;color:#0B0B0F;">Nueva reservación en ${esc(o.negocio)}.</h1>
          <p style="margin:16px 0 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:#4B4E5A;">
            <strong style="color:#0B0B0F;">${esc(o.nombre)}</strong> · ${o.personas} ${o.personas === 1 ? "persona" : "personas"}<br />
            <strong style="color:#0B0B0F;">${o.cuando}</strong><br />
            Sucursal: ${esc(o.sucursal)}<br />
            Teléfono: <a href="https://wa.me/${o.telefonoWa}" style="color:#2B4EFF;">${esc(o.telefonoRaw)}</a>
            ${o.nota ? `<br />Nota: ${esc(o.nota)}` : ""}
          </p>
        </td></tr>
        <tr><td style="padding:28px 40px 40px 40px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#2B4EFF;border-radius:12px;">
            <a href="${urlPanel}" style="display:inline-block;padding:15px 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:12px;">Ver en el panel</a>
          </td></tr></table>
          <p style="margin:20px 0 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#4B4E5A;">
            Estos son datos de tu cliente. Confírmale tú directamente por teléfono o WhatsApp.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "metodo_no_permitido" }, 405);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;

  const entrada = parseEntrada(await req.json().catch(() => null));
  if (!entrada) return json({ error: "datos_invalidos" }, 400);

  if (!(await verificarTurnstile(entrada.turnstile_token, ip))) {
    return json({ error: "captcha_invalido" }, 403);
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Sucursal + tenant + plan + correos de aviso
  const { data: suc, error: errSuc } = await db
    .from("sucursales")
    .select(
      "id, nombre, timezone, acepta_reservaciones, reservaciones_email, " +
        "tenant:tenants(id, nombre_negocio, plan:planes(permite_reservaciones))",
    )
    .eq("id", entrada.sucursal_id)
    .maybeSingle();

  const tenant = (
    suc as {
      tenant?: {
        id: string;
        nombre_negocio: string;
        plan?: { permite_reservaciones: boolean } | null;
      };
    } | null
  )?.tenant;
  if (
    errSuc ||
    !suc ||
    !tenant ||
    !suc.acepta_reservaciones ||
    !tenant.plan?.permite_reservaciones
  ) {
    return json({ error: "reservaciones_no_disponibles" }, 403);
  }

  // Rate-limit
  const desde = new Date(Date.now() - 3600_000).toISOString();
  const { count: nSuc } = await db
    .from("reservaciones")
    .select("id", { count: "exact", head: true })
    .eq("sucursal_id", entrada.sucursal_id)
    .gte("creada_en", desde);
  if ((nSuc ?? 0) >= LIMITE_POR_SUCURSAL_HORA)
    return json({ error: "demasiadas_solicitudes" }, 429);

  if (ip) {
    const { count: nIp } = await db
      .from("reservaciones")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("creada_en", desde);
    if ((nIp ?? 0) >= LIMITE_POR_IP_HORA) return json({ error: "demasiadas_solicitudes" }, 429);
  }

  // fecha_hora en la zona de la sucursal
  const { data: fhData, error: errFh } = await db.rpc("combinar_fecha_hora_sucursal", {
    p_fecha: entrada.fecha,
    p_hora: entrada.hora,
    p_tz: suc.timezone,
  });
  if (errFh || !fhData) return json({ error: "datos_invalidos" }, 400);
  const fechaHora = fhData as string;

  // Insert (el trigger valida plan/opt-in/ventana de fecha)
  const { error: errIns } = await db.from("reservaciones").insert({
    tenant_id: tenant.id,
    sucursal_id: entrada.sucursal_id,
    nombre: entrada.nombre,
    personas: entrada.personas,
    fecha_hora: fechaHora,
    telefono: entrada.telefono,
    email: entrada.email,
    nota: entrada.nota,
    ip,
  });
  if (errIns) {
    const slug =
      /reservacion_en_pasado|reservacion_muy_lejana|sucursal_no_acepta_reservaciones|reservaciones_no_permitidas|sucursal_ajena/.exec(
        errIns.message,
      )?.[0];
    return json({ error: slug ?? "datos_invalidos" }, 400);
  }

  // Aviso al restaurante — fire and forget: la fila YA existe. Cualquier fallo
  // aqui (red, DNS, Resend caido, getUserById) degrada a aviso:"correo_no_enviado",
  // nunca un throw: un 500 haria que el comensal reintente y duplique la reserva.
  let correoOk = false;
  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (apiKey) {
      let destino = (suc.reservaciones_email || "").trim() || null;
      if (!destino) {
        const { data: owner } = await db
          .from("tenant_usuarios")
          .select("user_id")
          .eq("tenant_id", tenant.id)
          .eq("rol", "owner")
          .maybeSingle();
        if (owner?.user_id) {
          const { data: u } = await db.auth.admin.getUserById(owner.user_id);
          destino = u.user?.email ?? null;
        }
      }
      if (destino) {
        const telWa = entrada.telefono.replace(/[^\d]/g, "");
        const cuando = new Intl.DateTimeFormat("es-MX", {
          timeZone: suc.timezone,
          dateStyle: "full",
          timeStyle: "short",
        }).format(new Date(fechaHora));
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: REMITENTE,
            to: [destino],
            subject: `Nueva reservación — ${esc(entrada.nombre)}, ${entrada.personas} ${entrada.personas === 1 ? "persona" : "personas"}`,
            html: plantillaReservacion({
              negocio: tenant.nombre_negocio,
              sucursal: suc.nombre,
              nombre: entrada.nombre,
              personas: entrada.personas,
              cuando,
              telefonoWa: telWa,
              telefonoRaw: entrada.telefono,
              nota: entrada.nota,
            }),
          }),
        });
        correoOk = resp.ok;
      }
    }
  } catch {
    correoOk = false;
  }

  return correoOk ? json({ ok: true }) : json({ ok: true, aviso: "correo_no_enviado" });
});
