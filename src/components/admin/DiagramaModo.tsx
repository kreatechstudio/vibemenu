import type { ModoImagen } from "@/lib/tema";

/**
 * Ayuda visual: como se va a usar la imagen que sube el tenant.
 *
 * No es un icono generico. Cada diagrama reproduce la anatomia real del modo,
 * con la foto de fondo del propio tenant si ya la subio.
 */
export default function DiagramaModo({
  modo,
  imagen,
  desenfoque = false,
}: {
  modo: ModoImagen;
  imagen: string | null;
  desenfoque?: boolean;
}) {
  const fondo = imagen
    ? { backgroundImage: `url(${imagen})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: "linear-gradient(135deg, #d6d3d1, #a8a29e)" };

  if (modo === "ninguno") {
    return (
      <div
        className="grid aspect-[4/3] w-full place-items-center rounded-lg border"
        style={{ background: "var(--menu-fondo, #FBF7F2)" }}
        aria-hidden
      >
        <div className="w-3/4 space-y-1.5">
          <div className="h-1.5 w-1/2 rounded-full bg-black/25" />
          <div className="h-1.5 w-full rounded-full bg-black/15" />
          <div className="h-1.5 w-4/5 rounded-full bg-black/15" />
        </div>
      </div>
    );
  }

  if (modo === "marco") {
    return (
      <div
        className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-lg border p-3"
        style={fondo}
        aria-hidden
      >
        {/* La carta va en una tarjeta al centro: la foto solo enmarca. */}
        <div
          className="w-full space-y-1.5 rounded-md p-3 shadow-sm"
          style={{ background: "var(--menu-fondo, #FBF7F2)" }}
        >
          <div className="h-1.5 w-1/2 rounded-full bg-black/25" />
          <div className="h-1.5 w-full rounded-full bg-black/15" />
          <div className="h-1.5 w-4/5 rounded-full bg-black/15" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border"
      style={fondo}
      aria-hidden
    >
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 grid place-items-center p-3">
        <div
          className={`w-3/4 space-y-1.5 rounded-md p-2 ${desenfoque ? "backdrop-blur-sm" : ""}`}
          style={desenfoque ? { background: "rgba(0,0,0,0.25)" } : undefined}
        >
          <div className="h-1.5 w-1/2 rounded-full bg-white/85" />
          <div className="h-1.5 w-full rounded-full bg-white/55" />
          <div className="h-1.5 w-4/5 rounded-full bg-white/55" />
        </div>
      </div>
    </div>
  );
}
