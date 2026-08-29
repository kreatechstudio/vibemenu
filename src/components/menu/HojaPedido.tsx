import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import BotonAgregar from "@/components/menu/BotonAgregar";
import { useCarritoWhatsApp } from "@/hooks/useCarritoWhatsApp";
import { lineasDePedido } from "@/lib/carrito";
import { contactoSucursal } from "@/lib/contacto";
import { construirMensajePedido, totalPedido } from "@/lib/pedido";
import { precioMenu } from "@/lib/tema";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import type { Sucursal, Tenant } from "@/types/database";

/**
 * Hoja de resumen del pedido (bottom-sheet, patrón del `Post` de Instagram).
 * Ítems editables, nota opcional, total, "Enviar por WhatsApp" y "Vaciar".
 * Al quedarse sin ítems se cierra sola.
 */
export default function HojaPedido({
  tenant,
  sucursal,
  alCerrar,
}: {
  tenant: Tenant;
  sucursal: Sucursal | null;
  alCerrar: () => void;
}) {
  const c = useCarritoWhatsApp();
  const [nota, setNota] = useState("");

  useEffect(() => {
    if (c.items.length === 0) alCerrar();
  }, [c.items.length, alCerrar]);

  const lineas = lineasDePedido(c.items);
  const borde = "color-mix(in srgb, var(--menu-texto) 12%, transparent)";

  function enviar() {
    const url = enlaceWhatsApp(
      contactoSucursal(sucursal, tenant).whatsapp,
      construirMensajePedido({
        negocio: tenant.nombre_negocio,
        sucursal: sucursal?.nombre,
        lineas,
        nota,
      }),
    );
    const ventana = url ? window.open(url, "_blank", "noopener,noreferrer") : null;
    if (url && !ventana) return; // popup bloqueado — deja el pedido para reintentar
    c.vaciar();
    alCerrar();
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={alCerrar}
    >
      <motion.article
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 32, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Tu pedido"
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl shadow-vm-3 sm:max-h-[88vh] sm:rounded-2xl"
        style={{ background: "var(--menu-fondo)", color: "var(--menu-texto)" }}
      >
        <div
          className="flex items-center justify-between border-b p-4"
          style={{ borderColor: borde }}
        >
          <h2 className="text-base font-semibold">Tu pedido</h2>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            style={{ color: "var(--menu-texto-suave)" }}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <ul className="space-y-4">
            {c.items.map((it) => (
              <li key={it.producto.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.producto.nombre}</p>
                  <p className="vm-data text-xs" style={{ color: "var(--menu-texto-suave)" }}>
                    {precioMenu(it.cantidad * it.producto.precio)}
                  </p>
                </div>
                <BotonAgregar producto={it.producto} variante="stepper" />
                <button
                  type="button"
                  onClick={() => c.quitar(it.producto.id)}
                  aria-label={`Quitar ${it.producto.nombre} del pedido`}
                  style={{ color: "var(--menu-texto-suave)" }}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>

          <label
            className="mt-5 block text-xs font-medium"
            style={{ color: "var(--menu-texto-suave)" }}
          >
            Nota (opcional)
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Hora de recogida, algo que quieras avisar… lo verá el negocio en WhatsApp."
              className="mt-1 w-full resize-none rounded-lg border bg-transparent p-2.5 text-sm outline-none"
              style={{ borderColor: borde, color: "var(--menu-texto)" }}
            />
          </label>
        </div>

        <div className="border-t p-4" style={{ borderColor: borde }}>
          <div className="mb-3 flex items-center justify-between text-sm font-semibold">
            <span>Total</span>
            <span className="vm-data">{precioMenu(totalPedido(lineas))}</span>
          </div>
          <button
            type="button"
            onClick={enviar}
            className="h-11 w-full rounded-xl text-sm font-semibold"
            style={{ background: "var(--menu-primario)", color: "var(--menu-fondo)" }}
          >
            Enviar por WhatsApp
          </button>
          <button
            type="button"
            onClick={() => {
              c.vaciar();
              alCerrar();
            }}
            className="mt-2 h-9 w-full text-xs transition-opacity hover:opacity-70"
            style={{ color: "var(--menu-texto-suave)" }}
          >
            Vaciar pedido
          </button>
        </div>
      </motion.article>
    </motion.div>
  );
}
