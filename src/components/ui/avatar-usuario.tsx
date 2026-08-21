import { cn } from "@/lib/utils";

const inicial = (nombre: string) => nombre.trim().charAt(0).toUpperCase() || "?";

const TAMANOS = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
} as const;

/**
 * Foto de perfil (de Google, si inició sesión así) o iniciales como respaldo —
 * cubre por igual a quien entró con Google y a quien usa email/password.
 */
export default function AvatarUsuario({
  nombre,
  avatarUrl,
  tamano = "sm",
}: {
  nombre: string;
  avatarUrl?: string | null;
  tamano?: keyof typeof TAMANOS;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={nombre}
        // Google bloquea la imagen si el navegador manda referrer: sin esto,
        // la foto sale rota en algunos navegadores con politicas estrictas.
        referrerPolicy="no-referrer"
        className={cn("shrink-0 rounded-full object-cover", TAMANOS[tamano])}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-vm-primary/10 font-medium text-vm-primary",
        TAMANOS[tamano],
      )}
    >
      {inicial(nombre)}
    </span>
  );
}
