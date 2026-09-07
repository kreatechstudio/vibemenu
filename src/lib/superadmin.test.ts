import { describe, expect, test } from "bun:test";
import {
  bajoEnUltimosDias,
  senalesDeSalud,
  situacionComercial,
  type SuscripcionMin,
} from "@/lib/superadmin";

const susc = (p: Partial<SuscripcionMin>): SuscripcionMin => ({
  estado: "activa",
  motivo_cambio: null,
  fecha_fin: null,
  fecha_renovacion: null,
  ...p,
});

describe("situacionComercial", () => {
  test("fila activa + sin cancelar = pagando", () => {
    const s = situacionComercial({ estado: "activo", cancela_al_terminar: false }, [susc({})]);
    expect(s.tipo).toBe("pagando");
  });

  test("fila activa + cancela_al_terminar = cancela_al_terminar con fecha", () => {
    const s = situacionComercial({ estado: "activo", cancela_al_terminar: true }, [
      susc({ fecha_renovacion: "2026-11-14T00:00:00Z" }),
    ]);
    expect(s).toEqual({ tipo: "cancela_al_terminar", hasta: "2026-11-14T00:00:00Z" });
  });

  test("sin activa, con canceladas = bajo con la fecha_fin más reciente", () => {
    const s = situacionComercial({ estado: "activo", cancela_al_terminar: false }, [
      susc({ estado: "cancelada", fecha_fin: "2026-05-01T00:00:00Z" }),
      susc({ estado: "cancelada", fecha_fin: "2026-09-01T00:00:00Z" }),
      susc({ estado: "reemplazada", fecha_fin: "2026-03-01T00:00:00Z" }),
    ]);
    expect(s).toEqual({ tipo: "bajo", desde: "2026-09-01T00:00:00Z" });
  });

  test("sin filas + trial = trial", () => {
    expect(situacionComercial({ estado: "trial", cancela_al_terminar: false }, []).tipo).toBe(
      "trial",
    );
  });

  test("sin filas + activo = nunca_pago", () => {
    expect(situacionComercial({ estado: "activo", cancela_al_terminar: null }, []).tipo).toBe(
      "nunca_pago",
    );
  });
});

describe("bajoEnUltimosDias", () => {
  const ahora = new Date("2026-09-20T00:00:00Z");
  test("bajó hace 10 días, ventana 30 = true", () => {
    expect(bajoEnUltimosDias({ tipo: "bajo", desde: "2026-09-10T00:00:00Z" }, 30, ahora)).toBe(
      true,
    );
  });
  test("bajó hace 40 días, ventana 30 = false", () => {
    expect(bajoEnUltimosDias({ tipo: "bajo", desde: "2026-08-11T00:00:00Z" }, 30, ahora)).toBe(
      false,
    );
  });
  test("fecha en el futuro = false", () => {
    expect(bajoEnUltimosDias({ tipo: "bajo", desde: "2026-10-01T00:00:00Z" }, 30, ahora)).toBe(
      false,
    );
  });
  test("no es baja = false", () => {
    expect(bajoEnUltimosDias({ tipo: "pagando" }, 30, ahora)).toBe(false);
  });
});

describe("senalesDeSalud", () => {
  const base = {
    tenant: {
      created_at: "2026-09-10T00:00:00Z",
      lealtad_activa: false,
      formato_activo: "clasico",
      logo_url: null,
      tema: {},
    },
    productos: 0,
    algunaSucursalConReservas: false,
    visitas30: 0,
    ahora: new Date("2026-09-20T00:00:00Z"),
  };

  test("tenant nuevo sin nada: solo 'Días desde el alta' ok", () => {
    const s = senalesDeSalud(base);
    const publico = s.find((x) => x.etiqueta === "Publicó menú")!;
    const dias = s.find((x) => x.etiqueta === "Días desde el alta")!;
    expect(publico.ok).toBe(false);
    expect(dias.ok).toBe(true);
    expect(dias.detalle).toBe("10");
  });

  test("con productos, visitas y lealtad: esas tres ok", () => {
    const s = senalesDeSalud({
      ...base,
      productos: 12,
      visitas30: 40,
      tenant: { ...base.tenant, lealtad_activa: true },
    });
    expect(s.find((x) => x.etiqueta === "Publicó menú")!.ok).toBe(true);
    expect(s.find((x) => x.etiqueta === "Su menú recibe visitas")!.ok).toBe(true);
    expect(s.find((x) => x.etiqueta === "Activó tarjeta de lealtad")!.ok).toBe(true);
  });

  test("personalizó diseño = tema con llaves o logo", () => {
    expect(
      senalesDeSalud({ ...base, tenant: { ...base.tenant, tema: { primario: "#fff" } } }).find(
        (x) => x.etiqueta === "Personalizó diseño",
      )!.ok,
    ).toBe(true);
    expect(
      senalesDeSalud({ ...base, tenant: { ...base.tenant, logo_url: "x.png" } }).find(
        (x) => x.etiqueta === "Personalizó diseño",
      )!.ok,
    ).toBe(true);
  });
});
