import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export default function EscanerCodigo({
  onCodigo,
  onCerrar,
}: {
  onCodigo: (texto: string) => void;
  onCerrar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let vivo = true;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!vivo || !ref.current) return;
        const inst = new Html5Qrcode(ref.current.id);
        scanner = inst as unknown as { stop: () => Promise<void>; clear: () => void };
        await inst.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          (texto: string) => {
            onCodigo(texto);
            void inst.stop().then(() => inst.clear());
          },
          () => {},
        );
      } catch {
        if (vivo) setError("No pudimos abrir la cámara. Teclea el código.");
      }
    })();
    return () => {
      vivo = false;
      scanner
        ?.stop()
        .then(() => scanner?.clear())
        .catch(() => {});
    };
  }, [onCodigo]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-vm-ink">Escanear código</h3>
          <button type="button" onClick={onCerrar} aria-label="Cerrar">
            <X className="size-5 text-vm-body" />
          </button>
        </div>
        <div id="escaner-lealtad" ref={ref} className="mt-3 overflow-hidden rounded-xl" />
        {error && <p className="mt-2 text-xs text-vm-danger">{error}</p>}
      </div>
    </div>
  );
}
