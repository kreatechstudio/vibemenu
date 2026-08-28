import { describe, expect, test } from "bun:test";
import { contactoSucursal } from "@/lib/contacto";

const tenant = {
  telefono: "+52 55 0000 0000",
  whatsapp: "+52 55 0000 0001",
  google_reviews_url: "https://g.page/empresa/review",
};

describe("contactoSucursal", () => {
  test("la sucursal manda cuando tiene el dato", () => {
    const c = contactoSucursal(
      {
        telefono: "+52 33 1111 1111",
        whatsapp: "+52 33 1111 1112",
        google_reviews_url: "https://g.page/sucursal/review",
      },
      tenant,
    );
    expect(c).toEqual({
      telefono: "+52 33 1111 1111",
      whatsapp: "+52 33 1111 1112",
      googleReviewsUrl: "https://g.page/sucursal/review",
    });
  });

  test("cada campo vacio en la sucursal cae a la empresa", () => {
    const c = contactoSucursal(
      { telefono: "+52 33 1111 1111", whatsapp: null, google_reviews_url: "  " },
      tenant,
    );
    expect(c.telefono).toBe("+52 33 1111 1111");
    expect(c.whatsapp).toBe("+52 55 0000 0001");
    expect(c.googleReviewsUrl).toBe("https://g.page/empresa/review");
  });

  test("sin sucursal, todo de la empresa", () => {
    const c = contactoSucursal(null, tenant);
    expect(c).toEqual({
      telefono: "+52 55 0000 0000",
      whatsapp: "+52 55 0000 0001",
      googleReviewsUrl: "https://g.page/empresa/review",
    });
  });

  test("google_reviews_url undefined (entorno sin migracion 007) => null", () => {
    const c = contactoSucursal(
      { telefono: null, whatsapp: null, google_reviews_url: null },
      { telefono: null, whatsapp: null, google_reviews_url: undefined as unknown as string | null },
    );
    expect(c.googleReviewsUrl).toBeNull();
  });
});
