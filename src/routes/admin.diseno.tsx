import { createFileRoute } from "@tanstack/react-router";
import Diseno from "@/pages/admin/Diseno";

export const Route = createFileRoute("/admin/diseno")({
  component: Diseno,
  validateSearch: (buscar: Record<string, unknown>): { tour?: boolean } => ({
    tour: buscar.tour ? true : undefined,
  }),
});
