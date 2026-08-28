import type { Sucursal, Tenant } from "@/types/database";

export type ContactoResuelto = {
  telefono: string | null;
  whatsapp: string | null;
  googleReviewsUrl: string | null;
};

type CamposSucursal = Pick<Sucursal, "telefono" | "whatsapp" | "google_reviews_url">;
type CamposTenant = Pick<Tenant, "telefono" | "whatsapp" | "google_reviews_url">;

/** Primer valor no vacío (tras `trim`), o null. */
function primero(a: string | null | undefined, b: string | null | undefined): string | null {
  const av = a?.trim();
  if (av) return av;
  const bv = b?.trim();
  return bv || null;
}

/**
 * Resuelve la cadena de fallback de contacto para el menú público. La sucursal
 * manda; cada campo cae a `tenants` solo si viene vacío. Con `sucursal` null
 * (menú general, negocio sin sucursales) usa todo de `tenants`.
 */
export function contactoSucursal(
  sucursal: CamposSucursal | null,
  tenant: CamposTenant,
): ContactoResuelto {
  return {
    telefono: primero(sucursal?.telefono, tenant.telefono),
    whatsapp: primero(sucursal?.whatsapp, tenant.whatsapp),
    googleReviewsUrl: primero(sucursal?.google_reviews_url, tenant.google_reviews_url),
  };
}
