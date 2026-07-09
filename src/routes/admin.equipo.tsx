import { createFileRoute } from "@tanstack/react-router";
import Equipo from "@/pages/admin/Equipo";

export const Route = createFileRoute("/admin/equipo")({
  component: Equipo,
});
