import { isAuthError } from "@supabase/supabase-js";

/**
 * Traduce un error de Supabase Auth (gotrue) al copy real en español.
 *
 * A diferencia de `errores.ts` (triggers de Postgres) y `erroresEdge.ts`
 * (cuerpo de las Edge Functions), esto cubre lo que devuelven
 * `signInWithPassword`, `signUp`, `signInWithOAuth`, `resetPasswordForEmail`,
 * `updateUser` y `resend`. El `code` de `AuthError` es el contrato estable
 * (ver @supabase/auth-js `error-codes`); el `.message` viene en inglés.
 *
 * Devuelve `null` cuando el error no es de Auth o su código no está mapeado,
 * para que el llamador lo encadene con otro traductor:
 *   setError(traducirErrorAuth(err) ?? traducirError(err as Error).mensaje)
 */
const POR_CODIGO: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed:
    "Todavía no confirmas tu correo. Abre el enlace que te enviamos al registrarte.",
  user_already_exists: "Ese correo ya tiene una cuenta. Entra desde la pantalla de acceso.",
  email_exists: "Ese correo ya tiene una cuenta. Entra desde la pantalla de acceso.",
  weak_password: "La contraseña debe tener al menos 6 caracteres.",
  same_password: "La contraseña nueva no puede ser igual a la anterior.",
  over_request_rate_limit: "Demasiados intentos. Espera un minuto y vuelve a probar.",
  over_email_send_rate_limit:
    "Ya enviamos varios correos. Espera unos minutos antes de pedir otro.",
  captcha_failed: "No pudimos verificar el captcha. Recarga la página e intenta de nuevo.",
  validation_failed: "Revisa el correo y la contraseña.",
  email_address_invalid: "Ese correo no parece válido.",
  signup_disabled: "El registro está cerrado por ahora.",
  user_banned: "Esta cuenta está deshabilitada. Escríbenos si crees que es un error.",
  otp_expired: "Ese enlace ya venció. Pide uno nuevo.",
};

/** Errores que llegan sin `code` (algunos flujos de OAuth, SDKs viejos): se cae al mensaje. */
const POR_MENSAJE: readonly (readonly [RegExp, string])[] = [
  [/invalid login credentials/i, POR_CODIGO.invalid_credentials],
  [/email not confirmed/i, POR_CODIGO.email_not_confirmed],
  [/already registered|already exists|user already/i, POR_CODIGO.user_already_exists],
  [/rate limit|too many requests/i, POR_CODIGO.over_request_rate_limit],
  [/password should be at least|weak password/i, POR_CODIGO.weak_password],
];

export function traducirErrorAuth(error: unknown): string | null {
  if (!error) return null;

  if (isAuthError(error)) {
    if (error.code && error.code in POR_CODIGO) return POR_CODIGO[error.code];
    if (error.status === 429) return POR_CODIGO.over_request_rate_limit;
  }

  const mensaje = error instanceof Error ? error.message : "";
  for (const [patron, copy] of POR_MENSAJE) {
    if (patron.test(mensaje)) return copy;
  }

  return null;
}

/** true si `error` es un AuthError con exactamente ese `code` (para ramificar la UI). */
export function esAuthErrorConCodigo(error: unknown, codigo: string): boolean {
  return isAuthError(error) && error.code === codigo;
}
