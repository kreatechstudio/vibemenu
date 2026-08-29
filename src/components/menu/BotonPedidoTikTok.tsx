import { MessageCircle } from "lucide-react";
import { contactoSucursal } from "@/lib/contacto";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import type { Sucursal, Tenant } from "@/types/database";

/**
 * TikTok es un feed de descubrimiento a pantalla completa: no lleva carrito.
 * Solo un botón flotante que abre WhatsApp con un mensaje genérico. `habilitado`
 * lo calcula `MenuPublico` igual que para el resto (plan + número resoluble).
 *
 * `bottom-16`: por encima de `<MarcaAgua flotante />` (bottom-3) y del hint de
 * scroll (bottom-9). `z-30`: nivel de las pastillas de categoría de TikTok.
 */
export default function BotonPedidoTikTok({
  tenant,
  sucursal,
  habilitado,
}: {
  tenant: Tenant;
  sucursal: Sucursal | null;
  habilitado: boolean;
}) {
  if (!habilitado) return null;

  const url = enlaceWhatsApp(
    contactoSucursal(sucursal, tenant).whatsapp,
    `Hola, quiero hacer un pedido del menú de ${tenant.nombre_negocio}.`,
  );
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-16 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur"
    >
      <MessageCircle className="size-4" aria-hidden />
      Pedir por WhatsApp
    </a>
  );
}
