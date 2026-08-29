import { describe, expect, test } from "bun:test";
import { construirMensajePedido, totalPedido, type LineaPedido } from "@/lib/pedido";

const lineas: LineaPedido[] = [
  { nombre: "Cappuccino", cantidad: 2, precioUnitario: 180 },
  { nombre: "Concha", cantidad: 1, precioUnitario: 45 },
];

describe("totalPedido", () => {
  test("suma cantidad x precioUnitario de cada linea", () => {
    expect(totalPedido(lineas)).toBe(405);
  });

  test("lista vacia => 0", () => {
    expect(totalPedido([])).toBe(0);
  });
});

describe("construirMensajePedido", () => {
  test("encabezado con sucursal", () => {
    const msg = construirMensajePedido({ negocio: "Café Aurora", sucursal: "Centro", lineas });
    expect(msg.startsWith("Hola, quiero hacer un pedido de Café Aurora (Centro):")).toBe(true);
  });

  test("encabezado sin sucursal (null o undefined)", () => {
    expect(
      construirMensajePedido({ negocio: "Café Aurora", sucursal: null, lineas }).startsWith(
        "Hola, quiero hacer un pedido de Café Aurora:",
      ),
    ).toBe(true);
    expect(
      construirMensajePedido({ negocio: "Café Aurora", lineas }).startsWith(
        "Hola, quiero hacer un pedido de Café Aurora:",
      ),
    ).toBe(true);
  });

  test("una linea se formatea con cantidad, nombre y subtotal", () => {
    const msg = construirMensajePedido({
      negocio: "X",
      lineas: [{ nombre: "Cappuccino", cantidad: 2, precioUnitario: 180 }],
    });
    expect(msg).toContain("• 2 × Cappuccino — $360.00");
    expect(msg).toContain("Total: $360.00");
  });

  test("nota con espacios => se recorta y va al final", () => {
    const msg = construirMensajePedido({
      negocio: "X",
      lineas,
      nota: "  a las 3pm  ",
    });
    expect(msg.endsWith("Nota: a las 3pm")).toBe(true);
  });

  test("nota vacia o ausente => sin linea Nota:", () => {
    expect(construirMensajePedido({ negocio: "X", lineas, nota: "   " })).not.toContain("Nota:");
    expect(construirMensajePedido({ negocio: "X", lineas })).not.toContain("Nota:");
  });

  test("estructura exacta sin nota: encabezado, línea en blanco, ítems, línea en blanco, total", () => {
    const msg = construirMensajePedido({
      negocio: "X",
      lineas: [{ nombre: "A", cantidad: 1, precioUnitario: 10 }],
    });
    expect(msg).toBe("Hola, quiero hacer un pedido de X:\n\n• 1 × A — $10.00\n\nTotal: $10.00");
  });

  test("estructura exacta con nota: dos saltos de línea antes de Nota:", () => {
    const msg = construirMensajePedido({
      negocio: "X",
      lineas: [{ nombre: "A", cantidad: 1, precioUnitario: 10 }],
      nota: "ya",
    });
    expect(msg).toBe(
      "Hola, quiero hacer un pedido de X:\n\n• 1 × A — $10.00\n\nTotal: $10.00\n\nNota: ya",
    );
  });
});
