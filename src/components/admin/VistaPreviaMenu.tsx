import { variablesDeTema, type TemaResuelto } from "@/lib/tema";
import type { FormatoMenu } from "@/types/database";
import { cn } from "@/lib/utils";

/**
 * Vista previa del menú con el tema sin guardar todavía.
 *
 * Pinta la anatomía del formato ACTIVO, no siempre la del Clásico. Cada formato
 * es una experiencia distinta, no la misma tarjeta con otro grid, y la vista
 * previa tiene que decir la verdad sobre eso.
 *
 * Los colores salen de `resolverTema`, que ya aplica los defaults de cada formato
 * (Pinterest e Instagram sobre blanco, TikTok oscuro) antes de dejar que el tenant
 * los pise. Un negocio que no ha tocado nada ve los de stock.
 */

const PRODUCTOS = [
  {
    nombre: "Flat White Especial",
    precio: "65.00",
    descripcion: "Doble ristretto con leche microespumada.",
    modificadores: "Tamaño: Chico · Grande (+$12) — Leche: Entera · Almendra (+$15)",
    alto: 62,
  },
  {
    nombre: "Avocado Toast",
    precio: "120.00",
    descripcion: "Pan de masa madre, aguacate y huevo pochado.",
    modificadores: "Extras: Tocino (+$25) · Queso de cabra (+$20)",
    alto: 84,
  },
  {
    nombre: "Cold Brew",
    precio: "58.00",
    descripcion: "Doce horas de extracción en frío.",
    modificadores: "",
    alto: 52,
  },
] as const;

const CATEGORIAS = ["Todo", "Cafetería", "Desayunos"] as const;

/* ── Anatomías ─────────────────────────────────────────────────────── */

function Clasico() {
  return (
    <div className="space-y-5 p-4">
      <p
        className="text-center text-[10px] font-semibold tracking-[0.2em]"
        style={{ color: "var(--menu-primario)" }}
      >
        CAFETERÍA
      </p>

      {PRODUCTOS.slice(0, 2).map((p) => (
        <div key={p.nombre}>
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-sm font-medium"
              style={{ fontFamily: "var(--menu-fuente)", color: "var(--menu-texto)" }}
            >
              {p.nombre}
            </span>
            <span
              className="min-w-2 flex-1 border-b border-dotted"
              style={{ borderColor: "color-mix(in srgb, var(--menu-texto) 30%, transparent)" }}
            />
            <span className="vm-data text-sm" style={{ color: "var(--menu-texto)" }}>
              ${p.precio}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--menu-texto-suave)" }}>
            {p.descripcion}
          </p>
          {p.modificadores && (
            <p
              className="mt-1 text-[11px] leading-relaxed"
              style={{ color: "var(--menu-modificadores)" }}
            >
              {p.modificadores}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/** Pastillas arriba + masonry de alturas variables. */
function Pinterest() {
  return (
    <div className="p-3">
      <div className="mb-3 flex gap-1.5 overflow-hidden">
        {CATEGORIAS.map((c, i) => (
          <span
            key={c}
            className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium"
            style={
              i === 0
                ? { background: "var(--menu-texto)", color: "var(--menu-fondo)" }
                : {
                    background: "color-mix(in srgb, var(--menu-texto) 8%, transparent)",
                    color: "var(--menu-texto)",
                  }
            }
          >
            {c}
          </span>
        ))}
      </div>

      <div className="columns-2 gap-2">
        {PRODUCTOS.map((p, i) => (
          <div key={p.nombre} className="mb-2 break-inside-avoid overflow-hidden rounded-lg">
            <div
              style={{
                height: p.alto,
                background:
                  i % 2
                    ? "color-mix(in srgb, var(--menu-primario) 18%, transparent)"
                    : "color-mix(in srgb, var(--menu-texto) 10%, transparent)",
              }}
            />
            <div className="pt-1.5">
              <p
                className="truncate text-[11px] font-medium"
                style={{ color: "var(--menu-texto)" }}
              >
                {p.nombre}
              </p>
              <p className="vm-data text-[11px]" style={{ color: "var(--menu-primario)" }}>
                ${p.precio}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Historias arriba + cuadrícula 3×3. */
function Instagram() {
  return (
    <div className="p-3">
      <div className="mb-3 flex gap-3">
        {CATEGORIAS.map((c, i) => (
          <div key={c} className="flex w-12 flex-col items-center gap-1">
            <span
              className="grid size-11 place-items-center rounded-full p-[2px]"
              style={{
                background:
                  i === 0
                    ? "var(--menu-primario)"
                    : "color-mix(in srgb, var(--menu-texto) 22%, transparent)",
              }}
            >
              <span
                className="grid size-full place-items-center rounded-full p-[1.5px]"
                style={{ background: "var(--menu-fondo)" }}
              >
                <span
                  className="size-full rounded-full"
                  style={{
                    background: "color-mix(in srgb, var(--menu-primario) 16%, transparent)",
                  }}
                />
              </span>
            </span>
            <span
              className="w-full truncate text-center text-[9px]"
              style={{ color: "var(--menu-texto)" }}
            >
              {c}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-0.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square"
            style={{
              background:
                i % 3 === 1
                  ? "color-mix(in srgb, var(--menu-primario) 20%, transparent)"
                  : "color-mix(in srgb, var(--menu-texto) 10%, transparent)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Fullscreen vertical: pastillas arriba, texto sobre degradado abajo. */
function TikTok() {
  return (
    <div
      className="relative aspect-[9/14] w-full overflow-hidden"
      style={{ background: "#0A0A0A" }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(120% 80% at 50% 25%, var(--menu-primario), transparent 70%)",
          opacity: 0.55,
        }}
      />

      <div className="absolute inset-x-0 top-0 z-10 flex gap-1.5 overflow-hidden p-2.5">
        {CATEGORIAS.map((c, i) => (
          <span
            key={c}
            className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium"
            style={
              i === 0
                ? { background: "#FFFFFF", color: "#0A0A0A" }
                : { background: "rgba(255,255,255,0.18)", color: "#FFFFFF" }
            }
          >
            {c}
          </span>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 space-y-1 p-3">
        <p className="text-sm font-bold text-white">Avocado Toast</p>
        <p className="vm-data text-xs text-white">$120.00</p>
        <p className="text-[10px] text-white/70">Pan de masa madre, aguacate y huevo pochado.</p>
        <span className="mt-1.5 inline-block rounded-full bg-white/15 px-2.5 py-1 text-[10px] text-white">
          Ver opciones
        </span>
      </div>
    </div>
  );
}

const ANATOMIAS: Record<FormatoMenu, () => React.ReactElement> = {
  clasico: Clasico,
  pinterest: Pinterest,
  instagram: Instagram,
  tiktok: TikTok,
};

/* ── Envoltorio: modo de imagen + desenfoque ───────────────────────── */

export default function VistaPreviaMenu({
  tema,
  formato,
}: {
  tema: TemaResuelto;
  formato: FormatoMenu;
}) {
  const Anatomia = ANATOMIAS[formato];
  const conImagen = tema.modo_imagen !== "ninguno" && tema.imagen_fondo_url;
  const esCompleto = tema.modo_imagen === "completo";

  // TikTok ya es una pantalla completa con su propio fondo: la imagen no aplica.
  const fondoEnvoltorio = formato === "tiktok" ? "#0A0A0A" : ("var(--menu-fondo)" as const);

  const contenido = <Anatomia />;

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{ ...variablesDeTema(tema), background: fondoEnvoltorio }}
    >
      {formato === "tiktok" || !conImagen ? (
        contenido
      ) : esCompleto ? (
        <div
          className="relative"
          style={{
            backgroundImage: `url(${tema.imagen_fondo_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-black/50" aria-hidden />
          <div
            className={cn("relative", tema.desenfoque_texto && "backdrop-blur-md")}
            // Sobre la foto, los colores del tenant serían ilegibles.
            style={
              {
                "--menu-texto": "#FFFFFF",
                "--menu-texto-suave": "rgba(255,255,255,0.78)",
                "--menu-modificadores": "rgba(255,255,255,0.65)",
              } as React.CSSProperties
            }
          >
            {contenido}
          </div>
        </div>
      ) : (
        // Marco: la foto enmarca. Con desenfoque se difumina LA FOTO, y la tarjeta
        // se vuelve translúcida para dejarla translucir — igual que el menú real.
        <div className="relative overflow-hidden p-4">
          <div
            aria-hidden
            className={cn("absolute inset-0", tema.desenfoque_texto && "scale-110 blur-[6px]")}
            style={{
              backgroundImage: `url(${tema.imagen_fondo_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div
            className={cn(
              "relative overflow-hidden rounded-lg shadow-vm-2",
              tema.desenfoque_texto && "backdrop-blur-[2px]",
            )}
            style={{
              background: tema.desenfoque_texto
                ? "color-mix(in srgb, var(--menu-fondo) 78%, transparent)"
                : "var(--menu-fondo)",
            }}
          >
            {contenido}
          </div>
        </div>
      )}
    </div>
  );
}
