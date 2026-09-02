import { createFileRoute } from "@tanstack/react-router";
import TarjetaLealtad from "@/pages/TarjetaLealtad";

export const Route = createFileRoute("/$slug/lealtad/$tarjetaId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { slug, tarjetaId } = Route.useParams();
  return <TarjetaLealtad slug={slug} tarjetaId={tarjetaId} />;
}
