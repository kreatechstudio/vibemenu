import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";
import BotonGoogle from "@/components/ui/boton-google";
import Captcha, { captchaHabilitado, type TurnstileInstance } from "@/components/ui/captcha";
import { supabase } from "@/lib/supabase";
import { traducirError } from "@/lib/errores";
import { traducirErrorAuth } from "@/lib/erroresAuth";

type PasoCuentaProps = {
  onListo: () => void;
  onConfirmarCorreo: (email: string) => void;
};

export default function PasoCuenta({ onListo, onConfirmarCorreo }: PasoCuentaProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileInstance>(null);

  const puedeEnviar =
    email.includes("@") &&
    password.length >= 6 &&
    (!captchaHabilitado || captchaToken !== null) &&
    !enviando;

  async function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      const { data, error: errorAuth } = await supabase.auth.signUp({
        email,
        password,
        options: captchaToken ? { captchaToken } : undefined,
      });
      if (errorAuth) throw errorAuth;

      // Con confirmación de correo activa y protección contra enumeración de
      // usuarios, signUp de un correo YA registrado no devuelve error: trae un
      // `user` con `identities` vacío y no manda ningún correo. Sin esto, el
      // usuario ve "Confirma tu correo" y espera un enlace que nunca llega.
      if (data.user && data.user.identities?.length === 0) {
        setError("Ese correo ya tiene una cuenta. Entra desde abajo con tu contraseña.");
        captchaRef.current?.reset();
        setCaptchaToken(null);
        return;
      }

      if (!data.session) {
        onConfirmarCorreo(email);
        return;
      }

      onListo();
    } catch (err) {
      setError(traducirErrorAuth(err) ?? traducirError(err as Error).mensaje);
      captchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl text-vm-ink">Crea tu cuenta</h1>
      <p className="mt-2 text-sm text-vm-body">El primer paso para tener tu menú digital.</p>

      <form onSubmit={alEnviar} className="mt-6 space-y-5">
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

        {error && (
          <p className="flex items-center gap-1.5 rounded-lg bg-vm-danger-soft px-3.5 py-2.5 text-sm text-vm-danger">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <p className="text-xs leading-relaxed text-vm-body">
          Al crear tu cuenta aceptas el{" "}
          <Link to="/privacidad" className="text-vm-primary hover:underline">
            Aviso de Privacidad
          </Link>{" "}
          de Vibemenu.
        </p>

        <Captcha ref={captchaRef} onToken={setCaptchaToken} />

        <button
          type="submit"
          disabled={!puedeEnviar}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white transition-colors hover:bg-vm-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Crear cuenta
        </button>

        <div className="flex items-center gap-3 text-xs text-vm-body">
          <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
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
  );
}
