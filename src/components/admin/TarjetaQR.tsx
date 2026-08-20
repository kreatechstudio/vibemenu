import { useEffect, useRef, useState, type RefObject } from "react";
import QRCode from "react-qr-code";
import {
  disposicion,
  LIENZO,
  MEDIDAS,
  tamanoTitulo,
  type OpcionesTarjeta,
  type Renglon as TipoRenglon,
} from "@/lib/qr";
import { cn } from "@/lib/utils";

/** `y` es la línea base, igual que en el canvas: el DOM la convierte a `top`. */
function Renglon({ renglon, className }: { renglon: TipoRenglon; className?: string }) {
  return (
    <p
      className={cn("absolute w-full text-center leading-none", className)}
      style={{ top: renglon.y - renglon.tamano * 0.78, fontSize: renglon.tamano }}
    >
      {renglon.texto}
    </p>
  );
}

/**
 * Vista previa de la tarjeta imprimible.
 *
 * Se dibuja al tamano real (1000x1400) y se encoge con `transform: scale`. Asi la
 * vista previa no "se parece" al PNG: es el mismo layout, con las mismas medidas
 * de `MEDIDAS`. Lo unico que cambia es el zoom.
 */
export default function TarjetaQR({
  opciones,
  refQr,
}: {
  opciones: OpcionesTarjeta;
  /** El <svg> del codigo se serializa desde aqui para exportarlo. */
  refQr: RefObject<HTMLDivElement | null>;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.4);

  useEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;
    const observador = new ResizeObserver(([entrada]) => {
      setEscala(entrada.contentRect.width / LIENZO.ancho);
    });
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  const conFoto = Boolean(opciones.imagenFondoUrl);
  const colorTexto = conFoto ? "#FFFFFF" : opciones.colorTexto;
  const tamano = tamanoTitulo(opciones.titulo, opciones.fuenteCss);
  const bloque = disposicion(opciones);

  return (
    <div ref={caja} className="w-full" style={{ height: LIENZO.alto * escala }}>
      <div
        className="relative overflow-hidden rounded-xl bg-cover bg-center shadow-vm-2"
        style={{
          width: LIENZO.ancho,
          height: LIENZO.alto,
          transform: `scale(${escala})`,
          transformOrigin: "top left",
          background: opciones.colorFondo,
          backgroundImage: opciones.imagenFondoUrl ? `url(${opciones.imagenFondoUrl})` : undefined,
          fontFamily: opciones.fuenteCss,
        }}
        aria-label={`Vista previa del QR de ${opciones.titulo}`}
      >
        {/* Mismo velo que pinta el canvas: sin él, el texto blanco se pierde. */}
        {conFoto && <div className="absolute inset-0 bg-black/50" aria-hidden />}

        <div className="relative size-full" style={{ color: colorTexto }}>
          {/* Los textos se anclan por su línea base, igual que ctx.fillText. */}
          <p
            className="absolute w-full text-center font-semibold leading-none"
            style={{ top: MEDIDAS.titulo.y - tamano * 0.78, fontSize: tamano }}
          >
            {opciones.titulo}
          </p>

          {opciones.sucursal && (
            <p
              className="absolute w-full text-center leading-none opacity-75"
              style={{
                top: MEDIDAS.sucursal.y - MEDIDAS.sucursal.tamano * 0.78,
                fontSize: MEDIDAS.sucursal.tamano,
              }}
            >
              {opciones.sucursal}
            </p>
          )}

          {/* El panel es blanco siempre: el lector necesita contraste, no estilo. */}
          <div
            className="absolute bg-white shadow-vm-3"
            style={{
              left: MEDIDAS.panel.x,
              top: MEDIDAS.panel.y,
              width: MEDIDAS.panel.lado,
              height: MEDIDAS.panel.lado,
              borderRadius: MEDIDAS.panel.radio,
            }}
          />

          <div
            ref={refQr}
            className="absolute"
            style={{
              left: MEDIDAS.qr.x,
              top: MEDIDAS.qr.y,
              width: MEDIDAS.qr.lado,
              height: MEDIDAS.qr.lado,
            }}
          >
            <QRCode
              value={opciones.url}
              size={MEDIDAS.qr.lado}
              // Nivel H reserva redundancia suficiente para que el logo tape el centro.
              level={opciones.logoUrl ? "H" : "M"}
              bgColor="#FFFFFF"
              fgColor={opciones.colorQr}
              style={{ width: "100%", height: "100%" }}
            />
          </div>

          {opciones.logoUrl && (
            <div
              className="absolute grid place-items-center bg-white"
              style={{
                left: MEDIDAS.qr.x + MEDIDAS.qr.lado / 2 - MEDIDAS.logo.lado / 2,
                top: MEDIDAS.qr.y + MEDIDAS.qr.lado / 2 - MEDIDAS.logo.lado / 2,
                width: MEDIDAS.logo.lado,
                height: MEDIDAS.logo.lado,
                borderRadius: MEDIDAS.logo.radio,
              }}
            >
              <img
                src={opciones.logoUrl}
                alt=""
                crossOrigin="anonymous"
                style={{
                  width: MEDIDAS.logo.lado - MEDIDAS.logo.relleno * 2,
                  height: MEDIDAS.logo.lado - MEDIDAS.logo.relleno * 2,
                  borderRadius: MEDIDAS.logo.radio / 2,
                  objectFit: "cover",
                }}
              />
            </div>
          )}

          {/* El reparto vertical sale de `disposicion`, el mismo que pinta el PNG. */}
          <Renglon renglon={bloque.llamada} />

          {bloque.descripcion.map((r) => (
            <Renglon key={r.y} renglon={r} className="opacity-80" />
          ))}

          {bloque.pie.map((r) => (
            <Renglon key={r.y} renglon={r} className="vm-data opacity-70" />
          ))}

          {opciones.marcaAgua && (
            <p
              className="absolute w-full text-center leading-none opacity-55"
              style={{
                top: MEDIDAS.marca.y - MEDIDAS.marca.tamano * 0.78,
                fontSize: MEDIDAS.marca.tamano,
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              Hecho con Vibemenu
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
