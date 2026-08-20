import { ImageOff } from "lucide-react";
import type { CategoriaConProductos } from "@/hooks/useMenuPublico";
import { cn } from "@/lib/utils";

/**
 * Navegación por categorías, compartida por Pinterest, Instagram y TikTok.
 *
 * Dos anatomías, no dos estilos del mismo componente:
 *  - `pastillas`: chips redondeados. Es lo que hace Pinterest arriba del mosaico,
 *    y lo que hace TikTok con sus pestañas sobre el video.
 *  - `historias`: círculos con anillo, como las historias de Instagram. Cada uno
 *    lleva la primera foto de su categoría dentro.
 *
 * `null` significa "Todo": sin filtro.
 */

export type VarianteTira = "pastillas" | "historias";

/** Primera foto de la categoría. Sirve de portada del círculo. */
const portadaDe = (c: CategoriaConProductos) =>
  c.productos.find((p) => p.imagen_url)?.imagen_url ?? null;

export default function TiraCategorias({
  categorias,
  activa,
  alElegir,
  variante,
  sobreOscuro = false,
  logoTodo = null,
  inicialTodo,
  className,
}: {
  categorias: CategoriaConProductos[];
  /** `null` = todas. */
  activa: string | null;
  alElegir: (id: string | null) => void;
  variante: VarianteTira;
  /** Sobre foto o video: la barra y los textos cambian a blancos. */
  sobreOscuro?: boolean;
  /** Logo del negocio para el círculo "Todo". Sin él, se usa la inicial. */
  logoTodo?: string | null;
  inicialTodo?: string;
  className?: string;
}) {
  // Con una sola categoría el filtro no aporta nada y roba espacio vertical.
  if (categorias.length < 2) return null;

  const contenedor = cn(
    "tira-scroll flex gap-2 px-4 pb-2",
    sobreOscuro && "tira-scroll-claro",
    className,
  );

  if (variante === "historias") {
    return (
      <nav aria-label="Categorías" className={cn(contenedor, "gap-4 pb-3")}>
        <CirculoHistoria
          nombre="Todo"
          portada={logoTodo}
          inicial={inicialTodo}
          activa={activa === null}
          alElegir={() => alElegir(null)}
          sobreOscuro={sobreOscuro}
        />
        {categorias.map((c) => (
          <CirculoHistoria
            key={c.id}
            nombre={c.nombre}
            portada={portadaDe(c)}
            activa={activa === c.id}
            alElegir={() => alElegir(c.id)}
            sobreOscuro={sobreOscuro}
          />
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Categorías" className={contenedor}>
      <Pastilla
        nombre="Todo"
        activa={activa === null}
        alElegir={() => alElegir(null)}
        sobreOscuro={sobreOscuro}
      />
      {categorias.map((c) => (
        <Pastilla
          key={c.id}
          nombre={c.nombre}
          activa={activa === c.id}
          alElegir={() => alElegir(c.id)}
          sobreOscuro={sobreOscuro}
        />
      ))}
    </nav>
  );
}

function Pastilla({
  nombre,
  activa,
  alElegir,
  sobreOscuro,
}: {
  nombre: string;
  activa: boolean;
  alElegir: () => void;
  sobreOscuro: boolean;
}) {
  return (
    <button
      type="button"
      onClick={alElegir}
      aria-pressed={activa}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-opacity",
        !activa && "opacity-70 hover:opacity-100",
      )}
      style={
        activa
          ? sobreOscuro
            ? { background: "#FFFFFF", color: "#0A0A0A" }
            : { background: "var(--menu-texto)", color: "var(--menu-fondo)" }
          : sobreOscuro
            ? { background: "rgba(255,255,255,0.18)", color: "#FFFFFF" }
            : {
                background: "color-mix(in srgb, var(--menu-texto) 8%, transparent)",
                color: "var(--menu-texto)",
              }
      }
    >
      {nombre}
    </button>
  );
}

function CirculoHistoria({
  nombre,
  portada,
  inicial,
  activa,
  alElegir,
  sobreOscuro,
}: {
  nombre: string;
  portada: string | null;
  /** Solo para el círculo "Todo" cuando el negocio no tiene logo. */
  inicial?: string;
  activa: boolean;
  alElegir: () => void;
  sobreOscuro: boolean;
}) {
  return (
    <button
      type="button"
      onClick={alElegir}
      aria-pressed={activa}
      className="flex w-16 shrink-0 flex-col items-center gap-1.5"
    >
      {/* El anillo se pinta con padding + fondo, como el de Instagram. */}
      <span
        className={cn(
          "grid size-16 place-items-center rounded-full p-[2.5px]",
          !activa && "opacity-60",
        )}
        style={{
          background: activa
            ? "var(--menu-primario)"
            : sobreOscuro
              ? "rgba(255,255,255,0.35)"
              : "color-mix(in srgb, var(--menu-texto) 22%, transparent)",
        }}
      >
        <span
          className="grid size-full place-items-center overflow-hidden rounded-full p-[2px]"
          style={{ background: sobreOscuro ? "#0A0A0A" : "var(--menu-fondo)" }}
        >
          {portada ? (
            <img src={portada} alt="" className="size-full rounded-full object-cover" />
          ) : inicial ? (
            /* Sin logo, la inicial del negocio. Nunca un icono de "sin imagen". */
            <span
              className="grid size-full place-items-center rounded-full text-base font-bold text-white"
              style={{ background: "var(--menu-primario)" }}
            >
              {inicial.toUpperCase()}
            </span>
          ) : (
            <span
              className="grid size-full place-items-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--menu-primario) 14%, transparent)" }}
            >
              <ImageOff
                className="size-4"
                style={{ color: "var(--menu-texto-suave)" }}
                aria-hidden
              />
            </span>
          )}
        </span>
      </span>

      <span
        className="w-full truncate text-center text-[11px]"
        style={{ color: sobreOscuro ? "#FFFFFF" : "var(--menu-texto)" }}
      >
        {nombre}
      </span>
    </button>
  );
}
