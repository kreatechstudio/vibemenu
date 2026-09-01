import { telefonoParaWaMe } from "@/lib/whatsapp";

/**
 * Lógica pura del formulario de reservación. Sin React, sin red.
 * La validación de verdad la hace el trigger `validar_reservacion` en Postgres;
 * esto solo evita viajes obvios y da mensajes de campo.
 */

export const MAX_DIAS_RESERVA = 60;
export const MAX_PERSONAS = 99;

export type BorradorReservacion = {
  nombre: string;
  personas: number;
  /** `YYYY-MM-DD` de un <input type="date">. */
  fecha: string;
  /** `HH:MM` de un <input type="time">. */
  hora: string;
  /** Con lada `+NN` (viene de PhoneInput). */
  telefono: string;
  email: string;
  nota: string;
  consentimiento: boolean;
};

export type CampoReservacion =
  | "nombre"
  | "personas"
  | "fecha"
  | "hora"
  | "telefono"
  | "email"
  | "consentimiento";

export type ErrorReservacion = { campo: CampoReservacion; motivo: string };

const RE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** El instante que el comensal pidió, interpretado como reloj de pared en `tz`. */
function instantePedido(fecha: string, hora: string, tz: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return null;
  // Truco: formatear un instante en `tz` y medir el desfase contra UTC.
  const naive = new Date(`${fecha}T${hora}:00Z`);
  if (Number.isNaN(naive.getTime())) return null;
  const enTz = new Date(naive.toLocaleString("en-US", { timeZone: tz }));
  const enUtc = new Date(naive.toLocaleString("en-US", { timeZone: "UTC" }));
  const desfase = enTz.getTime() - enUtc.getTime();
  return new Date(naive.getTime() - desfase);
}

export function validarReservacion(
  b: BorradorReservacion,
  ahora: Date,
  tz: string,
): ErrorReservacion | null {
  if (b.nombre.trim().length < 2 || b.nombre.trim().length > 120) {
    return { campo: "nombre", motivo: "Escribe tu nombre completo." };
  }
  if (!Number.isInteger(b.personas) || b.personas < 1 || b.personas > MAX_PERSONAS) {
    return { campo: "personas", motivo: `Entre 1 y ${MAX_PERSONAS} personas.` };
  }

  const cuando = instantePedido(b.fecha, b.hora, tz);
  if (!cuando) return { campo: "fecha", motivo: "Elige una fecha y una hora." };
  if (cuando.getTime() < ahora.getTime()) {
    return { campo: "fecha", motivo: "Esa fecha y hora ya pasaron." };
  }
  const limite = new Date(ahora);
  limite.setDate(limite.getDate() + MAX_DIAS_RESERVA);
  if (cuando.getTime() > limite.getTime()) {
    return { campo: "fecha", motivo: `Como máximo ${MAX_DIAS_RESERVA} días adelante.` };
  }

  if (telefonoParaWaMe(b.telefono) === null) {
    return { campo: "telefono", motivo: "Deja un teléfono con lada para confirmarte." };
  }
  if (b.email.trim() !== "" && !RE_EMAIL.test(b.email.trim())) {
    return { campo: "email", motivo: "Ese correo no se ve bien." };
  }
  if (!b.consentimiento) {
    return { campo: "consentimiento", motivo: "Necesitamos tu permiso para guardar tus datos." };
  }
  return null;
}

export function payloadReservacion(
  b: BorradorReservacion,
  sucursalId: string,
  token: string | null,
): Record<string, unknown> {
  const limpio = (s: string) => {
    const t = s.trim();
    return t === "" ? null : t;
  };
  return {
    sucursal_id: sucursalId,
    nombre: b.nombre.trim(),
    personas: b.personas,
    fecha: b.fecha,
    hora: b.hora,
    telefono: b.telefono.trim(),
    email: limpio(b.email),
    nota: limpio(b.nota),
    consentimiento: b.consentimiento,
    turnstile_token: token,
  };
}

const FMT_CACHE = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = FMT_CACHE.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("es-MX", {
      timeZone: tz,
      dateStyle: "medium",
      timeStyle: "short",
    });
    FMT_CACHE.set(tz, f);
  }
  return f;
}

/** "3 sep 2026, 8:00 p.m." — para el resumen antes de enviar y el correo. */
export function formatearFechaHora(fecha: string, hora: string, tz: string): string {
  const cuando = instantePedido(fecha, hora, tz);
  if (!cuando) return `${fecha} ${hora}`;
  return fmt(tz).format(cuando);
}
