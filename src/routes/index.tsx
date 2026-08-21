import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
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

// El loader tambien puede re-ejecutar en el navegador (navegacion cliente,
// p.ej. volver a "/" desde otra pagina). `getRequestHost` solo existe en el
// servidor, y ademas TanStack Start prohibe importar `.../server` en codigo
// que se empaqueta para el cliente — de ahi `createIsomorphicFn`, que separa
// las dos implementaciones por build en vez de una rama `typeof window`.
const obtenerHost = createIsomorphicFn()
  .server(() => getRequestHost() ?? "")
  .client(() => window.location.hostname);

export const Route = createFileRoute("/")({
  loader: async (): Promise<DatosMenu | null> => {
    const host = obtenerHost().replace(/:\d+$/, "").toLowerCase();
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
