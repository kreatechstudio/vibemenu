import { createFileRoute, notFound } from "@tanstack/react-router";
import MenuPublicoSucursal from "@/pages/MenuPublicoSucursal";
import MenuNoEncontrado from "@/components/menu/MenuNoEncontrado";
import { menuExiste } from "@/lib/menuExiste";

export const Route = createFileRoute("/$slug/sucursal/$sucursalSlug")({
  // Una sucursal inexistente, o de otro negocio, tambien es un 404.
  loader: async ({ params }) => {
    if (!(await menuExiste(params.slug, params.sucursalSlug))) throw notFound();
  },
  component: RouteComponent,
  notFoundComponent: MenuNoEncontrado,
});

function RouteComponent() {
  const { slug, sucursalSlug } = Route.useParams();
  return <MenuPublicoSucursal slug={slug} sucursalSlug={sucursalSlug} />;
}
