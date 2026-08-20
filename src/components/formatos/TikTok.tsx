import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, ListPlus, X } from "lucide-react";
import TiraCategorias from "@/components/menu/TiraCategorias";
import { precioMenu } from "@/lib/tema";
import type { CategoriaConProductos, ProductoConModificadores } from "@/hooks/useMenuPublico";

/**
 * Formato TikTok — fullscreen vertical, un producto a la vez.
 *
 * Anatomia: scroll-snap vertical. Si el producto tiene video_url, se embebe con
 * autoplay muteado; si no, la foto entra con un zoom lento (Ken Burns). El texto
 * va sobre un degradado oscuro para que se lea encima de cualquier imagen.
 * Los modificadores suben desde abajo como un sheet, igual que TikTok Shop.
 *
 * El swipe no necesita JS: `snap-y snap-mandatory` con overflow lo resuelve nativo,
 * y funciona con el gesto real del dedo en vez de emularlo.
 */

/** YouTube y Reels no aceptan la URL de la barra: hay que convertirla a /embed. */
function urlEmbebida(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}?autoplay=1&mute=1&loop=1&controls=0&playsinline=1&playlist=${u.pathname.slice(1)}`;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").pop();
      if (!id) return null;
      return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&controls=0&playsinline=1&playlist=${id}`;
    }
    if (host === "instagram.com") {
      return `${u.origin}${u.pathname.replace(/\/$/, "")}/embed`;
    }
    return null;
  } catch {
    return null;
  }
}

function Sheet({
  producto,
  alCerrar,
}: {
  producto: ProductoConModificadores;
  alCerrar: () => void;
}) {
  return (
    <motion.div
      // z-40: por encima de las pastillas de categoría, que van en z-30.
      className="absolute inset-0 z-40 flex items-end bg-black/50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={alCerrar}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[70%] w-full overflow-y-auto rounded-t-2xl bg-neutral-900 p-5 text-white"
        role="dialog"
        aria-modal="true"
        aria-label={`Opciones de ${producto.nombre}`}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/25" aria-hidden />

        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">{producto.nombre}</h2>
          <button type="button" onClick={alCerrar} aria-label="Cerrar" className="text-white/60">
            <X className="size-5" />
          </button>
        </div>

        {producto.grupos.map((g) => (
          <div key={g.id} className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
              {g.nombre}
              {g.obligatorio && <span className="text-white"> *</span>}
            </p>
            <ul className="mt-2 space-y-1.5">
              {g.opciones.map((o) => (
                <li key={o.id} className="flex justify-between text-sm text-white/85">
                  <span>{o.nombre}</span>
                  {o.precio_extra > 0 && (
                    <span className="vm-data">+{precioMenu(o.precio_extra)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

function Slide({ producto }: { producto: ProductoConModificadores }) {
  const [sheet, setSheet] = useState(false);
  const embed = producto.video_url ? urlEmbebida(producto.video_url) : null;

  return (
    <section className="relative h-dvh w-full shrink-0 snap-start snap-always overflow-hidden bg-black">
      {embed ? (
        <iframe
          src={embed}
          title={producto.nombre}
          allow="autoplay; encrypted-media; picture-in-picture"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 border-0"
        />
      ) : producto.imagen_url ? (
        <motion.img
          src={producto.imagen_url}
          alt=""
          className="size-full object-cover"
          initial={{ scale: 1 }}
          animate={{ scale: 1.12 }}
          transition={{ duration: 14, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
        />
      ) : (
        <div className="size-full" style={{ background: "var(--menu-primario)" }} aria-hidden />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 z-10 p-5 pb-16">
        <h2 className="text-2xl font-bold text-white">{producto.nombre}</h2>
        <p className="vm-data mt-1 text-lg text-white">{precioMenu(producto.precio)}</p>
        {producto.descripcion && (
          <p className="mt-2 line-clamp-2 max-w-md text-sm text-white/80">{producto.descripcion}</p>
        )}

        {producto.grupos.length > 0 && (
          <button
            type="button"
            onClick={() => setSheet(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur"
          >
            <ListPlus className="size-4" aria-hidden />
            Ver opciones
          </button>
        )}
      </div>

      <AnimatePresence>
        {sheet && <Sheet producto={producto} alCerrar={() => setSheet(false)} />}
      </AnimatePresence>
    </section>
  );
}

export default function TikTok({ categorias }: { categorias: CategoriaConProductos[] }) {
  const [categoria, setCategoria] = useState<string | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);

  const visibles = categoria ? categorias.filter((c) => c.id === categoria) : categorias;
  const productos = visibles.flatMap((c) => c.productos);

  // Al cambiar de categoría hay que volver arriba, o el scroll queda en un slide
  // que ya no existe y el usuario ve una pantalla en blanco.
  function elegir(id: string | null) {
    setCategoria(id);
    contenedor.current?.scrollTo({ top: 0 });
  }

  return (
    <div className="relative h-dvh">
      {/* Pestañas flotando sobre el video, como las de TikTok. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 pt-3">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="pointer-events-auto relative">
          <TiraCategorias
            categorias={categorias}
            activa={categoria}
            alElegir={elegir}
            variante="pastillas"
            sobreOscuro
          />
        </div>
      </div>

      <div
        ref={contenedor}
        className="h-dvh snap-y snap-mandatory overflow-y-scroll overscroll-none"
      >
        {productos.map((producto) => (
          <Slide key={producto.id} producto={producto} />
        ))}
      </div>

      {productos.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-9 z-20 flex justify-center">
          <motion.span
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="text-white/50"
          >
            <ChevronUp className="size-5" aria-hidden />
          </motion.span>
        </div>
      )}
    </div>
  );
}
