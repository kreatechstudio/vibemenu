import { describe, expect, test } from "bun:test";
import { enlaceMaps } from "@/lib/maps";
import { esUrlValida } from "@/lib/url";

describe("enlaceMaps", () => {
  test("el enlace que pego el dueno manda sobre la direccion", () => {
    const url = enlaceMaps({
      direccion: "Av. Juárez 120",
      maps_url: "https://maps.app.goo.gl/abc",
    });
    expect(url).toBe("https://maps.app.goo.gl/abc");
  });

  test("sin enlace, arma una busqueda con el nombre y la direccion", () => {
    const url = enlaceMaps({ direccion: "Av. Juárez 120", maps_url: null }, "Café Aurora");
    expect(url).toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(decodeURIComponent(url!)).toContain("Café Aurora, Av. Juárez 120");
  });

  test("sin nombre, busca solo la direccion", () => {
    const url = enlaceMaps({ direccion: "Av. Juárez 120", maps_url: null });
    expect(decodeURIComponent(url!)).toContain("query=Av. Juárez 120");
  });

  test("sin direccion ni enlace no hay mapa", () => {
    expect(enlaceMaps({ direccion: null, maps_url: null })).toBeNull();
    expect(enlaceMaps({ direccion: "   ", maps_url: "  " })).toBeNull();
  });
});

describe("esUrlValida", () => {
  test("acepta http y https", () => {
    expect(esUrlValida("https://maps.app.goo.gl/abc")).toBe(true);
    expect(esUrlValida("http://goo.gl/maps/x")).toBe(true);
  });

  test("rechaza lo que no es una URL, y los esquemas peligrosos", () => {
    expect(esUrlValida("maps.app.goo.gl/abc")).toBe(false);
    expect(esUrlValida("javascript:alert(1)")).toBe(false);
    expect(esUrlValida("")).toBe(false);
  });
});
