import { motion } from "framer-motion";
import { precioMenu } from "@/lib/tema";
import type { CategoriaConProductos, ProductoConModificadores } from "@/hooks/useMenuPublico";

/**
 * Formato Clasico — la carta de siempre.
 *
 * Anatomia: lista vertical por categoria, nombre en serif, precio a la derecha
 * unido por la linea punteada clasica de menu de restaurante. Si el producto
 * tiene foto se muestra una miniatura chica a la izquierda (misma altura
 * aprox. que el bloque de texto, para no alargar la lista); sin foto no se
 * reserva espacio, como antes.
 */

function Modificadores({ producto }: { producto: ProductoConModificadores }) {
  if (producto.grupos.length === 0) return null;

  return (
    <ul className="mt-1.5 space-y-0.5">
      {producto.grupos.map((g) => (
        // Color propio: el tenant puede separarlos del resto del texto (desde Basic).
        <li key={g.id} className="text-xs" style={{ color: "var(--menu-modificadores)" }}>
          <span className="font-medium">{g.nombre}:</span>{" "}
          {g.opciones
            .map((o) =>
              o.precio_extra > 0 ? `${o.nombre} (+${precioMenu(o.precio_extra)})` : o.nombre,
            )
            .join(" · ")}
        </li>
      ))}
    </ul>
  );
}

export default function Clasico({ categorias }: { categorias: CategoriaConProductos[] }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-4">
      {categorias.map((categoria, i) => (
        <motion.section
          key={categoria.id}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.2) }}
          className="pt-10 first:pt-6"
        >
          <h2
            className="text-center text-xs font-semibold tracking-[0.2em]"
            style={{ color: "var(--menu-primario)" }}
          >
            {categoria.nombre.toUpperCase()}
          </h2>

          <ul className="mt-6 space-y-6">
            {categoria.productos.map((producto) => (
              <li key={producto.id} className="flex gap-3">
                {producto.imagen_url && (
                  <img
                    src={producto.imagen_url}
                    alt=""
                    loading="lazy"
                    className="size-16 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <h3
                      className="text-lg font-medium"
                      style={{ fontFamily: "var(--menu-fuente)", color: "var(--menu-texto)" }}
                    >
                      {producto.nombre}
                    </h3>
                    <span
                      className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted"
                      style={{
                        borderColor: "color-mix(in srgb, var(--menu-texto) 30%, transparent)",
                      }}
                      aria-hidden
                    />
                    <span className="vm-data text-base" style={{ color: "var(--menu-texto)" }}>
                      {precioMenu(producto.precio)}
                    </span>
                  </div>

                  {producto.descripcion && (
                    <p
                      className="mt-1 max-w-prose text-sm leading-relaxed"
                      style={{ color: "var(--menu-texto-suave)" }}
                    >
                      {producto.descripcion}
                    </p>
                  )}

                  <Modificadores producto={producto} />
                </div>
              </li>
            ))}
          </ul>
        </motion.section>
      ))}
    </div>
  );
}
