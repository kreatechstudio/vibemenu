import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Check, Loader2, MailCheck } from "lucide-react";
import Layout from "@/components/layout/Layout";
import MockupFormato from "@/components/landing/MockupFormato";
import BotonGoogle from "@/components/ui/boton-google";
import { useSlugDisponible, type EstadoSlug } from "@/hooks/useSlugDisponible";
import { supabase } from "@/lib/supabase";
import { crearTenant, guardarTenantPendiente } from "@/lib/registro";
import { traducirError } from "@/lib/errores";
import { MENSAJE_ERROR_SLUG, normalizarSlug } from "@/lib/slug";
import { BOTONES, ESTADOS } from "@/lib/copy";
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
          {ESTADOS.slugNoDisponible}
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

export default function Registro() {
  const navigate = useNavigate();

  const [negocio, setNegocio] = useState("");
  const [giro, setGiro] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [confirmaCorreo, setConfirmaCorreo] = useState(false);

  const estadoSlug = useSlugDisponible(slug);
  const puedeEnviar =
    negocio.trim().length > 1 &&
    email.includes("@") &&
    password.length >= 6 &&
    estadoSlug.estado === "disponible" &&
    !enviando;

  // El slug sigue al nombre del negocio hasta que el usuario lo edita a mano.
  function alCambiarNegocio(valor: string) {
    setNegocio(valor);
    if (!slugTocado) setSlug(normalizarSlug(valor));
  }

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setErrorGlobal(null);
    setEnviando(true);

    const borrador = {
      nombre_negocio: negocio.trim(),
      slug: slug.trim(),
      giro: giro.trim() || null,
    };

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      // Con confirmacion de correo activada, signUp no devuelve sesion y el insert
      // del tenant fallaria contra la policy. Se guarda y se crea en el primer login.
      if (!data.session) {
        guardarTenantPendiente(borrador);
        setConfirmaCorreo(true);
        return;
      }

      await crearTenant(borrador);
      await navigate({ to: "/admin" });
    } catch (err) {
      setErrorGlobal(traducirError(err as Error).mensaje);
    } finally {
      setEnviando(false);
    }
  }

  if (confirmaCorreo) {
    return (
      <Layout>
        <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
          <div className="rounded-xl border bg-white p-8 text-center shadow-vm-1">
            <MailCheck className="mx-auto size-10 text-vm-primary" aria-hidden />
            <h1 className="mt-5 text-2xl">Confirma tu correo</h1>
            <p className="mt-3 text-sm leading-relaxed text-vm-body">
              Te enviamos un enlace a <span className="font-medium text-vm-ink">{email}</span>.
              Ábrelo y entra: tu menú <span className="font-medium text-vm-ink">{slug}</span> queda
              apartado.
            </p>
            <Link
              to="/login"
              className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-lg border text-sm font-medium text-vm-ink hover:bg-vm-bg-soft"
            >
              Ir a entrar
            </Link>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="mx-auto grid max-w-6xl gap-14 px-4 py-16 md:px-10 md:py-24 lg:grid-cols-[1fr_420px] lg:items-center">
        <div className="order-2 lg:order-1">
          <h1 className="text-3xl text-balance md:text-4xl">Crea tu menú en dos minutos.</h1>
          <p className="mt-4 text-lg text-pretty text-vm-body">
            Sin tarjeta de crédito. Gratis para siempre, hasta 20 productos.
          </p>

          <form onSubmit={alEnviar} className="mt-9 space-y-5">
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
                  vibemenu.com/
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

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="text-sm font-medium text-vm-ink">
                  Correo
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
                />
              </div>
              <div>
                <label htmlFor="password" className="text-sm font-medium text-vm-ink">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
                />
              </div>
            </div>

            {errorGlobal && (
              <p className="flex items-center gap-1.5 rounded-lg bg-vm-danger-soft px-3.5 py-2.5 text-sm text-vm-danger">
                <AlertCircle className="size-4 shrink-0" aria-hidden />
                {errorGlobal}
              </p>
            )}

            <p className="text-xs leading-relaxed text-vm-body">
              Al crear tu cuenta aceptas el{" "}
              <Link to="/privacidad" className="text-vm-primary hover:underline">
                Aviso de Privacidad
              </Link>{" "}
              de Vibemenu.
            </p>

            <button
              type="submit"
              disabled={!puedeEnviar}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {BOTONES.registro}
            </button>

            <div className="flex items-center gap-3 text-xs text-vm-body">
              <span className="h-px flex-1 bg-border" />
              o
              <span className="h-px flex-1 bg-border" />
            </div>

            <BotonGoogle />

            <p className="text-center text-sm text-vm-body">
              ¿Ya tienes menú?{" "}
              <Link to="/login" className="font-medium text-vm-primary hover:underline">
                Entra aquí
              </Link>
            </p>
          </form>
        </div>

        <aside className="order-1 lg:order-2">
          <div className="rounded-xl border bg-vm-bg-soft p-6 shadow-vm-1">
            <p className="text-sm font-medium text-vm-ink">Así se verá tu carta</p>
            <div className="mt-4">
              <MockupFormato formato="pinterest" />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-vm-body">
              Podrás cambiar entre los 4 formatos cuando quieras, sin volver a capturar tus
              productos.
            </p>
          </div>
        </aside>
      </section>
    </Layout>
  );
}
