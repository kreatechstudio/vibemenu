import { describe, expect, test } from "bun:test";
import { combinarTelefono, LADA_DEFAULT, PAISES_LADA } from "@/lib/paises";

describe("PAISES_LADA", () => {
  test("no tiene ladas vacías", () => {
    for (const p of PAISES_LADA) {
      expect(p.lada.length).toBeGreaterThan(1);
      expect(p.lada.startsWith("+")).toBe(true);
      expect(p.pais.length).toBeGreaterThan(0);
    }
  });

  test("México está en la lista con +52", () => {
    const mexico = PAISES_LADA.find((p) => p.pais === "México");
    expect(mexico?.lada).toBe("+52");
  });

  test("LADA_DEFAULT es la lada de México", () => {
    expect(LADA_DEFAULT).toBe("+52");
  });
});

describe("combinarTelefono", () => {
  test("combina lada y número con un espacio", () => {
    expect(combinarTelefono("+52", "55 1234 5678")).toBe("+52 55 1234 5678");
  });

  test("recorta espacios sobrantes del número", () => {
    expect(combinarTelefono("+52", "  55 1234 5678  ")).toBe("+52 55 1234 5678");
  });

  test("número vacío devuelve null", () => {
    expect(combinarTelefono("+52", "")).toBeNull();
    expect(combinarTelefono("+52", "   ")).toBeNull();
  });
});
