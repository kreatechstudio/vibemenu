import { describe, expect, test } from "bun:test";
import type { ProductoConModificadores } from "@/hooks/useMenuPublico";
import {
  agregarProducto,
  cantidadDe,
  cantidadTotal,
  fijarCantidad,
  lineasDePedido,
  quitarProducto,
  type ItemCarrito,
} from "@/lib/carrito";

const prod = (id: string, nombre: string, precio: number) =>
  ({ id, nombre, precio, grupos: [] }) as unknown as ProductoConModificadores;

const cafe = prod("p1", "Cappuccino", 180);
const pan = prod("p2", "Concha", 45);

describe("carrito", () => {
  test("agregar dos veces el mismo producto => una linea, cantidad 2, orden preservado", () => {
    let items: ItemCarrito[] = [];
    items = agregarProducto(items, cafe);
    items = agregarProducto(items, pan);
    items = agregarProducto(items, cafe);
    expect(items.map((i) => i.producto.id)).toEqual(["p1", "p2"]);
    expect(cantidadDe(items, "p1")).toBe(2);
    expect(cantidadTotal(items)).toBe(3);
  });

  test("fijarCantidad a 0 quita la linea", () => {
    let items = agregarProducto([], cafe);
    items = fijarCantidad(items, "p1", 0);
    expect(items).toEqual([]);
  });

  test("fijarCantidad a 5 fija la cantidad exacta", () => {
    let items = agregarProducto([], cafe);
    items = fijarCantidad(items, "p1", 5);
    expect(cantidadDe(items, "p1")).toBe(5);
  });

  test("fijarCantidad de un id ausente con n>0 es no-op", () => {
    expect(fijarCantidad([], "zzz", 3)).toEqual([]);
  });

  test("quitarProducto elimina solo esa linea", () => {
    let items = agregarProducto(agregarProducto([], cafe), pan);
    items = quitarProducto(items, "p1");
    expect(items.map((i) => i.producto.id)).toEqual(["p2"]);
  });

  test("cantidadDe de un id ausente => 0", () => {
    expect(cantidadDe([], "p1")).toBe(0);
  });

  test("lineasDePedido mapea nombre, cantidad y precio del producto", () => {
    let items = agregarProducto([], cafe);
    items = agregarProducto(items, cafe);
    items = agregarProducto(items, pan);
    expect(lineasDePedido(items)).toEqual([
      { nombre: "Cappuccino", cantidad: 2, precioUnitario: 180 },
      { nombre: "Concha", cantidad: 1, precioUnitario: 45 },
    ]);
  });
});
