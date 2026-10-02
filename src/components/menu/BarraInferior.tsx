import type { ReactElement } from "react";
import BarraPedido from "@/components/menu/BarraPedido";
import ContactoMenu, { filasContacto } from "@/components/menu/ContactoMenu";
import ReservarMenu, { reservarHabilitado } from "@/components/menu/ReservarMenu";
import TarjetaLealtadPill from "@/components/menu/TarjetaLealtadPill";
import { useCarritoWhatsApp } from "@/hooks/useCarritoWhatsApp";
import type { Sucursal, Tenant } from "@/types/database";

/**
 * Todo lo que vive fijo al fondo del menú público, apilado en una sola franja:
 * arriba el resumen del pedido (si hay carrito), abajo la fila de acciones
 * (reseñas, tarjeta de lealtad, reservar) en una sola línea con scroll
 * horizontal — nunca se encogen a dos renglones ni se encima una franja fija
 * con otra. Llamar/WhatsApp/Cómo llegar viven como iconos en la cabecera
 * (`RedesSociales`), no aquí: estas tres sí conviene leerlas con texto.
 */
export default function BarraInferior({
  tenant,
  sucursal,
  sucursales,
  permiteReservaciones,
  lealtad,
}: {
  tenant: Tenant;
  sucursal: Sucursal | null;
  sucursales: Sucursal[];
  permiteReservaciones: boolean;
  /** `null` si el plan no trae lealtad o el negocio no la activó. */
  lealtad: { meta: number; premio: string } | null;
}): ReactElement | null {
  const carrito = useCarritoWhatsApp();
  const hayItems = carrito.habilitado && carrito.cantidadTotal > 0;
  const hayAcciones =
    filasContacto(tenant, sucursal).some((f) => f.etiqueta === "Reseñas") ||
    Boolean(lealtad) ||
    reservarHabilitado(sucursal, sucursales, permiteReservaciones);

  if (!hayItems && !hayAcciones) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col">
      <BarraPedido tenant={tenant} sucursal={sucursal} />

      {hayAcciones && (
        <nav
          aria-label="Acciones del menú"
          className="border-t"
          style={{
            background: "var(--menu-fondo)",
            borderColor: "color-mix(in srgb, var(--menu-texto) 10%, transparent)",
          }}
        >
          <div
            className="mx-auto flex max-w-2xl items-center gap-2 overflow-x-auto px-4 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
          >
            <ContactoMenu tenant={tenant} sucursal={sucursal} />
            {lealtad && <TarjetaLealtadPill tenantId={tenant.id} slug={tenant.slug} />}
            <ReservarMenu
              sucursalActiva={sucursal}
              sucursales={sucursales}
              habilitado={permiteReservaciones}
            />
          </div>
        </nav>
      )}
    </div>
  );
}
