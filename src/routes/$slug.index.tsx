import { createFileRoute, notFound } from "@tanstack/react-router";
import MenuPublico from "@/pages/MenuPublico";
import MenuNoEncontrado from "@/components/menu/MenuNoEncontrado";
import { menuExiste } from "@/lib/menuExiste";

export const Route = createFileRoute("/$slug/")({
  // El loader corre en el servidor: un slug inexistente responde 404 de verdad,
  // no un 200 con el esqueleto de carga dentro.
  loader: async ({ params }) => {
    if (!(await menuExiste(params.slug))) throw notFound();
  },
  component: RouteComponent,
  notFoundComponent: MenuNoEncontrado,
});

function RouteComponent() {
  const { slug } = Route.useParams();
  return <MenuPublico slug={slug} />;
}
