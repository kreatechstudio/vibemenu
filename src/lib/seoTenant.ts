import type { MenuPublico } from "@/hooks/useMenuPublico";
import { resolverTema } from "@/lib/tema";
import { EMPRESA } from "@/lib/legal";
import type { FormatoMenu } from "@/types/database";

/**
 * Meta tags Open Graph/Twitter del menu publico de un tenant. Sobrescriben las
 * genericas de __root.tsx (mismo `name`/`property`, ver headContentUtils de
 * TanStack Router) para que cada restaurante comparta su propio nombre y logo
 * al pegar el link en WhatsApp o Instagram, no el branding de Vibemenu.
 *
 * Aplica a todos los planes por igual: compartir el menu es el uso central del
 * producto, no un perk de pago — lo unico que sí varia por plan es la marca de
 * agua "Hecho con Vibemenu" dentro del menu, ajena a estas meta tags.
 */
export function metaMenuPublico(menu: MenuPublico, ruta: string, host: string = EMPRESA.dominio) {
  const { tenant, formato, sucursalActiva } = menu;
  const tema = resolverTema(tenant.tema, formato as FormatoMenu);

  const titulo = sucursalActiva
    ? `${tenant.nombre_negocio} — ${sucursalActiva.nombre}`
    : `${tenant.nombre_negocio} — Menú digital`;

  const descripcion =
    tenant.descripcion?.trim() || `Consulta el menú de ${tenant.nombre_negocio} en Vibemenu.`;

  // El og-image generico vive solo en vibemenu.com.mx: un dominio propio sin
  // logo se queda sin imagen antes que enlazar a un host que no es el suyo.
  const imagen =
    tenant.logo_url ??
    tema.imagen_fondo_url ??
    (host === EMPRESA.dominio ? `https://${EMPRESA.dominio}/og-image.png` : undefined);

  const url = `https://${host}${ruta}`;

  return [
    { title: titulo },
    { name: "description", content: descripcion },
    { property: "og:title", content: titulo },
    { property: "og:description", content: descripcion },
    { property: "og:type", content: "website" },
    { property: "og:url", content: url },
    ...(imagen ? [{ property: "og:image", content: imagen }] : []),
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: titulo },
    { name: "twitter:description", content: descripcion },
    ...(imagen ? [{ name: "twitter:image", content: imagen }] : []),
  ];
}
