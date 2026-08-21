import { createFileRoute } from "@tanstack/react-router";
import AceptarInvitacion from "@/pages/AceptarInvitacion";

export const Route = createFileRoute("/invitacion/$token")({
  component: RouteComponent,
});

function RouteComponent() {
  const { token } = Route.useParams();
  return <AceptarInvitacion token={token} />;
}
