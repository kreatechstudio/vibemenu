import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, Building2, Loader2, MailWarning } from "lucide-react";
import Layout from "@/components/layout/Layout";
import BotonGoogle from "@/components/ui/boton-google";
import { supabase } from "@/lib/supabase";
import { cerrarSesion, useSesion } from "@/hooks/useSesion";
import { useAceptarInvitacion, useInvitacionInfo } from "@/hooks/useInvitacion";
import { traducirErrorEdge } from "@/lib/erroresEdge";

function Tarjeta({ children }: { children: React.ReactNode }) {
  return (
    <Layout>
      <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
        <div className="rounded-xl border bg-white p-8 text-center shadow-vm-1">{children}</div>
      </section>
    </Layout>
  );
}

function Mensaje({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <>
      <MailWarning className="mx-auto size-10 text-vm-body" aria-hidden />
      <h1 className="mt-5 text-2xl">{titulo}</h1>
      <p className="mt-3 text-sm leading-relaxed text-vm-body">{texto}</p>
    </>
  );
}

export default function AceptarInvitacion({ token }: { token: string }) {
  const navigate = useNavigate();
  const { user, cargando: cargandoSesion } = useSesion();
  const { data: info, isLoading: cargandoInfo, isError } = useInvitacionInfo(token);
  const aceptar = useAceptarInvitacion();

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (cargandoSesion || cargandoInfo) {
    return (
      <Tarjeta>
        <Loader2 className="mx-auto size-6 animate-spin text-vm-primary" aria-hidden />
        <p className="mt-4 text-sm text-vm-body">Revisando tu invitación…</p>
      </Tarjeta>
    );
  }

  if (isError || !info) {
    return (
      <Tarjeta>
        <Mensaje
          titulo="Ese enlace no es válido"
          texto="Puede que ya lo hayas usado o que esté mal copiado. Pide que te reenvíen la invitación."
        />
      </Tarjeta>
    );
  }

  if (info.estado === "cancelada") {
    return (
      <Tarjeta>
        <Mensaje
          titulo="Esta invitación fue cancelada"
          texto={`El dueño de ${info.tenant_nombre} la canceló. Pídele que te invite de nuevo si sigue en pie.`}
        />
      </Tarjeta>
    );
  }

  if (info.estado === "aceptada") {
    return (
      <Tarjeta>
        <Mensaje
          titulo="Ya aceptaste esta invitación"
          texto={`Tu cuenta ya administra ${info.tenant_nombre}. Entra normalmente desde el login.`}
        />
      </Tarjeta>
    );
  }

  if (new Date(info.expira_at) < new Date()) {
    return (
      <Tarjeta>
        <Mensaje
          titulo="Esta invitación venció"
          texto={`Pídele al dueño de ${info.tenant_nombre} que te invite de nuevo desde Equipo.`}
        />
      </Tarjeta>
    );
  }

  // Se desestructura una vez: TypeScript no arrastra el narrowing de `info`
  // (que viene de useQuery) dentro de las funciones anidadas de abajo.
  const {
    email: correoInvitacion,
    tenant_nombre: nombreNegocio,
    cuenta_existente: cuentaExistente,
  } = info;
  const sesionCoincide = Boolean(
    user?.email && user.email.toLowerCase() === correoInvitacion.toLowerCase(),
  );

  async function alAceptarConSesion() {
    setError(null);
    setEnviando(true);
    try {
      await aceptar.mutateAsync({ token });
      await navigate({ to: "/admin" });
    } catch (err) {
      setError(await traducirErrorEdge(err));
    } finally {
      setEnviando(false);
    }
  }

  async function alCrearCuenta(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setEnviando(true);
    try {
      await aceptar.mutateAsync({ token, password });
      const { error: errorLogin } = await supabase.auth.signInWithPassword({
        email: correoInvitacion,
        password,
      });
      if (errorLogin) throw errorLogin;
      await navigate({ to: "/admin" });
    } catch (err) {
      setError(await traducirErrorEdge(err));
    } finally {
      setEnviando(false);
    }
  }

  async function alIniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const { error: errorLogin } = await supabase.auth.signInWithPassword({
        email: correoInvitacion,
        password: loginPassword,
      });
      if (errorLogin) {
        setError(
          errorLogin.message === "Invalid login credentials"
            ? "Correo o contraseña incorrectos."
            : errorLogin.message,
        );
        return;
      }
      await aceptar.mutateAsync({ token });
      await navigate({ to: "/admin" });
    } catch (err) {
      setError(await traducirErrorEdge(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tarjeta>
      <Building2 className="mx-auto size-10 text-vm-primary" aria-hidden />
      <h1 className="mt-5 text-2xl">Únete a {nombreNegocio}</h1>
      <p className="mt-3 text-sm leading-relaxed text-vm-body">
        Te invitaron como encargado con{" "}
        <span className="font-medium text-vm-ink">{correoInvitacion}</span>.
      </p>

      {error && (
        <p className="mt-5 flex items-center gap-1.5 rounded-lg bg-vm-danger-soft px-3.5 py-2.5 text-left text-sm text-vm-danger">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {/* Caso 1: el correo ya tiene cuenta, pero con otra sesión abierta. */}
      {cuentaExistente && user && !sesionCoincide && (
        <div className="mt-6 text-left">
          <p className="text-sm text-vm-body">
            Tienes la sesión de <span className="font-medium text-vm-ink">{user.email}</span>{" "}
            abierta, pero esta invitación es para otro correo.
          </p>
          <button
            type="button"
            onClick={() => void cerrarSesion()}
            className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-lg border text-sm font-medium text-vm-ink hover:bg-vm-bg-soft"
          >
            Cerrar sesión y volver a intentar
          </button>
        </div>
      )}

      {/* Caso 2: el correo ya tiene cuenta y ya es la sesión activa. */}
      {cuentaExistente && sesionCoincide && (
        <button
          type="button"
          disabled={enviando}
          onClick={() => void alAceptarConSesion()}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white hover:bg-vm-primary-hover disabled:opacity-50"
        >
          {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Aceptar y entrar
        </button>
      )}

      {/* Caso 3: el correo ya tiene cuenta, sin sesión — hay que probarla. */}
      {cuentaExistente && !user && (
        <div className="mt-6 text-left">
          <p className="mb-4 text-sm text-vm-body">
            Ese correo ya tiene cuenta en Vibemenu. Inicia sesión para aceptar.
          </p>
          <form onSubmit={alIniciarSesion} className="space-y-4">
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="Tu contraseña"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
            <button
              type="submit"
              disabled={enviando}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white hover:bg-vm-primary-hover disabled:opacity-50"
            >
              {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Iniciar sesión y aceptar
            </button>
          </form>
          <div className="my-4 flex items-center gap-3 text-xs text-vm-body">
            <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
          </div>
          <BotonGoogle rutaRegreso={`/invitacion/${token}`} />
        </div>
      )}

      {/* Caso 4: correo sin cuenta todavía — crea el acceso en el mismo paso. */}
      {!cuentaExistente && (
        <form onSubmit={alCrearCuenta} className="mt-6 space-y-4 text-left">
          <div>
            <label htmlFor="password" className="text-sm font-medium text-vm-ink">
              Elige una contraseña
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
          <div>
            <label htmlFor="password2" className="text-sm font-medium text-vm-ink">
              Confírmala
            </label>
            <input
              id="password2"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="mt-2 h-12 w-full rounded-lg border px-4 text-sm outline-none focus:border-vm-primary focus:ring-2 focus:ring-vm-primary/20"
            />
          </div>
          <button
            type="submit"
            disabled={enviando}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-vm-primary text-sm font-medium text-white hover:bg-vm-primary-hover disabled:opacity-50"
          >
            {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Crear acceso y entrar
          </button>
        </form>
      )}
    </Tarjeta>
  );
}
