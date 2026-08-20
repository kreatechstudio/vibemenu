import { describe, expect, test } from "bun:test";
import {
  colorLegibleParaQr,
  contraste,
  CONTRASTE_MINIMO_QR,
  disposicion,
  LIENZO,
  luminancia,
  MEDIDAS,
  partirPie,
  type OpcionesTarjeta,
} from "@/lib/qr";

/**
 * Un QR que no escanea es papel tirado. Estos helpers deciden si el color de marca
 * del negocio puede pintar el codigo o si hay que caer a negro, y como se reparte
 * el texto de la tarjeta. Sin `document`, `ancho()` estima; alcanza para probar
 * cuantos renglones salen y donde caen, que es lo que se rompe.
 */

const NEGRO = "#0B0B0F";

describe("luminancia", () => {
  test("blanco y negro estan en los extremos", () => {
    expect(luminancia("#FFFFFF")).toBeCloseTo(1, 5);
    expect(luminancia("#000000")).toBeCloseTo(0, 5);
  });

  test("acepta el atajo de tres digitos y no depende del #", () => {
    expect(luminancia("#fff")).toBeCloseTo(luminancia("FFFFFF"), 5);
  });

  test("un hex invalido no revienta: cae a 0", () => {
    expect(luminancia("no-es-un-color")).toBe(0);
  });
});

describe("contraste", () => {
  test("blanco contra negro es el maximo de WCAG", () => {
    expect(contraste("#FFFFFF", "#000000")).toBeCloseTo(21, 1);
  });

  test("es simetrico: el orden de los colores no importa", () => {
    expect(contraste("#C2410C", "#FFFFFF")).toBeCloseTo(contraste("#FFFFFF", "#C2410C"), 6);
  });

  test("un color contra si mismo no contrasta", () => {
    expect(contraste("#C2410C", "#C2410C")).toBeCloseTo(1, 6);
  });
});

describe("colorLegibleParaQr", () => {
  test("un terracota oscuro se imprime tal cual", () => {
    const { color, degradado } = colorLegibleParaQr("#C2410C");
    expect(color).toBe("#C2410C");
    expect(degradado).toBe(false);
  });

  test("un amarillo pastel cae a negro y avisa", () => {
    const { color, degradado } = colorLegibleParaQr("#FFE066");
    expect(color).toBe(NEGRO);
    expect(degradado).toBe(true);
  });

  test("el color devuelto siempre supera el minimo sobre el panel blanco", () => {
    for (const marca of ["#C2410C", "#FFE066", "#FFFFFF", "#1D4ED8", "#84CC16", "#000000"]) {
      const { color } = colorLegibleParaQr(marca);
      expect(contraste(color, "#FFFFFF")).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_QR);
    }
  });

  test("un hex basura no deja el codigo invisible", () => {
    expect(colorLegibleParaQr("rgb(10,10,10)").color).toBe(NEGRO);
  });
});

const tarjeta = (parcial: Partial<OpcionesTarjeta> = {}): OpcionesTarjeta => ({
  url: "https://vibemenu.com/cafe-charly",
  titulo: "Cafe Charly",
  sucursal: null,
  descripcion: null,
  pie: "vibemenu.com/cafe-charly",
  fuenteCss: "Inter, sans-serif",
  colorFondo: "#FFFFFF",
  colorTexto: NEGRO,
  colorQr: NEGRO,
  imagenFondoUrl: null,
  logoUrl: null,
  marcaAgua: false,
  ...parcial,
});

describe("partirPie", () => {
  test("una ruta corta va en un renglon, al tamano grande", () => {
    const { lineas, tamano } = partirPie("vibemenu.com/cafe-charly");
    expect(lineas).toEqual(["vibemenu.com/cafe-charly"]);
    expect(tamano).toBe(MEDIDAS.pie.tamano);
  });

  test("una ruta larga se parte despues de una barra, no a mitad de palabra", () => {
    const larga = `vibemenu.com/${"a".repeat(40)}/sucursal/${"b".repeat(40)}`;
    const { lineas, tamano } = partirPie(larga);

    expect(lineas).toHaveLength(2);
    expect(lineas[0].endsWith("/")).toBe(true);
    expect(lineas.join("")).toBe(larga);
    expect(tamano).toBe(MEDIDAS.pie.tamanoMinimo);
  });

  test("un slug larguisimo sin barras utiles se parte por la mitad, sin perder nada", () => {
    const sinBarras = `vibemenu.com/${"z".repeat(120)}`;
    const { lineas } = partirPie(sinBarras);
    expect(lineas).toHaveLength(2);
    expect(lineas.join("")).toBe(sinBarras);
  });
});

describe("disposicion", () => {
  test("sin descripcion no hay renglones de descripcion", () => {
    expect(disposicion(tarjeta()).descripcion).toEqual([]);
  });

  test("la descripcion nunca pasa de dos renglones", () => {
    const bloque = disposicion(tarjeta({ descripcion: "palabra ".repeat(80) }));
    expect(bloque.descripcion.length).toBeLessThanOrEqual(MEDIDAS.descripcion.maxLineas);
  });

  test("lo que no cabe se admite con puntos suspensivos", () => {
    const bloque = disposicion(tarjeta({ descripcion: "palabra ".repeat(80) }));
    const ultima = bloque.descripcion[bloque.descripcion.length - 1];
    expect(ultima.texto.endsWith("…")).toBe(true);
  });

  test("una descripcion corta cabe entera y sin recortes", () => {
    const bloque = disposicion(tarjeta({ descripcion: "Tostamos cada semana." }));
    expect(bloque.descripcion).toHaveLength(1);
    expect(bloque.descripcion[0].texto).toBe("Tostamos cada semana.");
  });

  test("los renglones bajan en orden y no invaden el codigo ni la marca de agua", () => {
    const bloque = disposicion(tarjeta({ descripcion: "Café de especialidad, tostado aquí." }));
    const ys = [bloque.llamada, ...bloque.descripcion, ...bloque.pie].map((r) => r.y);

    const ordenados = [...ys].sort((a, b) => a - b);
    expect(ys).toEqual(ordenados);

    const abajoDelPanel = MEDIDAS.panel.y + MEDIDAS.panel.lado;
    expect(Math.min(...ys)).toBeGreaterThan(abajoDelPanel);
    expect(Math.max(...ys)).toBeLessThan(MEDIDAS.marca.y - MEDIDAS.marca.tamano);
    expect(Math.max(...ys)).toBeLessThan(LIENZO.alto);
  });

  test("el bloque se recentra al crecer: con descripcion, la llamada sube", () => {
    const sin = disposicion(tarjeta()).llamada.y;
    const con = disposicion(tarjeta({ descripcion: "Café de especialidad." })).llamada.y;
    expect(con).toBeLessThan(sin);
  });
});
