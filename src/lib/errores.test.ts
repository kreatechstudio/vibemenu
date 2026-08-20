import { describe, expect, test } from "bun:test";
import type { PostgrestError } from "@supabase/supabase-js";
import { SLUGS_DE_LIMITE, traducirError } from "@/lib/errores";
import { MENSAJE_ERROR_SLUG, normalizarSlug, validarFormatoSlug } from "@/lib/slug";

/**
 * El contrato con Postgres: los triggers levantan `raise exception '<slug>'
 * using detail = '<texto con el número real del plan>'`. Si este mapeo se rompe,
 * el dueño de un negocio ve un mensaje críptico justo cuando iba a pagar más.
 */
const errorDb = (message: string, details = ""): PostgrestError =>
  ({ code: "P0001", message, details, hint: "" }) as PostgrestError;

describe("traducirError", () => {
  test("el detail gana: trae el número real del plan", () => {
    const r = traducirError(
      errorDb("limite_productos_alcanzado", "Tu plan permite hasta 20 productos."),
    );
    expect(r.mensaje).toBe("Tu plan permite hasta 20 productos.");
    expect(r.esLimiteDePlan).toBe(true);
    expect(r.slug).toBe("limite_productos_alcanzado");
  });

  test("sin detail, cae al copy genérico pero sigue siendo de límite", () => {
    const r = traducirError(errorDb("limite_sucursales_alcanzado"));
    expect(r.mensaje).toContain("límite de sucursales");
    expect(r.esLimiteDePlan).toBe(true);
  });

  test("todos los slugs de límite abren el modal de upsell", () => {
    for (const slug of SLUGS_DE_LIMITE) {
      expect(traducirError(errorDb(slug)).esLimiteDePlan).toBe(true);
    }
  });

  test("los errores del tema también son de plan", () => {
    expect(traducirError(errorDb("fuente_no_permitida")).esLimiteDePlan).toBe(true);
    expect(traducirError(errorDb("desenfoque_no_permitido")).esLimiteDePlan).toBe(true);
  });

  test("un error de coherencia NO abre el modal de upsell", () => {
    const r = traducirError(errorDb("producto_sucursal_incoherente"));
    expect(r.esLimiteDePlan).toBe(false);
  });

  test("el unique de tenants.slug se traduce a 'ya está en uso'", () => {
    const r = traducirError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "tenants_slug_key"',
      details: "",
      hint: "",
    } as PostgrestError);
    expect(r.mensaje).toContain("ya está en uso");
  });

  test("un error desconocido no filtra la jerga de Postgres", () => {
    const r = traducirError(errorDb("relation does not exist"));
    expect(r.mensaje).not.toContain("relation");
    expect(r.slug).toBeNull();
  });

  test("null devuelve cadena vacía, no 'null'", () => {
    expect(traducirError(null).mensaje).toBe("");
  });
});

describe("normalizarSlug", () => {
  test("quita acentos y baja a minúsculas", () => {
    expect(normalizarSlug("Café Aurora")).toBe("cafe-aurora");
  });

  test("la eñe no sobrevive a la URL", () => {
    expect(normalizarSlug("Piñata Ñam")).toBe("pinata-nam");
  });

  test("colapsa separadores y no deja guiones sueltos en los bordes", () => {
    expect(normalizarSlug("  ¡¡Tacos!!  El   Primo  ")).toBe("tacos-el-primo");
  });

  test("recorta al máximo permitido", () => {
    expect(normalizarSlug("a".repeat(80)).length).toBe(40);
  });
});

describe("validarFormatoSlug", () => {
  test("acepta un slug normal", () => {
    expect(validarFormatoSlug("cafe-aurora")).toBeNull();
  });

  test("rechaza los demasiado cortos", () => {
    expect(validarFormatoSlug("ab")).toBe("corto");
  });

  test("rechaza mayúsculas, espacios y guiones dobles", () => {
    expect(validarFormatoSlug("Cafe")).toBe("formato");
    expect(validarFormatoSlug("cafe aurora")).toBe("formato");
    expect(validarFormatoSlug("cafe--aurora")).toBe("formato");
    expect(validarFormatoSlug("-cafe")).toBe("formato");
  });

  test("cada motivo tiene su mensaje", () => {
    for (const motivo of ["corto", "largo", "formato"] as const) {
      expect(MENSAJE_ERROR_SLUG[motivo].length).toBeGreaterThan(5);
    }
  });
});
