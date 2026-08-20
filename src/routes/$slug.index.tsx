import { createFileRoute, notFound } from "@tanstack/react-router";
import MenuPublico from "@/pages/MenuPublico";
import MenuNoEncontrado from "@/components/menu/MenuNoEncontrado";
import { obtenerMenuPublico } from "@/hooks/useMenuPublico";

export const Route = createFileRoute("/$slug/")({
  // El menú se arma en el servidor. Dos razones: un slug inexistente responde un
  // 404 de verdad, y la carta viaja en el HTML inicial, así que Google la indexa.
  loader: async ({ params }) => {
    const menu = await obtenerMenuPublico(params.slug);
    if (!menu) throw notFound();
    return menu;
  },
  component: RouteComponent,
  notFoundComponent: MenuNoEncontrado,
});

function RouteComponent() {
  const { slug } = Route.useParams();
  return <MenuPublico slug={slug} inicial={Route.useLoaderData()} />;
}
