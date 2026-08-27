import { describe, expect, mock, test } from "bun:test";

// @/lib/supabase lanza en tiempo de import si faltan las env vars VITE_SUPABASE_*
// (ver src/lib/supabase.ts). bun test no hace la inyección de import.meta.env que
// hace Vite, así que sin este mock cualquier entorno limpio (incluida la CI) rompe
// el import de @/lib/registro antes de correr ningún test. El test de abajo solo
// ejercita la rama early-return de guardarRespuestasOnboarding, que nunca toca
// supabase, así que un stub vacío alcanza.
//
// mock.module debe registrarse antes de que @/lib/registro (que importa
// @/lib/supabase) se resuelva. Un `import` estático de @/lib/registro no sirve
// aunque se escriba después de esta línea: las declaraciones `import` se
// "hoistean" por encima de todo el resto del módulo, así que se ejecutaría
// antes que mock.module y el mock llegaría tarde. Por eso el import es dinámico.
mock.module("@/lib/supabase", () => ({
  supabase: {} as never,
}));

const { guardarRespuestasOnboarding } = await import("@/lib/registro");

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
