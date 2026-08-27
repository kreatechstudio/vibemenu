/**
 * Periodo de gracia por pago fallido. Cuando Stripe reporta past_due/unpaid,
 * stripe-webhook pone `tenants.pago_fallido_desde = now()` y el tenant conserva
 * acceso completo durante DIAS_GRACIA días con un banner de aviso. Pasado ese
 * plazo, el cron (procesar-trials-vencidos) lo pasa a `estado = 'suspendido'`.
 * Ver docs/superpowers/specs/2026-08-27-endurecer-facturacion-design.md
 */
export const DIAS_GRACIA = 7;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Fecha en la que se acaba la gracia y se bloquea el panel. */
export function fechaLimiteGracia(desde: string): Date {
  return new Date(new Date(desde).getTime() + DIAS_GRACIA * MS_POR_DIA);
}

/** `true` si hay un pago fallido y ya se cumplieron los DIAS_GRACIA. */
export function graciaVencida(desde: string | null, ahora: Date = new Date()): boolean {
  if (!desde) return false;
  return ahora.getTime() >= fechaLimiteGracia(desde).getTime();
}
