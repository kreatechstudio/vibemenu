import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { precioMenu } from "@/lib/tema";
import type { CategoriaConProductos, ProductoConModificadores } from "@/hooks/useMenuPublico";

/**
 * Formato Pinterest — mosaico masonry.
 *
 * Anatomia: columnas CSS de alturas variables segun la proporcion de cada foto.
 * Las fotos mandan; sin bordes entre tarjetas. Al tocar una, expande a detalle
 * con animacion de escala (layoutId comparte el elemento entre grid y detalle).
 *
 * Los productos sin foto no se pierden: se pintan como tarjeta de solo texto.
 */

function Detalle({
  producto,
  alCerrar,
}: {
  producto: ProductoConModificadores;
  alCerrar: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={alCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={producto.nombre}
    >
      <motion.div
        layoutId={`producto-${producto.id}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl"
        style={{ background: "var(--menu-fondo)" }}
      >
        {producto.imagen_url && (
          <img src={producto.imagen_url} alt="" className="w-full object-cover" />
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2
              className="text-xl font-bold"
              style={{ fontFamily: "var(--menu-fuente)", color: "var(--menu-texto)" }}
            >
              {producto.nombre}
            </h2>
            <button
              type="button"
              onClick={alCerrar}
              aria-label="Cerrar"
              className="shrink-0 rounded-full p-1"
              style={{ color: "var(--menu-texto-suave)" }}
            >
              <X className="size-5" />
            </button>
          </div>

          <p className="vm-data mt-1 text-lg" style={{ color: "var(--menu-primario)" }}>
            {precioMenu(producto.precio)}
          </p>

          {producto.descripcion && (
            <p
              className="mt-3 text-sm leading-relaxed"
              style={{ color: "var(--menu-texto-suave)" }}
            >
              {producto.descripcion}
            </p>
          )}

          {producto.grupos.map((g) => (
            <div key={g.id} className="mt-4">
              <p className="text-xs font-semibold" style={{ color: "var(--menu-texto)" }}>
                {g.nombre}
                {g.obligatorio && <span style={{ color: "var(--menu-primario)" }}> *</span>}
              </p>
              <ul className="mt-1.5 space-y-1">
                {g.opciones.map((o) => (
                  <li
                    key={o.id}
                    className="flex justify-between text-sm"
                    style={{ color: "var(--menu-texto-suave)" }}
                  >
                    <span>{o.nombre}</span>
                    {o.precio_extra > 0 && (
                      <span className="vm-data">+{precioMenu(o.precio_extra)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Pinterest({ categorias }: { categorias: CategoriaConProductos[] }) {
  const [abierto, setAbierto] = useState<ProductoConModificadores | null>(null);
  const productos = categorias.flatMap((c) => c.productos);

  return (
    <>
      <div className="mx-auto max-w-3xl px-3 pb-6">
        <div className="columns-2 gap-3 md:columns-3">
          {productos.map((producto) => (
            <motion.button
              key={producto.id}
              layoutId={`producto-${producto.id}`}
              onClick={() => setAbierto(producto)}
              whileHover={{ scale: 1.015 }}
              className="mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl text-left"
              style={{ background: "color-mix(in srgb, var(--menu-texto) 5%, transparent)" }}
            >
              {producto.imagen_url ? (
                <img
                  src={producto.imagen_url}
                  alt=""
                  className="w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div
                  className="aspect-[4/5] w-full"
                  style={{
                    background: "color-mix(in srgb, var(--menu-primario) 12%, transparent)",
                  }}
                  aria-hidden
                />
              )}
              <div className="p-3">
                <p
                  className="text-sm font-medium leading-snug"
                  style={{ color: "var(--menu-texto)" }}
                >
                  {producto.nombre}
                </p>
                <p className="vm-data mt-1 text-sm" style={{ color: "var(--menu-primario)" }}>
                  {precioMenu(producto.precio)}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {abierto && <Detalle producto={abierto} alCerrar={() => setAbierto(null)} />}
      </AnimatePresence>
    </>
  );
}
