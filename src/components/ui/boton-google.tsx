import { supabase } from "@/lib/supabase";

/** Logo oficial de Google en cuatro colores, tal cual lo pide su guía de marca. */
function LogoGoogle() {
  return (
    <svg className="size-4.5" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2.1 1.5-4.7 2.4-7.6 2.4-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5C41.4 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}

/**
 * Redirige a Google. supabase-js crea el usuario en auth.users si no existe
 * — el aterrizaje en /auth/completar decide si va al panel o a onboarding.
 *
 * `rutaRegreso` cambia ese aterrizaje: /invitacion/:token lo usa para volver
 * a la misma invitación tras el login, en vez de a /auth/completar.
 */
async function iniciarLoginGoogle(rutaRegreso: string) {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${rutaRegreso}` },
  });
}

export default function BotonGoogle({ rutaRegreso = "/auth/completar" }: { rutaRegreso?: string }) {
  return (
    <button
      type="button"
      onClick={() => void iniciarLoginGoogle(rutaRegreso)}
      className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-lg border text-sm font-medium text-vm-ink transition-colors hover:bg-vm-bg-soft"
    >
      <LogoGoogle />
      Continuar con Google
    </button>
  );
}
