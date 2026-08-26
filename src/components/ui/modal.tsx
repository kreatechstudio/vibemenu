import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Modal centrado que aprovecha casi toda la pantalla en escritorio (para que
 * quepa el formulario sin scroll) y ocupa la pantalla completa en móvil.
 *
 * Reemplaza al panel lateral deslizante: el contenido (header + cuerpo) lo
 * sigue armando quien lo usa, este componente solo pone el posicionamiento,
 * el fondo y la animación.
 */
export default function Modal({
  alCerrar,
  etiqueta,
  anchoMaximo = "sm:max-w-3xl",
  children,
}: {
  alCerrar: () => void;
  etiqueta: string;
  anchoMaximo?: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 sm:grid sm:place-items-center sm:p-4 lg:p-8">
      <div className="absolute inset-0 bg-black/40" onClick={alCerrar} aria-hidden />

      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-label={etiqueta}
        className={cn(
          "relative flex h-full w-full flex-col overflow-y-auto bg-white sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:rounded-2xl sm:shadow-vm-3 lg:max-h-[calc(100vh-4rem)]",
          anchoMaximo,
        )}
      >
        {children}
      </motion.div>
    </div>
  );
}
