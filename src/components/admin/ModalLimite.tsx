import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, X } from "lucide-react";
import type { ErrorTraducido } from "@/lib/errores";

/**
 * Se abre cuando un trigger de Postgres rechaza una insercion por limite de plan.
 *
 * El texto viene de `detail` del error, que trae el numero real de la tabla `planes`.
 * Aqui no se hardcodea ningun limite: si el mensaje dice "hasta 20 productos",
 * es porque eso dice la fila del plan del tenant.
 */
export default function ModalLimite({
  error,
  alCerrar,
}: {
  error: ErrorTraducido | null;
  alCerrar: () => void;
}) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={alCerrar}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-vm-3"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-limite"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="titulo-limite" className="text-xl">
                Llegaste al límite de tu plan
              </h2>
              <button type="button" onClick={alCerrar} aria-label="Cerrar" className="text-vm-body">
                <X className="size-5" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-vm-body">{error.mensaje}</p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <Link
                to="/admin/suscripcion"
                onClick={alCerrar}
                className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-lg bg-vm-primary text-sm font-medium text-white hover:bg-vm-primary-hover"
              >
                Actualizar plan
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
              <button
                type="button"
                onClick={alCerrar}
                className="inline-flex h-12 flex-1 items-center justify-center rounded-lg border text-sm font-medium text-vm-ink hover:bg-vm-bg-soft"
              >
                Ahora no
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
