import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, X } from "lucide-react";

/** Recorta sobre un canvas del tamaño exacto del área elegida. Siempre PNG: es un paso intermedio, `comprimir` lo vuelve a codificar a WebP al subir. */
async function imagenRecortada(urlOrigen: string, area: Area): Promise<Blob> {
  const img = new Image();
  await new Promise<void>((resolver, rechazar) => {
    img.onload = () => resolver();
    img.onerror = () => rechazar(new Error("no_pudimos_leer_la_imagen"));
    img.src = urlOrigen;
  });

  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sin_canvas");
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);

  return new Promise((resolver, rechazar) => {
    canvas.toBlob((b) => (b ? resolver(b) : rechazar(new Error("sin_blob"))), "image/png", 1);
  });
}

/**
 * Modal de recorte antes de subir una foto de perfil/logo. Sin esto, una foto
 * no cuadrada se recorta al centro vía CSS (`object-cover`) y, si el sujeto no
 * está centrado, sale cortado — el dueño nunca elige qué parte se ve.
 *
 * `react-easy-crop` solo calcula el área elegida; el recorte real (canvas) es
 * nuestro, para poder devolver un `File` normal que siga el mismo camino de
 * siempre (`subirImagen` → `comprimir` a WebP).
 */
export default function RecortarImagen({
  archivo,
  redondo = true,
  alConfirmar,
  alCancelar,
}: {
  archivo: File;
  /** true = vista previa circular (logo); false = cuadrada. */
  redondo?: boolean;
  alConfirmar: (archivoRecortado: File) => void;
  alCancelar: () => void;
}) {
  const [url] = useState(() => URL.createObjectURL(archivo));
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [procesando, setProcesando] = useState(false);

  const onCropComplete = useCallback((_: Area, areaPx: Area) => setArea(areaPx), []);

  function cerrar() {
    URL.revokeObjectURL(url);
    alCancelar();
  }

  async function confirmar() {
    if (!area) return;
    setProcesando(true);
    try {
      const blob = await imagenRecortada(url, area);
      const nombre = `${archivo.name.replace(/\.[^.]+$/, "")}.png`;
      alConfirmar(new File([blob], nombre, { type: "image/png" }));
    } finally {
      setProcesando(false);
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-vm-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-vm-ink">Ajusta tu foto</h2>
          <button type="button" onClick={cerrar} aria-label="Cancelar">
            <X className="size-5 text-vm-body" />
          </button>
        </div>

        <div className="relative mt-4 h-72 w-full overflow-hidden rounded-xl bg-vm-bg-soft">
          <Cropper
            image={url}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape={redondo ? "round" : "rect"}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <label className="mt-4 block text-xs font-medium text-vm-body">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="mt-1.5 w-full accent-vm-primary"
          />
        </label>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={cerrar}
            className="text-sm font-medium text-vm-body hover:text-vm-ink"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void confirmar()}
            disabled={procesando || !area}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-vm-primary px-5 text-sm font-medium text-white disabled:opacity-50"
          >
            {procesando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Usar esta foto
          </button>
        </div>
      </div>
    </div>
  );
}
