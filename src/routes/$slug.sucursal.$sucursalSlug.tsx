import { createFileRoute, notFound } from "@tanstack/react-router";
import MenuPublicoSucursal from "@/pages/MenuPublicoSucursal";
import MenuNoEncontrado from "@/components/menu/MenuNoEncontrado";
import { obtenerMenuPublico } from "@/hooks/useMenuPublico";

export const Route = createFileRoute("/$slug/sucursal/$sucursalSlug")({
  // Una sucursal inexistente, o de otro negocio, tambien es un 404.
  loader: async ({ params }) => {
    const menu = await obtenerMenuPublico(params.slug, params.sucursalSlug);
    if (!menu) throw notFound();
    return menu;
  },
  component: RouteComponent,
  notFoundComponent: MenuNoEncontrado,
});

function RouteComponent() {
  const { slug, sucursalSlug } = Route.useParams();
  return (
    <MenuPublicoSucursal slug={slug} sucursalSlug={sucursalSlug} inicial={Route.useLoaderData()} />
  );
}
