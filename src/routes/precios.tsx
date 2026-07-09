import { createFileRoute } from "@tanstack/react-router";
import Precios from "@/pages/Precios";
import { obtenerPlanes } from "@/hooks/usePlanes";

export const Route = createFileRoute("/precios")({
  // Los planes se cargan en el servidor: la tabla comparativa tiene que estar en
  // el HTML inicial. Es una pagina de precios; si Google no la ve, no existe.
  loader: () => obtenerPlanes(),
  component: RouteComponent,
});

function RouteComponent() {
  const planes = Route.useLoaderData();
  return <Precios planesIniciales={planes} />;
}
