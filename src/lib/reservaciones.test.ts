import { describe, expect, test } from "bun:test";
import {
  formatearFechaHora,
  MAX_DIAS_RESERVA,
  payloadReservacion,
  validarReservacion,
  type BorradorReservacion,
} from "@/lib/reservaciones";

const TZ = "America/Mexico_City";
// Un "ahora" fijo para que las pruebas no dependan del reloj.
const AHORA = new Date("2026-09-01T18:00:00-06:00");

const base = (): BorradorReservacion => ({
  nombre: "Ana López",
  personas: 2,
  fecha: "2026-09-03",
  hora: "20:00",
  telefono: "+52 55 1234 5678",
  email: "",
  nota: "",
  consentimiento: true,
});

describe("validarReservacion", () => {
  test("un borrador completo y futuro pasa", () => {
    expect(validarReservacion(base(), AHORA, TZ)).toBeNull();
  });

  test("nombre de 1 caracter => error en nombre", () => {
    expect(validarReservacion({ ...base(), nombre: "A" }, AHORA, TZ)?.campo).toBe("nombre");
  });

  test("0 personas y 100 personas => error en personas", () => {
    expect(validarReservacion({ ...base(), personas: 0 }, AHORA, TZ)?.campo).toBe("personas");
    expect(validarReservacion({ ...base(), personas: 100 }, AHORA, TZ)?.campo).toBe("personas");
  });

  test("fecha/hora en el pasado => error en fecha", () => {
    const r = validarReservacion({ ...base(), fecha: "2026-08-30", hora: "20:00" }, AHORA, TZ);
    expect(r?.campo).toBe("fecha");
  });

  test("más de MAX_DIAS_RESERVA días adelante => error en fecha", () => {
    const lejos = new Date(AHORA);
    lejos.setDate(lejos.getDate() + MAX_DIAS_RESERVA + 5);
    const fecha = lejos.toISOString().slice(0, 10);
    expect(validarReservacion({ ...base(), fecha }, AHORA, TZ)?.campo).toBe("fecha");
  });

  test("teléfono sin dígitos usables => error en telefono", () => {
    expect(validarReservacion({ ...base(), telefono: "abc" }, AHORA, TZ)?.campo).toBe("telefono");
  });

  test("email presente pero inválido => error en email; vacío pasa", () => {
    expect(validarReservacion({ ...base(), email: "no-es-correo" }, AHORA, TZ)?.campo).toBe(
      "email",
    );
    expect(validarReservacion({ ...base(), email: "" }, AHORA, TZ)).toBeNull();
  });

  test("sin consentimiento => error en consentimiento", () => {
    expect(validarReservacion({ ...base(), consentimiento: false }, AHORA, TZ)?.campo).toBe(
      "consentimiento",
    );
  });
});

describe("payloadReservacion", () => {
  test("arma el cuerpo que espera la edge function", () => {
    const p = payloadReservacion(base(), "suc-1", "tok-123");
    expect(p).toEqual({
      sucursal_id: "suc-1",
      nombre: "Ana López",
      personas: 2,
      fecha: "2026-09-03",
      hora: "20:00",
      telefono: "+52 55 1234 5678",
      email: null,
      nota: null,
      consentimiento: true,
      turnstile_token: "tok-123",
    });
  });

  test("email y nota con espacios se recortan; vacíos => null", () => {
    const p = payloadReservacion(
      { ...base(), email: "  a@b.com ", nota: "  mesa junto a la ventana  " },
      "suc-1",
      null,
    );
    expect(p.email).toBe("a@b.com");
    expect(p.nota).toBe("mesa junto a la ventana");
    expect(p.turnstile_token).toBeNull();
  });
});

describe("formatearFechaHora", () => {
  test("devuelve algo legible en español con la fecha y la hora", () => {
    const s = formatearFechaHora("2026-09-03", "20:00", TZ);
    expect(s).toContain("2026");
    expect(s.toLowerCase()).toContain("sep");
    expect(s).toContain("8:00"); // 20:00 → 8:00 p.m.
  });
});
