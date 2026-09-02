import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import {
  codigoValido,
  guardarTarjetaLocal,
  leerTarjetaLocal,
  normalizarCodigo,
  olvidarTarjetaLocal,
  progresoLealtad,
  puedeSellarHoy,
  rejillaSellos,
  validarCorreo,
  validarTelefono,
} from "@/lib/lealtad";

let previo: unknown;
beforeAll(() => {
  previo = (globalThis as Record<string, unknown>).localStorage;
  if (typeof (globalThis as Record<string, unknown>).localStorage === "undefined") {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    };
  }
});
afterAll(() => {
  if (previo === undefined) delete (globalThis as Record<string, unknown>).localStorage;
  else (globalThis as Record<string, unknown>).localStorage = previo;
});

describe("normalizarCodigo / codigoValido", () => {
  test("mayúsculas, quita ambiguos y separadores, recorta a 6", () => {
    expect(normalizarCodigo(" abc-234 z")).toBe("ABC234"); // 'z' fuera del alfabeto? Z sí está
    expect(normalizarCodigo("abc234z9")).toBe("ABC234"); // recorta a 6
    expect(normalizarCodigo("a1b0c")).toBe("ABC"); // 1 y 0 no están en el alfabeto
  });
  test("codigoValido exige 6 chars del alfabeto", () => {
    expect(codigoValido("ABC234")).toBe(true);
    expect(codigoValido("ABC23")).toBe(false);
    expect(codigoValido("ABC2O1")).toBe(false); // O y 1 fuera
  });
});

describe("validarTelefono", () => {
  test("10 dígitos → +52", () => {
    expect(validarTelefono("8112345678")).toEqual({ ok: true, e164: "+528112345678" });
  });
  test("con lada explícita", () => {
    expect(validarTelefono("+1 415 555 1234")).toEqual({ ok: true, e164: "+14155551234" });
  });
  test("basura", () => {
    expect(validarTelefono("123").ok).toBe(false);
    expect(validarTelefono("abcdef").ok).toBe(false);
  });
});

describe("validarCorreo", () => {
  test("acepta y rechaza", () => {
    expect(validarCorreo("a@b.com")).toBe(true);
    expect(validarCorreo("a@b")).toBe(false);
    expect(validarCorreo("sin arroba")).toBe(false);
  });
});

describe("progresoLealtad", () => {
  test("a medias", () => {
    expect(progresoLealtad(3, 8)).toEqual({ hechos: 3, faltan: 5, completa: false, pct: 3 / 8 });
  });
  test("completa y con extras", () => {
    const p = progresoLealtad(9, 8);
    expect(p.completa).toBe(true);
    expect(p.faltan).toBe(0);
    expect(p.pct).toBe(1);
    expect(p.hechos).toBe(8);
  });
});

describe("rejillaSellos", () => {
  test("longitud meta, llenos los primeros", () => {
    expect(rejillaSellos(2, 5)).toEqual([true, true, false, false, false]);
    expect(rejillaSellos(7, 5)).toEqual([true, true, true, true, true]);
  });
});

describe("puedeSellarHoy", () => {
  test("mismo día no; otro día o null sí", () => {
    expect(puedeSellarHoy("2026-09-02", "2026-09-02")).toBe(false);
    expect(puedeSellarHoy("2026-09-01", "2026-09-02")).toBe(true);
    expect(puedeSellarHoy(null, "2026-09-02")).toBe(true);
  });
});

describe("localStorage helpers", () => {
  test("guardar / leer / olvidar", () => {
    const slug = "taqueria-" + Math.random().toString(36).slice(2);
    expect(leerTarjetaLocal(slug)).toBeNull();
    guardarTarjetaLocal(slug, "11111111-2222-3333-4444-555555555555");
    expect(leerTarjetaLocal(slug)).toBe("11111111-2222-3333-4444-555555555555");
    olvidarTarjetaLocal(slug);
    expect(leerTarjetaLocal(slug)).toBeNull();
  });
});
