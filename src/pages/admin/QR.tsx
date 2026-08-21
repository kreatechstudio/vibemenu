import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy, Download, Loader2, Lock } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import TarjetaQR from "@/components/admin/TarjetaQR";
import { useTenantActual } from "@/hooks/useTenantActual";
import { useSucursales } from "@/hooks/useSucursales";
import { permiteQrAvanzado, permiteQrColor } from "@/lib/plan";
import { resolverTema } from "@/lib/tema";
import { FUENTES } from "@/lib/fuentes";
import {
  colorLegibleParaQr,
  descargar,
  pintarTarjeta,
  svgSerializado,
  type OpcionesTarjeta,
} from "@/lib/qr";
import { BOTONES } from "@/lib/copy";
import { EMPRESA } from "@/lib/legal";
import type { FormatoMenu } from "@/types/database";
import { cn } from "@/lib/utils";

export default function QR() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

const NEGRO = "#0B0B0F";
const FUENTE_NEUTRA = "Inter, system-ui, sans-serif";

/** Una fila con casilla. Si el plan no la incluye, se ve el candado y no se toca. */
function Opcion({
  titulo,
  nota,
  motivo,
  activa,
  bloqueada,
  alCambiar,
}: {
  titulo: string;
  nota: string;
  /** Qué decir cuando está bloqueada: el plan que la incluye, o lo que falta. */
  motivo: string;
  activa: boolean;
  bloqueada: boolean;
  alCambiar: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3.5 transition-colors",
        bloqueada ? "cursor-not-allowed bg-vm-bg-soft" : "cursor-pointer hover:bg-vm-bg-soft",
      )}
    >
      <input
        type="checkbox"
        checked={activa}
        disabled={bloqueada}
        onChange={(e) => alCambiar(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-vm-primary"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium text-vm-ink">
          {titulo}
          {bloqueada && <Lock className="size-3 text-vm-body" aria-hidden />}
        </span>
        <span className="mt-0.5 block text-xs text-vm-body">{bloqueada ? motivo : nota}</span>
      </span>
    </label>
  );
}

function Contenido() {
  const { data: ctx } = useTenantActual();
  const { data: sucursales } = useSucursales(ctx?.tenant.id);

  const refQr = useRef<HTMLDivElement>(null);
  const [copiado, setCopiado] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** null = el menú general del negocio. Si no, el id de una sucursal. */
  const [sucursalId, setSucursalId] = useState<string | null>(null);

  const [usarColores, setUsarColores] = useState(true);
  const [usarFuente, setUsarFuente] = useState(true);
  const [usarLogo, setUsarLogo] = useState(true);
  const [usarFondo, setUsarFondo] = useState(false);
  const [usarDescripcion, setUsarDescripcion] = useState(false);

  if (!ctx) return null;

  const { tenant, plan } = ctx;
  const conColor = permiteQrColor(plan);
  const conAvanzado = permiteQrAvanzado(plan);

  const tema = resolverTema(tenant.tema, tenant.formato_activo as FormatoMenu);
  const sucursal = sucursales?.find((s) => s.id === sucursalId) ?? null;

  // Cada sucursal tiene su propio QR: apunta a su ruta, con su carta y su horario.
  const ruta = sucursal ? `/${tenant.slug}/sucursal/${sucursal.slug}` : `/${tenant.slug}`;
  const origen = typeof window === "undefined" ? "" : window.location.origin;
  const url = `${origen}${ruta}`;
  const visible = `${EMPRESA.dominio}${ruta}`;
  const archivo = sucursal ? `vibemenu-${tenant.slug}-${sucursal.slug}` : `vibemenu-${tenant.slug}`;

  const hayLogo = Boolean(tenant.logo_url);
  const hayFondo = Boolean(tema.imagen_fondo_url);
  const hayDescripcion = Boolean(tenant.descripcion);

  const color = conColor && usarColores;
  const logo = conAvanzado && usarLogo && hayLogo ? tenant.logo_url : null;
  const fondo = conAvanzado && usarFondo && hayFondo ? tema.imagen_fondo_url : null;

  // Si el color de marca no contrasta con el panel blanco, el código se pinta negro.
  const { color: colorQr, degradado } = color
    ? colorLegibleParaQr(tema.color_primario)
    : { color: NEGRO, degradado: false };

  const opciones: OpcionesTarjeta = {
    url,
    titulo: tenant.nombre_negocio,
    sucursal: sucursal?.nombre ?? null,
    descripcion: usarDescripcion && hayDescripcion ? tenant.descripcion : null,
    pie: visible,
    fuenteCss: conAvanzado && usarFuente ? FUENTES[tema.fuente].css : FUENTE_NEUTRA,
    colorFondo: color ? tema.color_fondo : "#FFFFFF",
    colorTexto: color ? tema.color_texto : NEGRO,
    colorQr,
    imagenFondoUrl: fondo,
    logoUrl: logo,
    marcaAgua: plan.marca_agua,
  };

  async function descargarPNG() {
    if (!refQr.current) return;
    const svg = svgSerializado(refQr.current);
    if (!svg) return;

    setError(null);
    setGenerando(true);
    try {
      const canvas = await pintarTarjeta(opciones, svg);
      if (!canvas) throw new Error("sin_canvas");
      descargar(`${archivo}.png`, canvas.toDataURL("image/png"));
    } catch {
      setError("No pudimos generar la imagen. Vuelve a intentar en un momento.");
    } finally {
      setGenerando(false);
    }
  }

  /** Solo el código, sin tarjeta: es lo que un diseñador quiere para maquetar. */
  function descargarSVG() {
    if (!refQr.current) return;
    const texto = svgSerializado(refQr.current);
    if (!texto) return;
    const blob = new Blob([texto], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    descargar(`${archivo}.svg`, objectUrl);
    URL.revokeObjectURL(objectUrl);
  }

  async function copiar() {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <>
      <h1 className="text-2xl">Tu código QR</h1>
      <p className="mt-1 max-w-prose text-sm text-vm-body">
        Imprímelo y ponlo en tus mesas. Si cambias tu menú, el QR sigue funcionando: apunta siempre
        a tu carta más reciente.
      </p>

      {/* Un QR por sucursal: cada uno lleva a su carta y a su horario. */}
      {sucursales && sucursales.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium text-vm-ink">¿Para qué mesa?</p>
          <div className="tira-scroll mt-2.5 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSucursalId(null)}
              aria-pressed={sucursalId === null}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                sucursalId === null
                  ? "border-vm-primary bg-vm-primary text-white"
                  : "text-vm-body hover:bg-vm-bg-soft",
              )}
            >
              Menú general
            </button>
            {sucursales.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSucursalId(s.id)}
                aria-pressed={sucursalId === s.id}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                  sucursalId === s.id
                    ? "border-vm-primary bg-vm-primary text-white"
                    : "text-vm-body hover:bg-vm-bg-soft",
                )}
              >
                {s.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div>
          <TarjetaQR opciones={opciones} refQr={refQr} />

          <div className="mt-4 flex items-center gap-2 rounded-lg border bg-vm-bg-soft px-3.5 py-3">
            <span className="vm-data flex-1 truncate text-sm text-vm-ink">{visible}</span>
            <button
              type="button"
              onClick={() => void copiar()}
              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-vm-primary"
            >
              {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copiado ? "Copiado" : BOTONES.copiarLink}
            </button>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={generando}
              onClick={() => void descargarPNG()}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white hover:bg-vm-primary-hover disabled:opacity-50"
            >
              {generando ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Download className="size-4" aria-hidden />
              )}
              Tarjeta PNG
            </button>
            <button
              type="button"
              onClick={descargarSVG}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border text-sm font-medium text-vm-ink hover:bg-vm-bg-soft"
            >
              <Download className="size-4" aria-hidden />
              Código SVG
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-vm-body">
            La tarjeta completa, lista para imprimir. El SVG trae solo el código, por si tu
            diseñador lo va a maquetar.
          </p>

          {error && (
            <p className="mt-3 rounded-lg bg-vm-danger-soft px-3.5 py-2.5 text-sm text-vm-danger">
              {error}
            </p>
          )}
        </div>

        <aside>
          <h2 className="text-sm font-medium text-vm-ink">Personaliza tu tarjeta</h2>
          <p className="mt-1 text-xs text-vm-body">
            Toma lo que ya elegiste en{" "}
            <Link to="/admin/diseno" className="text-vm-primary hover:underline">
              Diseño
            </Link>
            . Si cambias el tema de tu menú, la tarjeta cambia contigo.
          </p>

          <div className="mt-4 space-y-2.5">
            <Opcion
              titulo="La descripción de mi negocio"
              nota="Se imprime bajo el código, en dos renglones como mucho."
              motivo="Escribe una descripción en Mi negocio para poder usarla aquí."
              activa={usarDescripcion && hayDescripcion}
              bloqueada={!hayDescripcion}
              alCambiar={setUsarDescripcion}
            />
            <Opcion
              titulo="Mis colores"
              nota="El fondo y el código toman los colores de tu menú."
              motivo="Los colores en el QR son parte de Basic."
              activa={color}
              bloqueada={!conColor}
              alCambiar={setUsarColores}
            />
            <Opcion
              titulo="Mi tipografía"
              nota={`El nombre de tu negocio se imprime en ${FUENTES[tema.fuente].nombre}.`}
              motivo="La tipografía en el QR es parte de Pro."
              activa={conAvanzado && usarFuente}
              bloqueada={!conAvanzado}
              alCambiar={setUsarFuente}
            />
            <Opcion
              titulo="Mi logo dentro del código"
              nota="Va al centro. El código se genera con corrección alta para que siga leyéndose."
              motivo={
                conAvanzado
                  ? "Sube tu logo en Mi negocio para poder usarlo aquí."
                  : "El logo dentro del QR es parte de Pro."
              }
              activa={logo !== null}
              bloqueada={!conAvanzado || !hayLogo}
              alCambiar={setUsarLogo}
            />
            <Opcion
              titulo="Mi imagen de fondo"
              nota="La foto de tu menú, detrás de la tarjeta. El código sigue sobre blanco."
              motivo={
                conAvanzado
                  ? "Sube una imagen de fondo en Diseño para poder usarla aquí."
                  : "La imagen de fondo en el QR es parte de Pro."
              }
              activa={fondo !== null}
              bloqueada={!conAvanzado || !hayFondo}
              alCambiar={setUsarFondo}
            />
          </div>

          {degradado && (
            <p className="mt-4 rounded-lg bg-vm-warning-soft px-3.5 py-3 text-xs text-vm-warning">
              Tu color de acento es demasiado claro para que un celular lea el código, así que este
              se imprime en negro. El resto de la tarjeta sí lleva tus colores.
            </p>
          )}

          {!conColor && (
            <p className="mt-4 rounded-lg border border-dashed px-3.5 py-3 text-xs text-vm-body">
              Tu plan imprime el QR en blanco y negro, con el nombre de tu negocio. Con{" "}
              <Link to="/precios" className="font-medium text-vm-primary hover:underline">
                Basic
              </Link>{" "}
              lleva tus colores; con Pro, además tu tipografía, tu logo y tu foto.
            </p>
          )}

          {plan.marca_agua && (
            <p className="mt-4 text-xs text-vm-body">
              La tarjeta lleva «Hecho con Vibemenu» al pie. Los planes de pago lo quitan.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
