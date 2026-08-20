import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { CLAVES_FUENTE, FUENTES } from "@/lib/fuentes";
import { precioMenu, resolverTema, variablesDeTema } from "@/lib/tema";

describe("catálogo de fuentes", () => {
  /**
   * Las claves viven en TRES sitios: fuentes.ts, la restricción
   * `fuentes_permitidas_validas` de la tabla `planes`, y el <link> de Google Fonts.
   * Si se agrega una fuente en uno y no en los otros, el INSERT falla en producción
   * o la fuente no carga. Esta prueba lee el SQL real y los compara.
   */
  test("coinciden con la restricción de la migración 002", () => {
    const sql = readFileSync("src/docs/vibemenu_migracion_tema.sql", "utf8");
    const bloque = sql.match(/fuentes_permitidas <@ array\[([\s\S]*?)\]/);
    expect(bloque).not.toBeNull();

    const enSql = [...bloque![1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(enSql).toEqual([...CLAVES_FUENTE].sort());
  });

  test("cada fuente declara su familia CSS y su categoría", () => {
    for (const clave of CLAVES_FUENTE) {
      expect(FUENTES[clave].css).toContain("'");
      expect(FUENTES[clave].nombre.length).toBeGreaterThan(2);
    }
  });
});

describe("resolverTema", () => {
  test("un tema vacío no rompe: usa los defaults del formato", () => {
    const t = resolverTema({}, "clasico");
    expect(t.fuente).toBe("fraunces");
    expect(t.modo_imagen).toBe("ninguno");
  });

  test("nunca usa el azul de Vibemenu como color por defecto", () => {
    const t = resolverTema({}, "clasico");
    expect(t.color_primario.toUpperCase()).not.toBe("#2B4EFF");
  });

  test("TikTok arranca oscuro; Pinterest e Instagram, en blanco", () => {
    expect(resolverTema({}, "tiktok").color_fondo).toBe("#0A0A0A");
    expect(resolverTema({}, "pinterest").color_fondo).toBe("#FFFFFF");
    expect(resolverTema({}, "instagram").color_fondo).toBe("#FFFFFF");
  });

  test("el campo legado `tipografia` se traduce a una fuente del catálogo", () => {
    expect(resolverTema({ tipografia: "serif" }, "clasico").fuente).toBe("fraunces");
    expect(resolverTema({ tipografia: "sans" }, "clasico").fuente).toBe("inter");
  });

  test("`fuente` gana sobre el campo legado", () => {
    const t = resolverTema({ tipografia: "serif", fuente: "anton" }, "clasico");
    expect(t.fuente).toBe("anton");
  });

  test("una fuente inventada en el jsonb se ignora", () => {
    const t = resolverTema({ fuente: "comic-sans" } as never, "clasico");
    expect(t.fuente).toBe("fraunces");
  });

  /** Si el tenant borró la foto, un modo activo dejaría un marco vacío. */
  test("sin imagen no hay modo, aunque el jsonb diga lo contrario", () => {
    const t = resolverTema({ modo_imagen: "completo", imagen_fondo_url: null }, "clasico");
    expect(t.modo_imagen).toBe("ninguno");
  });

  test("con imagen, el modo se respeta", () => {
    const t = resolverTema(
      { modo_imagen: "marco", imagen_fondo_url: "https://x/y.jpg" },
      "clasico",
    );
    expect(t.modo_imagen).toBe("marco");
  });

  test("un jsonb corrupto (array, string, null) no revienta", () => {
    expect(resolverTema(null, "clasico").fuente).toBe("fraunces");
    expect(resolverTema([1, 2] as never, "clasico").fuente).toBe("fraunces");
    expect(resolverTema("hola" as never, "clasico").fuente).toBe("fraunces");
  });

  test("las cadenas vacías no pisan los defaults", () => {
    const t = resolverTema({ color_primario: "" }, "clasico");
    expect(t.color_primario).toBe("#C2410C");
  });
});

describe("variablesDeTema", () => {
  test("expone las cinco variables que consumen los formatos", () => {
    const vars = variablesDeTema(resolverTema({}, "clasico")) as Record<string, string>;
    for (const v of [
      "--menu-primario",
      "--menu-fondo",
      "--menu-texto",
      "--menu-modificadores",
      "--menu-fuente",
    ]) {
      expect(vars[v]).toBeTruthy();
    }
  });
});

describe("precioMenu", () => {
  test("siempre dos decimales, para que la línea punteada alinee", () => {
    expect(precioMenu(65)).toBe("$65.00");
    expect(precioMenu(1234.5)).toBe("$1,234.50");
  });
});
