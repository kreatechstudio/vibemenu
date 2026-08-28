import { expect, test, describe } from "bun:test";
import {
  esApexSegunVercel,
  instruccionesDNS,
  motivoProblemaDNS,
  type DominioDiagnostico,
} from "./dominio";

const diagBase: DominioDiagnostico = {
  name: "menu.tienda.com.mx",
  apexName: "tienda.com.mx",
  misconfigured: false,
  verification: [],
  recommendedIPv4: ["76.76.21.21"],
  recommendedCNAME: ["cname.vercel-dns.com"],
  revisado_at: "2026-08-28T00:00:00.000Z",
};

describe("esApexSegunVercel", () => {
  test("subdominio .com.mx no es apex", () => {
    expect(esApexSegunVercel("menu.tienda.com.mx", "tienda.com.mx")).toBe(false);
  });
  test("apex .com.mx es apex", () => {
    expect(esApexSegunVercel("tienda.com.mx", "tienda.com.mx")).toBe(true);
  });
});

describe("instruccionesDNS", () => {
  test("subdominio .com.mx -> un CNAME al valor recomendado", () => {
    const r = instruccionesDNS("menu.tienda.com.mx", diagBase);
    expect(r).toEqual([{ tipo: "CNAME", nombre: "menu", valor: "cname.vercel-dns.com" }]);
  });

  test("apex .com.mx -> un registro A al IPv4 recomendado", () => {
    const diag = { ...diagBase, name: "tienda.com.mx", apexName: "tienda.com.mx" };
    const r = instruccionesDNS("tienda.com.mx", diag);
    expect(r).toEqual([{ tipo: "A", nombre: "@", valor: "76.76.21.21" }]);
  });

  test("sin diagnostico -> fallback estatico por conteo de labels sobre sufijo conocido", () => {
    expect(instruccionesDNS("tienda.com.mx", null)).toEqual([
      { tipo: "A", nombre: "@", valor: "76.76.21.21" },
    ]);
    expect(instruccionesDNS("menu.tienda.com.mx", null)).toEqual([
      { tipo: "CNAME", nombre: "menu", valor: "cname.vercel-dns.com" },
    ]);
    expect(instruccionesDNS("menu.tienda.com", null)).toEqual([
      { tipo: "CNAME", nombre: "menu", valor: "cname.vercel-dns.com" },
    ]);
    expect(instruccionesDNS("tienda.com", null)).toEqual([
      { tipo: "A", nombre: "@", valor: "76.76.21.21" },
    ]);
  });

  test("diagnostico sin recomendados -> cae a los valores estaticos", () => {
    const diag = { ...diagBase, recommendedIPv4: [], recommendedCNAME: [] };
    expect(instruccionesDNS("menu.tienda.com.mx", diag)).toEqual([
      { tipo: "CNAME", nombre: "menu", valor: "cname.vercel-dns.com" },
    ]);
  });

  test("subdominio de dos niveles -> el nombre del registro sale de apexName", () => {
    const diag: DominioDiagnostico = {
      ...diagBase,
      name: "menu.sucursales.tienda.com",
      apexName: "tienda.com",
    };
    expect(instruccionesDNS("menu.sucursales.tienda.com", diag)).toEqual([
      { tipo: "CNAME", nombre: "menu.sucursales", valor: "cname.vercel-dns.com" },
    ]);
  });
});

describe("motivoProblemaDNS", () => {
  test("null cuando no hay diagnostico", () => {
    expect(motivoProblemaDNS(null)).toBeNull();
  });
  test("null cuando misconfigured es false", () => {
    expect(motivoProblemaDNS(diagBase)).toBeNull();
  });
  test("mensaje generico cuando misconfigured y sin verification", () => {
    expect(motivoProblemaDNS({ ...diagBase, misconfigured: true })).toBe(
      "No encontramos el registro DNS, o apunta a otro lado. Revisa que coincida exactamente con lo de abajo.",
    );
  });
  test("usa el reason de verification cuando existe", () => {
    const diag: DominioDiagnostico = {
      ...diagBase,
      misconfigured: true,
      verification: [
        { type: "TXT", domain: "_vercel.tienda.com.mx", value: "abc", reason: "pending" },
      ],
    };
    expect(motivoProblemaDNS(diag)).toContain("_vercel.tienda.com.mx");
  });

  test("reto de verification pendiente aunque misconfigured sea false", () => {
    const diag: DominioDiagnostico = {
      ...diagBase,
      misconfigured: false,
      verification: [
        { type: "TXT", domain: "_vercel.tienda.com.mx", value: "abc", reason: "pending" },
      ],
    };
    expect(motivoProblemaDNS(diag)).toContain("_vercel.tienda.com.mx");
  });
});
