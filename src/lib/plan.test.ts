import { describe, expect, test } from "bun:test";
import {
  alcanzoLimite,
  formatearPrecio,
  fraccionDeUso,
  fuentesDelPlan,
  modosImagenDelPlan,
  permiteColorModificadores,
  permiteDesenfoque,
  permiteImagenDeFondo,
  puedeDesbloquearOtroFormato,
  restantes,
  textoLimite,
} from "@/lib/plan";
import type { Plan } from "@/types/database";

/**
 * Estos helpers deciden qué botón se deshabilita y qué candado se pinta.
 * El bloqueo real lo hacen los triggers de Postgres (ver plan_triggers.test.sql),
 * pero si aquí hay un bug, un cliente de Free ve controles que no puede usar,
 * o uno de Pro ve candados en algo que ya pagó.
 */

const plan = (parcial: Partial<Plan>): Plan =>
  ({
    id: "p",
    nombre: "free",
    precio_usd: 0,
    precio_mxn: 0,
    limite_sucursales: 1,
    limite_productos: 20,
    limite_usuarios: 1,
    limite_grupos_modificadores: 2,
    limite_formatos: 1,
    formatos_permitidos: ["clasico"],
    menu_independiente_por_sucursal: false,
    permite_multiusuario: false,
    permite_dominio_propio: false,
    marca_agua: true,
    stripe_price_id_usd: null,
    stripe_price_id_mxn: null,
    fuentes_permitidas: ["fraunces", "inter"],
    permite_color_modificadores: false,
    modos_imagen_permitidos: [],
    permite_desenfoque: false,
    ...parcial,
  }) as Plan;

describe("límites", () => {
  test("null significa ilimitado, nunca cero", () => {
    expect(alcanzoLimite(null, 9_999)).toBe(false);
    expect(restantes(null, 9_999)).toBeNull();
    expect(fraccionDeUso(null, 9_999)).toBeNull();
    expect(textoLimite(null)).toBe("Ilimitados");
  });

  test("se topa al llegar, no al pasarse", () => {
    expect(alcanzoLimite(20, 19)).toBe(false);
    expect(alcanzoLimite(20, 20)).toBe(true);
  });

  test("restantes nunca es negativo", () => {
    expect(restantes(20, 25)).toBe(0);
  });

  test("la barra de uso se satura en 1", () => {
    expect(fraccionDeUso(20, 30)).toBe(1);
    expect(fraccionDeUso(20, 10)).toBe(0.5);
  });

  test("un límite de cero no revienta la división", () => {
    expect(fraccionDeUso(0, 5)).toBeNull();
  });
});

describe("formatos", () => {
  test("Free no puede desbloquear nada: su pool es solo Clásico", () => {
    expect(puedeDesbloquearOtroFormato(plan({}), ["clasico"])).toBe(false);
  });

  test("Basic: Clásico + uno a elegir, y no un tercero", () => {
    const basic = plan({
      limite_formatos: 2,
      formatos_permitidos: ["clasico", "pinterest", "instagram", "tiktok"],
    });
    expect(puedeDesbloquearOtroFormato(basic, ["clasico"])).toBe(true);
    expect(puedeDesbloquearOtroFormato(basic, ["clasico", "tiktok"])).toBe(false);
  });

  test("Pro: sin límite, pero se acaba cuando ya tiene los 4", () => {
    const pro = plan({
      limite_formatos: null,
      formatos_permitidos: ["clasico", "pinterest", "instagram", "tiktok"],
    });
    expect(puedeDesbloquearOtroFormato(pro, ["clasico"])).toBe(true);
    expect(puedeDesbloquearOtroFormato(pro, ["clasico", "pinterest", "instagram", "tiktok"])).toBe(
      false,
    );
  });
});

describe("tema por plan", () => {
  test("Free: dos fuentes, sin imagen, sin color de modificadores ni desenfoque", () => {
    const p = plan({});
    expect(fuentesDelPlan(p)).toEqual(["fraunces", "inter"]);
    expect(permiteImagenDeFondo(p)).toBe(false);
    expect(modosImagenDelPlan(p)).toEqual([]);
    expect(permiteColorModificadores(p)).toBe(false);
    expect(permiteDesenfoque(p)).toBe(false);
  });

  test("Basic: solo modo marco", () => {
    const basic = plan({ modos_imagen_permitidos: ["marco"], permite_color_modificadores: true });
    expect(permiteImagenDeFondo(basic)).toBe(true);
    expect(modosImagenDelPlan(basic)).toEqual(["marco"]);
    expect(permiteDesenfoque(basic)).toBe(false);
  });

  test("los modos salen en orden canónico, no en el de la base", () => {
    const pro = plan({ modos_imagen_permitidos: ["completo", "marco"] });
    expect(modosImagenDelPlan(pro)).toEqual(["marco", "completo"]);
  });

  test("las fuentes salen en el orden del catálogo, no en el de la base", () => {
    const p = plan({ fuentes_permitidas: ["inter", "fraunces"] });
    expect(fuentesDelPlan(p)).toEqual(["fraunces", "inter"]);
  });

  test("una fuente inventada en la base se ignora", () => {
    const p = plan({ fuentes_permitidas: ["fraunces", "comic-sans"] });
    expect(fuentesDelPlan(p)).toEqual(["fraunces"]);
  });

  /**
   * Si la migración 002 no se ha corrido, estas columnas llegan undefined.
   * Deben caer al comportamiento más restrictivo, no reventar la pantalla.
   */
  test("antes de la migración 002, el plan cae a lo más restrictivo", () => {
    const sinMigrar = { ...plan({}) } as Partial<Plan>;
    delete sinMigrar.fuentes_permitidas;
    delete sinMigrar.modos_imagen_permitidos;
    delete sinMigrar.permite_color_modificadores;
    delete sinMigrar.permite_desenfoque;
    const p = sinMigrar as Plan;

    expect(fuentesDelPlan(p)).toEqual(["fraunces", "inter"]);
    expect(permiteImagenDeFondo(p)).toBe(false);
    expect(permiteColorModificadores(p)).toBe(false);
    expect(permiteDesenfoque(p)).toBe(false);
  });
});

describe("precios", () => {
  test("MXN y USD llevan su símbolo y sin decimales", () => {
    expect(formatearPrecio(349, "mxn")).toContain("349");
    expect(formatearPrecio(19, "usd")).toContain("19");
  });

  test("el plan gratis muestra cero, no vacío", () => {
    expect(formatearPrecio(0, "mxn")).toContain("0");
  });
});
