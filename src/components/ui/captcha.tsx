import { forwardRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

/** Falso en dev si no se configuro la site key: los formularios no deben bloquear el envio. */
export const captchaHabilitado = Boolean(TURNSTILE_SITE_KEY);

type CaptchaProps = {
  onToken: (token: string | null) => void;
};

/**
 * Reto de Cloudflare Turnstile. Si falta la site key (dev sin configurar),
 * no renderiza nada y el formulario sigue funcionando sin captcha: Supabase
 * solo lo exige cuando el proyecto tiene Attack Protection activado.
 */
const Captcha = forwardRef<TurnstileInstance, CaptchaProps>(function Captcha({ onToken }, ref) {
  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <Turnstile
      ref={ref}
      siteKey={TURNSTILE_SITE_KEY}
      onSuccess={onToken}
      onExpire={() => onToken(null)}
      onError={() => onToken(null)}
      options={{ size: "flexible" }}
    />
  );
});

export default Captcha;
export type { TurnstileInstance };
