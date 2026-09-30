import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import HojaPedido from "@/components/menu/HojaPedido";
import { useCarritoWhatsApp } from "@/hooks/useCarritoWhatsApp";
import { lineasDePedido } from "@/lib/carrito";
import { totalPedido } from "@/lib/pedido";
import { precioMenu } from "@/lib/tema";
import type { Sucursal, Tenant } from "@/types/database";

/**
 * Resumen del pedido. Solo aparece si el carrito está habilitado y tiene al
 * menos un ítem — por eso nunca coincide con el aviso del embudo (#2), que
 * espera a que el carrito esté vacío. Dueña del sheet.
 *
 * Sin posicionamiento propio: la fija al fondo `BarraInferior`, que también
 * apila debajo la franja de contacto/reservar para que nunca se encimen.
 */
export default function BarraPedido({
  tenant,
  sucursal,
}: {
  tenant: Tenant;
  sucursal: Sucursal | null;
}) {
  const c = useCarritoWhatsApp();
  const [abierta, setAbierta] = useState(false);

  if (!c.habilitado) return null;

  const hayItems = c.cantidadTotal > 0;
  const total = totalPedido(lineasDePedido(c.items));

  return (
    <>
      <AnimatePresence>
        {hayItems && (
          <motion.div
            key="barra-pedido"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.28 }}
            className="mx-auto w-full max-w-md p-3"
          >
            <button
              type="button"
              onClick={() => setAbierta(true)}
              className="flex h-12 w-full items-center justify-between rounded-2xl px-4 text-sm font-semibold shadow-lg"
              style={{ background: "var(--menu-primario)", color: "var(--menu-fondo)" }}
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="size-4" aria-hidden />
                Ver pedido · {c.cantidadTotal}
              </span>
              <span className="vm-data">{precioMenu(total)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {abierta && (
          <HojaPedido tenant={tenant} sucursal={sucursal} alCerrar={() => setAbierta(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
