import { createFileRoute } from "@tanstack/react-router";
import { getRequestHost } from "@tanstack/react-start/server";
import Index from "@/pages/Index";
import MenuPublico from "@/pages/MenuPublico";
import {
  obtenerMenuPublicoPorDominio,
  type MenuPublico as DatosMenu,
} from "@/hooks/useMenuPublico";
import { metaMenuPublico } from "@/lib/seoTenant";
import { EMPRESA } from "@/lib/legal";

/**
 * vibemenu.com.mx (con o sin www), localhost y los previews de Vercel sirven
 * el landing normal. Cualquier otro host es candidato a dominio personalizado
 * de un tenant en plan Pro — ver migracion 013. `host` ya llega sin puerto y
 * en minusculas.
 */
function esDominioPrincipal(host: string): boolean {
  return (
    host === EMPRESA.dominio ||
    host === `www.${EMPRESA.dominio}` ||
    host === "localhost" ||
    host.endsWith(".vercel.app")
  );
}

export const Route = createFileRoute("/")({
  // El loader tambien puede re-ejecutar en el navegador (navegacion cliente,
  // p.ej. volver a "/" desde otra pagina) — `getRequestHost` revienta ahi
  // porque no hay AsyncLocalStorage de request fuera del servidor. En el
  // cliente el host real ya esta en `window.location`, sin falta de llamarlo.
  loader: async (): Promise<DatosMenu | null> => {
    const hostCrudo =
      typeof window === "undefined" ? (getRequestHost() ?? "") : window.location.hostname;
    const host = hostCrudo.replace(/:\d+$/, "").toLowerCase();
    if (esDominioPrincipal(host)) return null;
    return obtenerMenuPublicoPorDominio(host);
  },
  // Sin esto, un menu servido en dominio propio compartiria en WhatsApp/Instagram
  // el titulo e imagen genericos de Vibemenu en vez de los del negocio.
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: metaMenuPublico(
            loaderData,
            "/",
            loaderData.tenant.dominio_personalizado ?? EMPRESA.dominio,
          ),
        }
      : {},
  component: RouteComponent,
});

function RouteComponent() {
  const menu = Route.useLoaderData();
  // Sin match: no es un error del dominio, tal vez el DNS aun no propaga o el
  // dueno todavia no configura nada. Se cae al landing en vez de un 404 feo.
  if (!menu) return <Index />;
  return <MenuPublico slug={menu.tenant.slug} inicial={menu} />;
}
