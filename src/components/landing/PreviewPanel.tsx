import { motion } from "framer-motion";
import { LayoutDashboard, Palette, QrCode, UtensilsCrossed } from "lucide-react";
import { scaleIn } from "@/lib/animations";

/**
 * Preview del panel admin que va debajo del hero.
 *
 * Regla anti-generico de vibemenu_diseño.md: esto NUNCA es una ilustracion.
 * Es el panel real con datos de un negocio ficticio realista. Los numeros
 * corresponden a las cuatro metricas del dashboard definidas en alcance.md;
 * no hay metrica de escaneos de QR — esa esta fuera del MVP.
 */

const METRICAS = [
  { label: "TOTAL PRODUCTOS", valor: "34" },
  { label: "SUCURSALES", valor: "2" },
  { label: "PLAN", valor: "Pro" },
  { label: "FORMATO ACTIVO", valor: "Pinterest" },
] as const;

const PRODUCTOS = [
  { nombre: "Flat White Especial", categoria: "Cafetería", precio: "$65.00", activo: true },
  { nombre: "Avocado Toast Clásico", categoria: "Desayunos", precio: "$120.00", activo: true },
  { nombre: "Té Matcha Frío", categoria: "Bebidas Frías", precio: "$85.00", activo: false },
] as const;

const NAV = [
  { icono: LayoutDashboard, label: "Resumen", activo: true },
  { icono: UtensilsCrossed, label: "Mi Carta", activo: false },
  { icono: Palette, label: "Formatos", activo: false },
  { icono: QrCode, label: "QR y Enlaces", activo: false },
] as const;

export default function PreviewPanel() {
  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className="overflow-hidden rounded-xl border bg-white shadow-vm-3"
      aria-label="Vista previa del panel de Vibemenu"
    >
      <div className="hidden items-center gap-1.5 border-b bg-vm-bg-soft px-4 py-2.5 sm:flex">
        <span className="size-2.5 rounded-full bg-vm-ink/15" />
        <span className="size-2.5 rounded-full bg-vm-ink/15" />
        <span className="size-2.5 rounded-full bg-vm-ink/15" />
        <span className="ml-2 flex-1 truncate rounded-full border bg-white px-3 py-1 text-xs text-vm-body">
          cafearoma.vibemenu.com.mx/panel
        </span>
      </div>

      <div className="grid md:grid-cols-[220px_1fr]">
        <aside className="hidden border-r bg-vm-bg-soft p-4 md:block">
          <div className="px-2 pb-4">
            <p className="font-display text-sm font-bold text-vm-ink">Café Aurora</p>
            <p className="text-xs text-vm-body">Centro Histórico</p>
          </div>
          <ul className="space-y-1">
            {NAV.map(({ icono: Icono, label, activo }) => (
              <li key={label}>
                <span
                  className={
                    activo
                      ? "flex items-center gap-2.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-vm-primary shadow-vm-1"
                      : "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-vm-body"
                  }
                >
                  <Icono className="size-4" aria-hidden />
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="p-5 md:p-6">
          <h3 className="text-lg">Resumen de tu menú</h3>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {METRICAS.map(({ label, valor }) => (
              <div key={label} className="rounded-xl border bg-vm-bg-soft p-4">
                <p className="text-[11px] font-medium tracking-wide text-vm-body">{label}</p>
                <p className="vm-data mt-2 text-xl font-medium text-vm-ink">{valor}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm font-medium text-vm-ink">Últimos productos actualizados</p>
          <div className="mt-3 overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-vm-bg-soft text-left text-xs text-vm-body">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Producto</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Categoría</th>
                  <th className="px-4 py-2.5 text-right font-medium">Precio</th>
                  <th className="px-4 py-2.5 text-right font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {PRODUCTOS.map(({ nombre, categoria, precio, activo }) => (
                  <tr key={nombre} className="border-t">
                    <td className="px-4 py-3 text-vm-ink">{nombre}</td>
                    <td className="hidden px-4 py-3 text-vm-body sm:table-cell">{categoria}</td>
                    <td className="vm-data px-4 py-3 text-right text-vm-ink">{precio}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          activo
                            ? "inline-flex rounded-full bg-vm-success-soft px-2.5 py-1 text-xs font-medium text-vm-success"
                            : "inline-flex rounded-full bg-vm-warning-soft px-2.5 py-1 text-xs font-medium text-vm-warning"
                        }
                      >
                        {activo ? "Activo" : "Borrador"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
