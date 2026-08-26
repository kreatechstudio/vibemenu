export type RespuestaCambioDePlan = { url: string } | { ok: true };

/**
 * `crear-checkout` devuelve una URL de Stripe Checkout solo si abre una
 * suscripción nueva. Si el tenant ya tenía una activa, la modifica directo en
 * Stripe (mismo `stripe_subscription_id`, sin cobrar dos veces) y regresa
 * `{ ok: true }` sin URL.
 */
export function urlDeCheckout(respuesta: RespuestaCambioDePlan): string | null {
  return "url" in respuesta ? respuesta.url : null;
}
