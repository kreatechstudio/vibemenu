import type { ReactElement } from "react";
import { MapPin, MessageCircle, Phone, Star } from "lucide-react";
import { contactoSucursal } from "@/lib/contacto";
import { enlaceMaps } from "@/lib/maps";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import type { Sucursal, Tenant } from "@/types/database";

type Fila = {
  etiqueta: string;
  href: string;
  externo: boolean;
  Icono: React.ComponentType<{ className?: string }>;
};

/**
 * Fila de contacto al pie del menú: llamar, WhatsApp, cómo llegar, reseñas.
 * Cada dato se resuelve sucursal → empresa (`contactoSucursal`). Solo pinta
 * las filas con dato; sin ninguna, no se monta. Usa el tema del tenant, nunca
 * colores de marca externos — igual que `RedesSociales`.
 *
 * El WhatsApp aquí es "abrir chat" a secas. El botón de pedido con carrito es
 * otra cosa (sub-proyecto #3).
 */
export default function ContactoMenu({
  tenant,
  sucursal,
}: {
  tenant: Tenant;
  sucursal: Sucursal | null;
}): ReactElement | null {
  const c = contactoSucursal(sucursal, tenant);
  const mapa = enlaceMaps(
    { direccion: sucursal?.direccion ?? null, maps_url: sucursal?.maps_url ?? null },
    tenant.nombre_negocio,
  );
  const wa = enlaceWhatsApp(c.whatsapp);
  const tel = c.telefono ? `tel:${c.telefono.replace(/[^\d+]/g, "")}` : null;

  const filas: Fila[] = [];
  if (tel) filas.push({ etiqueta: "Llamar", href: tel, externo: false, Icono: Phone });
  if (wa) filas.push({ etiqueta: "WhatsApp", href: wa, externo: true, Icono: MessageCircle });
  if (mapa) filas.push({ etiqueta: "Cómo llegar", href: mapa, externo: true, Icono: MapPin });
  if (c.googleReviewsUrl) {
    filas.push({ etiqueta: "Reseñas", href: c.googleReviewsUrl, externo: true, Icono: Star });
  }

  if (filas.length === 0) return null;

  return (
    <nav className="mx-auto mt-6 flex max-w-2xl flex-wrap gap-2 px-4 pb-8" aria-label="Contacto">
      {filas.map(({ etiqueta, href, externo, Icono }) => (
        <a
          key={etiqueta}
          href={href}
          {...(externo ? { target: "_blank", rel: "noreferrer noopener" } : {})}
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-opacity hover:opacity-75"
          style={{
            background: "color-mix(in srgb, var(--menu-primario) 10%, transparent)",
            color: "var(--menu-primario)",
          }}
        >
          <Icono className="size-4" aria-hidden />
          {etiqueta}
        </a>
      ))}
    </nav>
  );
}
