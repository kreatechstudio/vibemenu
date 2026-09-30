import { describe, expect, test } from "bun:test";
import type { ProductoConModificadores } from "@/hooks/useMenuPublico";
import {
  agregarProducto,
  cantidadDe,
  cantidadTotal,
  fijarCantidad,
  lineasDePedido,
  precioLinea,
  quitarProducto,
  type ItemCarrito,
} from "@/lib/carrito";

const prod = (id: string, nombre: string, precio: number, grupos: unknown[] = []) =>
  ({ id, nombre, precio, grupos }) as unknown as ProductoConModificadores;

const cafe = prod("p1", "Cappuccino", 180);
const pan = prod("p2", "Concha", 45);

const tortilla = {
  id: "g-tortilla",
  nombre: "Tortilla",
  tipo_seleccion: "unica",
  opciones: [
    { id: "o-maiz", nombre: "Maíz", precio_extra: 0 },
    { id: "o-harina", nombre: "Harina", precio_extra: 4 },
  ],
};
const extras = {
  id: "g-extras",
  nombre: "Extras",
  tipo_seleccion: "multiple",
  opciones: [
    { id: "o-queso", nombre: "Queso", precio_extra: 12 },
    { id: "o-aguacate", nombre: "Aguacate", precio_extra: 15 },
  ],
};
const taco = prod("p3", "Taco", 28, [tortilla, extras]);

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

  test("mismo producto con selecciones distintas => lineas separadas", () => {
    let items: ItemCarrito[] = [];
    items = agregarProducto(items, taco, { "g-tortilla": ["o-maiz"] });
    items = agregarProducto(items, taco, { "g-tortilla": ["o-harina"] });
    items = agregarProducto(items, taco, { "g-tortilla": ["o-maiz"] });
    expect(items).toHaveLength(2);
    expect(cantidadDe(items, "p3")).toBe(3);
    expect(items[0].cantidad).toBe(2);
    expect(items[1].cantidad).toBe(1);
  });

  test("precioLinea suma el extra de las opciones elegidas", () => {
    const items = agregarProducto([], taco, {
      "g-tortilla": ["o-harina"],
      "g-extras": ["o-queso", "o-aguacate"],
    });
    expect(precioLinea(items[0])).toBe(28 + 4 + 12 + 15);
  });

  test("lineasDePedido agrega los nombres elegidos entre parentesis", () => {
    const items = agregarProducto([], taco, {
      "g-tortilla": ["o-harina"],
      "g-extras": ["o-queso"],
    });
    expect(lineasDePedido(items)).toEqual([
      { nombre: "Taco (Harina, Queso)", cantidad: 1, precioUnitario: 28 + 4 + 12 },
    ]);
  });

  test("fijarCantidad e quitarProducto usan el id de la linea, no el del producto", () => {
    let items = agregarProducto([], taco, { "g-tortilla": ["o-maiz"] });
    const id = items[0].id;
    expect(id).not.toBe("p3");
    items = fijarCantidad(items, id, 3);
    expect(items[0].cantidad).toBe(3);
    items = quitarProducto(items, id);
    expect(items).toEqual([]);
  });
});
