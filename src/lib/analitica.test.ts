import { describe, expect, test } from "bun:test";
import {
  claveDedup,
  ignoradosDesde,
  porHoraDe,
  rankingDesde,
  serieDesde,
  yaRegistrada,
  type FilaInteraccion,
} from "@/lib/analitica";

// Mock sessionStorage for tests
if (typeof globalThis.sessionStorage === "undefined") {
  const store = new Map<string, string>();
  globalThis.sessionStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    length: 0,
    key: (_index: number) => null,
  } as Storage;
}

const fila = (over: Partial<FilaInteraccion>): FilaInteraccion => ({
  sucursal_id: null,
  producto_id: "p1",
  dia: "2026-09-01",
  hora: 14,
  vistas: 0,
  agregados: 0,
  ...over,
});

describe("claveDedup", () => {
  const ahora = new Date("2026-09-01T14:30:00-06:00");
  test("incluye tenant, sucursal, producto, tipo y la hora local", () => {
    const k = claveDedup("t1", "s1", "p1", "vista", ahora);
    expect(k).toContain("t1");
    expect(k).toContain("s1");
    expect(k).toContain("p1");
    expect(k).toContain("vista");
  });
  test("menú general usa 'general' en vez de la sucursal", () => {
    expect(claveDedup("t1", null, "p1", "vista", ahora)).toContain("general");
  });
  test("cambia al cambiar de hora", () => {
    const otra = new Date("2026-09-01T15:30:00-06:00");
    expect(claveDedup("t1", "s1", "p1", "vista", ahora)).not.toBe(
      claveDedup("t1", "s1", "p1", "vista", otra),
    );
  });
  test("cambia al cambiar de tipo y de producto", () => {
    expect(claveDedup("t1", "s1", "p1", "vista", ahora)).not.toBe(
      claveDedup("t1", "s1", "p1", "agregado", ahora),
    );
    expect(claveDedup("t1", "s1", "p1", "vista", ahora)).not.toBe(
      claveDedup("t1", "s1", "p2", "vista", ahora),
    );
  });
});

describe("yaRegistrada", () => {
  test("false la primera vez, true la segunda", () => {
    const k = "vm:ip:test:" + Math.random();
    expect(yaRegistrada(k)).toBe(false);
    expect(yaRegistrada(k)).toBe(true);
  });
});

describe("rankingDesde", () => {
  const nombres = new Map([
    ["p1", "Tacos"],
    ["p2", "Pozole"],
  ]);
  test("suma por producto y ordena por vistas desc", () => {
    const r = rankingDesde(
      [
        fila({ producto_id: "p1", vistas: 3, agregados: 1 }),
        fila({ producto_id: "p1", hora: 20, vistas: 2, agregados: 1 }),
        fila({ producto_id: "p2", vistas: 10, agregados: 0 }),
      ],
      nombres,
    );
    expect(r.map((x) => x.productoId)).toEqual(["p2", "p1"]);
    expect(r[1]).toMatchObject({ nombre: "Tacos", vistas: 5, agregados: 2 });
  });
  test("tasa null si vistas 0 o si agregados > vistas", () => {
    const r = rankingDesde(
      [
        fila({ producto_id: "p1", vistas: 0, agregados: 2 }),
        fila({ producto_id: "p2", vistas: 4, agregados: 1 }),
      ],
      nombres,
    );
    expect(r.find((x) => x.productoId === "p1")!.tasa).toBeNull();
    expect(r.find((x) => x.productoId === "p2")!.tasa).toBeCloseTo(0.25);
  });
});

describe("porHoraDe", () => {
  test("24 entradas, relleno con ceros, filtrado al producto", () => {
    const h = porHoraDe(
      [
        fila({ producto_id: "p1", hora: 14, vistas: 2 }),
        fila({ producto_id: "p1", hora: 14, agregados: 1 }),
        fila({ producto_id: "p2", hora: 9, vistas: 99 }),
      ],
      "p1",
    );
    expect(h).toHaveLength(24);
    expect(h[14]).toEqual({ hora: 14, vistas: 2, agregados: 1 });
    expect(h[9]).toEqual({ hora: 9, vistas: 0, agregados: 0 });
  });
});

describe("serieDesde", () => {
  test("rellena días sin datos y respeta el rango", () => {
    const hoy = new Date("2026-09-03T12:00:00Z");
    const s = serieDesde([fila({ dia: "2026-09-02", vistas: 5 })], 3, hoy);
    expect(s).toHaveLength(3);
    expect(s.map((x) => x.dia)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(s[1].vistas).toBe(5);
    expect(s[0].vistas).toBe(0);
  });
});

describe("ignoradosDesde", () => {
  test("productos activos por debajo del umbral, orden por vistas asc", () => {
    const r = ignoradosDesde(
      [fila({ producto_id: "p1", vistas: 1 }), fila({ producto_id: "p2", vistas: 10 })],
      [
        { id: "p1", nombre: "Tacos" },
        { id: "p2", nombre: "Pozole" },
        { id: "p3", nombre: "Agua" },
      ],
      3,
    );
    expect(r.map((x) => x.productoId)).toEqual(["p3", "p1"]); // p3 con 0, p1 con 1
    expect(r).not.toContainEqual(expect.objectContaining({ productoId: "p2" }));
  });
});
