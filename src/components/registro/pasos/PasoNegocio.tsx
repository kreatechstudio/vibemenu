import { useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useSlugDisponible, type EstadoSlug } from "@/hooks/useSlugDisponible";
import { crearTenant } from "@/lib/registro";
import { traducirError } from "@/lib/errores";
import { MENSAJE_ERROR_SLUG, normalizarSlug } from "@/lib/slug";
import { EMPRESA } from "@/lib/legal";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const GIROS = ["Restaurante", "Cafetería", "Bar", "Food truck", "Panadería"];

function AvisoSlug({ estado }: { estado: EstadoSlug }) {
  switch (estado.estado) {
    case "verificando":
      return (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-vm-body">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Verificando disponibilidad…
        </p>
      );
    case "disponible":
      return (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-vm-success">
          <Check className="size-3.5" aria-hidden />
          Disponible
        </p>
      );
    case "ocupado":
    case "reservado":
      return (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-vm-danger">
          <AlertCircle className="size-3.5" aria-hidden />
          Ese nombre ya está en uso — prueba con otra variante.
        </p>
      );
    case "invalido":
      return (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-vm-danger">
          <AlertCircle className="size-3.5" aria-hidden />
          {MENSAJE_ERROR_SLUG[estado.motivo]}
        </p>
      );
    default:
      return null;
  }
}

type PasoNegocioProps = {
  onCreado: (tenant: { id: string; nombreNegocio: string }) => void;
  onAtras: () => void;
};

export default function PasoNegocio({ onCreado, onAtras }: PasoNegocioProps) {
  const [nombre, setNombre] = useState("");
  const [giro, setGiro] = useState<string | null>(null);
  const [giroOtro, setGiroOtro] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estadoSlug = useSlugDisponible(slug);
  const giroFinal = giro === "Otro" ? giroOtro.trim() : giro;
  const puedeEnviar = nombre.trim().length > 1 && estadoSlug.estado === "disponible" && !enviando;

  function alCambiarNombre(valor: string) {
    setNombre(valor);
    if (!slugTocado) setSlug(normalizarSlug(valor));
  }

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      const tenant = await crearTenant({
        nombre_negocio: nombre.trim(),
        slug: slug.trim(),
        giro: giroFinal?.trim() || null,
      });
      trackEvent("sign_up", { method: "email" });
      onCreado({ id: tenant.id, nombreNegocio: nombre.trim() });
    } catch (err) {
      setError(traducirError(err as Error).mensaje);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl text-vm-ink">¿Cómo se llama tu negocio?</h1>
      <p className="mt-2 text-sm text-vm-body">
        Así es como lo van a ver tus clientes en tu menú.
      </p>

      <form onSubmit={alEnviar} className="mt-6 space-y-5">
        <div>
          <label htmlFor="nombre" className="text-sm font-medium text-vm-ink">
            Nombre del negocio
          </label>
          <input
            id="nombre"
            required
            value={nombre}
            onChange={(e) => alCambiarNombre(e.target.value)}
            placeholder="Café Aurora"
            className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
          />
        </div>

        <div>
          <span className="text-sm font-medium text-vm-ink">
            Giro <span className="font-normal text-vm-body">(opcional)</span>
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...GIROS, "Otro"].map((opcion) => (
              <button
                key={opcion}
                type="button"
                onClick={() => setGiro(opcion === giro ? null : opcion)}
                className={cn(
                  "h-10 rounded-lg border px-4 text-sm transition-colors",
                  giro === opcion
                    ? "border-vm-primary bg-vm-primary text-white"
                    : "text-vm-ink hover:border-vm-primary",
                )}
              >
                {opcion}
              </button>
            ))}
          </div>
          {giro === "Otro" && (
            <input
              value={giroOtro}
              onChange={(e) => setGiroOtro(e.target.value)}
              placeholder="Cuéntanos cuál"
              className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
          )}
        </div>

        <div>
          <label htmlFor="slug" className="text-sm font-medium text-vm-ink">
            La dirección de tu menú
          </label>
          <div
            className={cn(
              "mt-2 flex h-12 items-center overflow-hidden rounded-lg border bg-white focus-within:ring-2 focus-within:ring-vm-primary/20",
              estadoSlug.estado === "disponible" && "border-vm-success",
              (estadoSlug.estado === "ocupado" ||
                estadoSlug.estado === "reservado" ||
                estadoSlug.estado === "invalido") &&
                "border-vm-danger",
            )}
          >
            <span className="select-none self-stretch border-r bg-vm-bg-soft px-3.5 py-3.5 text-sm text-vm-body">
              {EMPRESA.dominio}/
            </span>
            <input
              id="slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugTocado(true);
                setSlug(normalizarSlug(e.target.value));
              }}
              placeholder="cafe-aurora"
              className="h-full flex-1 px-3 text-sm outline-none"
              aria-describedby="slug-aviso"
            />
          </div>
          <div id="slug-aviso" aria-live="polite">
            <AvisoSlug estado={estadoSlug} />
          </div>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 rounded-lg bg-vm-danger-soft px-3.5 py-2.5 text-sm text-vm-danger">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onAtras}
            className="inline-flex h-12 items-center justify-center rounded-lg border px-6 text-sm font-medium text-vm-ink hover:bg-vm-bg-soft"
          >
            Atrás
          </button>
          <button
            type="submit"
            disabled={!puedeEnviar}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Continuar
          </button>
        </div>
      </form>
    </div>
  );
}
