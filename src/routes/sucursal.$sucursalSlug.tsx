import { createFileRoute, notFound } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import MenuPublicoSucursal from "@/pages/MenuPublicoSucursal";
import MenuNoEncontrado from "@/components/menu/MenuNoEncontrado";
import { obtenerSucursalPublicaPorDominio } from "@/hooks/useMenuPublico";
import { metaMenuPublico } from "@/lib/seoTenant";

// Equivalente, bajo dominio propio, de $slug.sucursal.$sucursalSlug.tsx. Solo
// tiene sentido si el Host de la peticion es un dominio personalizado -- en
// vibemenu.com.mx esta ruta no existe (el patron es /<slug>/sucursal/<slug>).
const obtenerHost = createIsomorphicFn()
  .server(() => getRequestHost() ?? "")
  .client(() => window.location.hostname);

export const Route = createFileRoute("/sucursal/$sucursalSlug")({
  loader: async ({ params }) => {
    const host = obtenerHost().replace(/:\d+$/, "").toLowerCase();
    const menu = await obtenerSucursalPublicaPorDominio(host, params.sucursalSlug);
    if (!menu) throw notFound();
    return menu;
  },
  head: ({ loaderData, params }) =>
    loaderData
      ? {
          meta: metaMenuPublico(
            loaderData,
            `/sucursal/${params.sucursalSlug}`,
            loaderData.tenant.dominio_personalizado ?? undefined,
          ),
        }
      : {},
  component: RouteComponent,
  notFoundComponent: MenuNoEncontrado,
});

function RouteComponent() {
  const { sucursalSlug } = Route.useParams();
  const menu = Route.useLoaderData();
  return <MenuPublicoSucursal slug={menu.tenant.slug} sucursalSlug={sucursalSlug} inicial={menu} />;
}
