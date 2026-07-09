import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Reemplazo de window.prompt y window.confirm.
 *
 * Los nativos son cajas grises del navegador, sin la tipografia ni los colores
 * de la marca, y en Safari iOS ni siquiera se pueden estilar. Ademas bloquean el
 * hilo, asi que una animacion a medio correr se congela.
 */

function Envoltorio({
  abierto,
  alCerrar,
  etiquetadoPor,
  children,
}: {
  abierto: boolean;
  alCerrar: () => void;
  etiquetadoPor: string;
  children: React.ReactNode;
}) {
  // Escape cierra, como en los nativos.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto, alCerrar]);

  return (
    <AnimatePresence>
      {abierto && (
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
            role="dialog"
            aria-modal="true"
            aria-labelledby={etiquetadoPor}
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-vm-3"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Pide un texto. Sustituye a window.prompt. */
export function DialogoTexto({
  abierto,
  titulo,
  etiqueta,
  marcador,
  valorInicial = "",
  textoConfirmar = "Crear",
  alConfirmar,
  alCancelar,
}: {
  abierto: boolean;
  titulo: string;
  etiqueta: string;
  marcador?: string;
  valorInicial?: string;
  textoConfirmar?: string;
  alConfirmar: (valor: string) => void;
  alCancelar: () => void;
}) {
  const [valor, setValor] = useState(valorInicial);
  const input = useRef<HTMLInputElement>(null);

  // Al abrir: resetea y enfoca, como haria el nativo.
  useEffect(() => {
    if (abierto) {
      setValor(valorInicial);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [abierto, valorInicial]);

  return (
    <Envoltorio abierto={abierto} alCerrar={alCancelar} etiquetadoPor="dlg-texto">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valor.trim()) alConfirmar(valor.trim());
        }}
      >
        <h2 id="dlg-texto" className="text-lg">
          {titulo}
        </h2>

        <label htmlFor="dlg-input" className="mt-4 block text-sm font-medium text-vm-ink">
          {etiqueta}
        </label>
        <input
          id="dlg-input"
          ref={input}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={marcador}
          className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
        />

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="submit"
            disabled={!valor.trim()}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-lg bg-vm-primary text-sm font-medium text-white hover:bg-vm-primary-hover disabled:opacity-50"
          >
            {textoConfirmar}
          </button>
          <button
            type="button"
            onClick={alCancelar}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-lg border text-sm font-medium text-vm-ink hover:bg-vm-bg-soft"
          >
            Cancelar
          </button>
        </div>
      </form>
    </Envoltorio>
  );
}

/** Confirma una accion destructiva. Sustituye a window.confirm. */
export function DialogoConfirmar({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = "Eliminar",
  destructivo = true,
  alConfirmar,
  alCancelar,
}: {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  destructivo?: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
}) {
  return (
    <Envoltorio abierto={abierto} alCerrar={alCancelar} etiquetadoPor="dlg-confirmar">
      {destructivo && (
        <div className="grid size-10 place-items-center rounded-full bg-vm-danger-soft">
          <AlertTriangle className="size-5 text-vm-danger" aria-hidden />
        </div>
      )}

      <h2 id="dlg-confirmar" className={cn("text-lg", destructivo && "mt-4")}>
        {titulo}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-vm-body">{mensaje}</p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
        <button
          type="button"
          onClick={alConfirmar}
          className={cn(
            "inline-flex h-12 flex-1 items-center justify-center rounded-lg text-sm font-medium text-white",
            destructivo
              ? "bg-vm-danger hover:opacity-90"
              : "bg-vm-primary hover:bg-vm-primary-hover",
          )}
        >
          {textoConfirmar}
        </button>
        <button
          type="button"
          onClick={alCancelar}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-lg border text-sm font-medium text-vm-ink hover:bg-vm-bg-soft"
        >
          Cancelar
        </button>
      </div>
    </Envoltorio>
  );
}
