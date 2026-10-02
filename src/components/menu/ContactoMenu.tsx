import type { ReactElement } from "react";
import { MapPin, MessageCircle, Phone, Star } from "lucide-react";
import { contactoSucursal } from "@/lib/contacto";
import { enlaceMaps } from "@/lib/maps";
import { enlaceWhatsApp, telefonoParaWaMe } from "@/lib/whatsapp";
import type { Sucursal, Tenant } from "@/types/database";

export type FilaContacto = {
  etiqueta: string;
  href: string;
  externo: boolean;
  Icono: React.ComponentType<{ className?: string }>;
};

/**
 * Datos de contacto resueltos sucursal → empresa (`contactoSucursal`), listos
 * para pintar como pills. Pura — sin JSX — para que `BarraInferior` pueda
 * decidir si hay algo que mostrar antes de montar la franja fija.
 */
export function filasContacto(tenant: Tenant, sucursal: Sucursal | null): FilaContacto[] {
  const c = contactoSucursal(sucursal, tenant);
  const mapa = enlaceMaps(
    { direccion: sucursal?.direccion ?? null, maps_url: sucursal?.maps_url ?? null },
    tenant.nombre_negocio,
  );
  const wa = enlaceWhatsApp(c.whatsapp);
  const tel =
    telefonoParaWaMe(c.telefono) !== null ? `tel:${c.telefono!.replace(/[^\d+]/g, "")}` : null;

  const filas: FilaContacto[] = [];
  if (tel) filas.push({ etiqueta: "Llamar", href: tel, externo: false, Icono: Phone });
  if (wa) filas.push({ etiqueta: "WhatsApp", href: wa, externo: true, Icono: MessageCircle });
  if (mapa) filas.push({ etiqueta: "Cómo llegar", href: mapa, externo: true, Icono: MapPin });
  if (c.googleReviewsUrl) {
    filas.push({ etiqueta: "Reseñas", href: c.googleReviewsUrl, externo: true, Icono: Star });
  }
  return filas;
}

/** Clase compartida con `ReservarMenu` para que sus pills se vean idénticas. */
export const CLASE_PILL_ACCION =
  "inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-opacity hover:opacity-75";
export const ESTILO_PILL_ACCION = {
  background: "color-mix(in srgb, var(--menu-primario) 10%, transparent)",
  color: "var(--menu-primario)",
};

/**
 * Pill de reseñas. Sin envoltura ni posicionamiento propio — vive dentro de la
 * franja de `BarraInferior`, junto a `ReservarMenu` y la tarjeta de lealtad,
 * para que las tres queden en una sola fila legible, sin scroll horizontal.
 *
 * Llamar/WhatsApp/Cómo llegar YA NO van aquí: son iconos en la cabecera
 * (`RedesSociales`, junto a las redes sociales) — se reconocen solos y no
 * compiten por espacio en esta franja. Reseñas sí se queda con texto: es la
 * acción que de verdad conviene leer, no solo reconocer el icono.
 */
export default function ContactoMenu({
  tenant,
  sucursal,
}: {
  tenant: Tenant;
  sucursal: Sucursal | null;
}): ReactElement | null {
  const filas = filasContacto(tenant, sucursal).filter((f) => f.etiqueta === "Reseñas");
  if (filas.length === 0) return null;

  return (
    <>
      {filas.map(({ etiqueta, href, externo, Icono }) => (
        <a
          key={etiqueta}
          href={href}
          {...(externo ? { target: "_blank", rel: "noreferrer noopener" } : {})}
          className={CLASE_PILL_ACCION}
          style={ESTILO_PILL_ACCION}
        >
          <Icono className="size-4" aria-hidden />
          {etiqueta}
        </a>
      ))}
    </>
  );
}
