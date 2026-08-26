import { describe, expect, test } from "bun:test";
import { guardarRespuestasOnboarding } from "@/lib/registro";

/**
 * guardarRespuestasOnboarding es best-effort: si no hay nada que contestar
 * (el usuario omitió las 3 preguntas), no debe intentar ningún insert — se
 * puede probar sin mockear Supabase porque esa rama corta antes de tocar la
 * red. El resto de la función (el insert real) no tiene test unitario, igual
 * que crearTenant hoy: se verifica manualmente (ver Task 12).
 */
describe("guardarRespuestasOnboarding", () => {
  test("con respuestas vacías no hace nada y no lanza", async () => {
    await expect(guardarRespuestasOnboarding("tenant-falso", {})).resolves.toBeUndefined();
  });
});
