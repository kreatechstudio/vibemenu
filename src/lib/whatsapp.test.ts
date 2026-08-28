import { describe, expect, test } from "bun:test";
import { asegurarLada, enlaceWhatsApp, telefonoParaWaMe } from "@/lib/whatsapp";

describe("telefonoParaWaMe", () => {
  test("un numero con lada queda en digitos puros", () => {
    expect(telefonoParaWaMe("+52 55 1234 5678")).toBe("525512345678");
  });

  test("un valor legado sin lada devuelve sus digitos tal cual", () => {
    // No adivina pais: el guardado ya garantiza la lada via asegurarLada.
    expect(telefonoParaWaMe("55-1234-5678")).toBe("5512345678");
  });

  test("vacio, nulo o basura corta => null", () => {
    expect(telefonoParaWaMe("")).toBeNull();
    expect(telefonoParaWaMe(null)).toBeNull();
    expect(telefonoParaWaMe(undefined)).toBeNull();
    expect(telefonoParaWaMe("   ")).toBeNull();
    expect(telefonoParaWaMe("+1 (555) 010")).toBeNull(); // 7 digitos < 8
  });
});

describe("enlaceWhatsApp", () => {
  test("sin mensaje: solo abrir chat", () => {
    expect(enlaceWhatsApp("+52 55 1234 5678")).toBe("https://wa.me/525512345678");
  });

  test("con mensaje: lo antepone URL-encoded", () => {
    expect(enlaceWhatsApp("+52 55 1234 5678", "Hola, ¿me ayudas?")).toBe(
      "https://wa.me/525512345678?text=Hola%2C%20%C2%BFme%20ayudas%3F",
    );
  });

  test("numero no utilizable => null", () => {
    expect(enlaceWhatsApp(null)).toBeNull();
    expect(enlaceWhatsApp("123")).toBeNull();
  });
});

describe("asegurarLada", () => {
  test("antepone la lada default si falta el +", () => {
    expect(asegurarLada("55 1234 5678")).toBe("+52 55 1234 5678");
  });

  test("respeta un valor que ya trae lada", () => {
    expect(asegurarLada("+34 600 00 00 00")).toBe("+34 600 00 00 00");
  });

  test("vacio y nulo pasan igual", () => {
    expect(asegurarLada("")).toBe("");
    expect(asegurarLada(null)).toBeNull();
  });
});
