import { describe, expect, test } from "bun:test";
import { DIAS_GRACIA, fechaLimiteGracia, graciaVencida } from "@/lib/gracia";

describe("DIAS_GRACIA", () => {
  test("son 7 días", () => {
    expect(DIAS_GRACIA).toBe(7);
  });
});

describe("fechaLimiteGracia", () => {
  test("suma 7 días a la fecha de inicio", () => {
    expect(fechaLimiteGracia("2026-08-01T00:00:00.000Z").toISOString()).toBe(
      "2026-08-08T00:00:00.000Z",
    );
  });

  test("conserva la hora del día", () => {
    expect(fechaLimiteGracia("2026-08-01T14:30:00.000Z").toISOString()).toBe(
      "2026-08-08T14:30:00.000Z",
    );
  });
});

describe("graciaVencida", () => {
  test("null (al corriente) nunca está vencida", () => {
    expect(graciaVencida(null)).toBe(false);
  });

  test("dentro de los 7 días: no vencida", () => {
    const hace3dias = new Date("2026-08-01T00:00:00.000Z");
    const ahora = new Date("2026-08-04T00:00:00.000Z");
    expect(graciaVencida(hace3dias.toISOString(), ahora)).toBe(false);
  });

  test("justo en el límite de 7 días: vencida", () => {
    const desde = new Date("2026-08-01T00:00:00.000Z");
    const ahora = new Date("2026-08-08T00:00:00.000Z");
    expect(graciaVencida(desde.toISOString(), ahora)).toBe(true);
  });

  test("pasados los 7 días: vencida", () => {
    const desde = new Date("2026-08-01T00:00:00.000Z");
    const ahora = new Date("2026-08-20T00:00:00.000Z");
    expect(graciaVencida(desde.toISOString(), ahora)).toBe(true);
  });
});
