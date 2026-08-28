import { Facebook, Instagram, Star } from "lucide-react";
import type { Tenant } from "@/types/database";

/**
 * Enlaces del negocio en la cabecera del menu.
 *
 * No llevan color propio: usan `--menu-primario` y `--menu-texto`, asi que combinan
 * solos con lo que el dueno elija en Diseno. Un icono azul de Facebook sobre un
 * menu terracota se ve como un banner pegado encima.
 *
 * Las resenas de Google van como estrella, no como la "G" multicolor: es el unico
 * de los cuatro que no es una red social, y lo que el comensal busca ahi es la
 * calificacion.
 */

/** lucide-react no trae TikTok. Trazo oficial de la nota musical, simplificado. */
function IconoTikTok({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .76-5.06V9.7a5.66 5.66 0 0 0-.76-.05A5.65 5.65 0 1 0 15.54 15.3V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.28 4.28 0 0 1-3.24-1.48z" />
    </svg>
  );
}

type Enlace = {
  clave: keyof Pick<Tenant, "facebook_url" | "instagram_url" | "tiktok_url" | "google_reviews_url">;
  etiqueta: string;
  /** Los iconos de lucide son forwardRef; el de TikTok es una función. `ComponentType` cubre ambos. */
  Icono: React.ComponentType<{ className?: string }>;
};

const ENLACES: Enlace[] = [
  { clave: "instagram_url", etiqueta: "Instagram", Icono: Instagram },
  { clave: "facebook_url", etiqueta: "Facebook", Icono: Facebook },
  { clave: "tiktok_url", etiqueta: "TikTok", Icono: IconoTikTok },
  { clave: "google_reviews_url", etiqueta: "Reseñas en Google", Icono: Star },
];

/**
 * Href real de cada enlace. Para reseñas, `resenasUrlOverride` (si se pasa,
 * incluido `null` explícito) manda sobre `tenant.google_reviews_url` — así la
 * cabecera de una sucursal apunta a las reseñas de ESA sucursal.
 */
function hrefDe(
  tenant: Tenant,
  clave: Enlace["clave"],
  resenasUrlOverride: string | null | undefined,
): string | null {
  if (clave === "google_reviews_url" && resenasUrlOverride !== undefined) {
    return resenasUrlOverride;
  }
  return tenant[clave] ?? null;
}

/** Sin ningún enlace, la cabecera no debe reservar espacio para la fila. */
export const tieneRedes = (tenant: Tenant, resenasUrlOverride?: string | null): boolean =>
  ENLACES.some(({ clave }) => Boolean(hrefDe(tenant, clave, resenasUrlOverride)));

export default function RedesSociales({
  tenant,
  sobreOscuro = false,
  resenasUrlOverride,
}: {
  tenant: Tenant;
  /** En fondo completo el texto ya es blanco: los iconos también. */
  sobreOscuro?: boolean;
  /** Reseñas de la sucursal activa (o null si no tiene ni ella ni la empresa). */
  resenasUrlOverride?: string | null;
}) {
  // Sin la migración 007 estas columnas llegan como `undefined`, no como null.
  const visibles = ENLACES.filter(({ clave }) =>
    Boolean(hrefDe(tenant, clave, resenasUrlOverride)),
  );
  if (visibles.length === 0) return null;

  const estilo = sobreOscuro
    ? { background: "rgba(255,255,255,0.14)", color: "#FFFFFF" }
    : {
        background: "color-mix(in srgb, var(--menu-primario) 10%, transparent)",
        color: "var(--menu-primario)",
      };

  return (
    <nav className="flex items-center gap-2" aria-label="Redes sociales">
      {visibles.map(({ clave, etiqueta, Icono }) => (
        <a
          key={clave}
          href={hrefDe(tenant, clave, resenasUrlOverride)!}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={etiqueta}
          title={etiqueta}
          className="grid size-9 place-items-center rounded-full transition-opacity hover:opacity-75"
          style={estilo}
        >
          <Icono className="size-4" />
        </a>
      ))}
    </nav>
  );
}
