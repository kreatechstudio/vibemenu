import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/lib/supabase";
import { asegurarTenantDelUsuario } from "@/lib/registro";
import { traducirError } from "@/lib/errores";
import { trackEvent } from "@/lib/analytics";

type Estado = "verificando" | "listo" | "error";

export default function RestablecerContrasena() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El enlace del correo trae el token de recuperacion en la URL. supabase-js lo
  // procesa solo al cargar y abre una sesion; aqui solo esperamos a que aparezca.
  useEffect(() => {
    let vigente = true;

    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY" && vigente) setEstado("listo");
    });

    supabase.auth.getSession().then(({ data }) => {
      if (vigente && data.session) setEstado("listo");
    });

    const espera = setTimeout(() => {
      setEstado((actual) => (actual === "verificando" ? "error" : actual));
    }, 4000);

    return () => {
      vigente = false;
      sub.subscription.unsubscribe();
      clearTimeout(espera);
    };
  }, []);

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setEnviando(true);
    try {
      const { data, error: errorAuth } = await supabase.auth.updateUser({ password });
      if (errorAuth) throw errorAuth;

      if (data.user) {
        const creado = await asegurarTenantDelUsuario(data.user.id);
        if (creado) trackEvent("sign_up", { method: "email" });
      }
      await navigate({ to: "/admin" });
    } catch (err) {
      setError(traducirError(err as Error).mensaje);
    } finally {
      setEnviando(false);
    }
  }

  if (estado === "verificando") {
    return (
      <Layout>
        <section className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
          <Loader2 className="size-6 animate-spin text-vm-primary" aria-hidden />
          <p className="mt-4 text-sm text-vm-body">Verificando tu enlace…</p>
        </section>
      </Layout>
    );
  }

  if (estado === "error") {
    return (
      <Layout>
        <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
          <div className="rounded-xl border bg-white p-8 text-center shadow-vm-1">
            <AlertCircle className="mx-auto size-10 text-vm-danger" aria-hidden />
            <h1 className="mt-5 text-2xl">Enlace inválido o vencido</h1>
            <p className="mt-3 text-sm leading-relaxed text-vm-body">
              Pide un nuevo enlace para crear tu contraseña.
            </p>
            <Link
              to="/recuperar"
              className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-lg bg-vm-primary text-sm font-medium text-white hover:bg-vm-primary-hover"
            >
              Pedir un nuevo enlace
            </Link>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
        <h1 className="text-center text-3xl">Crea tu nueva contraseña</h1>

        <form
          onSubmit={alEnviar}
          className="mt-9 space-y-5 rounded-xl border bg-white p-7 shadow-vm-1"
        >
          <div>
            <label htmlFor="password" className="text-sm font-medium text-vm-ink">
              Nueva contraseña
            </label>
            <div className="relative mt-2">
              <input
                id="password"
                type={mostrarPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-lg border px-4 pr-12 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
              />
              <button
                type="button"
                onClick={() => setMostrarPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-vm-body hover:text-vm-ink"
                aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {mostrarPassword ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmar" className="text-sm font-medium text-vm-ink">
              Confirma tu contraseña
            </label>
            <div className="relative mt-2">
              <input
                id="confirmar"
                type={mostrarConfirmar ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                className="h-12 w-full rounded-lg border px-4 pr-12 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
              />
              <button
                type="button"
                onClick={() => setMostrarConfirmar((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-vm-body hover:text-vm-ink"
                aria-label={mostrarConfirmar ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {mostrarConfirmar ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
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
            disabled={enviando}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover disabled:opacity-50"
          >
            {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Guardar contraseña
          </button>
        </form>
      </section>
    </Layout>
  );
}
