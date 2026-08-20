import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";
import Layout from "@/components/layout/Layout";
import BotonGoogle from "@/components/ui/boton-google";
import { supabase } from "@/lib/supabase";
import { asegurarTenantDelUsuario } from "@/lib/registro";
import { traducirError } from "@/lib/errores";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      const { data, error: errorAuth } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (errorAuth) throw errorAuth;

      // Si se registro con confirmacion de correo pendiente, el tenant todavia
      // no existe. Se crea ahora, desde el borrador guardado en el registro.
      if (data.user) await asegurarTenantDelUsuario(data.user.id);

      await navigate({ to: "/admin" });
    } catch (err) {
      const traducido = traducirError(err as Error);
      // signInWithPassword no devuelve un PostgrestError; su mensaje viene en ingles.
      setError(
        (err as Error).message === "Invalid login credentials"
          ? "Correo o contraseña incorrectos."
          : traducido.mensaje,
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Layout>
      <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
        <h1 className="text-center text-3xl">Entra a tu menú</h1>
        <p className="mt-3 text-center text-sm text-vm-body">
          Administra tu carta, tus sucursales y tu formato.
        </p>

        <form
          onSubmit={alEnviar}
          className="mt-9 space-y-5 rounded-xl border bg-white p-7 shadow-vm-1"
        >
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
            <div className="flex items-baseline justify-between">
              <label htmlFor="password" className="text-sm font-medium text-vm-ink">
                Contraseña
              </label>
              <Link to="/recuperar" className="text-xs text-vm-primary hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
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
            Entrar
          </button>

          <div className="flex items-center gap-3 text-xs text-vm-body">
            <span className="h-px flex-1 bg-border" />
            o
            <span className="h-px flex-1 bg-border" />
          </div>

          <BotonGoogle />
        </form>

        <p className="mt-6 text-center text-sm text-vm-body">
          ¿Aún no tienes menú?{" "}
          <Link to="/registro" className="font-medium text-vm-primary hover:underline">
            Crea el tuyo gratis.
          </Link>
        </p>
      </section>
    </Layout>
  );
}
