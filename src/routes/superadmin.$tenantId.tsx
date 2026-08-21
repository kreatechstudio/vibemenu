import { createFileRoute } from "@tanstack/react-router";
import SuperAdminDetalle from "@/pages/SuperAdminDetalle";

export const Route = createFileRoute("/superadmin/$tenantId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { tenantId } = Route.useParams();
  return <SuperAdminDetalle tenantId={tenantId} />;
}
