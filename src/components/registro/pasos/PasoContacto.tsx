import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useActualizarTenant } from "@/hooks/useActualizarTenant";
import { combinarTelefono, LADA_DEFAULT, PAISES_LADA } from "@/lib/paises";
import { traducirError } from "@/lib/errores";

type PasoContactoProps = {
  tenantId: string;
  onContinuar: () => void;
};

export default function PasoContacto({ tenantId, onContinuar }: PasoContactoProps) {
  const actualizar = useActualizarTenant(tenantId);
  const [ladaTelefono, setLadaTelefono] = useState(LADA_DEFAULT);
  const [telefono, setTelefono] = useState("");
  const [ladaWhatsapp, setLadaWhatsapp] = useState(LADA_DEFAULT);
  const [whatsapp, setWhatsapp] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puedeEnviar = telefono.trim().length > 0 && whatsapp.trim().length > 0 && !enviando;

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      await actualizar.mutateAsync({
        telefono: combinarTelefono(ladaTelefono, telefono),
        whatsapp: combinarTelefono(ladaWhatsapp, whatsapp),
      });
      onContinuar();
    } catch (err) {
      setError(traducirError(err as Error).mensaje);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl text-vm-ink">¿Cómo te contactan tus clientes?</h1>
      <p className="mt-2 text-sm text-vm-body">
        Lo usamos para que puedan escribirte y pedir directo por WhatsApp.
      </p>

      <form onSubmit={alEnviar} className="mt-6 space-y-5">
        <div>
          <label htmlFor="telefono" className="text-sm font-medium text-vm-ink">
            Teléfono
          </label>
          <div className="mt-2 flex gap-2">
            <select
              aria-label="Lada de teléfono"
              value={ladaTelefono}
              onChange={(e) => setLadaTelefono(e.target.value)}
              className="h-12 rounded-lg border bg-white px-2 text-sm text-vm-ink outline-none focus:border-vm-primary"
            >
              {PAISES_LADA.map((p) => (
                <option key={p.pais} value={p.lada}>
                  {p.pais} ({p.lada})
                </option>
              ))}
            </select>
            <input
              id="telefono"
              type="tel"
              required
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="55 1234 5678"
              className="h-12 flex-1 rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
          </div>
        </div>

        <div>
          <label htmlFor="whatsapp" className="text-sm font-medium text-vm-ink">
            WhatsApp para pedidos
          </label>
          <div className="mt-2 flex gap-2">
            <select
              aria-label="Lada de WhatsApp"
              value={ladaWhatsapp}
              onChange={(e) => setLadaWhatsapp(e.target.value)}
              className="h-12 rounded-lg border bg-white px-2 text-sm text-vm-ink outline-none focus:border-vm-primary"
            >
              {PAISES_LADA.map((p) => (
                <option key={p.pais} value={p.lada}>
                  {p.pais} ({p.lada})
                </option>
              ))}
            </select>
            <input
              id="whatsapp"
              type="tel"
              required
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="55 1234 5678"
              className="h-12 flex-1 rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
          </div>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 rounded-lg bg-vm-danger-soft px-3.5 py-2.5 text-sm text-vm-danger">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!puedeEnviar}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Continuar
        </button>
      </form>
    </div>
  );
}
