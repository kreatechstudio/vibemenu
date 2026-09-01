import { describe, expect, test } from "bun:test";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { traducirErrorEdge } from "@/lib/erroresEdge";

/**
 * FunctionsHttpError guarda el Response crudo en `.context`, no en `.message`
 * (que siempre dice "Edge Function returned a non-2xx status code"). El
 * traductor tiene que leer el cuerpo real para encontrar el slug.
 */
const errorEdge = (cuerpo: Record<string, unknown>) =>
  new FunctionsHttpError({ json: async () => cuerpo } as unknown as Response);

describe("traducirErrorEdge", () => {
  test("lee el slug del cuerpo, no el .message genérico", async () => {
    const mensaje = await traducirErrorEdge(errorEdge({ error: "ya_es_parte_del_equipo" }));
    expect(mensaje).toBe("Ese correo ya es parte de tu equipo.");
  });

  test("el hueco de seguridad tiene su propio mensaje explícito", async () => {
    const mensaje = await traducirErrorEdge(
      errorEdge({ error: "correo_ya_administra_otro_negocio" }),
    );
    expect(mensaje).toContain("ya administra otro negocio");
  });

  test("slug desconocido cae al mensaje genérico, no lo muestra crudo", async () => {
    const mensaje = await traducirErrorEdge(errorEdge({ error: "algo_que_no_mapeamos_todavia" }));
    expect(mensaje).not.toContain("algo_que_no_mapeamos_todavia");
    expect(mensaje).toBe("Algo salió mal. Vuelve a intentar en un momento.");
  });

  test("cuerpo no interpretable como JSON no revienta, cae al genérico", async () => {
    const error = new FunctionsHttpError({
      json: async () => {
        throw new Error("no es json");
      },
    } as unknown as Response);
    expect(await traducirErrorEdge(error)).toBe("Algo salió mal. Vuelve a intentar en un momento.");
  });

  test("función no desplegada (404) sigue detectándose por mensaje", async () => {
    const mensaje = await traducirErrorEdge(new Error("Function not found (404)"));
    expect(mensaje).toContain("no está desplegada");
  });

  test("fallo de red sigue detectándose por mensaje", async () => {
    const mensaje = await traducirErrorEdge(new Error("Failed to fetch"));
    expect(mensaje).toContain("No pudimos contactar el servidor");
  });

  test("null/otros valores no truenan", async () => {
    expect(await traducirErrorEdge(null)).toBe("Algo salió mal. Vuelve a intentar en un momento.");
  });
});

describe("mensajes de reservaciones", () => {
  test("datos_invalidos", async () => {
    const mensaje = await traducirErrorEdge(errorEdge({ error: "datos_invalidos" }));
    expect(mensaje).toBe("Revisa los datos del formulario e intenta de nuevo.");
  });

  test("captcha_invalido", async () => {
    const mensaje = await traducirErrorEdge(errorEdge({ error: "captcha_invalido" }));
    expect(mensaje).toBe(
      "No pudimos verificar que no eres un robot. Recarga la página e intenta otra vez.",
    );
  });

  test("reservaciones_no_disponibles", async () => {
    const mensaje = await traducirErrorEdge(errorEdge({ error: "reservaciones_no_disponibles" }));
    expect(mensaje).toBe("Este restaurante no está recibiendo reservaciones ahora mismo.");
  });

  test("demasiadas_solicitudes", async () => {
    const mensaje = await traducirErrorEdge(errorEdge({ error: "demasiadas_solicitudes" }));
    expect(mensaje).toBe(
      "Llegaron muchas solicitudes seguidas. Espera unos minutos e intenta de nuevo.",
    );
  });

  test("reservacion_en_pasado", async () => {
    const mensaje = await traducirErrorEdge(errorEdge({ error: "reservacion_en_pasado" }));
    expect(mensaje).toBe("Esa fecha y hora ya pasaron. Elige otra.");
  });

  test("reservacion_muy_lejana", async () => {
    const mensaje = await traducirErrorEdge(errorEdge({ error: "reservacion_muy_lejana" }));
    expect(mensaje).toBe("Solo puedes reservar hasta con 60 días de anticipación.");
  });

  test("sucursal_no_acepta_reservaciones", async () => {
    const mensaje = await traducirErrorEdge(
      errorEdge({ error: "sucursal_no_acepta_reservaciones" }),
    );
    expect(mensaje).toBe("Esta sucursal no está recibiendo reservaciones.");
  });

  test("reservaciones_no_permitidas", async () => {
    const mensaje = await traducirErrorEdge(errorEdge({ error: "reservaciones_no_permitidas" }));
    expect(mensaje).toBe("Este restaurante no está recibiendo reservaciones ahora mismo.");
  });

  test("sucursal_ajena", async () => {
    const mensaje = await traducirErrorEdge(errorEdge({ error: "sucursal_ajena" }));
    expect(mensaje).toBe("Algo salió mal con la sucursal. Recarga la página e intenta de nuevo.");
  });

  test("metodo_no_permitido", async () => {
    const mensaje = await traducirErrorEdge(errorEdge({ error: "metodo_no_permitido" }));
    expect(mensaje).toBe("Algo salió mal. Vuelve a intentar en un momento.");
  });
});
