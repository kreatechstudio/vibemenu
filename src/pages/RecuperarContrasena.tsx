import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/lib/supabase";
import { traducirError } from "@/lib/errores";

export default function RecuperarContrasena() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      const { error: errorAuth } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/restablecer`,
      });
      if (errorAuth) throw errorAuth;
      setEnviado(true);
    } catch (err) {
      setError(traducirError(err as Error).mensaje);
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <Layout>
        <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
          <div className="rounded-xl border bg-white p-8 text-center shadow-vm-1">
            <MailCheck className="mx-auto size-10 text-vm-primary" aria-hidden />
            <h1 className="mt-5 text-2xl">Revisa tu correo</h1>
            <p className="mt-3 text-sm leading-relaxed text-vm-body">
              Si <span className="font-medium text-vm-ink">{email}</span> tiene una cuenta, te
              enviamos un enlace para crear una nueva contraseña.
            </p>
            <Link
              to="/login"
              className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-lg border text-sm font-medium text-vm-ink hover:bg-vm-bg-soft"
            >
              Volver a entrar
            </Link>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
        <h1 className="text-center text-3xl">Recupera tu contraseña</h1>
        <p className="mt-3 text-center text-sm text-vm-body">
          Escribe tu correo y te mandamos un enlace para crear una nueva.
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

          {error && (
            <p className="flex items-center gap-1.5 rounded-lg bg-vm-danger-soft px-3.5 py-2.5 text-sm text-vm-danger">
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando || !email.includes("@")}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Enviar enlace
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-vm-body">
          ¿Ya la recordaste?{" "}
          <Link to="/login" className="font-medium text-vm-primary hover:underline">
            Entra aquí
          </Link>
        </p>
      </section>
    </Layout>
  );
}
