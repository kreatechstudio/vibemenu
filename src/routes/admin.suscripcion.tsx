import { createFileRoute } from "@tanstack/react-router";
import Suscripcion from "@/pages/admin/Suscripcion";

export const Route = createFileRoute("/admin/suscripcion")({
  component: Suscripcion,
});
