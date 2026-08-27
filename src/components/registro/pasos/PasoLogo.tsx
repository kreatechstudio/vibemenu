import { useState } from "react";
import { Check, ImagePlus, Loader2 } from "lucide-react";
import { useActualizarTenant } from "@/hooks/useActualizarTenant";
import { subirImagen } from "@/hooks/useCarta";
import { ESTADOS } from "@/lib/copy";

type PasoLogoProps = {
  tenantId: string;
  onContinuar: () => void;
};

export default function PasoLogo({ tenantId, onContinuar }: PasoLogoProps) {
  const actualizar = useActualizarTenant(tenantId);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function alSubir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError(null);
    setSubiendo(true);
    try {
      const url = await subirImagen(tenantId, archivo, "logos");
      await actualizar.mutateAsync({ logo_url: url });
      setLogoUrl(url);
    } catch {
      setError(ESTADOS.errorImagen);
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl text-vm-ink">Dale cara a tu negocio</h1>
      <p className="mt-2 text-sm text-vm-body">
        Un logo ayuda a que tu menú se vea profesional. Puedes agregarlo después si no lo tienes a
        la mano.
      </p>

      <label
        htmlFor="logo"
        className="mt-6 flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed bg-vm-bg-soft px-6 py-10 text-center hover:border-vm-primary"
      >
        {logoUrl ? (
          <img src={logoUrl} alt="Logo del negocio" className="size-16 rounded-lg object-cover" />
        ) : subiendo ? (
          <Loader2 className="size-8 animate-spin text-vm-primary" aria-hidden />
        ) : (
          <ImagePlus className="size-8 text-vm-primary" aria-hidden />
        )}
        <span className="text-sm font-medium text-vm-ink">
          {logoUrl ? "Logo subido" : "Arrastra tu logo o haz clic para subir"}
        </span>
        <span className="text-xs text-vm-body">PNG o JPG, máx 2MB</span>
        <input
          id="logo"
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => void alSubir(e)}
          disabled={subiendo}
          className="hidden"
        />
      </label>

      {error && <p className="mt-3 text-sm text-vm-danger">{error}</p>}

      <div className="mt-6 flex items-center justify-end gap-5">
        {!logoUrl && (
          <button
            type="button"
            onClick={onContinuar}
            className="text-sm font-medium text-vm-body underline hover:text-vm-primary"
          >
            Lo hago después
          </button>
        )}
        <button
          type="button"
          onClick={onContinuar}
          disabled={subiendo}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-vm-primary px-6 text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {logoUrl && <Check className="size-4" aria-hidden />}
          Continuar
        </button>
      </div>
    </div>
  );
}
