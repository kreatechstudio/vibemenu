import { describe, expect, test } from "bun:test";
import {
  bajoEnUltimosDias,
  senalesDeSalud,
  situacionComercial,
  type SuscripcionMin,
} from "@/lib/superadmin";

const susc = (p: Partial<SuscripcionMin>): SuscripcionMin => ({
  estado: "activa",
  fecha_fin: null,
  fecha_renovacion: null,
  ...p,
});

const tnt = (p: Partial<Parameters<typeof situacionComercial>[0]>) => ({
  estado: "activo",
  cancela_al_terminar: false,
  trial_iniciado_at: null,
  pago_fallido_desde: null,
  ...p,
});

describe("situacionComercial", () => {
  test("fila activa + sin nada = pagando", () => {
    expect(situacionComercial(tnt({}), [susc({})]).tipo).toBe("pagando");
  });

  test("estado suspendido gana sobre todo", () => {
    expect(situacionComercial(tnt({ estado: "suspendido" }), [susc({})])).toEqual({
      tipo: "suspendido",
    });
  });

  test("fila activa + pago_fallido_desde = pago_fallido con fecha", () => {
    expect(
      situacionComercial(tnt({ pago_fallido_desde: "2026-09-01T00:00:00Z" }), [susc({})]),
    ).toEqual({ tipo: "pago_fallido", desde: "2026-09-01T00:00:00Z" });
  });

  test("fila activa + cancela_al_terminar = cancela_al_terminar", () => {
    expect(
      situacionComercial(tnt({ cancela_al_terminar: true }), [
        susc({ fecha_renovacion: "2026-11-14T00:00:00Z" }),
      ]),
    ).toEqual({ tipo: "cancela_al_terminar", hasta: "2026-11-14T00:00:00Z" });
  });

  test("sin activa, con canceladas = bajo con la fecha_fin más reciente", () => {
    expect(
      situacionComercial(tnt({}), [
        susc({ estado: "cancelada", fecha_fin: "2026-05-01T00:00:00Z" }),
        susc({ estado: "cancelada", fecha_fin: "2026-09-01T00:00:00Z" }),
      ]),
    ).toEqual({ tipo: "bajo", desde: "2026-09-01T00:00:00Z" });
  });

  test("trial dentro de los 14 días = trial", () => {
    const ahora = new Date("2026-09-10T00:00:00Z");
    expect(
      situacionComercial(
        tnt({ estado: "trial", trial_iniciado_at: "2026-09-01T00:00:00Z" }),
        [],
        ahora,
      ).tipo,
    ).toBe("trial");
  });

  test("trial vencido y nunca pagó = nunca_pago", () => {
    const ahora = new Date("2026-10-01T00:00:00Z");
    expect(
      situacionComercial(
        tnt({ estado: "trial", trial_iniciado_at: "2026-09-01T00:00:00Z" }),
        [],
        ahora,
      ).tipo,
    ).toBe("nunca_pago");
  });

  test("trial sin fecha = trial (aún no arranca el reloj)", () => {
    expect(situacionComercial(tnt({ estado: "trial" }), []).tipo).toBe("trial");
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

  test("formato_activo distinto de 'clasico' marca 'Personalizó diseño' ok", () => {
    expect(
      senalesDeSalud({ ...base, tenant: { ...base.tenant, formato_activo: "tiktok" } }).find(
        (x) => x.etiqueta === "Personalizó diseño",
      )!.ok,
    ).toBe(true);
    expect(
      senalesDeSalud({ ...base, tenant: { ...base.tenant, formato_activo: "clasico" } }).find(
        (x) => x.etiqueta === "Personalizó diseño",
      )!.ok,
    ).toBe(false);
  });
});
