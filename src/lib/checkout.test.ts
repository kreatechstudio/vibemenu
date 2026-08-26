import { describe, expect, test } from "bun:test";
import { urlDeCheckout } from "@/lib/checkout";

/**
 * `crear-checkout` solo devuelve una URL de Stripe Checkout cuando abre una
 * suscripción nueva. Si el tenant ya tenía una activa, la Edge Function la
 * modifica directo en Stripe (evita el bug de cobrar dos veces al cambiar de
 * plan) y regresa `{ ok: true }` sin URL — no hay a dónde redirigir.
 */
describe("urlDeCheckout", () => {
  test("una suscripción nueva trae URL de Stripe Checkout", () => {
    expect(urlDeCheckout({ url: "https://checkout.stripe.com/pay/xyz" })).toBe(
      "https://checkout.stripe.com/pay/xyz",
    );
  });

  test("cambiar de plan con una suscripción ya activa no trae URL — Stripe la modificó directo", () => {
    expect(urlDeCheckout({ ok: true })).toBeNull();
  });
});
