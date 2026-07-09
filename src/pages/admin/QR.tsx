import { useRef, useState } from "react";
import QRCode from "react-qr-code";
import { Check, Copy, Download } from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useTenantActual } from "@/hooks/useTenantActual";
import { useSucursales } from "@/hooks/useSucursales";
import { BOTONES } from "@/lib/copy";
import { cn } from "@/lib/utils";

export default function QR() {
  return (
    <AdminLayout>
      <Contenido />
    </AdminLayout>
  );
}

/** Serializa el <svg> que ya esta en el DOM. No hace falta regenerar el QR. */
function svgSerializado(contenedor: HTMLElement): string | null {
  const svg = contenedor.querySelector("svg");
  if (!svg) return null;
  const clon = svg.cloneNode(true) as SVGElement;
  clon.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clon);
}

function descargar(nombre: string, url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
}

function Contenido() {
  const { data: ctx } = useTenantActual();
  const { data: sucursales } = useSucursales(ctx?.tenant.id);
  const contenedor = useRef<HTMLDivElement>(null);
  const [copiado, setCopiado] = useState(false);
  /** null = el menú general del negocio. Si no, el id de una sucursal. */
  const [sucursalId, setSucursalId] = useState<string | null>(null);

  if (!ctx) return null;

  const slug = ctx.tenant.slug;
  const sucursal = sucursales?.find((s) => s.id === sucursalId) ?? null;

  // Cada sucursal tiene su propio QR: apunta a su ruta, con su carta y su horario.
  const ruta = sucursal ? `/${slug}/sucursal/${sucursal.slug}` : `/${slug}`;
  const url = `${window.location.origin}${ruta}`;
  const visible = `vibemenu.com${ruta}`;
  const archivo = sucursal ? `vibemenu-${slug}-${sucursal.slug}` : `vibemenu-${slug}`;
  const titulo = sucursal
    ? `${ctx.tenant.nombre_negocio} · ${sucursal.nombre}`
    : ctx.tenant.nombre_negocio;

  function descargarSVG() {
    if (!contenedor.current) return;
    const texto = svgSerializado(contenedor.current);
    if (!texto) return;
    const blob = new Blob([texto], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    descargar(`${archivo}.svg`, objectUrl);
    URL.revokeObjectURL(objectUrl);
  }

  /** El PNG se rasteriza dibujando el SVG en un canvas a 1024px, listo para imprimir. */
  function descargarPNG() {
    if (!contenedor.current) return;
    const texto = svgSerializado(contenedor.current);
    if (!texto) return;

    const lado = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = lado;
    canvas.height = lado;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const img = new Image();
    img.onload = () => {
      ctx2d.fillStyle = "#FFFFFF";
      ctx2d.fillRect(0, 0, lado, lado);
      ctx2d.drawImage(img, 0, 0, lado, lado);
      descargar(`${archivo}.png`, canvas.toDataURL("image/png"));
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(texto)))}`;
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
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSucursalId(null)}
              aria-pressed={sucursalId === null}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
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
                  "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
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
          <div
            ref={contenedor}
            className="grid place-items-center rounded-xl border bg-white p-8"
            aria-label={`Código QR de ${visible}`}
          >
            <QRCode value={url} size={256} level="M" bgColor="#FFFFFF" fgColor="#0B0B0F" />
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-lg border bg-vm-bg-soft px-3.5 py-3">
            <span className="vm-data flex-1 truncate text-sm text-vm-ink">{visible}</span>
            <button
              type="button"
              onClick={() => void copiar()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-vm-primary"
            >
              {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copiado ? "Copiado" : BOTONES.copiarLink}
            </button>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={descargarPNG}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white hover:bg-vm-primary-hover"
            >
              <Download className="size-4" aria-hidden />
              PNG
            </button>
            <button
              type="button"
              onClick={descargarSVG}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border text-sm font-medium text-vm-ink hover:bg-vm-bg-soft"
            >
              <Download className="size-4" aria-hidden />
              SVG
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-vm-body">
            PNG para imprimir. SVG si tu diseñador lo va a escalar.
          </p>
        </div>

        {/* Cómo se ve impreso, en un tent de mesa */}
        <aside className="hidden lg:block">
          <p className="text-sm font-medium text-vm-ink">Así se ve en tu mesa</p>
          <div className="mt-3 mx-auto w-64 rounded-t-xl border bg-white p-5 text-center shadow-vm-2">
            <p className="font-display text-base font-bold text-vm-ink">{titulo}</p>
            <p className="mt-1 text-[11px] text-vm-body">Escanea para ver la carta</p>
            <div className="mx-auto mt-4 w-fit rounded-lg border p-3">
              <QRCode value={url} size={120} level="M" bgColor="#FFFFFF" fgColor="#0B0B0F" />
            </div>
            <p className="vm-data mt-3 text-[10px] text-vm-body">{visible}</p>
          </div>
          <div className="mx-auto h-3 w-72 rounded-b-lg bg-vm-bg-soft" aria-hidden />
        </aside>
      </div>
    </>
  );
}
