import { Facebook, Instagram } from "lucide-react";
import { filasContacto } from "@/components/menu/ContactoMenu";
import type { Sucursal, Tenant } from "@/types/database";

/**
 * Iconos de la cabecera del menu: redes sociales + contacto rápido (llamar,
 * WhatsApp, cómo llegar). Entran los cuatro en una fila sin romperse a varios
 * renglones ni competir por espacio con "Reseñas"/"Reservar", que se quedan
 * como pills con texto en `BarraInferior` — ésos sí conviene leerlos, no solo
 * reconocer el icono.
 *
 * No llevan color propio: usan `--menu-primario` y `--menu-texto`, asi que combinan
 * solos con lo que el dueno elija en Diseno. Un icono azul de Facebook sobre un
 * menu terracota se ve como un banner pegado encima.
 *
 * Las resenas de Google NO van aqui: ya viven como pill con etiqueta en
 * `BarraInferior`, siempre visible sin scrollear arriba. Repetirlas como un
 * icono suelto en la cabecera era el mismo enlace dos veces en la misma pantalla.
 */

/** lucide-react no trae TikTok. Trazo oficial de la nota musical, simplificado. */
function IconoTikTok({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .76-5.06V9.7a5.66 5.66 0 0 0-.76-.05A5.65 5.65 0 1 0 15.54 15.3V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.28 4.28 0 0 1-3.24-1.48z" />
    </svg>
  );
}

type IconoEnlace = {
  clave: string;
  etiqueta: string;
  href: string;
  externo: boolean;
  /** Los iconos de lucide son forwardRef; el de TikTok es una función. `ComponentType` cubre ambos. */
  Icono: React.ComponentType<{ className?: string }>;
};

const REDES: {
  clave: keyof Pick<Tenant, "facebook_url" | "instagram_url" | "tiktok_url">;
  etiqueta: string;
  Icono: IconoEnlace["Icono"];
}[] = [
  { clave: "instagram_url", etiqueta: "Instagram", Icono: Instagram },
  { clave: "facebook_url", etiqueta: "Facebook", Icono: Facebook },
  { clave: "tiktok_url", etiqueta: "TikTok", Icono: IconoTikTok },
];

function iconosDe(tenant: Tenant, sucursal: Sucursal | null): IconoEnlace[] {
  const redes = REDES.filter((r) => Boolean(tenant[r.clave])).map((r) => ({
    clave: r.clave,
    etiqueta: r.etiqueta,
    href: tenant[r.clave]!,
    externo: true,
    Icono: r.Icono,
  }));

  // Reseñas se queda fuera: ya es una pill con texto en BarraInferior.
  const contacto = filasContacto(tenant, sucursal)
    .filter((f) => f.etiqueta !== "Reseñas")
    .map((f) => ({
      clave: f.etiqueta,
      etiqueta: f.etiqueta,
      href: f.href,
      externo: f.externo,
      Icono: f.Icono,
    }));

  return [...contacto, ...redes];
}

/** Sin ningún icono, la cabecera no debe reservar espacio para la fila. */
export const tieneIconosContacto = (tenant: Tenant, sucursal: Sucursal | null): boolean =>
  iconosDe(tenant, sucursal).length > 0;

export default function RedesSociales({
  tenant,
  sucursal,
  sobreOscuro = false,
}: {
  tenant: Tenant;
  sucursal: Sucursal | null;
  /** En fondo completo el texto ya es blanco: los iconos también. */
  sobreOscuro?: boolean;
}) {
  const iconos = iconosDe(tenant, sucursal);
  if (iconos.length === 0) return null;

  const estilo = sobreOscuro
    ? { background: "rgba(255,255,255,0.14)", color: "#FFFFFF" }
    : {
        background: "color-mix(in srgb, var(--menu-primario) 10%, transparent)",
        color: "var(--menu-primario)",
      };

  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Contacto y redes sociales">
      {iconos.map(({ clave, etiqueta, href, externo, Icono }) => (
        <a
          key={clave}
          href={href}
          {...(externo ? { target: "_blank", rel: "noreferrer noopener" } : {})}
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
