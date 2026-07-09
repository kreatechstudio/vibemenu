import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImageOff, X } from "lucide-react";
import { precioMenu } from "@/lib/tema";
import type { CategoriaConProductos, ProductoConModificadores } from "@/hooks/useMenuPublico";

/**
 * Formato Instagram — cuadricula tipo feed.
 *
 * Anatomia: grid perfecto de 3 columnas con fotos cuadradas (crop automatico via
 * object-cover). Al abrir un producto, vista tipo "post": foto grande arriba,
 * nombre/precio/descripcion abajo, y los modificadores como "detalles del post".
 *
 * El header de perfil simulado lo pone HeaderMenu en modo compacto.
 */

function Post({
  producto,
  alCerrar,
}: {
  producto: ProductoConModificadores;
  alCerrar: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: "var(--menu-fondo)" }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      role="dialog"
      aria-modal="true"
      aria-label={producto.nombre}
    >
      <div className="mx-auto max-w-lg">
        <div
          className="sticky top-0 z-10 flex justify-end p-3"
          style={{ background: "var(--menu-fondo)" }}
        >
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="rounded-full p-1.5"
            style={{ color: "var(--menu-texto)" }}
          >
            <X className="size-5" />
          </button>
        </div>

        {producto.imagen_url ? (
          <img src={producto.imagen_url} alt="" className="aspect-square w-full object-cover" />
        ) : (
          <div
            className="grid aspect-square w-full place-items-center"
            style={{ background: "color-mix(in srgb, var(--menu-primario) 10%, transparent)" }}
          >
            <ImageOff className="size-8" style={{ color: "var(--menu-texto-suave)" }} aria-hidden />
          </div>
        )}

        <div className="p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-bold" style={{ color: "var(--menu-texto)" }}>
              {producto.nombre}
            </h2>
            <span className="vm-data text-lg" style={{ color: "var(--menu-primario)" }}>
              {precioMenu(producto.precio)}
            </span>
          </div>

          {producto.descripcion && (
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: "var(--menu-texto-suave)" }}
            >
              {producto.descripcion}
            </p>
          )}

          {producto.grupos.length > 0 && (
            <div
              className="mt-6 space-y-4 border-t pt-5"
              style={{ borderColor: "color-mix(in srgb, var(--menu-texto) 12%, transparent)" }}
            >
              {producto.grupos.map((g) => (
                <div key={g.id}>
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--menu-texto)" }}
                  >
                    {g.nombre}
                    {g.obligatorio && <span style={{ color: "var(--menu-primario)" }}> *</span>}
                  </p>
                  <ul className="mt-2 space-y-1.5">
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
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function Instagram({ categorias }: { categorias: CategoriaConProductos[] }) {
  const [abierto, setAbierto] = useState<ProductoConModificadores | null>(null);
  const productos = categorias.flatMap((c) => c.productos);

  return (
    <>
      <div className="mx-auto max-w-lg pb-6">
        <div className="grid grid-cols-3 gap-0.5">
          {productos.map((producto) => (
            <button
              key={producto.id}
              type="button"
              onClick={() => setAbierto(producto)}
              className="group relative aspect-square overflow-hidden"
              aria-label={producto.nombre}
            >
              {producto.imagen_url ? (
                <img
                  src={producto.imagen_url}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div
                  className="grid size-full place-items-center p-2 text-center"
                  style={{
                    background: "color-mix(in srgb, var(--menu-primario) 10%, transparent)",
                  }}
                >
                  <span
                    className="text-[10px] font-medium leading-tight"
                    style={{ color: "var(--menu-texto)" }}
                  >
                    {producto.nombre}
                  </span>
                </div>
              )}

              <span className="vm-data absolute bottom-1 right-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                {precioMenu(producto.precio)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {abierto && <Post producto={abierto} alCerrar={() => setAbierto(null)} />}
      </AnimatePresence>
    </>
  );
}
