import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImageOff, X } from "lucide-react";
import BotonAgregar from "@/components/menu/BotonAgregar";
import TiraCategorias from "@/components/menu/TiraCategorias";
import { useAnalitica } from "@/hooks/useAnalitica";
import { precioMenu } from "@/lib/tema";
import type { CategoriaConProductos, ProductoConModificadores } from "@/hooks/useMenuPublico";

/**
 * Formato Instagram — cuadricula tipo feed.
 *
 * Anatomia: circulos de historias con las categorias, luego grid perfecto de 3
 * columnas con fotos cuadradas. Al abrir un producto, vista tipo "post".
 *
 * El detalle NO inunda la pantalla con el color de fondo del tenant: es una
 * tarjeta centrada sobre un velo oscuro. Antes, un tema naranja convertia el
 * detalle en un muro naranja con medio metro vacio debajo.
 */

function Post({
  producto,
  alCerrar,
}: {
  producto: ProductoConModificadores;
  alCerrar: () => void;
}) {
  const obligatorios = producto.grupos.filter((g) => g.obligatorio);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={alCerrar}
    >
      <motion.article
        // En móvil sube como hoja desde abajo; en escritorio aparece centrada.
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 32, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={producto.nombre}
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl shadow-vm-3 sm:max-h-[88vh] sm:rounded-2xl"
        style={{ background: "var(--menu-fondo)" }}
      >
        {/* Asa de arrastre, solo en móvil */}
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span
            className="h-1 w-10 rounded-full"
            style={{ background: "color-mix(in srgb, var(--menu-texto) 22%, transparent)" }}
            aria-hidden
          />
        </div>

        <div className="relative">
          {producto.imagen_url ? (
            <img src={producto.imagen_url} alt="" className="aspect-square w-full object-cover" />
          ) : (
            <div
              className="grid aspect-square w-full place-items-center"
              style={{ background: "color-mix(in srgb, var(--menu-primario) 10%, transparent)" }}
            >
              <ImageOff
                className="size-8"
                style={{ color: "var(--menu-texto-suave)" }}
                aria-hidden
              />
            </div>
          )}

          {/* Sobre la foto, no sobre el color del tenant: siempre se ve. */}
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/65"
          >
            <X className="size-4.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-3">
            <h2
              className="text-xl font-bold leading-snug"
              style={{ fontFamily: "var(--menu-fuente)", color: "var(--menu-texto)" }}
            >
              {producto.nombre}
            </h2>

            {/* El precio como pastilla: es el dato que el comensal busca. */}
            <span
              className="vm-data shrink-0 rounded-full px-3 py-1 text-sm font-medium"
              style={{
                background: "color-mix(in srgb, var(--menu-primario) 12%, transparent)",
                color: "var(--menu-primario)",
              }}
            >
              {precioMenu(producto.precio)}
            </span>
          </div>

          <div className="mt-3">
            <BotonAgregar producto={producto} variante="stepper" />
          </div>

          {producto.descripcion && (
            <p
              className="mt-2.5 text-sm leading-relaxed"
              style={{ color: "var(--menu-texto-suave)" }}
            >
              {producto.descripcion}
            </p>
          )}

          {producto.grupos.length > 0 && (
            <div className="mt-5 space-y-3">
              {producto.grupos.map((g) => (
                <div
                  key={g.id}
                  className="rounded-xl p-4"
                  style={{ background: "color-mix(in srgb, var(--menu-texto) 5%, transparent)" }}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--menu-texto)" }}
                    >
                      {g.nombre}
                    </p>
                    <span className="text-[11px]" style={{ color: "var(--menu-modificadores)" }}>
                      {g.obligatorio
                        ? "Obligatorio"
                        : g.tipo_seleccion === "multiple"
                          ? "Elige las que quieras"
                          : "Elige una"}
                    </span>
                  </div>

                  <ul className="mt-2.5 space-y-2">
                    {g.opciones.map((o) => (
                      <li key={o.id} className="flex items-baseline gap-2 text-sm">
                        <span style={{ color: "var(--menu-texto)" }}>{o.nombre}</span>
                        <span
                          className="min-w-2 flex-1 border-b border-dotted"
                          style={{
                            borderColor: "color-mix(in srgb, var(--menu-texto) 20%, transparent)",
                          }}
                          aria-hidden
                        />
                        <span
                          className="vm-data shrink-0 text-xs"
                          style={{ color: "var(--menu-modificadores)" }}
                        >
                          {o.precio_extra > 0 ? `+${precioMenu(o.precio_extra)}` : "Incluido"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {obligatorios.length > 0 && (
                <p className="text-[11px]" style={{ color: "var(--menu-modificadores)" }}>
                  Los grupos obligatorios se eligen al ordenar en el mostrador.
                </p>
              )}
            </div>
          )}
        </div>
      </motion.article>
    </motion.div>
  );
}

export default function Instagram({
  categorias,
  logoUrl,
  inicial,
}: {
  categorias: CategoriaConProductos[];
  logoUrl?: string | null;
  inicial?: string;
}) {
  const [abierto, setAbierto] = useState<ProductoConModificadores | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  const analitica = useAnalitica();

  const visibles = categoria ? categorias.filter((c) => c.id === categoria) : categorias;
  const productos = visibles.flatMap((c) => c.productos);

  return (
    <>
      <div className="mx-auto max-w-lg pb-6">
        {/* Las categorías son las historias. El círculo "Todo" lleva el logo. */}
        <TiraCategorias
          categorias={categorias}
          activa={categoria}
          alElegir={setCategoria}
          variante="historias"
          logoTodo={logoUrl ?? null}
          inicialTodo={inicial}
          className="mb-3"
        />

        <div className="grid grid-cols-3 gap-0.5">
          {productos.map((producto) => (
            <div key={producto.id} className="group relative aspect-square overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  analitica.registrarVista(producto.id);
                  setAbierto(producto);
                }}
                className="block size-full"
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

              <div className="absolute left-1 top-1 z-10">
                <BotonAgregar producto={producto} variante="badge" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {abierto && <Post producto={abierto} alCerrar={() => setAbierto(null)} />}
      </AnimatePresence>
    </>
  );
}
