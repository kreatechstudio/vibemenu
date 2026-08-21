import { useState } from "react";
import { Navigate, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useSesion } from "@/hooks/useSesion";
import { useTenantActual } from "@/hooks/useTenantActual";
import { useSlugDisponible, type EstadoSlug } from "@/hooks/useSlugDisponible";
import { crearTenant } from "@/lib/registro";
import { traducirError } from "@/lib/errores";
import { MENSAJE_ERROR_SLUG, normalizarSlug } from "@/lib/slug";
import { EMPRESA } from "@/lib/legal";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

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

/**
 * Solo para sesiones sin tenant: quien llega por Google no pasa por Registro.tsx
 * (ahi se piden negocio + slug + email + password en un solo submit, imposible
 * con un redirect a Google de por medio). Aqui solo se piden los datos del
 * negocio, porque la sesion ya existe.
 */
export default function Onboarding() {
  const navigate = useNavigate();
  const { user, cargando: cargandoSesion } = useSesion();
  const { data: ctx, isLoading: cargandoTenant } = useTenantActual();

  const [negocio, setNegocio] = useState("");
  const [giro, setGiro] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estadoSlug = useSlugDisponible(slug);
  const puedeEnviar = negocio.trim().length > 1 && estadoSlug.estado === "disponible" && !enviando;

  if (!cargandoSesion && !user) return <Navigate to="/login" />;
  if (!cargandoTenant && ctx) return <Navigate to="/admin" />;

  function alCambiarNegocio(valor: string) {
    setNegocio(valor);
    if (!slugTocado) setSlug(normalizarSlug(valor));
  }

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      await crearTenant({
        nombre_negocio: negocio.trim(),
        slug: slug.trim(),
        giro: giro.trim() || null,
      });
      trackEvent("sign_up", { method: "google" });
      await navigate({ to: "/admin" });
    } catch (err) {
      setError(traducirError(err as Error).mensaje);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Layout>
      <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
        <h1 className="text-center text-3xl">Cuéntanos de tu negocio</h1>
        <p className="mt-3 text-center text-sm text-vm-body">
          Un último paso y tu menú está listo.
        </p>

        <form
          onSubmit={alEnviar}
          className="mt-9 space-y-5 rounded-xl border bg-white p-7 shadow-vm-1"
        >
          <div>
            <label htmlFor="negocio" className="text-sm font-medium text-vm-ink">
              Nombre del negocio
            </label>
            <input
              id="negocio"
              required
              value={negocio}
              onChange={(e) => alCambiarNegocio(e.target.value)}
              placeholder="Café Aurora"
              className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
          </div>

          <div>
            <label htmlFor="giro" className="text-sm font-medium text-vm-ink">
              Giro <span className="font-normal text-vm-body">(opcional)</span>
            </label>
            <input
              id="giro"
              value={giro}
              onChange={(e) => setGiro(e.target.value)}
              placeholder="Cafetería"
              className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
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

          <button
            type="submit"
            disabled={!puedeEnviar}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Crear mi menú
          </button>
        </form>
      </section>
    </Layout>
  );
}
