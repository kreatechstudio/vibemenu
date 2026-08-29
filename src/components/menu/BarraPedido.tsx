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
 * Barra fija al fondo con el resumen del pedido. Solo aparece si el carrito está
 * habilitado y tiene al menos un ítem — por eso nunca coincide con el aviso del
 * embudo (#2), que espera a que el carrito esté vacío. Dueña del sheet.
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

  if (!c.habilitado || c.cantidadTotal === 0) return null;

  const total = totalPedido(lineasDePedido(c.items));

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md p-3"
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

      <AnimatePresence>
        {abierta && (
          <HojaPedido tenant={tenant} sucursal={sucursal} alCerrar={() => setAbierta(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
