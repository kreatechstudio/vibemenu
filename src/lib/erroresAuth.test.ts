import { describe, expect, test } from "bun:test";
import { AuthApiError, AuthError } from "@supabase/supabase-js";
import { traducirErrorAuth } from "@/lib/erroresAuth";

/**
 * Contrato con Supabase Auth: los errores de gotrue traen un `code` estable
 * (ver @supabase/auth-js error-codes). Si este mapeo se rompe, el usuario ve
 * "Algo salió mal" justo cuando no puede entrar o registrarse.
 */
const authError = (code: string, status = 400, message = "english message"): AuthError =>
  new AuthApiError(message, status, code);

describe("traducirErrorAuth", () => {
  test("credenciales inválidas", () => {
    expect(traducirErrorAuth(authError("invalid_credentials"))).toBe(
      "Correo o contraseña incorrectos.",
    );
  });

  test("correo sin confirmar apunta al enlace del registro", () => {
    const msg = traducirErrorAuth(authError("email_not_confirmed"));
    expect(msg).toContain("confirmas tu correo");
  });

  test("correo ya registrado manda a entrar", () => {
    expect(traducirErrorAuth(authError("user_already_exists"))).toContain("ya tiene una cuenta");
    expect(traducirErrorAuth(authError("email_exists"))).toContain("ya tiene una cuenta");
  });

  test("contraseña débil", () => {
    expect(traducirErrorAuth(authError("weak_password"))).toContain("al menos 6");
  });

  test("rate limit por código", () => {
    expect(traducirErrorAuth(authError("over_request_rate_limit", 429))).toContain("Demasiados");
  });

  test("rate limit por status 429 sin código conocido", () => {
    expect(traducirErrorAuth(authError("some_future_code", 429))).toContain("Demasiados");
  });

  test("límite de envío de correos", () => {
    expect(traducirErrorAuth(authError("over_email_send_rate_limit"))).toContain("correos");
  });

  test("captcha fallido", () => {
    expect(traducirErrorAuth(authError("captcha_failed"))).toContain("captcha");
  });

  test("misma contraseña al restablecer", () => {
    expect(traducirErrorAuth(authError("same_password"))).toContain("igual a la anterior");
  });

  test("fallback por mensaje en inglés cuando no hay código (OAuth)", () => {
    expect(traducirErrorAuth(new AuthError("Invalid login credentials"))).toBe(
      "Correo o contraseña incorrectos.",
    );
    expect(traducirErrorAuth(new AuthError("Email not confirmed"))).toContain(
      "confirmas tu correo",
    );
  });

  test("un AuthError desconocido devuelve null: que responda otro traductor", () => {
    expect(traducirErrorAuth(authError("unexpected_failure", 500))).toBeNull();
  });

  test("un error que no es de Auth devuelve null", () => {
    expect(traducirErrorAuth(new Error("duplicate key value"))).toBeNull();
    expect(traducirErrorAuth({ code: "23505", message: "algo" })).toBeNull();
  });

  test("null devuelve null, no la cadena 'null'", () => {
    expect(traducirErrorAuth(null)).toBeNull();
    expect(traducirErrorAuth(undefined)).toBeNull();
  });
});
