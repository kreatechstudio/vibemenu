import { createFileRoute } from "@tanstack/react-router";
import MenuPublicoSucursal from "@/pages/MenuPublicoSucursal";

export const Route = createFileRoute("/$slug/sucursal/$sucursalSlug")({
  component: RouteComponent,
});

function RouteComponent() {
  const { slug, sucursalSlug } = Route.useParams();
  return <MenuPublicoSucursal slug={slug} sucursalSlug={sucursalSlug} />;
}
