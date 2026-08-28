import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Building2,
  HelpCircle,
  LayoutDashboard,
  Palette,
  QrCode,
  UtensilsCrossed,
  X,
} from "lucide-react";
import Modal from "@/components/ui/modal";
import { TUTORIAL } from "@/lib/copy";

/**
 * Íconos emparejados por posición con TUTORIAL.secciones (copy.ts) — mismo
 * orden que NAV en AdminLayout.tsx. Si cambia el orden de una lista, cambia
 * el de la otra.
 */
const ICONOS = [LayoutDashboard, UtensilsCrossed, Building2, Palette, QrCode];

/**
 * Botón de ayuda del header del admin: abre un modal con un resumen de las
 * 5 secciones del panel. Puramente manual — nunca se abre solo, sin estado
 * persistido. Complementa (no reemplaza) el tour guiado por pestaña que
 * documenta vibemenu_registro_asistido.md §6, pospuesto hasta que Diseño.tsx
 * se estabilice.
 */
export default function TutorialAyuda() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm text-vm-ink hover:bg-vm-bg-soft"
      >
        <HelpCircle className="size-4" aria-hidden />
        <span className="hidden sm:inline">{TUTORIAL.boton}</span>
      </button>

      <AnimatePresence>
        {abierto && (
          <Modal
            alCerrar={() => setAbierto(false)}
            etiqueta={TUTORIAL.titulo}
            anchoMaximo="sm:max-w-lg"
          >
            <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
              <h2 className="text-lg">{TUTORIAL.titulo}</h2>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="text-vm-body"
              >
                <X className="size-5" />
              </button>
            </header>

            <div className="space-y-5 p-5">
              <p className="text-sm text-vm-body">{TUTORIAL.intro}</p>

              <ul className="space-y-4">
                {TUTORIAL.secciones.map((seccion, i) => {
                  const Icono = ICONOS[i];
                  return (
                    <li key={seccion.etiqueta} className="flex gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-vm-primary/10">
                        <Icono className="size-4.5 text-vm-primary" aria-hidden />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-vm-ink">{seccion.etiqueta}</p>
                        <p className="mt-0.5 text-sm text-vm-body">{seccion.descripcion}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}
