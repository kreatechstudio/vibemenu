import { variablesDeTema, type TemaResuelto } from "@/lib/tema";
import { cn } from "@/lib/utils";

/**
 * Vista previa del menu con el tema sin guardar todavia.
 *
 * Reproduce el formato Clasico: nombre en la fuente elegida, precio en JetBrains
 * Mono a la derecha unido por linea punteada, y los modificadores debajo en su
 * propio color. Es lo mismo que veran los clientes del negocio.
 */

const PRODUCTOS = [
  {
    nombre: "Flat White Especial",
    precio: "65.00",
    descripcion: "Doble ristretto con leche microespumada.",
    modificadores: "Tamaño: Chico · Grande (+$12) — Leche: Entera · Almendra (+$15)",
  },
  {
    nombre: "Avocado Toast",
    precio: "120.00",
    descripcion: "Pan de masa madre, aguacate y huevo pochado.",
    modificadores: "Extras: Tocino (+$25) · Queso de cabra (+$20)",
  },
];

export default function VistaPreviaMenu({ tema }: { tema: TemaResuelto }) {
  const conImagen = tema.modo_imagen !== "ninguno" && tema.imagen_fondo_url;
  const esCompleto = tema.modo_imagen === "completo";

  // En fondo completo el texto va sobre la foto, así que manda el blanco.
  const colorTexto = esCompleto ? "#FFFFFF" : "var(--menu-texto)";
  const colorSuave = esCompleto ? "rgba(255,255,255,0.75)" : "var(--menu-texto-suave)";
  const colorModif = esCompleto ? "rgba(255,255,255,0.65)" : "var(--menu-modificadores)";

  const contenido = (
    <div
      className={cn(
        "space-y-5 rounded-lg p-4",
        esCompleto && tema.desenfoque_texto && "backdrop-blur-md",
      )}
      style={
        esCompleto
          ? { background: tema.desenfoque_texto ? "rgba(0,0,0,0.28)" : "transparent" }
          : undefined
      }
    >
      <p
        className="text-center text-[10px] font-semibold tracking-[0.2em]"
        style={{ color: esCompleto ? "#FFFFFF" : "var(--menu-primario)" }}
      >
        CAFETERÍA
      </p>

      {PRODUCTOS.map((p) => (
        <div key={p.nombre}>
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-sm font-medium"
              style={{ fontFamily: "var(--menu-fuente)", color: colorTexto }}
            >
              {p.nombre}
            </span>
            <span
              className="min-w-2 flex-1 border-b border-dotted"
              style={{
                borderColor: esCompleto
                  ? "rgba(255,255,255,0.4)"
                  : "color-mix(in srgb, var(--menu-texto) 30%, transparent)",
              }}
            />
            <span className="vm-data text-sm" style={{ color: colorTexto }}>
              ${p.precio}
            </span>
          </div>

          <p className="mt-1 text-xs leading-relaxed" style={{ color: colorSuave }}>
            {p.descripcion}
          </p>

          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: colorModif }}>
            {p.modificadores}
          </p>
        </div>
      ))}
    </div>
  );

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{ ...variablesDeTema(tema), background: "var(--menu-fondo)" }}
    >
      {!conImagen ? (
        <div className="p-2">{contenido}</div>
      ) : esCompleto ? (
        <div
          className="relative"
          style={{
            backgroundImage: `url(${tema.imagen_fondo_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-black/45" aria-hidden />
          <div className="relative p-3">{contenido}</div>
        </div>
      ) : (
        <div
          className="p-5"
          style={{
            backgroundImage: `url(${tema.imagen_fondo_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="rounded-lg shadow-vm-2" style={{ background: "var(--menu-fondo)" }}>
            {contenido}
          </div>
        </div>
      )}
    </div>
  );
}
