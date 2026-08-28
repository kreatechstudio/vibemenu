import { describe, expect, test } from "bun:test";
import { claveEmbudo, marcarEmbudoRespondido, yaRespondioEmbudo } from "@/lib/embudo";

/** localStorage falso: un Map con la misma firma parcial que usa el helper. */
function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    _map: m,
  };
}

function storageQueLanza() {
  return {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceeded");
    },
  };
}

describe("claveEmbudo", () => {
  test("namespacea por tenant", () => {
    expect(claveEmbudo("abc-123")).toBe("vm:embudo:abc-123");
  });
});

describe("yaRespondioEmbudo / marcarEmbudoRespondido", () => {
  test("false antes de marcar, true despues", () => {
    const s = fakeStorage();
    expect(yaRespondioEmbudo("t1", s)).toBe(false);
    marcarEmbudoRespondido("t1", s);
    expect(yaRespondioEmbudo("t1", s)).toBe(true);
  });

  test("cada tenant es independiente", () => {
    const s = fakeStorage();
    marcarEmbudoRespondido("t1", s);
    expect(yaRespondioEmbudo("t2", s)).toBe(false);
  });

  test("guarda un timestamp ISO, no solo un flag", () => {
    const s = fakeStorage();
    marcarEmbudoRespondido("t1", s);
    expect(s._map.get("vm:embudo:t1")).toMatch(/^\d{4}-\d\d-\d\dT/);
  });

  test("storage undefined: no responde, no lanza", () => {
    expect(yaRespondioEmbudo("t1", undefined)).toBe(false);
    expect(() => marcarEmbudoRespondido("t1", undefined)).not.toThrow();
  });

  test("storage que lanza: se trata como 'no respondio', sin propagar", () => {
    const s = storageQueLanza();
    expect(yaRespondioEmbudo("t1", s)).toBe(false);
    expect(() => marcarEmbudoRespondido("t1", s)).not.toThrow();
  });
});
