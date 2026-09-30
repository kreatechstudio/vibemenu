import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import MenuPublico from "@/pages/MenuPublico";
import MenuNoEncontrado from "@/components/menu/MenuNoEncontrado";
import SeleccionarSucursal from "@/pages/SeleccionarSucursal";
import { obtenerMenuPublico } from "@/hooks/useMenuPublico";
import { metaMenuPublico } from "@/lib/seoTenant";

export const Route = createFileRoute("/$slug/")({
  // El menú se arma en el servidor. Dos razones: un slug inexistente responde un
  // 404 de verdad, y la carta viaja en el HTML inicial, así que Google la indexa.
  loader: async ({ params }) => {
    const menu = await obtenerMenuPublico(params.slug);
    if (!menu) throw notFound();

    // Con sucursales, el catálogo "general" sin filtrar deja de servirse aquí:
    // cada link público debe resolver a una sucursal real para que lealtad,
    // reseñas y reservaciones queden bien atribuidas. Con exactamente una,
    // redirige directo (302, no un salto en el cliente); con varias, se elige.
    // Sin ninguna (hoy solo cuentas en trial que aún no crean la suya), sigue
    // sirviéndose el genérico tal cual — nada cambia para ellas.
    if (menu.sucursales.length === 1) {
      throw redirect({
        to: "/$slug/sucursal/$sucursalSlug",
        params: { slug: params.slug, sucursalSlug: menu.sucursales[0].slug },
      });
    }

    return menu;
  },
  head: ({ loaderData, params }) =>
    loaderData ? { meta: metaMenuPublico(loaderData, `/${params.slug}`) } : {},
  component: RouteComponent,
  notFoundComponent: MenuNoEncontrado,
});

function RouteComponent() {
  const { slug } = Route.useParams();
  const menu = Route.useLoaderData();
  if (menu.sucursales.length > 1) return <SeleccionarSucursal menu={menu} />;
  return <MenuPublico slug={slug} inicial={menu} />;
}
