import { describe, expect, test } from "bun:test";
import {
  FILAS_COMPARATIVA,
  GRUPOS_COMPARATIVA,
  filasDeGrupo,
  gruposConFilas,
} from "@/lib/comparativa";
import type { Plan } from "@/types/database";

const plan = (parcial: Partial<Plan>): Plan =>
  ({
    id: "p",
    nombre: "free",
    precio_usd: 0,
    precio_mxn: 0,
    precio_usd_anual: null,
    precio_mxn_anual: null,
    limite_sucursales: 1,
    limite_productos: 20,
    limite_usuarios: 1,
    limite_grupos_modificadores: 2,
    limite_formatos: 1,
    formatos_permitidos: ["clasico"],
    fuentes_permitidas: ["fraunces", "inter"],
    modos_imagen_permitidos: [],
    menu_independiente_por_sucursal: false,
    marca_agua: true,
    permite_multiusuario: false,
    permite_dominio_propio: false,
    permite_color_modificadores: false,
    permite_desenfoque: false,
    qr_color: false,
    qr_avanzado: false,
    permite_pedidos_whatsapp: false,
    permite_embudo_resenas: false,
    permite_reservaciones: false,
    permite_analitica_platillo: false,
    permite_lealtad: false,
    ...parcial,
  }) as Plan;

const FREE = plan({});
const ENTERPRISE = plan({
  nombre: "enterprise",
  precio_mxn_anual: 6990,
  precio_usd_anual: 390,
  limite_sucursales: null,
  limite_productos: null,
  limite_usuarios: null,
  limite_grupos_modificadores: null,
  limite_formatos: null,
  formatos_permitidos: ["clasico", "pinterest", "instagram", "tiktok"],
  fuentes_permitidas: Array(12).fill("x"),
  modos_imagen_permitidos: ["marco", "completo"],
  menu_independiente_por_sucursal: true,
  marca_agua: false,
  permite_multiusuario: true,
  permite_dominio_propio: true,
  permite_color_modificadores: true,
  permite_desenfoque: true,
  qr_color: true,
  qr_avanzado: true,
  permite_pedidos_whatsapp: true,
  permite_embudo_resenas: true,
  permite_reservaciones: true,
  permite_analitica_platillo: true,
  permite_lealtad: true,
});

const ETIQUETAS_FIJAS = new Set([
  "1 foto por producto",
  "Video por URL embebida",
  "Color de acento, fondo y texto",
  "QR imprimible con tu nombre",
  "Soporte por correo",
  "Precio congelado al suscribirte",
]);

describe("cobertura", () => {
  test("cada función de conversión/fidelización tiene su fila", () => {
    const etiquetas = FILAS_COMPARATIVA.map((f) => f.etiqueta);
    for (const e of [
      "Pedir por WhatsApp",
      "Embudo a reseñas de Google",
      "Reservaciones",
      "Tarjeta de lealtad con QR",
      "Analítica por platillo",
    ]) {
      expect(etiquetas).toContain(e);
    }
  });

  test("toda fila declara un grupo válido", () => {
    for (const f of FILAS_COMPARATIVA) {
      expect(GRUPOS_COMPARATIVA).toContain(f.grupo);
    }
  });
});

describe("valores por plan", () => {
  test("Free: las booleanas son false salvo las fijas", () => {
    for (const f of FILAS_COMPARATIVA) {
      const v = f.valor(FREE);
      if (typeof v === "boolean" && !ETIQUETAS_FIJAS.has(f.etiqueta)) {
        expect(v).toBe(false);
      }
    }
  });

  test("Enterprise: ninguna booleana es false", () => {
    for (const f of FILAS_COMPARATIVA) {
      const v = f.valor(ENTERPRISE);
      if (typeof v === "boolean") expect(v).toBe(true);
    }
  });

  test("Soporte prioritario solo en enterprise", () => {
    const fila = FILAS_COMPARATIVA.find((f) => f.etiqueta === "Soporte prioritario")!;
    expect(fila.valor(FREE)).toBe(false);
    expect(fila.valor(plan({ nombre: "pro" }))).toBe(false);
    expect(fila.valor(ENTERPRISE)).toBe(true);
  });

  test("Descuento en plan anual sigue a precio_mxn_anual", () => {
    const fila = FILAS_COMPARATIVA.find((f) => f.etiqueta === "Descuento en plan anual")!;
    expect(fila.valor(FREE)).toBe(false);
    expect(fila.valor(plan({ precio_mxn_anual: 1690 }))).toBe(true);
  });
});

describe("agrupado", () => {
  test("gruposConFilas respeta el orden canónico", () => {
    const g = gruposConFilas(false);
    expect(g).toEqual([...GRUPOS_COMPARATIVA].filter((x) => g.includes(x)));
  });

  test("las destacadas son un subconjunto", () => {
    const rapida = gruposConFilas(true);
    const completa = gruposConFilas(false);
    for (const x of rapida) expect(completa).toContain(x);
  });

  test("filasDeGrupo(g, true) son todas destacadas", () => {
    for (const g of GRUPOS_COMPARATIVA) {
      for (const f of filasDeGrupo(g, true)) expect(f.destacada).toBe(true);
    }
  });

  test("hay entre 7 y 10 filas destacadas", () => {
    const n = FILAS_COMPARATIVA.filter((f) => f.destacada).length;
    expect(n).toBeGreaterThanOrEqual(7);
    expect(n).toBeLessThanOrEqual(10);
  });
});
